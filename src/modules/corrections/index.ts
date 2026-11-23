/**
 * Corrections & HR Reviews module (Technical Design v1.0 sections 8, 9, and 10).
 *
 * Implements:
 * - Immutable intern correction proposals with clientRequestId idempotency,
 *   same-local-date validation, atomic supersession of prior open proposals,
 *   and atomic review_job enqueueing.
 * - Clarification comments (owner or HR) that increment requestVersion, move
 *   NEEDS_INFO back to PENDING on intern reply, and enqueue a fresh review_job.
 * - Version-fenced HR decisions (APPROVE / REJECT / NEEDS_INFO) with
 *   operationKey + payloadHash idempotency, parent Internship locking, atomic
 *   AttendanceSession update/creation + AttendanceRevision + AuditEvent.
 * - Queue, detail, and intern read models with role-scoped evidence.
 */

import type { CorrectionReasonCategory, HrDecision, Prisma } from "@prisma/client";

import { calculateDailyCredit, officeLocalToUtc } from "@/domain/calculation/engine";
import { parseStoredPolicy } from "@/domain/policy/schemas";
import type { ActiveInternActor, AuthenticatedActor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { canonicalPayloadHash, getDbErrorCode, withTransientDbRetry } from "@/lib/http/guard";
import { hrReasonLabel, type CorrectionReason, type RecordedDay } from "@/lib/ui/correction-form";
import { workdaysBetween } from "@/lib/ui/dtr";
import { formatClock, formatShortDate, officeDateIso } from "@/lib/ui/format";
import type {
  CorrectionDetailVM,
  CorrectionMessageVM,
  CorrectionSummaryVM,
  InternCorrectionsVM,
  JevReadingVM,
  NewCorrectionVM,
  ReviewDetailVM,
  ReviewEvidenceVM,
  ReviewQueueVM,
  ReviewRowVM,
  ReviewTab,
} from "@/lib/ui/view-models";
import { aggregateDayCredits, dateToIso, policyToUiRules } from "@/modules/attendance/credit";
import { recordAuditEvent } from "@/modules/audit";
import { buildMinimizedJevContext, JEV_CRITERIA_VERSION, JEV_MODEL_VERSION } from "@/worker/context";

export interface CreateCorrectionInput {
  readonly actorId: string;
  readonly internshipId: string;
  readonly sessionId?: string;
  readonly replaceRequestId?: string;
  readonly attendanceDate: string;
  readonly reason: CorrectionReason;
  readonly explanation: string;
  readonly proposedTimeIn?: string;
  readonly proposedTimeOut?: string;
  readonly clientRequestId: string;
  readonly correlationId: string;
}

export interface CreateCorrectionResult {
  readonly id: string;
  readonly correctionRequestId: string;
  readonly requestVersion: number;
  readonly status: "PENDING";
}

export interface DecideCorrectionInput {
  readonly correctionRequestId: string;
  readonly reviewerUserId: string;
  readonly operationKey: string;
  readonly decision: HrDecision;
  readonly note: string;
  readonly expectedRequestVersion: number;
  readonly expectedSessionVersion?: number | null;
  readonly expectedAttendanceVersion?: number;
  readonly correlationId: string;
}

export interface DecideCorrectionResult {
  readonly reviewId: string;
  readonly status: "APPROVED" | "REJECTED" | "NEEDS_INFO";
  readonly version: number;
}

function toPrismaReasonCategory(reason: CorrectionReason): CorrectionReasonCategory {
  switch (reason) {
    case "missed_clock_in":
      return "MISSED_CLOCK_IN";
    case "missed_clock_out":
      return "MISSED_CLOCK_OUT";
    case "wrong_action":
      return "WRONG_ACTION";
    case "technical_issue":
      return "TECHNICAL_ISSUE";
    default:
      return "OTHER";
  }
}

function fromPrismaReasonCategory(category: CorrectionReasonCategory): CorrectionReason {
  switch (category) {
    case "MISSED_CLOCK_IN":
      return "missed_clock_in";
    case "MISSED_CLOCK_OUT":
      return "missed_clock_out";
    case "WRONG_ACTION":
      return "wrong_action";
    case "TECHNICAL_ISSUE":
      return "technical_issue";
    default:
      return "other";
  }
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

async function enqueueReviewJob(
  tx: Prisma.TransactionClient,
  input: {
    readonly correctionRequestId: string;
    readonly requestVersion: number;
    readonly reasonCategory: CorrectionReasonCategory;
    readonly explanation: string;
    readonly comments: readonly { readonly role: "INTERN" | "HR"; readonly message: string }[];
    readonly hasExistingSession: boolean;
    readonly hasRecordedTimeIn: boolean;
    readonly hasRecordedTimeOut: boolean;
    readonly proposesTimeIn: boolean;
    readonly proposesTimeOut: boolean;
  },
): Promise<void> {
  const minimized = buildMinimizedJevContext({
    requestVersion: input.requestVersion,
    reasonCategory: input.reasonCategory,
    explanation: input.explanation,
    comments: input.comments,
    facts: {
      hasExistingSession: input.hasExistingSession,
      hasRecordedTimeIn: input.hasRecordedTimeIn,
      hasRecordedTimeOut: input.hasRecordedTimeOut,
      proposesTimeIn: input.proposesTimeIn,
      proposesTimeOut: input.proposesTimeOut,
    },
  });

  await tx.reviewJob.upsert({
    where: {
      correctionRequestId_inputFingerprint_modelVersion_criteriaVersion: {
        correctionRequestId: input.correctionRequestId,
        inputFingerprint: minimized.inputFingerprint,
        modelVersion: JEV_MODEL_VERSION,
        criteriaVersion: JEV_CRITERIA_VERSION,
      },
    },
    update: {},
    create: {
      correctionRequestId: input.correctionRequestId,
      inputFingerprint: minimized.inputFingerprint,
      modelVersion: JEV_MODEL_VERSION,
      criteriaVersion: JEV_CRITERIA_VERSION,
      state: "PENDING",
      nextRunAtUtc: new Date(),
    },
  });
}

export async function createCorrection(input: CreateCorrectionInput): Promise<CreateCorrectionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.attendanceDate)) {
    throw new AppError(400, "VALIDATION_ERROR", "Attendance date must be YYYY-MM-DD.", false);
  }
  const explanation = input.explanation.trim();
  if (explanation.length < 15) {
    throw new AppError(400, "VALIDATION_ERROR", "Explanation must be at least 15 characters.", false);
  }

  const reasonCategory = toPrismaReasonCategory(input.reason);
  const payloadHash = canonicalPayloadHash({
    attendanceDate: input.attendanceDate,
    sessionId: input.sessionId ?? null,
    replaceRequestId: input.replaceRequestId ?? null,
    reasonCategory,
    explanation,
    proposedTimeIn: input.proposedTimeIn ?? null,
    proposedTimeOut: input.proposedTimeOut ?? null,
  });

  // Idempotent replay check
  const existingByKey = await prisma.correctionRequest.findUnique({
    where: {
      internshipId_clientRequestId: {
        internshipId: input.internshipId,
        clientRequestId: input.clientRequestId,
      },
    },
  });
  if (existingByKey) {
    if (existingByKey.payloadHash !== payloadHash) {
      throw new AppError(409, "KEY_REUSED", "Request id was already used with a different proposal.", false);
    }
    return {
      id: existingByKey.id,
      correctionRequestId: existingByKey.id,
      requestVersion: existingByKey.requestVersion,
      status: "PENDING",
    };
  }

  return withTransientDbRetry(() =>
    prisma.$transaction(async (tx) => {
      // Lock parent Internship first (Tech Design §4)
      await tx.$queryRaw`SELECT id FROM "internship" WHERE id = ${input.internshipId}::uuid FOR UPDATE`;

      const internship = await tx.internship.findUnique({
        where: { id: input.internshipId },
        include: { office: true },
      });
      if (!internship || internship.status !== "ACTIVE" || internship.internUserId !== input.actorId) {
        throw new AppError(403, "FORBIDDEN", "Active internship not found for this account.", false);
      }

      const timeZone = internship.office.timezone;
      const todayIso = officeDateIso(new Date(), timeZone);
      const startIso = dateToIso(internship.startDate);
      const endIso = internship.endDate ? dateToIso(internship.endDate) : null;

      if (input.attendanceDate > todayIso || input.attendanceDate < startIso || (endIso && input.attendanceDate > endIso)) {
        throw new AppError(422, "DATE_OUT_OF_RANGE", "Date must fall within your internship up to today.", false);
      }

      const attendanceDate = new Date(`${input.attendanceDate}T00:00:00Z`);

      // Resolve target session if one exists on that date
      const session = input.sessionId
        ? await tx.attendanceSession.findFirst({
            where: { id: input.sessionId, internshipId: internship.id },
          })
        : await tx.attendanceSession.findFirst({
            where: { internshipId: internship.id, attendanceDate, status: { not: "VOID" } },
            orderBy: { createdAt: "desc" },
          });

      if (input.sessionId && !session) {
        throw new AppError(404, "SESSION_NOT_FOUND", "Referenced session does not exist.", false);
      }

      // Validate proposed times against same-local-date interval rules
      const proposedTimeInUtc = input.proposedTimeIn
        ? officeLocalToUtc(input.attendanceDate, input.proposedTimeIn, timeZone)
        : null;
      const proposedTimeOutUtc = input.proposedTimeOut
        ? officeLocalToUtc(input.attendanceDate, input.proposedTimeOut, timeZone)
        : null;

      if (!session) {
        if (!proposedTimeInUtc || !proposedTimeOutUtc) {
          throw new AppError(422, "INTERVAL_INVALID", "Missing-day requests require both Time in and Time out.", false);
        }
      } else if (!proposedTimeInUtc && !proposedTimeOutUtc) {
        throw new AppError(422, "INTERVAL_INVALID", "Change at least Time in or Time out.", false);
      }

      const effectiveIn = proposedTimeInUtc ?? session?.effectiveTimeInUtc ?? null;
      const effectiveOut = proposedTimeOutUtc ?? session?.effectiveTimeOutUtc ?? null;

      if (!effectiveIn || !effectiveOut || effectiveOut.getTime() <= effectiveIn.getTime()) {
        throw new AppError(422, "INTERVAL_INVALID", "Time out must be strictly later than Time in on the same day.", false);
      }
      if (
        officeDateIso(effectiveIn, timeZone) !== input.attendanceDate ||
        officeDateIso(effectiveOut, timeZone) !== input.attendanceDate
      ) {
        throw new AppError(422, "INTERVAL_INVALID", "Proposed times must stay on the same office local date.", false);
      }

      // Check existing open request for this session or missing day
      const openExisting = await tx.correctionRequest.findFirst({
        where: session
          ? { sessionId: session.id, status: { in: ["PENDING", "NEEDS_INFO"] } }
          : { internshipId: internship.id, sessionId: null, attendanceDate, status: { in: ["PENDING", "NEEDS_INFO"] } },
      });

      let previousRequestId: string | null = null;
      if (openExisting) {
        if (input.replaceRequestId && input.replaceRequestId === openExisting.id) {
          await tx.correctionRequest.update({
            where: { id: openExisting.id },
            data: { status: "SUPERSEDED" },
          });
          previousRequestId = openExisting.id;
        } else {
          throw new AppError(409, "OPEN_REQUEST_EXISTS", "An open correction request already exists for this day.", false);
        }
      }

      const created = await tx.correctionRequest.create({
        data: {
          internshipId: internship.id,
          sessionId: session?.id ?? null,
          baseSessionVersion: session?.version ?? null,
          requestVersion: 1,
          clientRequestId: input.clientRequestId,
          payloadHash,
          attendanceDate,
          proposedTimeInUtc,
          proposedTimeOutUtc,
          reasonCategory,
          reason: explanation,
          status: "PENDING",
          previousRequestId,
        },
      });

      await enqueueReviewJob(tx, {
        correctionRequestId: created.id,
        requestVersion: created.requestVersion,
        reasonCategory,
        explanation,
        comments: [],
        hasExistingSession: Boolean(session),
        hasRecordedTimeIn: Boolean(session?.effectiveTimeInUtc),
        hasRecordedTimeOut: Boolean(session?.effectiveTimeOutUtc),
        proposesTimeIn: Boolean(proposedTimeInUtc),
        proposesTimeOut: Boolean(proposedTimeOutUtc),
      });

      await recordAuditEvent(tx, {
        actorId: input.actorId,
        action: previousRequestId ? "correction.replaced" : "correction.submitted",
        resourceType: "correction_request",
        resourceId: created.id,
        afterValues: {
          attendanceDate: input.attendanceDate,
          reasonCategory,
          previousRequestId,
          summary: `Submitted ${hrReasonLabel(input.reason)} request for ${input.attendanceDate}`,
        },
        correlationId: input.correlationId,
      });

      return {
        id: created.id,
        correctionRequestId: created.id,
        requestVersion: created.requestVersion,
        status: "PENDING",
      };
    }),
  );
}

export async function addCorrectionComment(input: {
  readonly actor: AuthenticatedActor;
  readonly correctionRequestId: string;
  readonly message: string;
  readonly correlationId: string;
}): Promise<{ readonly id: string; readonly createdAtUtc: string; readonly requestVersion: number }> {
  const message = input.message.trim();
  if (!message || message.length > 2000) {
    throw new AppError(400, "VALIDATION_ERROR", "Comment message is required (max 2000 characters).", false);
  }

  return withTransientDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const req = await tx.correctionRequest.findUnique({
        where: { id: input.correctionRequestId },
        include: {
          internship: true,
          session: { select: { effectiveTimeInUtc: true, effectiveTimeOutUtc: true } },
        },
      });
      if (!req) throw new AppError(404, "CORRECTION_NOT_FOUND", "Correction request not found.", false);

      if (input.actor.role === "INTERN" && req.internship.internUserId !== input.actor.userId) {
        throw new AppError(403, "FORBIDDEN", "You can only comment on your own correction requests.", false);
      }

      await tx.$queryRaw`SELECT id FROM "internship" WHERE id = ${req.internshipId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "correction_request" WHERE id = ${req.id}::uuid FOR UPDATE`;

      const fresh = await tx.correctionRequest.findUniqueOrThrow({ where: { id: req.id } });
      if (fresh.status !== "PENDING" && fresh.status !== "NEEDS_INFO") {
        throw new AppError(409, "REQUEST_FINALIZED", "Finalized requests cannot accept new replies.", false);
      }

      const comment = await tx.correctionComment.create({
        data: {
          correctionRequestId: fresh.id,
          authorUserId: input.actor.userId,
          message,
        },
      });

      // When an intern replies to a NEEDS_INFO request, return it to PENDING ("Waiting on you")
      const nextStatus =
        input.actor.role === "INTERN" && fresh.status === "NEEDS_INFO" ? "PENDING" : fresh.status;

      const updated = await tx.correctionRequest.update({
        where: { id: fresh.id },
        data: {
          requestVersion: { increment: 1 },
          status: nextStatus,
        },
      });

      const allComments = await tx.correctionComment.findMany({
        where: { correctionRequestId: fresh.id },
        include: { author: { select: { role: true } } },
        orderBy: { createdAtUtc: "asc" },
      });

      await enqueueReviewJob(tx, {
        correctionRequestId: fresh.id,
        requestVersion: updated.requestVersion,
        reasonCategory: fresh.reasonCategory,
        explanation: fresh.reason,
        comments: allComments.map((c) => ({
          role: c.author.role === "HR" ? "HR" : "INTERN",
          message: c.message,
        })),
        hasExistingSession: Boolean(req.sessionId),
        hasRecordedTimeIn: Boolean(req.session?.effectiveTimeInUtc),
        hasRecordedTimeOut: Boolean(req.session?.effectiveTimeOutUtc),
        proposesTimeIn: Boolean(fresh.proposedTimeInUtc),
        proposesTimeOut: Boolean(fresh.proposedTimeOutUtc),
      });

      await recordAuditEvent(tx, {
        actorId: input.actor.userId,
        action: "correction.comment_added",
        resourceType: "correction_request",
        resourceId: fresh.id,
        afterValues: {
          requestVersion: updated.requestVersion,
          status: updated.status,
          summary: `${input.actor.role === "HR" ? "HR" : "Intern"} replied (v${updated.requestVersion})`,
        },
        correlationId: input.correlationId,
      });

      return {
        id: comment.id,
        createdAtUtc: comment.createdAtUtc.toISOString(),
        requestVersion: updated.requestVersion,
      };
    }),
  );
}

export async function decideCorrection(input: DecideCorrectionInput): Promise<DecideCorrectionResult> {
  const note = input.note.trim();
  if (note.length < 5) {
    throw new AppError(400, "NOTE_REQUIRED", "A decision note of at least 5 characters is required.", false);
  }

  const payloadHash = canonicalPayloadHash({
    correctionRequestId: input.correctionRequestId,
    decision: input.decision,
    note,
    expectedRequestVersion: input.expectedRequestVersion,
    expectedSessionVersion: input.expectedSessionVersion ?? null,
    expectedAttendanceVersion: input.expectedAttendanceVersion ?? null,
  });

  // Idempotency replay check by unique operationKey
  const existingReview = await prisma.hrReview.findUnique({
    where: { operationKey: input.operationKey },
    include: { correctionRequest: { select: { requestVersion: true, status: true } } },
  });
  if (existingReview) {
    if (existingReview.payloadHash !== payloadHash) {
      throw new AppError(409, "KEY_REUSED", "Decision operationKey was reused with a different payload.", false);
    }
    const statusMap: Record<HrDecision, DecideCorrectionResult["status"]> = {
      APPROVE: "APPROVED",
      REJECT: "REJECTED",
      NEEDS_INFO: "NEEDS_INFO",
    };
    return {
      reviewId: existingReview.id,
      status: statusMap[existingReview.decision],
      version: existingReview.correctionRequest.requestVersion,
    };
  }

  try {
    return await withTransientDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const initialReq = await tx.correctionRequest.findUnique({
          where: { id: input.correctionRequestId },
          include: { internship: { include: { office: true } } },
        });
        if (!initialReq) {
          throw new AppError(404, "CORRECTION_NOT_FOUND", "Correction request not found.", false);
        }

        // Strict lock order: Internship -> AttendanceSession -> CorrectionRequest
        await tx.$queryRaw`SELECT id FROM "internship" WHERE id = ${initialReq.internshipId}::uuid FOR UPDATE`;
        if (initialReq.sessionId) {
          await tx.$queryRaw`SELECT id FROM "attendance_session" WHERE id = ${initialReq.sessionId}::uuid FOR UPDATE`;
        }
        await tx.$queryRaw`SELECT id FROM "correction_request" WHERE id = ${initialReq.id}::uuid FOR UPDATE`;

        const [internship, req, session] = await Promise.all([
          tx.internship.findUniqueOrThrow({
            where: { id: initialReq.internshipId },
            include: { office: true, intern: { select: { name: true } } },
          }),
          tx.correctionRequest.findUniqueOrThrow({ where: { id: initialReq.id } }),
          initialReq.sessionId
            ? tx.attendanceSession.findUnique({ where: { id: initialReq.sessionId } })
            : Promise.resolve(null),
        ]);

        if (req.status !== "PENDING" && req.status !== "NEEDS_INFO") {
          throw new AppError(409, "REQUEST_FINALIZED", "This correction request has already been finalized.", false);
        }
        if (req.requestVersion !== input.expectedRequestVersion) {
          throw new AppError(409, "REQUEST_CHANGED", "This request changed while you were reading it.", false);
        }
        if (session) {
          if (
            (input.expectedSessionVersion !== undefined &&
              input.expectedSessionVersion !== null &&
              session.version !== input.expectedSessionVersion) ||
            (req.baseSessionVersion !== null && session.version !== req.baseSessionVersion)
          ) {
            throw new AppError(409, "REQUEST_CHANGED", "The underlying attendance session changed.", false);
          }
        } else if (
          input.decision === "APPROVE" &&
          input.expectedAttendanceVersion !== undefined &&
          internship.attendanceVersion !== input.expectedAttendanceVersion
        ) {
          throw new AppError(409, "REQUEST_CHANGED", "Intern attendance changed while you were reading.", false);
        }

        const nextStatus: DecideCorrectionResult["status"] =
          input.decision === "APPROVE"
            ? "APPROVED"
            : input.decision === "REJECT"
              ? "REJECTED"
              : "NEEDS_INFO";

        const review = await tx.hrReview.create({
          data: {
            correctionRequestId: req.id,
            reviewerUserId: input.reviewerUserId,
            operationKey: input.operationKey,
            payloadHash,
            decision: input.decision,
            note,
          },
        });

        if (input.decision === "NEEDS_INFO") {
          await tx.correctionComment.create({
            data: {
              correctionRequestId: req.id,
              authorUserId: input.reviewerUserId,
              message: note,
            },
          });
        }

        if (input.decision === "APPROVE") {
          const timeZone = session?.timezoneSnapshot ?? internship.office.timezone;
          const dateIso = dateToIso(req.attendanceDate);
          const nextIn = req.proposedTimeInUtc ?? session?.effectiveTimeInUtc ?? null;
          const nextOut = req.proposedTimeOutUtc ?? session?.effectiveTimeOutUtc ?? null;

          if (!nextIn || !nextOut || nextOut.getTime() <= nextIn.getTime()) {
            throw new AppError(422, "INTERVAL_INVALID", "Approved times must form a valid non-empty interval.", false);
          }
          if (officeDateIso(nextIn, timeZone) !== dateIso || officeDateIso(nextOut, timeZone) !== dateIso) {
            throw new AppError(422, "INTERVAL_INVALID", "Approved times must stay on the same office local date.", false);
          }

          // Verify no overlap with other non-VOID bounded sessions for this internship
          const overlapping = await tx.attendanceSession.findFirst({
            where: {
              internshipId: internship.id,
              status: { not: "VOID" },
              ...(session ? { id: { not: session.id } } : {}),
              effectiveTimeInUtc: { lt: nextOut },
              effectiveTimeOutUtc: { gt: nextIn },
            },
          });
          if (overlapping) {
            throw new AppError(409, "INTERVAL_OVERLAP", "Approved times overlap another attendance session.", false);
          }

          let targetSessionId: string;
          const beforeValues = session
            ? {
                effectiveTimeInUtc: session.effectiveTimeInUtc?.toISOString() ?? null,
                effectiveTimeOutUtc: session.effectiveTimeOutUtc?.toISOString() ?? null,
                status: session.status,
                version: session.version,
              }
            : {
                effectiveTimeInUtc: null,
                effectiveTimeOutUtc: null,
                status: null,
                version: 0,
              };

          if (session) {
            const updatedSession = await tx.attendanceSession.update({
              where: { id: session.id },
              data: {
                effectiveTimeInUtc: nextIn,
                effectiveTimeOutUtc: nextOut,
                status: "COMPLETE",
                version: { increment: 1 },
              },
            });
            targetSessionId = updatedSession.id;
          } else {
            // Pin day policy from existing day session or latest published policy effective for that day
            const existingDay = await tx.attendanceSession.findFirst({
              where: { internshipId: internship.id, attendanceDate: req.attendanceDate },
              orderBy: { createdAt: "asc" },
              select: { policyVersionId: true },
            });
            const policyRow = existingDay
              ? { id: existingDay.policyVersionId }
              : await tx.attendancePolicyVersion.findFirst({
                  where: {
                    officeId: internship.officeId,
                    status: "PUBLISHED",
                    effectiveFromUtc: { lte: nextIn },
                  },
                  orderBy: { version: "desc" },
                  select: { id: true },
                });
            const fallbackPolicy =
              policyRow ??
              (await tx.attendancePolicyVersion.findFirst({
                where: { officeId: internship.officeId, status: "PUBLISHED" },
                orderBy: { version: "asc" },
                select: { id: true },
              }));
            if (!fallbackPolicy) {
              throw new AppError(422, "POLICY_NOT_CONFIGURED", "Office attendance policy is not configured.", false);
            }

            const createdSession = await tx.attendanceSession.create({
              data: {
                internshipId: internship.id,
                policyVersionId: fallbackPolicy.id,
                attendanceDate: req.attendanceDate,
                effectiveTimeInUtc: nextIn,
                effectiveTimeOutUtc: nextOut,
                status: "COMPLETE",
                version: 1,
                timezoneSnapshot: timeZone,
                departmentIdSnapshot: internship.departmentId,
              },
            });
            targetSessionId = createdSession.id;
          }

          await tx.attendanceRevision.create({
            data: {
              sessionId: targetSessionId,
              reviewId: review.id,
              beforeValues,
              afterValues: {
                effectiveTimeInUtc: nextIn.toISOString(),
                effectiveTimeOutUtc: nextOut.toISOString(),
                status: "COMPLETE",
              },
            },
          });

          await tx.internship.update({
            where: { id: internship.id },
            data: { attendanceVersion: { increment: 1 } },
          });
        }

        const updatedReq = await tx.correctionRequest.update({
          where: { id: req.id },
          data: {
            status: nextStatus,
            requestVersion: { increment: 1 },
          },
        });

        await recordAuditEvent(tx, {
          actorId: input.reviewerUserId,
          action: `review.${input.decision.toLowerCase()}`,
          resourceType: "correction_request",
          resourceId: req.id,
          beforeValues: { status: req.status, requestVersion: req.requestVersion },
          afterValues: {
            status: nextStatus,
            requestVersion: updatedReq.requestVersion,
            summary: `${nextStatus} correction for ${internship.intern.name} (${dateToIso(req.attendanceDate)})`,
          },
          correlationId: input.correlationId,
        });

        return {
          reviewId: review.id,
          status: nextStatus,
          version: updatedReq.requestVersion,
        };
      }),
    );
  } catch (error) {
    if (getDbErrorCode(error) === "P2002") {
      const winner = await prisma.hrReview.findUnique({
        where: { operationKey: input.operationKey },
        include: { correctionRequest: { select: { requestVersion: true } } },
      });
      if (winner && winner.payloadHash === payloadHash) {
        const statusMap: Record<HrDecision, DecideCorrectionResult["status"]> = {
          APPROVE: "APPROVED",
          REJECT: "REJECTED",
          NEEDS_INFO: "NEEDS_INFO",
        };
        return {
          reviewId: winner.id,
          status: statusMap[winner.decision],
          version: winner.correctionRequest.requestVersion,
        };
      }
      throw new AppError(409, "KEY_REUSED", "Decision operationKey was reused with a different payload.", false);
    }
    throw error;
  }
}

export async function retryReviewJob(input: {
  readonly actorId: string;
  readonly correctionRequestId: string;
  readonly correlationId: string;
}): Promise<{ readonly queued: true }> {
  const req = await prisma.correctionRequest.findUnique({
    where: { id: input.correctionRequestId },
    include: {
      session: { select: { effectiveTimeInUtc: true, effectiveTimeOutUtc: true } },
      comments: { include: { author: { select: { role: true } } }, orderBy: { createdAtUtc: "asc" } },
    },
  });
  if (!req) throw new AppError(404, "CORRECTION_NOT_FOUND", "Correction request not found.", false);
  if (req.status !== "PENDING" && req.status !== "NEEDS_INFO") {
    throw new AppError(409, "REQUEST_FINALIZED", "Cannot re-run Jev on a finalized request.", false);
  }

  const minimized = buildMinimizedJevContext({
    requestVersion: req.requestVersion,
    reasonCategory: req.reasonCategory,
    explanation: req.reason,
    comments: req.comments.map((c) => ({
      role: c.author.role === "HR" ? "HR" : "INTERN",
      message: c.message,
    })),
    facts: {
      hasExistingSession: Boolean(req.sessionId),
      hasRecordedTimeIn: Boolean(req.session?.effectiveTimeInUtc),
      hasRecordedTimeOut: Boolean(req.session?.effectiveTimeOutUtc),
      proposesTimeIn: Boolean(req.proposedTimeInUtc),
      proposesTimeOut: Boolean(req.proposedTimeOutUtc),
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.reviewJob.upsert({
      where: {
        correctionRequestId_inputFingerprint_modelVersion_criteriaVersion: {
          correctionRequestId: req.id,
          inputFingerprint: minimized.inputFingerprint,
          modelVersion: JEV_MODEL_VERSION,
          criteriaVersion: JEV_CRITERIA_VERSION,
        },
      },
      update: {
        state: "PENDING",
        attempts: 0,
        nextRunAtUtc: new Date(),
        leaseToken: null,
        leaseExpiresAtUtc: null,
        lastErrorCode: null,
      },
      create: {
        correctionRequestId: req.id,
        inputFingerprint: minimized.inputFingerprint,
        modelVersion: JEV_MODEL_VERSION,
        criteriaVersion: JEV_CRITERIA_VERSION,
        state: "PENDING",
        nextRunAtUtc: new Date(),
      },
    });

    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "review.jev_retried",
      resourceType: "correction_request",
      resourceId: req.id,
      afterValues: { summary: `Re-queued Jev advisory reading for request v${req.requestVersion}` },
      correlationId: input.correlationId,
    });
  });

  return { queued: true };
}

export async function countWaitingOnHr(): Promise<number> {
  const [pendingCorrections, heldSessions] = await Promise.all([
    prisma.correctionRequest.count({ where: { status: "PENDING" } }),
    prisma.attendanceSession.count({ where: { status: "REVIEW" } }),
  ]);
  return pendingCorrections + heldSessions;
}

export async function listMyCorrections(actor: ActiveInternActor): Promise<InternCorrectionsVM> {
  const timeZone = actor.internship.timeZone;
  const rows = await prisma.correctionRequest.findMany({
    where: { internshipId: actor.internship.id, status: { not: "SUPERSEDED" } },
    include: {
      reviews: { orderBy: { reviewedAtUtc: "desc" }, take: 1 },
      comments: { include: { author: { select: { role: true } } }, orderBy: { createdAtUtc: "desc" }, take: 1 },
    },
    orderBy: { submittedAtUtc: "desc" },
  });

  const toSummary = (row: (typeof rows)[number]): CorrectionSummaryVM => {
    const latestReview = row.reviews[0];
    const latestComment = row.comments[0];
    const activity =
      row.status === "NEEDS_INFO"
        ? "HR asked for more info"
        : latestComment
          ? `${latestComment.author.role === "HR" ? "HR" : "You"} replied ${formatShortDate(
              officeDateIso(latestComment.createdAtUtc, timeZone),
            )}`
          : `Sent ${formatShortDate(officeDateIso(row.submittedAtUtc, timeZone))}`;

    return {
      id: row.id,
      dateIso: dateToIso(row.attendanceDate),
      reason: fromPrismaReasonCategory(row.reasonCategory),
      proposal: {
        timeIn: row.proposedTimeInUtc ? formatClock(row.proposedTimeInUtc, timeZone) : undefined,
        timeOut: row.proposedTimeOutUtc ? formatClock(row.proposedTimeOutUtc, timeZone) : undefined,
      },
      status: row.status,
      activity,
      hrNote: row.status === "REJECTED" ? (latestReview?.note ?? undefined) : undefined,
    };
  };

  const open = rows.filter((r) => r.status === "PENDING" || r.status === "NEEDS_INFO").map(toSummary);
  const decided = rows.filter((r) => r.status === "APPROVED" || r.status === "REJECTED").map(toSummary);

  return {
    identity: {
      name: actor.name,
      initials: initialsOf(actor.name),
      department: actor.internship.departmentName,
      timeZone,
    },
    open,
    decided,
  };
}

export async function getCorrectionDetailForIntern(
  actor: ActiveInternActor,
  id: string,
): Promise<CorrectionDetailVM | null> {
  const req = await prisma.correctionRequest.findFirst({
    where: { id, internshipId: actor.internship.id },
    include: {
      session: { include: { policyVersion: true } },
      comments: { include: { author: { select: { name: true, role: true } } }, orderBy: { createdAtUtc: "asc" } },
      reviews: { include: { reviewer: { select: { name: true } } }, orderBy: { reviewedAtUtc: "desc" }, take: 1 },
    },
  });
  if (!req) return null;

  const timeZone = req.session?.timezoneSnapshot ?? actor.internship.timeZone;
  const dateIso = dateToIso(req.attendanceDate);

  const recorded: RecordedDay | null = req.session
    ? {
        timeIn: req.session.effectiveTimeInUtc ? formatClock(req.session.effectiveTimeInUtc, timeZone) : null,
        timeOut: req.session.effectiveTimeOutUtc ? formatClock(req.session.effectiveTimeOutUtc, timeZone) : null,
      }
    : null;

  const proposal = {
    timeIn: req.proposedTimeInUtc ? formatClock(req.proposedTimeInUtc, timeZone) : undefined,
    timeOut: req.proposedTimeOutUtc ? formatClock(req.proposedTimeOutUtc, timeZone) : undefined,
  };

  let estimatedCreditMinutes: number | null = null;
  const policyRow =
    req.session?.policyVersion ??
    (await prisma.attendancePolicyVersion.findFirst({
      where: { officeId: actor.internship.officeId, status: "PUBLISHED" },
      orderBy: { version: "desc" },
    }));
  const effIn = req.proposedTimeInUtc ?? req.session?.effectiveTimeInUtc ?? null;
  const effOut = req.proposedTimeOutUtc ?? req.session?.effectiveTimeOutUtc ?? null;
  if (policyRow && effIn && effOut && effOut > effIn) {
    try {
      const calc = calculateDailyCredit(
        [{ timeInUtc: effIn, timeOutUtc: effOut }],
        parseStoredPolicy(policyRow),
        { attendanceDate: dateIso, timeZone },
      );
      estimatedCreditMinutes = calc.creditedMinutes;
    } catch {
      estimatedCreditMinutes = null;
    }
  }

  const messages: CorrectionMessageVM[] = [
    {
      id: `${req.id}-reason`,
      author: "intern",
      name: "You",
      atLabel: `${formatShortDate(officeDateIso(req.submittedAtUtc, timeZone))} · ${formatClock(req.submittedAtUtc, timeZone)}`,
      body: req.reason,
    },
    ...req.comments.map(
      (c): CorrectionMessageVM => ({
        id: c.id,
        author: c.author.role === "HR" ? "hr" : "intern",
        name: c.author.role === "HR" ? c.author.name : "You",
        atLabel: `${formatShortDate(officeDateIso(c.createdAtUtc, timeZone))} · ${formatClock(c.createdAtUtc, timeZone)}`,
        body: c.message,
      }),
    ),
  ];

  const latestReview = req.reviews[0];
  const isOpen = req.status === "PENDING" || req.status === "NEEDS_INFO";

  return {
    identity: {
      name: actor.name,
      initials: initialsOf(actor.name),
      department: actor.internship.departmentName,
      timeZone,
    },
    id: req.id,
    dateIso,
    reason: fromPrismaReasonCategory(req.reasonCategory),
    status: req.status,
    submittedLabel: `${formatShortDate(officeDateIso(req.submittedAtUtc, timeZone))} · ${formatClock(req.submittedAtUtc, timeZone)}`,
    recorded,
    proposal,
    estimatedCreditMinutes,
    creditedDeltaMinutes: req.status === "APPROVED" ? (estimatedCreditMinutes ?? undefined) : undefined,
    decisionNote: !isOpen ? (latestReview?.note ?? undefined) : undefined,
    messages,
    canReply: isOpen,
  };
}

export async function getNewCorrectionData(
  actor: ActiveInternActor,
  dateIso?: string,
  replaceRequestId?: string,
): Promise<NewCorrectionVM> {
  const timeZone = actor.internship.timeZone;
  const todayIso = officeDateIso(new Date(), timeZone);
  const startIso = dateToIso(actor.internship.startDate);

  const sessions = await prisma.attendanceSession.findMany({
    where: { internshipId: actor.internship.id, status: { not: "VOID" } },
    orderBy: [{ attendanceDate: "desc" }, { effectiveTimeInUtc: "asc" }],
    take: 90,
  });

  const recordedByDate: Record<string, RecordedDay & { sessionId?: string }> = {};
  for (const s of sessions) {
    const iso = dateToIso(s.attendanceDate);
    if (!recordedByDate[iso]) {
      recordedByDate[iso] = {
        sessionId: s.id,
        timeIn: s.effectiveTimeInUtc ? formatClock(s.effectiveTimeInUtc, s.timezoneSnapshot) : null,
        timeOut: s.effectiveTimeOutUtc ? formatClock(s.effectiveTimeOutUtc, s.timezoneSnapshot) : null,
      };
    }
  }

  const validDate =
    dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) && dateIso <= todayIso && dateIso >= startIso
      ? dateIso
      : todayIso;

  return {
    identity: {
      name: actor.name,
      initials: initialsOf(actor.name),
      department: actor.internship.departmentName,
      timeZone,
    },
    todayIso,
    earliestDateIso: startIso,
    initialDateIso: validDate,
    replaceRequestId,
    recordedByDate,
  };
}

export async function listForReview(filters: {
  readonly tab?: ReviewTab;
  readonly query?: string;
  readonly department?: string | null;
  readonly jev?: ReviewQueueVM["jev"];
  readonly from?: string;
  readonly to?: string;
}): Promise<ReviewQueueVM> {
  const [office, departments, requests] = await Promise.all([
    prisma.office.findFirst({ select: { timezone: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.correctionRequest.findMany({
      where: {
        status: { not: "SUPERSEDED" },
        ...(filters.from || filters.to
          ? {
              attendanceDate: {
                ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00Z`) } : {}),
                ...(filters.to ? { lte: new Date(`${filters.to}T00:00:00Z`) } : {}),
              },
            }
          : {}),
      },
      include: {
        internship: {
          include: {
            intern: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        assessments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { submittedAtUtc: "asc" },
    }),
  ]);

  const timeZone = office?.timezone ?? "Asia/Manila";
  const now = new Date();
  const todayIso = officeDateIso(now, timeZone);
  const deptNames = departments.map((d) => d.name);

  const allRows: ReviewRowVM[] = requests.map((req) => {
    const tab: Exclude<ReviewTab, "all"> =
      req.status === "PENDING" ? "you" : req.status === "NEEDS_INFO" ? "intern" : "decided";

    const ageDays = Math.max(0, Math.floor((now.getTime() - req.submittedAtUtc.getTime()) / (24 * 60 * 60 * 1000)));
    const ageWorkdays =
      req.status === "PENDING" ? workdaysBetween(officeDateIso(req.submittedAtUtc, timeZone), todayIso) : 0;

    const latestJev = req.assessments[0];
    const jevTyped =
      latestJev?.runStatus === "SUCCEEDED" && latestJev.requestVersion === req.requestVersion
        ? (latestJev.typedResults as { category?: string } | null)
        : null;

    const proposalLabel = req.proposedTimeInUtc && req.proposedTimeOutUtc
      ? {
          label: req.sessionId ? "Update times" : "Add missing day",
          value: `${formatClock(req.proposedTimeInUtc, timeZone)}–${formatClock(req.proposedTimeOutUtc, timeZone)}`,
        }
      : req.proposedTimeOutUtc
        ? { label: "Add Time out", value: formatClock(req.proposedTimeOutUtc, timeZone) }
        : {
            label: "Update Time in",
            value: req.proposedTimeInUtc ? formatClock(req.proposedTimeInUtc, timeZone) : undefined,
          };

    return {
      id: req.id,
      href: `/hr/reviews/${req.id}`,
      internName: req.internship.intern.name,
      department: req.internship.department.name,
      dateIso: dateToIso(req.attendanceDate),
      request: proposalLabel,
      jevCategory: jevTyped?.category ? hrReasonLabel(jevTyped.category as CorrectionReason) : null,
      status: { type: "correction", value: req.status, ageWorkdays },
      ageDays,
      tab,
    };
  });

  const counts: Record<ReviewTab, number> = {
    you: allRows.filter((r) => r.tab === "you").length,
    intern: allRows.filter((r) => r.tab === "intern").length,
    decided: allRows.filter((r) => r.tab === "decided").length,
    all: allRows.length,
  };

  const validTabs: ReviewTab[] = ["you", "intern", "decided", "all"];
  const tab = filters.tab && validTabs.includes(filters.tab) ? filters.tab : "you";
  const query = (filters.query ?? "").trim();
  const department = filters.department && deptNames.includes(filters.department) ? filters.department : null;
  const jev = filters.jev === "read" || filters.jev === "manual" ? filters.jev : "all";
  const needle = query.toLowerCase();

  return {
    tab,
    query,
    department,
    jev,
    counts,
    rows: allRows.filter(
      (row) =>
        (tab === "all" || row.tab === tab) &&
        (!department || row.department === department) &&
        (jev === "all" || (jev === "read") === (row.jevCategory !== null)) &&
        (!needle || row.internName.toLowerCase().includes(needle)),
    ),
    departments: deptNames,
  };
}

export async function getCorrectionForReview(id: string): Promise<ReviewDetailVM | null> {
  const req = await prisma.correctionRequest.findUnique({
    where: { id },
    include: {
      internship: {
        include: {
          intern: { select: { id: true, name: true } },
          department: { select: { name: true } },
          office: {
            include: {
              policyVersions: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1 },
            },
          },
          sessions: { where: { status: "COMPLETE" }, include: { policyVersion: true } },
        },
      },
      session: { include: { policyVersion: true } },
      comments: { include: { author: { select: { name: true, role: true } } }, orderBy: { createdAtUtc: "asc" } },
      reviews: { include: { reviewer: { select: { name: true } } }, orderBy: { reviewedAtUtc: "desc" } },
      assessments: { orderBy: { createdAt: "desc" }, take: 1 },
      reviewJobs: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  if (!req) return null;

  const timeZone = req.session?.timezoneSnapshot ?? req.internship.office.timezone;
  const todayIso = officeDateIso(new Date(), timeZone);
  const dateIso = dateToIso(req.attendanceDate);

  const policyRow = req.session?.policyVersion ?? req.internship.office.policyVersions[0];
  const parsedPolicy = policyRow ? parseStoredPolicy(policyRow) : null;
  const uiRules = policyRow ? policyToUiRules(policyRow) : null;

  const recordedIn = req.session?.effectiveTimeInUtc ?? null;
  const recordedOut = req.session?.effectiveTimeOutUtc ?? null;
  const proposedIn = req.proposedTimeInUtc ?? recordedIn;
  const proposedOut = req.proposedTimeOutUtc ?? recordedOut;

  let recordedCredited = 0;
  if (parsedPolicy && req.session?.status === "COMPLETE" && recordedIn && recordedOut) {
    try {
      recordedCredited = calculateDailyCredit(
        [{ timeInUtc: recordedIn, timeOutUtc: recordedOut }],
        parsedPolicy,
        { attendanceDate: dateIso, timeZone },
      ).creditedMinutes;
    } catch {
      recordedCredited = 0;
    }
  }

  let proposedCredited = 0;
  if (parsedPolicy && proposedIn && proposedOut && proposedOut > proposedIn) {
    try {
      proposedCredited = calculateDailyCredit(
        [{ timeInUtc: proposedIn, timeOutUtc: proposedOut }],
        parsedPolicy,
        { attendanceDate: dateIso, timeZone },
      ).creditedMinutes;
    } catch {
      proposedCredited = 0;
    }
  }

  const totalCredits = aggregateDayCredits(
    req.internship.sessions.map((s) => ({
      attendanceDateIso: dateToIso(s.attendanceDate),
      status: s.status,
      effectiveTimeInUtc: s.effectiveTimeInUtc,
      effectiveTimeOutUtc: s.effectiveTimeOutUtc,
      timezoneSnapshot: s.timezoneSnapshot,
      policyVersion: s.policyVersion,
    })),
    req.internship.requiredMinutes,
  );

  // HR-only scan evidence for that attendance day
  const dayStartUtc = new Date(`${dateIso}T00:00:00Z`);
  dayStartUtc.setUTCHours(dayStartUtc.getUTCHours() - 14);
  const dayEndUtc = new Date(`${dateIso}T23:59:59Z`);
  dayEndUtc.setUTCHours(dayEndUtc.getUTCHours() + 14);

  const dayScans = await prisma.attendanceScan.findMany({
    where: {
      internshipId: req.internshipId,
      receivedAtUtc: { gte: dayStartUtc, lte: dayEndUtc },
    },
    include: { checkpoint: true },
    orderBy: { receivedAtUtc: "asc" },
  });

  const evidence: ReviewEvidenceVM[] = dayScans
    .filter((scan) => officeDateIso(scan.receivedAtUtc, timeZone) === dateIso)
    .map((scan) => {
      const ev = scan.locationEvidence as {
        distanceMeters?: number;
        geofenceRadiusMeters?: number;
        accuracyMeters?: number;
      } | null;
      return {
        action: scan.actionSnapshot === "TIME_IN" ? "Time in" : "Time out",
        time: formatClock(scan.receivedAtUtc, timeZone, { seconds: true }),
        qrLabel: `${scan.checkpoint.name} · ${scan.actionSnapshot === "TIME_IN" ? "IN" : "OUT"}`,
        distanceM: Math.round(ev?.distanceMeters ?? 0),
        radiusM: Math.round(ev?.geofenceRadiusMeters ?? req.internship.office.geofenceRadiusMeters),
        accuracyM: Math.round(ev?.accuracyMeters ?? 0),
        accepted: scan.validationStatus === "ACCEPTED",
      };
    });

  // Build Jev reading VM covering PENDING/RUNNING, SUCCEEDED, SUPERSEDED, FAILED/MANUAL_REVIEW
  const latestJev = req.assessments[0];
  const latestJob = req.reviewJobs[0];
  let jev: JevReadingVM;

  if (latestJob && (latestJob.state === "PENDING" || latestJob.state === "RUNNING")) {
    jev = { status: "pending" };
  } else if (latestJev && latestJev.runStatus === "SUCCEEDED" && latestJev.typedResults) {
    const typed = latestJev.typedResults as { category: CorrectionReason; categoryScore: number; detailsScore: number };
    const atLabel = latestJev.evaluatedAtUtc
      ? `${formatShortDate(officeDateIso(latestJev.evaluatedAtUtc, timeZone))} · ${formatClock(latestJev.evaluatedAtUtc, timeZone)}`
      : "";
    if (latestJev.requestVersion < req.requestVersion) {
      jev = {
        status: "superseded",
        category: hrReasonLabel(typed.category),
        version: latestJev.requestVersion,
        model: latestJev.modelVersion,
        atLabel,
      };
    } else {
      jev = {
        status: "read",
        category: hrReasonLabel(typed.category),
        categoryScore: typed.categoryScore,
        detailsScore: typed.detailsScore,
        version: latestJev.requestVersion,
        model: latestJev.modelVersion,
        atLabel,
      };
    }
  } else if (latestJev && latestJev.runStatus === "SUPERSEDED" && latestJev.typedResults) {
    const typed = latestJev.typedResults as { category: CorrectionReason };
    jev = {
      status: "superseded",
      category: hrReasonLabel(typed.category),
      version: latestJev.requestVersion,
      model: latestJev.modelVersion,
      atLabel: latestJev.evaluatedAtUtc ? formatShortDate(officeDateIso(latestJev.evaluatedAtUtc, timeZone)) : "",
    };
  } else {
    jev = {
      status: "unavailable",
      canRetry: latestJob?.state === "MANUAL_REVIEW" || latestJob?.state === "FAILED" || !latestJob,
    };
  }

  const ageWorkdays =
    req.status === "PENDING" ? workdaysBetween(officeDateIso(req.submittedAtUtc, timeZone), todayIso) : 0;

  const history = [
    ...req.reviews.map((rev) => ({
      label: `HR ${rev.decision.toLowerCase().replace("_", " ")} by ${rev.reviewer.name}`,
      atLabel: `${formatShortDate(officeDateIso(rev.reviewedAtUtc, timeZone))} · ${formatClock(rev.reviewedAtUtc, timeZone)}`,
    })),
    {
      label: "Submitted by intern",
      atLabel: `${formatShortDate(officeDateIso(req.submittedAtUtc, timeZone))} · ${formatClock(req.submittedAtUtc, timeZone)}`,
    },
  ];

  return {
    id: req.id,
    version: req.requestVersion,
    expectedSessionVersion: req.session?.version ?? null,
    expectedAttendanceVersion: req.internship.attendanceVersion,
    internId: req.internship.intern.id,
    internName: req.internship.intern.name,
    department: req.internship.department.name,
    dateIso,
    reason: fromPrismaReasonCategory(req.reasonCategory),
    state: req.status,
    status: { type: "correction", value: req.status, ageWorkdays },
    submittedLabel: `${formatShortDate(officeDateIso(req.submittedAtUtc, timeZone))} · ${formatClock(req.submittedAtUtc, timeZone)}`,
    recorded: {
      timeIn: recordedIn ? formatClock(recordedIn, timeZone) : null,
      timeOut: recordedOut ? formatClock(recordedOut, timeZone) : null,
      creditedMinutes: recordedCredited,
    },
    proposed: {
      timeIn: proposedIn ? formatClock(proposedIn, timeZone) : null,
      timeOut: proposedOut ? formatClock(proposedOut, timeZone) : null,
      creditedMinutes: proposedCredited,
    },
    policyNote: policyRow ? `Policy v${policyRow.version}` : "No policy",
    schedule: uiRules ? { start: uiRules.start, end: uiRules.end } : { start: "08:00", end: "19:00" },
    hours: {
      creditedMinutes: totalCredits.totalCreditedMinutes,
      requiredMinutes: req.internship.requiredMinutes,
    },
    comments: [
      {
        id: `${req.id}-reason`,
        author: "intern",
        name: req.internship.intern.name,
        atLabel: `${formatShortDate(officeDateIso(req.submittedAtUtc, timeZone))} · ${formatClock(req.submittedAtUtc, timeZone)}`,
        body: req.reason,
      },
      ...req.comments.map((c) => ({
        id: c.id,
        author: (c.author.role === "HR" ? "hr" : "intern") as "hr" | "intern",
        name: c.author.name,
        atLabel: `${formatShortDate(officeDateIso(c.createdAtUtc, timeZone))} · ${formatClock(c.createdAtUtc, timeZone)}`,
        body: c.message,
      })),
    ],
    jev,
    evidence,
    evidenceNote: evidence.length === 0 ? `No scans recorded on ${formatShortDate(dateIso)}, accepted or rejected.` : undefined,
    history,
    decisionNote: req.reviews[0]?.note ?? undefined,
  };
}
