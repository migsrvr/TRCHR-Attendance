import { describe, expect, it } from "vitest";

import { calculateDailyCredit } from "@/domain/calculation/engine";
import { formatMinutesAsDecimalHours, formatMinutesAsHhMm } from "@/domain/calculation/formatters";
import type { AttendancePolicy } from "@/domain/calculation/types";

const BASE_POLICY: AttendancePolicy = {
  version: 1,
  scheduleRules: [{ startMinutes: 8 * 60, endMinutes: 19 * 60 }],
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
    dailyCapMinutes: 8 * 60,
  },
};

const manila = (hhmm: string, date = "2026-10-19") => new Date(`${date}T${hhmm}:00+08:00`);

describe("calculation engine", () => {
  it("produces integer credited minutes for the fixture 09:00-12:00 and 13:00-18:00", () => {
    const result = calculateDailyCredit(
      [
        { timeInUtc: manila("09:00"), timeOutUtc: manila("12:00") },
        { timeInUtc: manila("13:00"), timeOutUtc: manila("18:00") },
      ],
      BASE_POLICY,
      { attendanceDate: "2026-10-19", timeZone: "Asia/Manila" },
    );

    expect(result.recordedMinutes).toBe(480);
    expect(result.appliedBreakDeductionMinutes).toBe(0);
    expect(result.capped).toBe(false);
    expect(result.creditedMinutes).toBe(480);
  });

  it("unions eligible intervals and excludes gaps between sessions", () => {
    const result = calculateDailyCredit(
      [
        { timeInUtc: manila("09:00"), timeOutUtc: manila("11:00") },
        { timeInUtc: manila("13:00"), timeOutUtc: manila("16:00") },
      ],
      BASE_POLICY,
      { attendanceDate: "2026-10-19", timeZone: "Asia/Manila" },
    );

    // 2h + 3h = 300m, gap 11:00-13:00 overlaps 12:00-14:00 by 60m -> 0 additional deduction
    expect(result.recordedMinutes).toBe(300);
    expect(result.appliedBreakDeductionMinutes).toBe(0);
    expect(result.creditedMinutes).toBe(300);
  });

  it("clips intervals against allowed schedule windows", () => {
    const result = calculateDailyCredit(
      [{ timeInUtc: manila("07:00"), timeOutUtc: manila("11:00") }],
      {
        ...BASE_POLICY,
        breakRules: [],
      },
      { attendanceDate: "2026-10-19", timeZone: "Asia/Manila" },
    );

    // 07:00-08:00 is outside schedule 08:00-19:00 -> only 08:00-11:00 (180m) counts
    expect(result.recordedMinutes).toBe(240);
    expect(result.clipped).toBe(true);
    expect(result.creditedMinutes).toBe(180);
  });

  it("applies an additional break deduction only for a short qualifying gap", () => {
    const result = calculateDailyCredit(
      [
        { timeInUtc: manila("09:00"), timeOutUtc: manila("12:00") },
        { timeInUtc: manila("12:20"), timeOutUtc: manila("18:00") },
      ],
      BASE_POLICY,
      { attendanceDate: "2026-10-19", timeZone: "Asia/Manila" },
    );

    // Worked 180 + 340 = 520m, gap 20m in break window -> extra deduction 40m -> 480m
    expect(result.appliedBreakDeductionMinutes).toBe(40);
    expect(result.creditedMinutes).toBe(480);
  });

  it("clamps negative durations to zero", () => {
    const result = calculateDailyCredit(
      [{ timeInUtc: manila("09:00"), timeOutUtc: manila("09:30") }],
      BASE_POLICY,
      { attendanceDate: "2026-10-19", timeZone: "Asia/Manila" },
    );

    // 30m worked minus 60m required break -> clamped to 0
    expect(result.creditedMinutes).toBe(0);
  });

  it("applies the daily cap before day-level rounding", () => {
    const policy: AttendancePolicy = {
      ...BASE_POLICY,
      breakRules: [],
      creditRules: {
        roundingMode: "CEIL",
        roundingUnitMinutes: 15,
        dailyCapMinutes: 480,
      },
    };
    const result = calculateDailyCredit(
      [{ timeInUtc: manila("08:00"), timeOutUtc: manila("17:10") }],
      policy,
      { attendanceDate: "2026-10-19", timeZone: "Asia/Manila" },
    );

    expect(result.capped).toBe(true);
    expect(result.creditedMinutes).toBe(480);
  });

  it("rounds once per day (floor, ceiling, nearest half-up)", () => {
    const intervals = [{ timeInUtc: manila("09:00"), timeOutUtc: manila("10:08") }]; // 68m
    const floorRes = calculateDailyCredit(
      intervals,
      { ...BASE_POLICY, breakRules: [], creditRules: { roundingMode: "FLOOR", roundingUnitMinutes: 15, dailyCapMinutes: 480 } },
      { attendanceDate: "2026-10-19", timeZone: "Asia/Manila" },
    );
    const ceilRes = calculateDailyCredit(
      intervals,
      { ...BASE_POLICY, breakRules: [], creditRules: { roundingMode: "CEIL", roundingUnitMinutes: 15, dailyCapMinutes: 480 } },
      { attendanceDate: "2026-10-19", timeZone: "Asia/Manila" },
    );
    const halfUpRes = calculateDailyCredit(
      intervals,
      {
        ...BASE_POLICY,
        breakRules: [],
        creditRules: { roundingMode: "NEAREST_HALF_UP", roundingUnitMinutes: 15, dailyCapMinutes: 480 },
      },
      { attendanceDate: "2026-10-19", timeZone: "Asia/Manila" },
    );

    expect(floorRes.creditedMinutes).toBe(60);
    expect(ceilRes.creditedMinutes).toBe(75);
    expect(halfUpRes.creditedMinutes).toBe(75); // 68 is >= 67.5 midpoint -> rounds up to 75
  });

  it("rejects overlapping or cross-midnight intervals", () => {
    expect(() =>
      calculateDailyCredit(
        [
          { timeInUtc: manila("09:00"), timeOutUtc: manila("12:00") },
          { timeInUtc: manila("11:30"), timeOutUtc: manila("15:00") },
        ],
        BASE_POLICY,
        { attendanceDate: "2026-10-19", timeZone: "Asia/Manila" },
      ),
    ).toThrow(/overlap/i);

    expect(() =>
      calculateDailyCredit(
        [{ timeInUtc: manila("22:00", "2026-10-19"), timeOutUtc: manila("01:00", "2026-10-20") }],
        BASE_POLICY,
        { attendanceDate: "2026-10-19", timeZone: "Asia/Manila" },
      ),
    ).toThrow(/midnight|same/i);
  });
});

describe("formatters", () => {
  it("formats integer minutes as hh:mm and decimal hours", () => {
    expect(formatMinutesAsHhMm(480)).toBe("08:00");
    expect(formatMinutesAsHhMm(120)).toBe("02:00");
    expect(formatMinutesAsHhMm(65)).toBe("01:05");
    expect(formatMinutesAsHhMm(-10)).toBe("00:00");
    expect(formatMinutesAsDecimalHours(450)).toBe("7.50");
  });
});
