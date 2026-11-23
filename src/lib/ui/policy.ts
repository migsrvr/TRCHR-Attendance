/**
 * Attendance policy rules and a preview of how they credit one day.
 * Delegates directly to the canonical deterministic calculation engine
 * (src/domain/calculation/engine.ts) so the policy editor, dashboards, and DTR
 * exports always produce identical results.
 */

import { calculateDailyCredit } from "@/domain/calculation/engine";
import type { AttendancePolicy } from "@/domain/calculation/types";
import { uiRoundingToCreditRounding } from "@/domain/policy/schemas";
import { clockToMinutes } from "@/lib/ui/timeline";

export type Rounding = "none" | "down5" | "down15" | "nearest15";

export interface PolicyRules {
  /** 0 = Sunday … 6 = Saturday. */
  workdays: number[];
  start: string;
  end: string;
  breakMinutes: number;
  breakWindow: { start: string; end: string };
  gapCountsTowardBreak: boolean;
  capMinutes: number;
  rounding: Rounding;
}

export const ROUNDING_OPTIONS: { value: Rounding; label: string }[] = [
  { value: "none", label: "None, whole minutes" },
  { value: "down5", label: "Round down to 5 minutes" },
  { value: "down15", label: "Round down to 15 minutes" },
  { value: "nearest15", label: "Nearest 15 minutes" },
];

export const roundingLabel = (rounding: Rounding) =>
  ROUNDING_OPTIONS.find((option) => option.value === rounding)!.label;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "Mon–Fri", or a list when the days aren't consecutive. */
export function workdaysLabel(workdays: number[]): string {
  const sorted = [...workdays].sort((a, b) => a - b);
  if (!sorted.length) return "No workdays";
  const consecutive = sorted.every((day, index) => index === 0 || day === sorted[index - 1]! + 1);
  return consecutive && sorted.length > 2
    ? `${WEEKDAYS[sorted[0]!]}–${WEEKDAYS[sorted.at(-1)!]}`
    : sorted.map((day) => WEEKDAYS[day]).join(", ");
}

export interface DayCredit {
  inside: number;
  gapInWindow: number;
  breakOwed: number;
  beforeRounding: number;
  credited: number;
  /** The daily cap cut it. */
  capped: boolean;
  /** Time outside the schedule was left out ("Capped at schedule"). */
  clipped: boolean;
}

export function policyRulesToAttendancePolicy(rules: PolicyRules, version = 1): AttendancePolicy {
  const { roundingMode, roundingUnitMinutes } = uiRoundingToCreditRounding(rules.rounding);
  return {
    version,
    workdays: rules.workdays,
    scheduleRules: [{ startMinutes: clockToMinutes(rules.start), endMinutes: clockToMinutes(rules.end) }],
    breakRules:
      rules.breakMinutes > 0
        ? [
            {
              requiredBreakMinutes: rules.breakMinutes,
              windowStartMinutes: clockToMinutes(rules.breakWindow.start),
              windowEndMinutes: clockToMinutes(rules.breakWindow.end),
              gapCountsTowardBreak: rules.gapCountsTowardBreak,
            },
          ]
        : [],
    creditRules: {
      roundingMode,
      roundingUnitMinutes,
      dailyCapMinutes: rules.capMinutes,
    },
  };
}

export function creditDay(sessions: { start: string; end: string }[], rules: PolicyRules): DayCredit {
  const referenceDate = "2026-10-19";
  const intervals = sessions.map((session) => ({
    timeInUtc: new Date(`${referenceDate}T${session.start}:00Z`),
    timeOutUtc: new Date(`${referenceDate}T${session.end}:00Z`),
  }));

  const policy = policyRulesToAttendancePolicy(rules);
  const effectiveUnit = policy.creditRules.roundingMode === "NONE" ? 1 : policy.creditRules.roundingUnitMinutes;
  // Guard preview while user is mid-edit with a temporary cap not divisible by unit
  const safePolicy: AttendancePolicy =
    policy.creditRules.dailyCapMinutes > 0 && policy.creditRules.dailyCapMinutes % effectiveUnit === 0
      ? policy
      : {
          ...policy,
          creditRules: {
            ...policy.creditRules,
            dailyCapMinutes: Math.max(
              effectiveUnit,
              Math.floor(Math.max(rules.capMinutes, 0) / effectiveUnit) * effectiveUnit,
            ),
          },
        };

  const result = calculateDailyCredit(intervals, safePolicy, {
    attendanceDate: referenceDate,
    timeZone: "UTC",
  });

  return {
    inside: result.insideMinutes,
    gapInWindow: result.gapInWindowMinutes,
    breakOwed: result.appliedBreakDeductionMinutes,
    beforeRounding: result.beforeRoundingMinutes,
    credited: result.creditedMinutes,
    capped: result.capped,
    clipped: result.clipped,
  };
}

/** "8h 00m", "7h30m", "8" (hours) → minutes; null if unreadable. */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase();
  const full = value.match(/^(\d{1,2})\s*h(?:\s*(\d{1,2})\s*m)?$/);
  if (full) return Number(full[1]) * 60 + Number(full[2] ?? 0);
  if (/^\d{1,2}$/.test(value)) return Number(value) * 60;
  return null;
}

export type PolicyErrors = Partial<
  Record<"workdays" | "schedule" | "breakMinutes" | "breakWindow" | "capMinutes", string>
>;

export function validatePolicy(rules: PolicyRules): PolicyErrors {
  const errors: PolicyErrors = {};
  const span = clockToMinutes(rules.end) - clockToMinutes(rules.start);
  if (!rules.workdays.length) errors.workdays = "Pick at least one workday.";
  if (span <= 0) errors.schedule = "The schedule must end after it starts.";
  if (!Number.isInteger(rules.breakMinutes) || rules.breakMinutes < 0 || rules.breakMinutes > 120) {
    errors.breakMinutes = "Use a break between 0 and 120 minutes.";
  }
  if (clockToMinutes(rules.breakWindow.end) <= clockToMinutes(rules.breakWindow.start)) {
    errors.breakWindow = "The break window must end after it starts.";
  }
  if (!Number.isInteger(rules.capMinutes) || rules.capMinutes <= 0 || rules.capMinutes > 24 * 60) {
    errors.capMinutes = "Enter a daily cap like 8h 00m.";
  } else {
    const { roundingMode, roundingUnitMinutes } = uiRoundingToCreditRounding(rules.rounding);
    if (roundingMode !== "NONE" && rules.capMinutes % roundingUnitMinutes !== 0) {
      errors.capMinutes = `Daily cap must be a multiple of ${roundingUnitMinutes} minutes for this rounding setting.`;
    }
  }
  return errors;
}

const FIELDS: (keyof PolicyRules)[] = [
  "workdays",
  "start",
  "end",
  "breakMinutes",
  "breakWindow",
  "gapCountsTowardBreak",
  "capMinutes",
  "rounding",
];

export function changedFields(base: PolicyRules, draft: PolicyRules): (keyof PolicyRules)[] {
  return FIELDS.filter((field) => JSON.stringify(base[field]) !== JSON.stringify(draft[field]));
}
