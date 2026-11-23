import { describe, expect, it } from "vitest";

import { aggregateDayCredits, computeIntentExpiry, validateLocationFreshness } from "@/modules/attendance/credit";

const SAMPLE_POLICY_ROW = {
  version: 1,
  scheduleRules: {
    workdays: [1, 2, 3, 4, 5],
    windows: [{ startMinutes: 8 * 60, endMinutes: 19 * 60 }],
  },
  breakRules: [
    {
      requiredBreakMinutes: 60,
      windowStartMinutes: 12 * 60,
      windowEndMinutes: 14 * 60,
      gapCountsTowardBreak: true,
    },
  ],
  creditRules: {
    roundingMode: "NONE",
    roundingUnitMinutes: 1,
    dailyCapMinutes: 480,
  },
};

describe("attendance credit aggregation & scan validation helpers", () => {
  it("credits only COMPLETE sessions and ignores OPEN, REVIEW, and VOID intervals", () => {
    const result = aggregateDayCredits(
      [
        {
          attendanceDateIso: "2026-10-19",
          status: "COMPLETE",
          effectiveTimeInUtc: new Date("2026-10-19T01:00:00Z"), // 09:00 Manila
          effectiveTimeOutUtc: new Date("2026-10-19T04:00:00Z"), // 12:00 Manila
          timezoneSnapshot: "Asia/Manila",
          policyVersion: SAMPLE_POLICY_ROW,
        },
        {
          attendanceDateIso: "2026-10-19",
          status: "COMPLETE",
          effectiveTimeInUtc: new Date("2026-10-19T05:00:00Z"), // 13:00 Manila
          effectiveTimeOutUtc: new Date("2026-10-19T10:00:00Z"), // 18:00 Manila
          timezoneSnapshot: "Asia/Manila",
          policyVersion: SAMPLE_POLICY_ROW,
        },
        {
          attendanceDateIso: "2026-10-20",
          status: "OPEN",
          effectiveTimeInUtc: new Date("2026-10-20T01:00:00Z"),
          effectiveTimeOutUtc: null,
          timezoneSnapshot: "Asia/Manila",
          policyVersion: SAMPLE_POLICY_ROW,
        },
        {
          attendanceDateIso: "2026-10-21",
          status: "REVIEW",
          effectiveTimeInUtc: new Date("2026-10-21T08:00:00Z"),
          effectiveTimeOutUtc: new Date("2026-10-21T16:40:00Z"),
          timezoneSnapshot: "Asia/Manila",
          policyVersion: SAMPLE_POLICY_ROW,
        },
      ],
      600,
    );

    expect(result.byDate.get("2026-10-19")?.creditedMinutes).toBe(480);
    expect(result.byDate.get("2026-10-20")).toBeUndefined();
    expect(result.byDate.get("2026-10-21")).toBeUndefined();
    expect(result.totalCreditedMinutes).toBe(480);
    expect(result.remainingMinutes).toBe(120);
  });

  it("validates location freshness within 30s past and 5s future clock skew", () => {
    const now = new Date("2026-10-19T01:00:30Z");
    expect(validateLocationFreshness(new Date("2026-10-19T01:00:05Z"), now)).toEqual({ ok: true });
    expect(validateLocationFreshness(new Date("2026-10-19T01:00:34Z"), now)).toEqual({ ok: true });
    expect(validateLocationFreshness(new Date("2026-10-19T00:59:50Z"), now)).toEqual({
      ok: false,
      code: "LOCATION_STALE",
    });
    expect(validateLocationFreshness(new Date("2026-10-19T01:00:45Z"), now)).toEqual({
      ok: false,
      code: "LOCATION_STALE",
    });
  });

  it("caps intent expiry at the earlier of credential expiry and 60s intent lifetime", () => {
    const now = new Date("2026-10-19T01:00:00Z");
    const farCred = new Date("2026-12-01T00:00:00Z");
    const soonCred = new Date("2026-10-19T01:00:20Z");

    expect(computeIntentExpiry(farCred, now).toISOString()).toBe("2026-10-19T01:01:00.000Z");
    expect(computeIntentExpiry(soonCred, now).toISOString()).toBe("2026-10-19T01:00:20.000Z");
  });
});
