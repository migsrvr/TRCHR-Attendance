/**
 * Attendance module (Technical Design v1.0 sections 5, 6, 7, 10, and 11).
 *
 * Implements:
 * - Scan intent issuance bound to Internship.attendanceVersion & open session.
 * - Atomic scan submission with receipt reservation, exact replay, 409 KEY_REUSED,
 *   parent Internship FOR UPDATE locking, DB-clock receivedAtUtc, location freshness
 *   & geodesic geofence verification, cross-midnight REVIEW flagging, and audit logging.
 * - Owner-only receipt recovery and read models for intern & HR dashboards.
 */

import type { Prisma } from "@prisma/client";

import type { ActiveInternActor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { evaluateLocation, haversineDistanceMeters, type LatLng } from "@/lib/geo/distance";
import { AppError } from "@/lib/http/errors";
import { canonicalPayloadHash, getDbErrorCode, withTransientDbRetry } from "@/lib/http/guard";
import { sendCorrectionRequestedEmail } from "@/lib/mail";
import { loadQrKeyringConfig } from "@/lib/qr/signer";
import { QrVerificationError, verifyQrCredential } from "@/lib/qr/verifier";
import type { TodaySummary } from "@/lib/scan/api";
import { workdaysBetween } from "@/lib/ui/dtr";
import { formatClock, formatShortDate, officeDateIso } from "@/lib/ui/format";
import type { ScanContext } from "@/lib/ui/queries/intern";
import { REVIEW_THRESHOLD_WORKDAYS, type StatusKind } from "@/lib/ui/status";
import { clockToMinutes } from "@/lib/ui/timeline";
import type {
  AttendanceDayVM,
  AttendanceRowVM,
  AttendanceStatusFilter,
  AttendanceVM,
  HistoryDayVM,
  HoursRowVM,
  HrOverviewVM,
  InternHistoryVM,
  InternHomeVM,
  NeedsYouItemVM,
  OfficeTodayItemVM,
  SessionDetailVM,
  SessionScanVM,
} from "@/lib/ui/view-models";
import {
  aggregateDayCredits,
  computeIntentExpiry,
  dateToIso,
  policyToUiRules,
  validateLocationFreshness,
} from "@/modules/attendance/credit";
import { recordAuditEvent } from "@/modules/audit";

export interface CreateScanIntentInput {
  readonly actorId: string;
  readonly qrToken: string;
  readonly correlationId: string;
}

export interface CreateScanIntentResult {
  readonly intentId: string;
  readonly action: "TIME_IN" | "TIME_OUT";
  readonly checkpointName: string;
  readonly expiresAtUtc: string;
}

export interface SubmitScanInput {
  readonly actorId: string;
  readonly intentId: string;
  readonly requestKey: string;
  readonly location: LatLng & {
    readonly accuracyMeters: number;
    readonly capturedAtUtc: Date;
  };
  readonly correlationId: string;
}

export interface SubmitScanReceiptPayload {
  readonly receiptId: string;
  readonly decision: "ACCEPTED";
  readonly action: "TIME_IN" | "TIME_OUT";
  readonly checkpointName: string;
  readonly sessionId: string;
  readonly receivedAtUtc: string;
  readonly sessionVersion: number;
  readonly attendanceVersion: number;
}

export interface SubmitScanHttpOutcome {
  readonly httpStatus: number;
  readonly body: unknown;
  readonly replayed: boolean;
}

function buildAppUrl(path: string): string {
  const base = (process.env.APP_ORIGIN || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

function formatCheckpointLabel(name: string, action: "TIME_IN" | "TIME_OUT"): string {
  return `${name} · ${action === "TIME_IN" ? "IN" : "OUT"}`;
}

export async function createScanIntent(input: CreateScanIntentInput): Promise<CreateScanIntentResult> {
  const qrConfig = loadQrKeyringConfig();
  let verified;
  try {
    verified = await verifyQrCredential(input.qrToken, {
      issuer: qrConfig.issuer,
      audience: qrConfig.audience,
      keyring: qrConfig.keyring,
    });
  } catch (error) {
    if (error instanceof QrVerificationError) {
      throw new AppError(422, error.code, error.message, false);
    }
    throw new AppError(422, "QR_INVALID", "Invalid QR code.", false);
  }

  return withTransientDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: input.actorId },
        select: { id: true, role: true, status: true },
      });
      if (!user || user.role !== "INTERN" || user.status !== "ACTIVE") {
        throw new AppError(403, "ACCOUNT_INACTIVE", "Only active intern accounts can scan.", false);
      }

      const internship = await tx.internship.findFirst({
        where: { internUserId: user.id, status: "ACTIVE" },
      });
      if (!internship) {
        throw new AppError(403, "NO_ACTIVE_INTERNSHIP", "No active internship found.", false);
      }

      // Lock parent Internship row first (Technical Design §4 locking protocol)
      await tx.$queryRaw`SELECT id FROM "internship" WHERE id = ${internship.id}::uuid FOR UPDATE`;

      const freshInternship = await tx.internship.findUniqueOrThrow({
        where: { id: internship.id },
        include: { office: true },
      });

      const checkpoint = await tx.qrCheckpoint.findUnique({
        where: { id: verified.checkpointId },
      });
      if (!checkpoint || checkpoint.officeId !== freshInternship.officeId) {
        throw new AppError(422, "QR_INVALID", "This QR code is not valid for your office.", false);
      }
      if (!checkpoint.active || checkpoint.credentialVersion !== verified.credentialVersion) {
        throw new AppError(422, "QR_REVOKED", "This QR code has been replaced. Scan the latest office code.", false);
      }
      if (checkpoint.action !== verified.action) {
        throw new AppError(422, "QR_INVALID", "QR action mismatch.", false);
      }

      const [clockRow] = await tx.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;
      const serverNow = clockRow?.now ?? new Date();

      if (checkpoint.credentialExpiresAtUtc && checkpoint.credentialExpiresAtUtc <= serverNow) {
        throw new AppError(422, "QR_EXPIRED", "This QR code has expired.", false);
      }

      // Require an active published policy before accepting any scan (Tech Design §7)
      const activePolicy = await tx.attendancePolicyVersion.findFirst({
        where: {
          officeId: freshInternship.officeId,
          status: "PUBLISHED",
          effectiveFromUtc: { lte: serverNow },
        },
        orderBy: { version: "desc" },
      });
      if (!activePolicy) {
        throw new AppError(422, "POLICY_NOT_CONFIGURED", "Office attendance policy is not configured.", false);
      }

      const unclosedSession = await tx.attendanceSession.findFirst({
        where: {
          internshipId: freshInternship.id,
          effectiveTimeInUtc: { not: null },
          effectiveTimeOutUtc: null,
          status: { in: ["OPEN", "REVIEW"] },
        },
      });

      if (verified.action === "TIME_IN" && unclosedSession) {
        throw new AppError(409, "ALREADY_TIMED_IN", "You already have an open Time in session.", false);
      }
      if (verified.action === "TIME_OUT" && !unclosedSession) {
        throw new AppError(409, "NO_OPEN_SESSION", "You do not have an open Time in session to close.", false);
      }

      const expiresAtUtc = computeIntentExpiry(verified.expiresAtUtc, serverNow);
      if (expiresAtUtc <= serverNow) {
        throw new AppError(422, "QR_EXPIRED", "This QR code has expired.", false);
      }

      const intent = await tx.scanIntent.create({
        data: {
          actorId: user.id,
          internshipId: freshInternship.id,
          checkpointId: checkpoint.id,
          actionSnapshot: verified.action,
          credentialVersion: checkpoint.credentialVersion,
          expectedAttendanceVersion: freshInternship.attendanceVersion,
          expectedSessionId: unclosedSession?.id ?? null,
          expectedSessionVersion: unclosedSession?.version ?? null,
          issuedAtUtc: serverNow,
          expiresAtUtc,
        },
      });

      return {
        intentId: intent.id,
        action: intent.actionSnapshot,
        checkpointName: formatCheckpointLabel(checkpoint.name, checkpoint.action),
        expiresAtUtc: expiresAtUtc.toISOString(),
      };
    }),
  );
}

function makeTerminalErrorBody(
  code: string,
  message: string,
  correlationId: string,
  details?: Record<string, Prisma.InputJsonValue>,
): Prisma.InputJsonValue {
  return {
    error: {
      code,
      message,
      retryable: false,
      correlationId,
      ...(details ? { details } : {}),
    },
  };
}

export async function submitScan(input: SubmitScanInput): Promise<SubmitScanHttpOutcome> {
  if (
    !Number.isFinite(input.location.latitude) ||
    input.location.latitude < -90 ||
    input.location.latitude > 90 ||
    !Number.isFinite(input.location.longitude) ||
    input.location.longitude < -180 ||
    input.location.longitude > 180 ||
    !Number.isFinite(input.location.accuracyMeters) ||
    input.location.accuracyMeters < 0
  ) {
    throw new AppError(400, "INVALID_LOCATION", "Location coordinates and accuracy must be valid finite numbers.", false);
  }

  const payloadHash = canonicalPayloadHash({
    intentId: input.intentId,
    requestKey: input.requestKey,
    location: {
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      accuracyMeters: input.location.accuracyMeters,
      capturedAtUtc: input.location.capturedAtUtc.toISOString(),
    },
  });

  // Step 1: Pre-check existing committed receipt for exact replay or KEY_REUSED
  const existingReceipt = await prisma.scanReceipt.findUnique({
    where: { actorId_requestKey: { actorId: input.actorId, requestKey: input.requestKey } },
  });
  if (existingReceipt) {
    if (existingReceipt.payloadHash !== payloadHash) {
      throw new AppError(409, "KEY_REUSED", "Request key was already used with a different payload.", false);
    }
    return {
      httpStatus: existingReceipt.httpStatus,
      body: existingReceipt.resultSnapshot,
      replayed: true,
    };
  }

  try {
    return await withTransientDbRetry(() =>
      prisma.$transaction(async (tx): Promise<SubmitScanHttpOutcome> => {
        // Step 2: Reserve receipt before acquiring attendance locks (Tech Design §4)
        const receipt = await tx.scanReceipt.create({
          data: {
            actorId: input.actorId,
            requestKey: input.requestKey,
            payloadHash,
            httpStatus: 202,
            decisionCode: "PENDING",
            resultSnapshot: {},
          },
        });

        const finalize = async (
          httpStatus: number,
          decisionCode: string,
          body: Prisma.InputJsonValue,
          consumeIntentId?: string,
        ): Promise<SubmitScanHttpOutcome> => {
          if (consumeIntentId) {
            await tx.scanIntent.update({
              where: { id: consumeIntentId },
              data: { consumedReceiptId: receipt.id },
            });
          }
          await tx.scanReceipt.update({
            where: { id: receipt.id },
            data: {
              httpStatus,
              decisionCode,
              resultSnapshot: body,
            },
          });
          return { httpStatus, body, replayed: false };
        };

        // Load and lock intent
        const intent = await tx.scanIntent.findUnique({
          where: { id: input.intentId },
        });
        if (!intent || intent.actorId !== input.actorId) {
          throw new AppError(404, "INTENT_NOT_FOUND", "Scan intent not found.", false);
        }

        // Lock parent Internship first, then session if OUT
        await tx.$queryRaw`SELECT id FROM "internship" WHERE id = ${intent.internshipId}::uuid FOR UPDATE`;
        if (intent.expectedSessionId) {
          await tx.$queryRaw`SELECT id FROM "attendance_session" WHERE id = ${intent.expectedSessionId}::uuid FOR UPDATE`;
        }

        // Read DB time AFTER acquiring locks so lock wait cannot backdate attendance
        const [clockRow] = await tx.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;
        const serverNow = clockRow?.now ?? new Date();

        const [user, internship, checkpoint] = await Promise.all([
          tx.user.findUnique({ where: { id: input.actorId }, select: { id: true, role: true, status: true } }),
          tx.internship.findUnique({ where: { id: intent.internshipId }, include: { office: true } }),
          tx.qrCheckpoint.findUnique({ where: { id: intent.checkpointId } }),
        ]);

        if (!user || user.role !== "INTERN" || user.status !== "ACTIVE" || !internship || internship.status !== "ACTIVE") {
          return finalize(
            403,
            "ACCOUNT_INACTIVE",
            makeTerminalErrorBody("ACCOUNT_INACTIVE", "Account or internship is no longer active.", input.correlationId),
            intent.consumedReceiptId ? undefined : intent.id,
          );
        }

        if (intent.consumedReceiptId) {
          return finalize(
            409,
            "INTENT_CONSUMED",
            makeTerminalErrorBody("INTENT_CONSUMED", "This scan attempt was already completed. Scan again.", input.correlationId),
          );
        }

        if (intent.expiresAtUtc <= serverNow) {
          return finalize(
            409,
            "INTENT_EXPIRED",
            makeTerminalErrorBody("INTENT_EXPIRED", "Scan attempt timed out. Scan the office QR code again.", input.correlationId),
            intent.id,
          );
        }

        if (
          !checkpoint ||
          !checkpoint.active ||
          checkpoint.credentialVersion !== intent.credentialVersion ||
          (checkpoint.credentialExpiresAtUtc && checkpoint.credentialExpiresAtUtc <= serverNow)
        ) {
          return finalize(
            422,
            "QR_REVOKED",
            makeTerminalErrorBody("QR_REVOKED", "This QR code is no longer active.", input.correlationId),
            intent.id,
          );
        }

        if (internship.attendanceVersion !== intent.expectedAttendanceVersion) {
          return finalize(
            409,
            "STALE_STATE",
            makeTerminalErrorBody("STALE_STATE", "Your attendance state changed. Refresh and scan again.", input.correlationId),
            intent.id,
          );
        }

        const expectedSession = intent.expectedSessionId
          ? await tx.attendanceSession.findUnique({ where: { id: intent.expectedSessionId } })
          : null;

        if (
          intent.expectedSessionId &&
          (!expectedSession || expectedSession.version !== intent.expectedSessionVersion)
        ) {
          return finalize(
            409,
            "STALE_STATE",
            makeTerminalErrorBody("STALE_STATE", "Your open session changed. Refresh and scan again.", input.correlationId),
            intent.id,
          );
        }

        // Location freshness + geodesic rule
        const freshness = validateLocationFreshness(input.location.capturedAtUtc, serverNow);
        const office = internship.office;
        const distanceMeters = Math.round(
          haversineDistanceMeters(
            { latitude: Number(office.latitude), longitude: Number(office.longitude) },
            { latitude: input.location.latitude, longitude: input.location.longitude },
          ),
        );
        const roundedAccuracy = Math.round(input.location.accuracyMeters);

        const locationEvidence = {
          latitude: input.location.latitude,
          longitude: input.location.longitude,
          accuracyMeters: input.location.accuracyMeters,
          capturedAtUtc: input.location.capturedAtUtc.toISOString(),
          distanceMeters,
          officeConfigVersion: office.configVersion,
          geofenceRadiusMeters: office.geofenceRadiusMeters,
          maxAccuracyMeters: office.maxAccuracyMeters,
        };

        if (!freshness.ok) {
          await tx.attendanceScan.create({
            data: {
              internshipId: internship.id,
              checkpointId: checkpoint.id,
              sessionId: null,
              receivedAtUtc: serverNow,
              locationEvidence,
              validationStatus: "REJECTED",
              validationFlags: { code: "LOCATION_STALE" },
              receiptId: receipt.id,
              actionSnapshot: intent.actionSnapshot,
            },
          });
          return finalize(
            422,
            "LOCATION_STALE",
            makeTerminalErrorBody("LOCATION_UNCERTAIN", "Location sample was stale. Try scanning again.", input.correlationId, {
              distanceMeters,
              radiusMeters: office.geofenceRadiusMeters,
              accuracyMeters: roundedAccuracy,
              maxAccuracyMeters: office.maxAccuracyMeters,
            }),
            intent.id,
          );
        }

        const locationDecision = evaluateLocation({
          distanceMeters,
          accuracyMeters: input.location.accuracyMeters,
          geofenceRadiusMeters: office.geofenceRadiusMeters,
          maxAccuracyMeters: office.maxAccuracyMeters,
        });

        if (locationDecision !== "ACCEPT") {
          const isOutside = locationDecision === "OUTSIDE";
          const code = isOutside ? "OUTSIDE_GEOFENCE" : "LOCATION_UNCERTAIN";
          await tx.attendanceScan.create({
            data: {
              internshipId: internship.id,
              checkpointId: checkpoint.id,
              sessionId: null,
              receivedAtUtc: serverNow,
              locationEvidence,
              validationStatus: isOutside ? "REJECTED" : "UNCERTAIN",
              validationFlags: { code, locationDecision },
              receiptId: receipt.id,
              actionSnapshot: intent.actionSnapshot,
            },
          });
          return finalize(
            422,
            code,
            makeTerminalErrorBody(
              code,
              isOutside
                ? "Your phone appears to be outside the office area."
                : "Location accuracy is not precise enough to confirm you are inside the office.",
              input.correlationId,
              {
                distanceMeters,
                radiusMeters: office.geofenceRadiusMeters,
                accuracyMeters: roundedAccuracy,
                maxAccuracyMeters: office.maxAccuracyMeters,
              },
            ),
            intent.id,
          );
        }

        // Accepted scan! Apply session transition atomically
        const todayIso = officeDateIso(serverNow, office.timezone);
        const todayDate = new Date(`${todayIso}T00:00:00Z`);
        let sessionId: string;
        let sessionVersion: number;
        let crossMidnight = false;

        if (intent.actionSnapshot === "TIME_IN") {
          // Pin day policy from existing session on todayIso or latest effective published policy
          const existingDaySession = await tx.attendanceSession.findFirst({
            where: { internshipId: internship.id, attendanceDate: todayDate },
            orderBy: { createdAt: "asc" },
            select: { policyVersionId: true },
          });
          const policyVersionId =
            existingDaySession?.policyVersionId ??
            (
              await tx.attendancePolicyVersion.findFirst({
                where: {
                  officeId: office.id,
                  status: "PUBLISHED",
                  effectiveFromUtc: { lte: serverNow },
                },
                orderBy: { version: "desc" },
                select: { id: true },
              })
            )?.id;

          if (!policyVersionId) {
            return finalize(
              422,
              "POLICY_NOT_CONFIGURED",
              makeTerminalErrorBody("POLICY_NOT_CONFIGURED", "Office attendance policy is not configured.", input.correlationId),
              intent.id,
            );
          }

          const createdSession = await tx.attendanceSession.create({
            data: {
              internshipId: internship.id,
              policyVersionId,
              attendanceDate: todayDate,
              effectiveTimeInUtc: serverNow,
              status: "OPEN",
              version: 1,
              timezoneSnapshot: office.timezone,
              departmentIdSnapshot: internship.departmentId,
            },
          });
          sessionId = createdSession.id;
          sessionVersion = createdSession.version;
        } else {
          if (!expectedSession) {
            return finalize(
              409,
              "NO_OPEN_SESSION",
              makeTerminalErrorBody("NO_OPEN_SESSION", "No open session to close.", input.correlationId),
              intent.id,
            );
          }
          const sessionDateIso = dateToIso(expectedSession.attendanceDate);
          crossMidnight = sessionDateIso !== todayIso;
          const updatedSession = await tx.attendanceSession.update({
            where: { id: expectedSession.id },
            data: {
              effectiveTimeOutUtc: serverNow,
              status: crossMidnight ? "REVIEW" : "COMPLETE",
              version: { increment: 1 },
            },
          });
          sessionId = updatedSession.id;
          sessionVersion = updatedSession.version;
        }

        await tx.attendanceScan.create({
          data: {
            internshipId: internship.id,
            checkpointId: checkpoint.id,
            sessionId,
            receivedAtUtc: serverNow,
            locationEvidence,
            validationStatus: "ACCEPTED",
            validationFlags: crossMidnight ? { crossMidnight: true } : {},
            receiptId: receipt.id,
            actionSnapshot: intent.actionSnapshot,
          },
        });

        const updatedInternship = await tx.internship.update({
          where: { id: internship.id },
          data: { attendanceVersion: { increment: 1 } },
          select: { attendanceVersion: true },
        });

        const checkpointLabel = formatCheckpointLabel(checkpoint.name, checkpoint.action);
        const resultPayload: SubmitScanReceiptPayload = {
          receiptId: receipt.id,
          decision: "ACCEPTED",
          action: intent.actionSnapshot,
          checkpointName: checkpointLabel,
          sessionId,
          receivedAtUtc: serverNow.toISOString(),
          sessionVersion,
          attendanceVersion: updatedInternship.attendanceVersion,
        };

        await recordAuditEvent(tx, {
          actorId: input.actorId,
          action: crossMidnight ? "attendance.session_held_overnight" : "attendance.scan_accepted",
          resourceType: "attendance_session",
          resourceId: sessionId,
          afterValues: {
            action: intent.actionSnapshot,
            sessionVersion,
            attendanceVersion: updatedInternship.attendanceVersion,
            crossMidnight,
            summary: `${intent.actionSnapshot === "TIME_IN" ? "Time in" : "Time out"} saved${crossMidnight ? " (held for overnight review)" : ""}`,
          },
          correlationId: input.correlationId,
        });

        return finalize(201, "ACCEPTED", resultPayload as unknown as Prisma.InputJsonValue, intent.id);
      }),
    );
  } catch (error) {
    // Handle concurrent race on unique (actorId, requestKey) by replaying the committed receipt
    if (getDbErrorCode(error) === "P2002") {
      const winner = await prisma.scanReceipt.findUnique({
        where: { actorId_requestKey: { actorId: input.actorId, requestKey: input.requestKey } },
      });
      if (winner) {
        if (winner.payloadHash !== payloadHash) {
          throw new AppError(409, "KEY_REUSED", "Request key was already used with a different payload.", false);
        }
        return {
          httpStatus: winner.httpStatus,
          body: winner.resultSnapshot,
          replayed: true,
        };
      }
    }
    throw error;
  }
}

export async function getScanReceipt(
  actorId: string,
  requestKey: string,
): Promise<{ readonly httpStatus: number; readonly result: unknown } | null> {
  const receipt = await prisma.scanReceipt.findUnique({
    where: { actorId_requestKey: { actorId, requestKey } },
  });
  if (!receipt || receipt.decisionCode === "PENDING") return null;
  return {
    httpStatus: receipt.httpStatus,
    result: receipt.resultSnapshot,
  };
}

export async function getMeSummary(actor: ActiveInternActor): Promise<TodaySummary> {
  const timeZone = actor.internship.timeZone;
  const todayIso = officeDateIso(new Date(), timeZone);

  const [sessions, pendingCorrections] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { internshipId: actor.internship.id },
      include: { policyVersion: true },
      orderBy: [{ attendanceDate: "asc" }, { effectiveTimeInUtc: "asc" }],
    }),
    prisma.correctionRequest.count({
      where: { internshipId: actor.internship.id, status: { in: ["PENDING", "NEEDS_INFO"] } },
    }),
  ]);

  const credits = aggregateDayCredits(
    sessions.map((s) => ({
      attendanceDateIso: dateToIso(s.attendanceDate),
      status: s.status,
      effectiveTimeInUtc: s.effectiveTimeInUtc,
      effectiveTimeOutUtc: s.effectiveTimeOutUtc,
      timezoneSnapshot: s.timezoneSnapshot,
      policyVersion: s.policyVersion,
    })),
    actor.internship.requiredMinutes,
  );

  const todaySessions = sessions.filter((s) => dateToIso(s.attendanceDate) === todayIso);
  const lastToday = todaySessions.at(-1);

  return {
    sessionStart: lastToday?.effectiveTimeInUtc
      ? formatClock(lastToday.effectiveTimeInUtc, timeZone)
      : undefined,
    sessionEnd: lastToday?.effectiveTimeOutUtc
      ? formatClock(lastToday.effectiveTimeOutUtc, timeZone)
      : undefined,
    creditedTodayMinutes: credits.byDate.get(todayIso)?.creditedMinutes ?? 0,
    creditedTotalMinutes: credits.totalCreditedMinutes,
    requiredMinutes: actor.internship.requiredMinutes,
    pendingCorrections,
  };
}

export async function getMeAttendance(
  actor: ActiveInternActor,
  filters: { readonly from?: string; readonly to?: string; readonly cursor?: string; readonly limit?: number },
) {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const where: Prisma.AttendanceSessionWhereInput = {
    internshipId: actor.internship.id,
    ...(filters.from || filters.to
      ? {
          attendanceDate: {
            ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00Z`) } : {}),
            ...(filters.to ? { lte: new Date(`${filters.to}T00:00:00Z`) } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.attendanceSession.findMany({
    where,
    include: { policyVersion: true },
    orderBy: [{ attendanceDate: "desc" }, { effectiveTimeInUtc: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const credits = aggregateDayCredits(
    page.map((s) => ({
      attendanceDateIso: dateToIso(s.attendanceDate),
      status: s.status,
      effectiveTimeInUtc: s.effectiveTimeInUtc,
      effectiveTimeOutUtc: s.effectiveTimeOutUtc,
      timezoneSnapshot: s.timezoneSnapshot,
      policyVersion: s.policyVersion,
    })),
    actor.internship.requiredMinutes,
  );

  return {
    items: page.map((s) => {
      const dateIso = dateToIso(s.attendanceDate);
      return {
        id: s.id,
        attendanceDate: dateIso,
        effectiveTimeInUtc: s.effectiveTimeInUtc?.toISOString() ?? null,
        effectiveTimeOutUtc: s.effectiveTimeOutUtc?.toISOString() ?? null,
        status: s.status,
        version: s.version,
        timezone: s.timezoneSnapshot,
        policyVersion: s.policyVersion.version,
        creditedDayMinutes: credits.byDate.get(dateIso)?.creditedMinutes ?? 0,
      };
    }),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function getScanContextData(actor: ActiveInternActor): Promise<ScanContext> {
  const timeZone = actor.internship.timeZone;
  const todayIso = officeDateIso(new Date(), timeZone);
  const openSession = await prisma.attendanceSession.findFirst({
    where: {
      internshipId: actor.internship.id,
      effectiveTimeInUtc: { not: null },
      effectiveTimeOutUtc: null,
      status: { in: ["OPEN", "REVIEW"] },
    },
    orderBy: { effectiveTimeInUtc: "desc" },
  });

  return {
    internName: actor.name,
    initials: initialsOf(actor.name),
    department: actor.internship.departmentName,
    todayIso,
    timeZone,
    openSince: openSession?.effectiveTimeInUtc
      ? formatClock(openSession.effectiveTimeInUtc, timeZone)
      : null,
  };
}

export async function getInternHomeData(actor: ActiveInternActor): Promise<InternHomeVM> {
  const timeZone = actor.internship.timeZone;
  const now = new Date();
  const todayIso = officeDateIso(now, timeZone);
  const nowClock = formatClock(now, timeZone);

  const [sessions, openCorr, latestPolicy] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { internshipId: actor.internship.id },
      include: { policyVersion: true },
      orderBy: [{ attendanceDate: "asc" }, { effectiveTimeInUtc: "asc" }],
    }),
    prisma.correctionRequest.findFirst({
      where: { internshipId: actor.internship.id, status: { in: ["PENDING", "NEEDS_INFO"] } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.attendancePolicyVersion.findFirst({
      where: { officeId: actor.internship.officeId, status: "PUBLISHED" },
      orderBy: { version: "desc" },
    }),
  ]);

  const credits = aggregateDayCredits(
    sessions.map((s) => ({
      attendanceDateIso: dateToIso(s.attendanceDate),
      status: s.status,
      effectiveTimeInUtc: s.effectiveTimeInUtc,
      effectiveTimeOutUtc: s.effectiveTimeOutUtc,
      timezoneSnapshot: s.timezoneSnapshot,
      policyVersion: s.policyVersion,
    })),
    actor.internship.requiredMinutes,
  );

  const todaySessions = sessions.filter((s) => dateToIso(s.attendanceDate) === todayIso);
  const openSession = sessions.find(
    (s) => s.effectiveTimeInUtc && !s.effectiveTimeOutUtc && (s.status === "OPEN" || s.status === "REVIEW"),
  );
  const rules = latestPolicy ? policyToUiRules(latestPolicy) : null;

  return {
    identity: {
      name: actor.name,
      initials: initialsOf(actor.name),
      department: actor.internship.departmentName,
      timeZone,
    },
    todayIso,
    nowClock,
    today: {
      openSince: openSession?.effectiveTimeInUtc
        ? formatClock(openSession.effectiveTimeInUtc, timeZone)
        : null,
      sessions: todaySessions
        .filter((s) => s.effectiveTimeInUtc)
        .map((s) => ({
          start: formatClock(s.effectiveTimeInUtc!, s.timezoneSnapshot),
          end: s.effectiveTimeOutUtc ? formatClock(s.effectiveTimeOutUtc, s.timezoneSnapshot) : null,
        })),
    },
    schedule: rules ? { start: rules.start, end: rules.end } : { start: "08:00", end: "19:00" },
    hours: {
      creditedMinutes: credits.totalCreditedMinutes,
      requiredMinutes: actor.internship.requiredMinutes,
      endDateIso: actor.internship.endDate ? dateToIso(actor.internship.endDate) : todayIso,
      workdaysLeft:
        actor.internship.endDate && dateToIso(actor.internship.endDate) >= todayIso
          ? workdaysBetween(todayIso, dateToIso(actor.internship.endDate))
          : 0,
    },
    openCorrection: openCorr
      ? {
          id: openCorr.id,
          dateIso: dateToIso(openCorr.attendanceDate),
          status: openCorr.status,
          activity:
            openCorr.status === "NEEDS_INFO"
              ? "HR asked for details"
              : `Sent ${formatShortDate(officeDateIso(openCorr.submittedAtUtc, timeZone))}`,
        }
      : null,
  };
}

export async function getInternHistoryData(
  actor: ActiveInternActor,
  monthIso: string,
): Promise<InternHistoryVM> {
  const timeZone = actor.internship.timeZone;
  const todayIso = officeDateIso(new Date(), timeZone);
  const [year, month] = monthIso.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const fromIso = `${monthIso}-01`;
  const toIso = `${monthIso}-${String(lastDay).padStart(2, "0")}`;

  const [sessions, corrections] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: {
        internshipId: actor.internship.id,
        attendanceDate: {
          gte: new Date(`${fromIso}T00:00:00Z`),
          lte: new Date(`${toIso}T00:00:00Z`),
        },
      },
      include: { policyVersion: true, revisions: { take: 1 } },
      orderBy: [{ attendanceDate: "desc" }, { effectiveTimeInUtc: "asc" }],
    }),
    prisma.correctionRequest.findMany({
      where: {
        internshipId: actor.internship.id,
        attendanceDate: {
          gte: new Date(`${fromIso}T00:00:00Z`),
          lte: new Date(`${toIso}T00:00:00Z`),
        },
        status: { not: "SUPERSEDED" },
      },
      orderBy: { submittedAtUtc: "desc" },
    }),
  ]);

  const credits = aggregateDayCredits(
    sessions.map((s) => ({
      attendanceDateIso: dateToIso(s.attendanceDate),
      status: s.status,
      effectiveTimeInUtc: s.effectiveTimeInUtc,
      effectiveTimeOutUtc: s.effectiveTimeOutUtc,
      timezoneSnapshot: s.timezoneSnapshot,
      policyVersion: s.policyVersion,
    })),
    actor.internship.requiredMinutes,
  );

  const byDate = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const iso = dateToIso(s.attendanceDate);
    const list = byDate.get(iso);
    if (list) list.push(s);
    else byDate.set(iso, [s]);
  }
  const corrByDate = new Map<string, (typeof corrections)[number]>();
  for (const c of corrections) {
    const iso = dateToIso(c.attendanceDate);
    if (!corrByDate.has(iso)) corrByDate.set(iso, c);
  }

  const allDateKeys = Array.from(new Set([...byDate.keys(), ...corrByDate.keys()])).sort((a, b) =>
    b.localeCompare(a),
  );

  const days: HistoryDayVM[] = allDateKeys.map((iso) => {
    const daySessions = byDate.get(iso) ?? [];
    const corr = corrByDate.get(iso);
    const hasOpen = daySessions.some((s) => s.status === "OPEN");
    const hasReview = daySessions.some((s) => s.status === "REVIEW");
    const hasComplete = daySessions.some((s) => s.status === "COMPLETE");
    const corrected = daySessions.some((s) => s.revisions.length > 0);
    const dayCredit = credits.byDate.get(iso);

    return {
      dateIso: iso,
      sessions: daySessions
        .filter((s) => s.effectiveTimeInUtc)
        .map((s) => ({
          start: formatClock(s.effectiveTimeInUtc!, s.timezoneSnapshot),
          end: s.effectiveTimeOutUtc ? formatClock(s.effectiveTimeOutUtc, s.timezoneSnapshot) : null,
        })),
      creditedMinutes: hasOpen ? null : (dayCredit?.creditedMinutes ?? 0),
      kind: hasOpen ? "open" : hasReview ? "incomplete" : hasComplete ? "complete" : "none",
      corrected,
      correction: corr ? { id: corr.id, status: corr.status } : undefined,
    };
  });

  const endCap = toIso > todayIso ? todayIso : toIso;
  const workdays = fromIso <= endCap ? workdaysBetween(fromIso, endCap) : 0;

  return {
    identity: {
      name: actor.name,
      initials: initialsOf(actor.name),
      department: actor.internship.departmentName,
      timeZone,
    },
    monthIso,
    creditedMinutes: credits.totalCreditedMinutes,
    daysWithHours: days.filter((d) => (d.creditedMinutes ?? 0) > 0).length,
    workdays,
    days,
    canGoNext: monthIso < todayIso.slice(0, 7),
  };
}

export async function getHrTodayOverview(): Promise<HrOverviewVM> {
  const office = await prisma.office.findFirst({ orderBy: { createdAt: "asc" } });
  const timeZone = office?.timezone ?? "Asia/Manila";
  const now = new Date();
  const todayIso = officeDateIso(now, timeZone);
  const nowClock = formatClock(now, timeZone);
  const todayDate = new Date(`${todayIso}T00:00:00Z`);

  const [activeInternships, todaySessions, missingClockOuts, pendingCorrections, heldSessions, todayScans] =
    await Promise.all([
      prisma.internship.findMany({
        where: { status: "ACTIVE", intern: { status: "ACTIVE" } },
        include: {
          intern: { select: { id: true, name: true } },
          department: { select: { name: true } },
          sessions: { where: { status: "COMPLETE" }, include: { policyVersion: true } },
        },
      }),
      prisma.attendanceSession.findMany({
        where: { attendanceDate: todayDate },
        include: {
          internship: {
            include: {
              intern: { select: { id: true, name: true } },
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.attendanceSession.count({
        where: {
          attendanceDate: { lt: todayDate },
          effectiveTimeInUtc: { not: null },
          effectiveTimeOutUtc: null,
          status: { in: ["OPEN", "REVIEW"] },
        },
      }),
      prisma.correctionRequest.findMany({
        where: { status: "PENDING" },
        include: {
          internship: { include: { intern: { select: { name: true } } } },
          assessments: { where: { runStatus: "SUCCEEDED" }, take: 1 },
        },
        orderBy: { submittedAtUtc: "asc" },
      }),
      prisma.attendanceSession.findMany({
        where: { status: "REVIEW" },
        include: {
          internship: { include: { intern: { select: { name: true } } } },
        },
        orderBy: { attendanceDate: "asc" },
      }),
      prisma.attendanceScan.count({
        where: {
          receivedAtUtc: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

  const needsYou: NeedsYouItemVM[] = [
    ...pendingCorrections.map((c): NeedsYouItemVM => {
      const ageDays = Math.max(0, Math.floor((now.getTime() - c.submittedAtUtc.getTime()) / (24 * 60 * 60 * 1000)));
      const ageWorkdays = workdaysBetween(officeDateIso(c.submittedAtUtc, timeZone), todayIso);
      const dateIso = dateToIso(c.attendanceDate);
      return {
        id: c.id,
        href: `/hr/reviews/${c.id}`,
        internName: c.internship.intern.name,
        subject: c.sessionId ? "correction" : "missing-day",
        dateIso,
        detail: c.proposedTimeOutUtc
          ? `Proposes Time out ${formatClock(c.proposedTimeOutUtc, timeZone)}`
          : c.proposedTimeInUtc
            ? `Proposes Time in ${formatClock(c.proposedTimeInUtc, timeZone)}`
            : "Correction request",
        jevRead: c.assessments.length > 0,
        status: { type: "correction", value: "PENDING", ageWorkdays },
        ageDays,
      };
    }),
    ...heldSessions.map((s): NeedsYouItemVM => {
      const dateIso = dateToIso(s.attendanceDate);
      const ageDays = Math.max(0, Math.floor((now.getTime() - s.updatedAt.getTime()) / (24 * 60 * 60 * 1000)));
      return {
        id: s.id,
        href: `/hr/attendance?session=${encodeURIComponent(s.id)}#session-detail`,
        internName: s.internship.intern.name,
        subject: "session",
        dateIso,
        detail: "Held for review (overnight or incomplete)",
        jevRead: false,
        status: { type: "session", value: "REVIEW" },
        ageDays,
      };
    }),
  ].sort((a, b) => b.ageDays - a.ageDays);

  const officeToday: OfficeTodayItemVM[] = todaySessions.slice(0, 8).map((s) => ({
    internId: s.internship.intern.id,
    name: s.internship.intern.name,
    department: s.internship.department.name,
    status: { type: "session", value: s.status },
    time:
      s.status === "OPEN" && s.effectiveTimeInUtc
        ? formatClock(s.effectiveTimeInUtc, s.timezoneSnapshot)
        : s.effectiveTimeOutUtc
          ? formatClock(s.effectiveTimeOutUtc, s.timezoneSnapshot)
          : s.effectiveTimeInUtc
            ? formatClock(s.effectiveTimeInUtc, s.timezoneSnapshot)
            : "—",
  }));

  const hoursRows: HoursRowVM[] = activeInternships.map((internship) => {
    const credits = aggregateDayCredits(
      internship.sessions.map((s) => ({
        attendanceDateIso: dateToIso(s.attendanceDate),
        status: s.status,
        effectiveTimeInUtc: s.effectiveTimeInUtc,
        effectiveTimeOutUtc: s.effectiveTimeOutUtc,
        timezoneSnapshot: s.timezoneSnapshot,
        policyVersion: s.policyVersion,
      })),
      internship.requiredMinutes,
    );
    const startIso = dateToIso(internship.startDate);
    const endIso = internship.endDate ? dateToIso(internship.endDate) : todayIso;
    const totalWorkdays = Math.max(1, workdaysBetween(startIso, endIso >= startIso ? endIso : startIso));
    const elapsedWorkdays = startIso <= todayIso ? workdaysBetween(startIso, todayIso) : 0;
    const expectedMinutes = Math.round((internship.requiredMinutes * Math.min(elapsedWorkdays, totalWorkdays)) / totalWorkdays);

    return {
      internId: internship.intern.id,
      name: internship.intern.name,
      department: internship.department.name,
      creditedMinutes: credits.totalCreditedMinutes,
      requiredMinutes: internship.requiredMinutes,
      endDateIso: endIso,
      paceDeltaMinutes: credits.totalCreditedMinutes - expectedMinutes,
    };
  });

  const inOffice = todaySessions.filter((s) => s.status === "OPEN").length;
  const completedToday = todaySessions.filter((s) => s.status === "COMPLETE").length;

  return {
    todayIso,
    updatedAt: nowClock,
    kpis: {
      inOffice,
      activeInterns: activeInternships.length,
      completedToday,
      missingClockOut: missingClockOuts,
      waitingOnHr: needsYou.length,
      oldestWaitingDays: needsYou[0]?.ageDays ?? null,
    },
    needsYou: needsYou.slice(0, 6),
    officeToday,
    scansToday: todayScans,
    behindPace: [...hoursRows].sort((a, b) => a.paceDeltaMinutes - b.paceDeltaMinutes).slice(0, 4),
    finishingSoon: [...hoursRows].sort((a, b) => a.endDateIso.localeCompare(b.endDateIso)).slice(0, 4),
  };
}

export async function listSessionsByDay(filters: {
  readonly query?: string;
  readonly internId?: string;
  readonly department?: string | null;
  readonly status?: AttendanceStatusFilter;
  readonly session?: string;
  readonly from?: string;
  readonly to?: string;
}): Promise<AttendanceVM & { readonly timeZone: string; readonly from?: string; readonly to?: string }> {
  const [office, departments] = await Promise.all([
    prisma.office.findFirst({
      include: { policyVersions: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  const timeZone = office?.timezone ?? "Asia/Manila";
  const now = new Date();
  const todayIso = officeDateIso(now, timeZone);
  const nowClock = formatClock(now, timeZone);

  const defaultFromDate = new Date(`${todayIso}T12:00:00Z`);
  defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 13);
  const fromIso = filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from) ? filters.from : defaultFromDate.toISOString().slice(0, 10);
  const toIso = filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to) ? filters.to : todayIso;

  const departmentNames = departments.map((d) => d.name);
  const department = filters.department && departmentNames.includes(filters.department) ? filters.department : null;
  const validStatuses: AttendanceStatusFilter[] = ["all", "open", "complete", "review", "rejected"];
  const status = filters.status && validStatuses.includes(filters.status) ? filters.status : "all";
  const query = (filters.query ?? "").trim();
  const needle = query.toLowerCase();

  const departmentById = new Map(departments.map((d) => [d.id, d.name]));

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      attendanceDate: {
        gte: new Date(`${fromIso}T00:00:00Z`),
        lte: new Date(`${toIso}T00:00:00Z`),
      },
      ...(filters.internId ? { internship: { internUserId: filters.internId } } : {}),
    },
    include: {
      policyVersion: true,
      internship: { include: { intern: { select: { id: true, name: true } } } },
      scans: { include: { checkpoint: true }, orderBy: { receivedAtUtc: "asc" } },
      revisions: { include: { review: { include: { reviewer: { select: { name: true } } } } }, orderBy: { appliedAtUtc: "desc" } },
      corrections: { where: { status: { in: ["PENDING", "NEEDS_INFO"] } }, orderBy: { submittedAtUtc: "desc" }, take: 1 },
    },
    orderBy: [{ attendanceDate: "desc" }, { effectiveTimeInUtc: "asc" }],
  });

  // Group by attendanceDate -> internshipId
  const dayMap = new Map<string, Map<string, typeof sessions>>();
  for (const s of sessions) {
    const dateIso = dateToIso(s.attendanceDate);
    let internMap = dayMap.get(dateIso);
    if (!internMap) {
      internMap = new Map();
      dayMap.set(dateIso, internMap);
    }
    const list = internMap.get(s.internshipId);
    if (list) list.push(s);
    else internMap.set(s.internshipId, [s]);
  }

  let selected: SessionDetailVM | null = null;
  const days: AttendanceDayVM[] = [];

  for (const [dateIso, internMap] of Array.from(dayMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))) {
    const rows: AttendanceRowVM[] = [];
    let scanCount = 0;

    for (const [, daySessions] of internMap) {
      const first = daySessions[0]!;
      const intern = first.internship.intern;
      const deptName = departmentById.get(first.departmentIdSnapshot) ?? "Unassigned";

      const hasOpen = daySessions.some((s) => s.status === "OPEN");
      const hasReview = daySessions.some((s) => s.status === "REVIEW");
      const openCorr = daySessions.flatMap((s) => s.corrections)[0];
      const allScans = daySessions.flatMap((s) => s.scans);
      scanCount += allScans.length;

      const filterKey: Exclude<AttendanceStatusFilter, "all"> =
        hasReview || openCorr ? "review" : hasOpen ? "open" : "complete";

      const rowStatus: StatusKind = hasReview
        ? { type: "session", value: "REVIEW" }
        : openCorr
          ? {
              type: "correction",
              value: openCorr.status,
              ageWorkdays:
                openCorr.status === "PENDING"
                  ? workdaysBetween(officeDateIso(openCorr.submittedAtUtc, timeZone), todayIso)
                  : 0,
            }
          : hasOpen
            ? { type: "session", value: "OPEN" }
            : { type: "session", value: "COMPLETE" };

      const credits = aggregateDayCredits(
        daySessions.map((s) => ({
          attendanceDateIso: dateIso,
          status: s.status,
          effectiveTimeInUtc: s.effectiveTimeInUtc,
          effectiveTimeOutUtc: s.effectiveTimeOutUtc,
          timezoneSnapshot: s.timezoneSnapshot,
          policyVersion: s.policyVersion,
        })),
        first.internship.requiredMinutes,
      );

      const creditedMinutes = hasOpen || hasReview ? null : (credits.byDate.get(dateIso)?.creditedMinutes ?? 0);
      const rowId = first.id;

      const row: AttendanceRowVM = {
        id: rowId,
        internId: intern.id,
        internName: intern.name,
        department: deptName,
        sessions: daySessions
          .filter((s) => s.effectiveTimeInUtc)
          .map((s) => ({
            start: formatClock(s.effectiveTimeInUtc!, s.timezoneSnapshot),
            end: s.effectiveTimeOutUtc ? formatClock(s.effectiveTimeOutUtc, s.timezoneSnapshot) : null,
          })),
        held: hasReview,
        note: openCorr
          ? { label: openCorr.status === "NEEDS_INFO" ? "waiting on intern" : "correction pending", href: `/hr/reviews/${openCorr.id}` }
          : undefined,
        creditedMinutes,
        status: rowStatus,
        filter: filterKey,
      };

      if (filters.session === rowId || daySessions.some((s) => s.id === filters.session)) {
        const closed = row.sessions.filter((s) => s.end);
        const scansVm: SessionScanVM[] = allScans.map((scan) => {
          const ev = scan.locationEvidence as { distanceMeters?: number } | null;
          const scanDateIso = officeDateIso(scan.receivedAtUtc, timeZone);
          return {
            action: scan.actionSnapshot === "TIME_IN" ? "IN" : "OUT",
            time: formatClock(scan.receivedAtUtc, timeZone, { seconds: true }),
            dateIso: scanDateIso !== dateIso ? scanDateIso : undefined,
            qrLabel: formatCheckpointLabel(scan.checkpoint.name, scan.actionSnapshot),
            distanceM: Math.round(ev?.distanceMeters ?? 0),
            accepted: scan.validationStatus === "ACCEPTED",
            rejectReason: scan.validationStatus !== "ACCEPTED" ? scan.validationStatus : undefined,
          };
        });

        selected = {
          id: rowId,
          internId: intern.id,
          internName: intern.name,
          department: deptName,
          dateIso,
          version: first.version,
          policyVersion: first.policyVersion.version,
          status: rowStatus,
          heldReason: hasReview
            ? "Overnight or out-of-policy departure. Ask the intern to submit a correction so HR can review."
            : undefined,
          effective: daySessions.map((s) => {
            const outDateIso = s.effectiveTimeOutUtc ? officeDateIso(s.effectiveTimeOutUtc, s.timezoneSnapshot) : undefined;
            return {
              timeIn: s.effectiveTimeInUtc ? formatClock(s.effectiveTimeInUtc, s.timezoneSnapshot) : null,
              timeOut: s.effectiveTimeOutUtc ? formatClock(s.effectiveTimeOutUtc, s.timezoneSnapshot) : null,
              timeOutDateIso: outDateIso && outDateIso !== dateIso ? outDateIso : undefined,
            };
          }),
          elapsedMinutes:
            closed.length && closed.length === row.sessions.length
              ? closed.reduce((sum, s) => sum + clockToMinutes(s.end!) - clockToMinutes(s.start), 0)
              : null,
          creditedMinutes,
          scans: scansVm,
          revisions: daySessions.flatMap((s) =>
            s.revisions.map((rev) => ({
              label: `Approved by ${rev.review.reviewer.name}`,
              atLabel: `${formatShortDate(officeDateIso(rev.appliedAtUtc, timeZone))} · ${formatClock(rev.appliedAtUtc, timeZone)}`,
              before: JSON.stringify(rev.beforeValues),
              after: JSON.stringify(rev.afterValues),
            })),
          ),
          correction: openCorr ? { label: "Open the request", href: `/hr/reviews/${openCorr.id}` } : undefined,
          canAskForCorrection: hasReview && !openCorr,
        };
      }

      if (
        (status === "all" || row.filter === status) &&
        (!department || row.department === department) &&
        (!needle || row.internName.toLowerCase().includes(needle))
      ) {
        rows.push(row);
      }
    }

    if (rows.length > 0) {
      days.push({
        dateIso,
        isToday: dateIso === todayIso,
        scans: scanCount,
        rows,
      });
    }
  }

  const latestPolicy = office?.policyVersions[0];
  const rules = latestPolicy ? policyToUiRules(latestPolicy) : null;
  // Touch constant to keep threshold aligned
  void REVIEW_THRESHOLD_WORKDAYS;

  return {
    query,
    department,
    status,
    periodLabel: `${formatShortDate(fromIso)} – ${formatShortDate(toIso)}`,
    todayIso,
    nowClock,
    schedule: rules ? { start: rules.start, end: rules.end } : { start: "08:00", end: "19:00" },
    departments: departmentNames,
    days,
    selected,
    timeZone,
    from: fromIso,
    to: toIso,
    hasCustomRange: Boolean(filters.from || filters.to),
  };
}

export async function askForCorrection(input: {
  readonly actorId: string;
  readonly sessionId: string;
  readonly correlationId: string;
}): Promise<{ readonly notified: true }> {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: input.sessionId },
    include: {
      internship: { include: { intern: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!session) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Attendance session not found.", false);
  }

  const dateIso = dateToIso(session.attendanceDate);
  await prisma.$transaction(async (tx) => {
    await tx.attendanceSession.update({
      where: { id: session.id },
      data: { correctionRequestedAtUtc: new Date() },
    });
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "attendance.correction_requested",
      resourceType: "attendance_session",
      resourceId: session.id,
      afterValues: {
        attendanceDate: dateIso,
        summary: `Asked ${session.internship.intern.name} to submit a correction for ${dateIso}`,
      },
      correlationId: input.correlationId,
    });
  });

  await sendCorrectionRequestedEmail({
    to: session.internship.intern.email,
    firstName: session.internship.intern.name.split(/\s+/)[0] || session.internship.intern.name,
    dateIso,
    correctionUrl: buildAppUrl(`/corrections/new?date=${encodeURIComponent(dateIso)}`),
  }).catch(() => undefined);

  return { notified: true };
}
