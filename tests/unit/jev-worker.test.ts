import { describe, expect, it } from "vitest";

import { buildMinimizedJevContext } from "@/worker/context";
import { computeRetryDelayMs, evaluateWithStubJev, parseJevTypedResult } from "@/worker/jev-client";

describe("Jev context minimization and typed response validation", () => {
  it("strips emails, phone numbers, and coordinates while producing a stable fingerprint", () => {
    const first = buildMinimizedJevContext({
      requestVersion: 2,
      reasonCategory: "MISSED_CLOCK_OUT",
      explanation: "Left with ana.reyes@school.edu.ph at 14.554729, 121.024445; call 09171234567 to confirm.",
      comments: [{ role: "INTERN", message: "Supervisor confirmed via email boss@toprealty.ph." }],
      facts: {
        hasExistingSession: true,
        hasRecordedTimeIn: true,
        hasRecordedTimeOut: false,
        proposesTimeIn: false,
        proposesTimeOut: true,
      },
    });

    const second = buildMinimizedJevContext({
      requestVersion: 2,
      reasonCategory: "MISSED_CLOCK_OUT",
      explanation: "Left with ana.reyes@school.edu.ph at 14.554729, 121.024445; call 09171234567 to confirm.",
      comments: [{ role: "INTERN", message: "Supervisor confirmed via email boss@toprealty.ph." }],
      facts: {
        hasExistingSession: true,
        hasRecordedTimeIn: true,
        hasRecordedTimeOut: false,
        proposesTimeIn: false,
        proposesTimeOut: true,
      },
    });

    expect(first.inputFingerprint).toBe(second.inputFingerprint);
    const serialized = JSON.stringify(first.inputSnapshot);
    expect(serialized).not.toContain("ana.reyes@school.edu.ph");
    expect(serialized).not.toContain("boss@toprealty.ph");
    expect(serialized).not.toContain("14.554729");
    expect(serialized).not.toContain("09171234567");
  });

  it("validates bounded Jev Choice + Noul outputs and rejects unknown categories or out-of-range scores", () => {
    const valid = parseJevTypedResult({
      category: "missed_clock_out",
      categoryScore: 0.91,
      detailsScore: 0.82,
    });
    expect(valid.category).toBe("missed_clock_out");
    expect(valid.detailsScore).toBe(0.82);

    expect(() =>
      parseJevTypedResult({ category: "approve_now", categoryScore: 0.9, detailsScore: 0.8 }),
    ).toThrow();
    expect(() =>
      parseJevTypedResult({ category: "other", categoryScore: 1.5, detailsScore: 0.8 }),
    ).toThrow();
  });

  it("evaluates deterministically with stub Jev when no live key is configured", () => {
    const ctx = buildMinimizedJevContext({
      requestVersion: 1,
      reasonCategory: "MISSED_CLOCK_OUT",
      explanation: "Client walkthrough ran late with the Marketing lead and I left at 6:05 PM without scanning OUT.",
      comments: [],
      facts: {
        hasExistingSession: true,
        hasRecordedTimeIn: true,
        hasRecordedTimeOut: false,
        proposesTimeIn: false,
        proposesTimeOut: true,
      },
    });
    const output = evaluateWithStubJev(ctx);
    expect(output.category).toBe("missed_clock_out");
    expect(output.categoryScore).toBeGreaterThan(0.5);
    expect(output.categoryScore).toBeLessThanOrEqual(1);
    expect(output.detailsScore).toBeGreaterThan(0.5);
    expect(output.detailsScore).toBeLessThanOrEqual(1);
  });

  it("honors Retry-After headers and caps exponential backoff", () => {
    expect(computeRetryDelayMs(1, "12")).toBe(12_000);
    const backoff = computeRetryDelayMs(2, null);
    expect(backoff).toBeGreaterThanOrEqual(2_000);
    expect(backoff).toBeLessThanOrEqual(30_000);
  });
});
