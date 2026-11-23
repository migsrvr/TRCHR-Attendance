import { describe, expect, it, vi } from "vitest";

import { runRetentionCleanup, type RetentionDb } from "@/worker/retention";

describe("worker retention cleanup", () => {
  it("prunes expired intents (>24h), old receipts (>90d), and terminal review jobs (>90d) only", async () => {
    const intentDeleteMany = vi.fn().mockResolvedValue({ count: 14 });
    const receiptDeleteMany = vi.fn().mockResolvedValue({ count: 7 });
    const jobDeleteMany = vi.fn().mockResolvedValue({ count: 5 });

    const fakeDb: RetentionDb = {
      scanIntent: { deleteMany: intentDeleteMany },
      scanReceipt: { deleteMany: receiptDeleteMany },
      reviewJob: { deleteMany: jobDeleteMany },
    };

    const now = new Date("2026-11-23T12:00:00Z");
    const result = await runRetentionCleanup({ now }, fakeDb);

    expect(result).toEqual({ deletedIntents: 14, deletedReceipts: 7, deletedReviewJobs: 5 });

    expect(intentDeleteMany).toHaveBeenCalledWith({
      where: { expiresAtUtc: { lt: new Date("2026-11-22T12:00:00Z") } },
    });
    expect(receiptDeleteMany).toHaveBeenCalledWith({
      where: { receivedAtUtc: { lt: new Date("2026-08-25T12:00:00Z") } },
    });
    expect(jobDeleteMany).toHaveBeenCalledWith({
      where: {
        state: { in: ["SUCCEEDED", "FAILED"] },
        updatedAt: { lt: new Date("2026-08-25T12:00:00Z") },
      },
    });
  });

  it("honors custom retention window overrides", async () => {
    const intentDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const receiptDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const jobDeleteMany = vi.fn().mockResolvedValue({ count: 3 });

    const fakeDb: RetentionDb = {
      scanIntent: { deleteMany: intentDeleteMany },
      scanReceipt: { deleteMany: receiptDeleteMany },
      reviewJob: { deleteMany: jobDeleteMany },
    };

    const now = new Date("2026-11-23T12:00:00Z");
    await runRetentionCleanup(
      { now, intentRetentionHours: 48, receiptRetentionDays: 30, completedJobRetentionDays: 15 },
      fakeDb,
    );

    expect(intentDeleteMany).toHaveBeenCalledWith({
      where: { expiresAtUtc: { lt: new Date("2026-11-21T12:00:00Z") } },
    });
    expect(receiptDeleteMany).toHaveBeenCalledWith({
      where: { receivedAtUtc: { lt: new Date("2026-10-24T12:00:00Z") } },
    });
    expect(jobDeleteMany).toHaveBeenCalledWith({
      where: {
        state: { in: ["SUCCEEDED", "FAILED"] },
        updatedAt: { lt: new Date("2026-11-08T12:00:00Z") },
      },
    });
  });
});
