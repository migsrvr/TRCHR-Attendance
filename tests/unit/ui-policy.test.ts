import { describe, expect, it } from "vitest";

import { OCTOBER_DAYS } from "@/lib/ui/fixtures/intern";
import { changedFields, creditDay, parseDuration, validatePolicy, type PolicyRules } from "@/lib/ui/policy";

const V2: PolicyRules = {
  workdays: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "18:00",
  breakMinutes: 60,
  breakWindow: { start: "12:00", end: "14:00" },
  gapCountsTowardBreak: true,
  capMinutes: 480,
  rounding: "none",
};

describe("creditDay", () => {
  it("reproduces Ana's credited October days under version 2", () => {
    for (const day of OCTOBER_DAYS.filter((candidate) => candidate.kind === "complete")) {
      expect(creditDay(day.sessions as { start: string; end: string }[], V2).credited, day.dateIso).toBe(day.creditedMinutes);
    }
  });

  it("explains the canvas cases", () => {
    expect(creditDay([{ start: "08:55", end: "18:05" }], V2)).toMatchObject({ credited: 480, capped: false, clipped: true });
    expect(creditDay([{ start: "08:58", end: "12:01" }, { start: "13:00", end: "17:30" }], V2)).toMatchObject({
      inside: 451,
      gapInWindow: 59,
      breakOwed: 1,
      credited: 450,
    });
  });

  it("matches the version 3 worked example", () => {
    const v3 = { ...V2, rounding: "down5" as const };
    expect(creditDay([{ start: "08:52", end: "12:00" }, { start: "13:03", end: "18:21" }], v3)).toEqual({
      inside: 477,
      gapInWindow: 63,
      breakOwed: 0,
      beforeRounding: 477,
      credited: 475,
      capped: false,
      clipped: true,
    });
  });

  it("ignores gaps outside the break window or when the rule is off", () => {
    expect(creditDay([{ start: "09:00", end: "10:00" }, { start: "11:00", end: "18:00" }], V2).breakOwed).toBe(60);
    expect(creditDay([{ start: "09:00", end: "12:00" }, { start: "13:00", end: "18:00" }], { ...V2, gapCountsTowardBreak: false }).breakOwed).toBe(60);
  });
});

describe("policy form helpers", () => {
  it("parses durations HR types", () => {
    expect(parseDuration("8h 00m")).toBe(480);
    expect(parseDuration("7h30m")).toBe(450);
    expect(parseDuration("8")).toBe(480);
    expect(parseDuration("eight")).toBeNull();
  });

  it("validates the rules", () => {
    expect(validatePolicy(V2)).toEqual({});
    const errors = validatePolicy({ ...V2, workdays: [], start: "18:00", end: "09:00", breakMinutes: 200, capMinutes: 0 });
    expect(Object.keys(errors).sort()).toEqual(["breakMinutes", "capMinutes", "schedule", "workdays"]);
  });

  it("lists what changed from the base version", () => {
    expect(changedFields(V2, { ...V2, rounding: "down5" })).toEqual(["rounding"]);
    expect(changedFields(V2, V2)).toEqual([]);
  });
});
