/**
 * Durable PostgreSQL review_job queue processor using FOR UPDATE SKIP LOCKED
 * and lease-fenced write-back (Technical Design v1.0 section 9).
 */

import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { logInfo, logWarn } from "@/lib/http/logger";
import { buildMinimizedJevContext } from "@/worker/context";
import { callTypeSafeJev, computeRetryDelayMs, JevClientError } from "@/worker/jev-client";

export const LEASE_DURATION_MS = 60_000;
export const MAX_JOB_ATTEMPTS = 3;

export interface ClaimedReviewJob {
  readonly id: string;
  readonly correctionRequestId: string;
  readonly inputFingerprint: string;
  readonly modelVersion: string;
  readonly criteriaVersion: string;
  readonly attempts: number;
  readonly leaseToken: string;
}

/**
 * Atomically claim the oldest ready PENDING job or expired RUNNING lease using
 * PostgreSQL FOR UPDATE SKIP LOCKED, then commit before calling external APIs.
 */
export async function claimNextReviewJob(): Promise<ClaimedReviewJob | null> {
  const leaseToken = randomUUID();

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "review_job"
      WHERE ("state" = 'PENDING' AND "next_run_at_utc" <= NOW())
         OR ("state" = 'RUNNING' AND "lease_expires_at_utc" < NOW())
      ORDER BY "next_run_at_utc" ASC, "created_at" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;

    const [clockRow] = await tx.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;
    const now = clockRow?.now ?? new Date();
    const leaseExpiresAtUtc = new Date(now.getTime() + LEASE_DURATION_MS);

    const updated = await tx.reviewJob.update({
      where: { id: row.id },
      data: {
        state: "RUNNING",
        attempts: { increment: 1 },
        leaseToken,
        leaseExpiresAtUtc,
      },
    });

    return {
      id: updated.id,
      correctionRequestId: updated.correctionRequestId,
      inputFingerprint: updated.inputFingerprint,
      modelVersion: updated.modelVersion,
      criteriaVersion: updated.criteriaVersion,
      attempts: updated.attempts,
      leaseToken,
    };
  });
}

async function loadRequestContext(correctionRequestId: string) {
  const req = await prisma.correctionRequest.findUnique({
    where: { id: correctionRequestId },
    include: {
      session: { select: { effectiveTimeInUtc: true, effectiveTimeOutUtc: true } },
      comments: {
        include: { author: { select: { role: true } } },
        orderBy: { createdAtUtc: "asc" },
      },
    },
  });
  if (!req) return null;

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

  return { request: req, minimized };
}

export async function processClaimedJob(job: ClaimedReviewJob): Promise<void> {
  const loaded = await loadRequestContext(job.correctionRequestId);
  if (!loaded) {
    await prisma.reviewJob.updateMany({
      where: { id: job.id, leaseToken: job.leaseToken, state: "RUNNING" },
      data: { state: "FAILED", lastErrorCode: "CORRECTION_NOT_FOUND", leaseToken: null, leaseExpiresAtUtc: null },
    });
    return;
  }

  const { request, minimized } = loaded;
  const isAlreadyFinalized =
    request.status === "APPROVED" || request.status === "REJECTED" || request.status === "SUPERSEDED";

  // If the request was already finalized or superseded before we even call Jev, avoid wasting an external call
  if (isAlreadyFinalized || minimized.inputFingerprint !== job.inputFingerprint) {
    await prisma.reviewJob.updateMany({
      where: { id: job.id, leaseToken: job.leaseToken, state: "RUNNING" },
      data: { state: "SUCCEEDED", leaseToken: null, leaseExpiresAtUtc: null },
    });
    return;
  }

  try {
    const evaluation = await callTypeSafeJev(minimized, { modelVersion: job.modelVersion });
    const evaluatedAtUtc = new Date();

    // Re-check latest state inside completion transaction with lease fence
    await prisma.$transaction(async (tx) => {
      const stillOwned = await tx.reviewJob.findFirst({
        where: { id: job.id, leaseToken: job.leaseToken, state: "RUNNING" },
      });
      if (!stillOwned) {
        logWarn("worker.lease_lost", { jobId: job.id });
        return;
      }

      const latest = await tx.correctionRequest.findUnique({
        where: { id: job.correctionRequestId },
        include: {
          session: { select: { effectiveTimeInUtc: true, effectiveTimeOutUtc: true } },
          comments: {
            include: { author: { select: { role: true } } },
            orderBy: { createdAtUtc: "asc" },
          },
        },
      });

      let superseded = true;
      if (latest && (latest.status === "PENDING" || latest.status === "NEEDS_INFO")) {
        const latestCtx = buildMinimizedJevContext({
          requestVersion: latest.requestVersion,
          reasonCategory: latest.reasonCategory,
          explanation: latest.reason,
          comments: latest.comments.map((c) => ({
            role: c.author.role === "HR" ? "HR" : "INTERN",
            message: c.message,
          })),
          facts: {
            hasExistingSession: Boolean(latest.sessionId),
            hasRecordedTimeIn: Boolean(latest.session?.effectiveTimeInUtc),
            hasRecordedTimeOut: Boolean(latest.session?.effectiveTimeOutUtc),
            proposesTimeIn: Boolean(latest.proposedTimeInUtc),
            proposesTimeOut: Boolean(latest.proposedTimeOutUtc),
          },
        });
        superseded =
          latest.requestVersion !== request.requestVersion ||
          latestCtx.inputFingerprint !== job.inputFingerprint;
      }

      await tx.jevAssessment.upsert({
        where: {
          correctionRequestId_requestVersion_inputFingerprint_modelVersion_criteriaVersion: {
            correctionRequestId: job.correctionRequestId,
            requestVersion: request.requestVersion,
            inputFingerprint: job.inputFingerprint,
            modelVersion: job.modelVersion,
            criteriaVersion: job.criteriaVersion,
          },
        },
        update: {
          typedResults: evaluation.result as unknown as Prisma.InputJsonValue,
          runStatus: superseded ? "SUPERSEDED" : "SUCCEEDED",
          evaluatedAtUtc,
        },
        create: {
          correctionRequestId: job.correctionRequestId,
          requestVersion: request.requestVersion,
          modelVersion: job.modelVersion,
          criteriaVersion: job.criteriaVersion,
          inputFingerprint: job.inputFingerprint,
          inputSnapshot: minimized.inputSnapshot as unknown as Prisma.InputJsonValue,
          typedResults: evaluation.result as unknown as Prisma.InputJsonValue,
          runStatus: superseded ? "SUPERSEDED" : "SUCCEEDED",
          evaluatedAtUtc,
        },
      });

      await tx.reviewJob.update({
        where: { id: job.id },
        data: {
          state: "SUCCEEDED",
          leaseToken: null,
          leaseExpiresAtUtc: null,
          lastErrorCode: null,
        },
      });

      logInfo("worker.job_completed", {
        jobId: job.id,
        correctionRequestId: job.correctionRequestId,
        superseded,
        stubbed: evaluation.stubbed,
      });
    });
  } catch (error) {
    const jevErr =
      error instanceof JevClientError
        ? error
        : new JevClientError("JEV_UNEXPECTED_ERROR", "Unexpected worker failure", true);
    const exhausted = !jevErr.retryable || job.attempts >= MAX_JOB_ATTEMPTS;

    await prisma.$transaction(async (tx) => {
      const stillOwned = await tx.reviewJob.findFirst({
        where: { id: job.id, leaseToken: job.leaseToken, state: "RUNNING" },
      });
      if (!stillOwned) return;

      if (exhausted) {
        await tx.jevAssessment.upsert({
          where: {
            correctionRequestId_requestVersion_inputFingerprint_modelVersion_criteriaVersion: {
              correctionRequestId: job.correctionRequestId,
              requestVersion: request.requestVersion,
              inputFingerprint: job.inputFingerprint,
              modelVersion: job.modelVersion,
              criteriaVersion: job.criteriaVersion,
            },
          },
          update: { runStatus: "FAILED", evaluatedAtUtc: new Date() },
          create: {
            correctionRequestId: job.correctionRequestId,
            requestVersion: request.requestVersion,
            modelVersion: job.modelVersion,
            criteriaVersion: job.criteriaVersion,
            inputFingerprint: job.inputFingerprint,
            inputSnapshot: minimized.inputSnapshot as unknown as Prisma.InputJsonValue,
            runStatus: "FAILED",
            evaluatedAtUtc: new Date(),
          },
        });

        await tx.reviewJob.update({
          where: { id: job.id },
          data: {
            state: "MANUAL_REVIEW",
            lastErrorCode: jevErr.code,
            leaseToken: null,
            leaseExpiresAtUtc: null,
          },
        });
      } else {
        const delayMs = computeRetryDelayMs(job.attempts, jevErr.retryAfterHeader);
        await tx.reviewJob.update({
          where: { id: job.id },
          data: {
            state: "PENDING",
            nextRunAtUtc: new Date(Date.now() + delayMs),
            lastErrorCode: jevErr.code,
            leaseToken: null,
            leaseExpiresAtUtc: null,
          },
        });
      }

      logWarn("worker.job_failed", {
        jobId: job.id,
        code: jevErr.code,
        attempts: job.attempts,
        exhausted,
      });
    });
  }
}

export async function runWorkerOnce(): Promise<boolean> {
  const job = await claimNextReviewJob();
  if (!job) return false;
  await processClaimedJob(job);
  return true;
}
