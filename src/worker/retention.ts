/**
 * Operational retention cleanup (Technical Design v1.0 sections 4 & 9).
 *
 * Prunes transient operational rows while strictly preserving every immutable
 * attendance and audit table (AttendanceSession, AttendanceScan,
 * AttendanceRevision, CorrectionRequest, HrReview, JevAssessment, AuditEvent).
 */

import { prisma } from "@/lib/db";
import { logInfo } from "@/lib/http/logger";

export interface RetentionCleanupOptions {
  readonly now?: Date;
  /** Delete expired ScanIntent rows older than this many hours (default: 24). */
  readonly intentRetentionHours?: number;
  /** Delete aged ScanReceipt rows older than this many days (default: 90). */
  readonly receiptRetentionDays?: number;
  /** Delete terminal ReviewJob rows (SUCCEEDED/FAILED) older than this many days (default: 90). */
  readonly completedJobRetentionDays?: number;
}

export interface RetentionCleanupResult {
  readonly deletedIntents: number;
  readonly deletedReceipts: number;
  readonly deletedReviewJobs: number;
}

export interface RetentionDb {
  readonly scanIntent: {
    deleteMany(args: { where: { expiresAtUtc: { lt: Date } } }): Promise<{ count: number }>;
  };
  readonly scanReceipt: {
    deleteMany(args: { where: { receivedAtUtc: { lt: Date } } }): Promise<{ count: number }>;
  };
  readonly reviewJob: {
    deleteMany(args: {
      where: { state: { in: ("SUCCEEDED" | "FAILED")[] }; updatedAt: { lt: Date } };
    }): Promise<{ count: number }>;
  };
}

export const DEFAULT_INTENT_RETENTION_HOURS = 24;
export const DEFAULT_RECEIPT_RETENTION_DAYS = 90;
export const DEFAULT_COMPLETED_JOB_RETENTION_DAYS = 90;

export async function runRetentionCleanup(
  options: RetentionCleanupOptions = {},
  db: RetentionDb = prisma,
): Promise<RetentionCleanupResult> {
  const now = options.now ?? new Date();
  const intentHours = options.intentRetentionHours ?? DEFAULT_INTENT_RETENTION_HOURS;
  const receiptDays = options.receiptRetentionDays ?? DEFAULT_RECEIPT_RETENTION_DAYS;
  const jobDays = options.completedJobRetentionDays ?? DEFAULT_COMPLETED_JOB_RETENTION_DAYS;

  const intentCutoff = new Date(now.getTime() - intentHours * 60 * 60 * 1000);
  const receiptCutoff = new Date(now.getTime() - receiptDays * 24 * 60 * 60 * 1000);
  const jobCutoff = new Date(now.getTime() - jobDays * 24 * 60 * 60 * 1000);

  const [intents, receipts, jobs] = await Promise.all([
    db.scanIntent.deleteMany({
      where: { expiresAtUtc: { lt: intentCutoff } },
    }),
    db.scanReceipt.deleteMany({
      where: { receivedAtUtc: { lt: receiptCutoff } },
    }),
    db.reviewJob.deleteMany({
      where: {
        state: { in: ["SUCCEEDED", "FAILED"] },
        updatedAt: { lt: jobCutoff },
      },
    }),
  ]);

  const result: RetentionCleanupResult = {
    deletedIntents: intents.count,
    deletedReceipts: receipts.count,
    deletedReviewJobs: jobs.count,
  };

  logInfo("worker.retention_cleanup", { ...result });
  return result;
}
