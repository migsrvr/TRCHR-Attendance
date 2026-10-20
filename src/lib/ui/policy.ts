/**
 * Attendance policy rules and a preview of how they credit one day. The
 * calculation engine (src/modules/attendance) is the source of truth; this
 * mirrors it for the policy editor's worked example and is tested against
 * the same sample days.
 *
 * Order: clip each session to the schedule, deduct the break once (a gap
 * between sessions inside the break window counts toward it), cap, round.
 */

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

export const roundingLabel = (rounding: Rounding) => ROUNDING_OPTIONS.find((option) => option.value === rounding)!.label;

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

function round(minutes: number, rounding: Rounding): number {
  switch (rounding) {
    case "down5":
      return Math.floor(minutes / 5) * 5;
    case "down15":
      return Math.floor(minutes / 15) * 15;
    case "nearest15":
      return Math.round(minutes / 15) * 15;
    default:
      return minutes;
  }
}

const overlap = (a: [number, number], b: [number, number]) => Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));

export function creditDay(sessions: { start: string; end: string }[], rules: PolicyRules): DayCredit {
  const schedule: [number, number] = [clockToMinutes(rules.start), clockToMinutes(rules.end)];
  const window: [number, number] = [clockToMinutes(rules.breakWindow.start), clockToMinutes(rules.breakWindow.end)];
  const spans = sessions
    .map((session) => [clockToMinutes(session.start), clockToMinutes(session.end)] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const inside = spans.reduce((sum, span) => sum + overlap(span, schedule), 0);
  const clipped = spans.reduce((sum, span) => sum + span[1] - span[0], 0) > inside;
  const gapInWindow = rules.gapCountsTowardBreak
    ? spans.slice(1).reduce((sum, span, index) => sum + overlap([spans[index]![1], span[0]], window), 0)
    : 0;
  const breakOwed = inside > 0 ? Math.max(0, rules.breakMinutes - gapInWindow) : 0;
  const afterBreak = Math.max(0, inside - breakOwed);
  const capped = afterBreak > rules.capMinutes;
  const beforeRounding = Math.min(afterBreak, rules.capMinutes);
  return { inside, gapInWindow, breakOwed, beforeRounding, credited: round(beforeRounding, rules.rounding), capped, clipped };
}

/** "8h 00m", "7h30m", "8" (hours) → minutes; null if unreadable. */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase();
  const full = value.match(/^(\d{1,2})\s*h(?:\s*(\d{1,2})\s*m)?$/);
  if (full) return Number(full[1]) * 60 + Number(full[2] ?? 0);
  if (/^\d{1,2}$/.test(value)) return Number(value) * 60;
  return null;
}

export type PolicyErrors = Partial<Record<"workdays" | "schedule" | "breakMinutes" | "breakWindow" | "capMinutes", string>>;

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
  }
  return errors;
}

const FIELDS: (keyof PolicyRules)[] = ["workdays", "start", "end", "breakMinutes", "breakWindow", "gapCountsTowardBreak", "capMinutes", "rounding"];

export function changedFields(base: PolicyRules, draft: PolicyRules): (keyof PolicyRules)[] {
  return FIELDS.filter((field) => JSON.stringify(base[field]) !== JSON.stringify(draft[field]));
}
