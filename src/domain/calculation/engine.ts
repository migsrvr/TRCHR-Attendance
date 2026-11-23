/**
 * Deterministic attendance calculation engine (Technical Design v1.0 section 7).
 *
 * Pure, side-effect-free arithmetic in integer seconds until day-level rounding:
 *  1. Validate ordering, non-overlap, and same-office-local-date bounds.
 *  2. Intersect intervals with allowed schedule windows and sum seconds.
 *  3. Deduct additional break seconds once per day (qualifying gaps inside break
 *     windows count toward required break when enabled).
 *  4. Clamp to >= 0, apply daily cap, perform day-level rounding once.
 *  5. Return integer credited minutes.
 */

import type {
  AttendanceInterval,
  AttendancePolicy,
  CalculationContext,
  DailyCreditResult,
  ScheduleWindow,
} from "./types";

interface LocalParts {
  readonly dateIso: string;
  readonly secondsFromMidnight: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

/** Extract office-local calendar date ("YYYY-MM-DD") and seconds since midnight. */
export function toOfficeLocalParts(instant: Date, timeZone: string): LocalParts {
  const parts = getPartsFormatter(timeZone).formatToParts(instant);
  let year = "";
  let month = "";
  let day = "";
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    switch (part.type) {
      case "year":
        year = part.value;
        break;
      case "month":
        month = part.value;
        break;
      case "day":
        day = part.value;
        break;
      case "hour":
        hour = Number(part.value);
        break;
      case "minute":
        minute = Number(part.value);
        break;
      case "second":
        second = Number(part.value);
        break;
    }
  }

  return {
    dateIso: `${year}-${month}-${day}`,
    secondsFromMidnight: hour * 3600 + minute * 60 + second,
  };
}

/**
 * Convert an office-local ("YYYY-MM-DD", "HH:MM") wall clock into a UTC Date.
 * Uses iterative offset resolution so DST-observing zones remain exact.
 */
export function officeLocalToUtc(dateIso: string, hhmm: string, timeZone: string): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hhmm);
  if (!dateMatch || !timeMatch) {
    throw new Error(`Invalid office local date/time: ${dateIso} ${hhmm}`);
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? "0");

  const targetUtcAsWall = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = targetUtcAsWall;

  for (let i = 0; i < 3; i += 1) {
    const local = toOfficeLocalParts(new Date(guess), timeZone);
    const [ly, lm, ld] = local.dateIso.split("-").map(Number) as [number, number, number];
    const lh = Math.floor(local.secondsFromMidnight / 3600);
    const lmin = Math.floor((local.secondsFromMidnight % 3600) / 60);
    const lsec = local.secondsFromMidnight % 60;
    const actualAsWall = Date.UTC(ly, lm - 1, ld, lh, lmin, lsec);
    const diff = targetUtcAsWall - actualAsWall;
    if (diff === 0) break;
    guess += diff;
  }

  return new Date(guess);
}

function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function mergeWindows(windows: readonly ScheduleWindow[]): [number, number][] {
  const sorted = [...windows]
    .map((w): [number, number] => [w.startMinutes * 60, w.endMinutes * 60])
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (!last || start > last[1]) {
      merged.push([start, end]);
    } else if (end > last[1]) {
      last[1] = end;
    }
  }
  return merged;
}

function roundSeconds(seconds: number, mode: AttendancePolicy["creditRules"]["roundingMode"], unitMinutes: number): number {
  if (mode === "NONE") {
    return Math.floor(seconds / 60) * 60;
  }
  const unitSec = unitMinutes * 60;
  switch (mode) {
    case "FLOOR":
      return Math.floor(seconds / unitSec) * unitSec;
    case "CEIL":
      return Math.ceil(seconds / unitSec) * unitSec;
    case "NEAREST_HALF_UP":
      return Math.floor((seconds + unitSec / 2) / unitSec) * unitSec;
  }
}

export function calculateDailyCredit(
  intervals: readonly AttendanceInterval[],
  policy: AttendancePolicy,
  context: CalculationContext = {},
): DailyCreditResult {
  const { creditRules } = policy;
  const effectiveUnit = creditRules.roundingMode === "NONE" ? 1 : creditRules.roundingUnitMinutes;
  if (effectiveUnit <= 0 || creditRules.dailyCapMinutes % effectiveUnit !== 0) {
    throw new Error("dailyCapMinutes must be a multiple of roundingUnitMinutes");
  }

  if (intervals.length === 0) {
    return {
      recordedMinutes: 0,
      insideMinutes: 0,
      gapInWindowMinutes: 0,
      appliedBreakDeductionMinutes: 0,
      beforeRoundingMinutes: 0,
      capped: false,
      clipped: false,
      creditedMinutes: 0,
    };
  }

  const timeZone = context.timeZone ?? "UTC";
  const sorted = [...intervals].sort((a, b) => a.timeInUtc.getTime() - b.timeInUtc.getTime());
  const firstParts = toOfficeLocalParts(sorted[0]!.timeInUtc, timeZone);
  const attendanceDate = context.attendanceDate ?? firstParts.dateIso;

  const spans: [number, number][] = [];
  let recordedSeconds = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i]!;
    if (current.timeOutUtc.getTime() <= current.timeInUtc.getTime()) {
      throw new Error("Attendance interval timeOutUtc must be strictly after timeInUtc");
    }

    if (i > 0) {
      const prev = sorted[i - 1]!;
      if (current.timeInUtc.getTime() < prev.timeOutUtc.getTime()) {
        throw new Error("Overlapping attendance intervals are not allowed");
      }
    }

    const inParts = toOfficeLocalParts(current.timeInUtc, timeZone);
    const outParts = toOfficeLocalParts(current.timeOutUtc, timeZone);

    if (inParts.dateIso !== attendanceDate || outParts.dateIso !== attendanceDate) {
      throw new Error("Cross-midnight or multi-date intervals are not supported in same-day calculation");
    }

    const startSec = inParts.secondsFromMidnight;
    const endSec = outParts.secondsFromMidnight;
    if (endSec <= startSec) {
      throw new Error("Local interval end must be after start");
    }

    spans.push([startSec, endSec]);
    recordedSeconds += Math.round((current.timeOutUtc.getTime() - current.timeInUtc.getTime()) / 1000);
  }

  // Step 2: Intersect with allowed schedule windows and sum seconds
  const scheduleSpans = mergeWindows(policy.scheduleRules);
  let insideSeconds = 0;
  for (const [sStart, sEnd] of spans) {
    for (const [wStart, wEnd] of scheduleSpans) {
      insideSeconds += overlapSeconds(sStart, sEnd, wStart, wEnd);
    }
  }
  const clipped = recordedSeconds > insideSeconds;

  // Step 3: Additional break deduction once per day
  let totalGapInWindowSec = 0;
  let additionalBreakSec = 0;
  if (insideSeconds > 0) {
    for (const rule of policy.breakRules) {
      const winStart = rule.windowStartMinutes * 60;
      const winEnd = rule.windowEndMinutes * 60;
      let qualifyingGapSec = 0;

      if (rule.gapCountsTowardBreak !== false) {
        for (let i = 1; i < spans.length; i += 1) {
          const gapStart = spans[i - 1]![1];
          const gapEnd = spans[i]![0];
          qualifyingGapSec += overlapSeconds(gapStart, gapEnd, winStart, winEnd);
        }
      }

      totalGapInWindowSec += qualifyingGapSec;
      additionalBreakSec += Math.max(0, rule.requiredBreakMinutes * 60 - qualifyingGapSec);
    }
  }

  // Step 4: Clamp >= 0, apply daily cap, round once
  const afterBreakSec = Math.max(0, insideSeconds - additionalBreakSec);
  const capSec = creditRules.dailyCapMinutes * 60;
  const capped = afterBreakSec > capSec;
  const beforeRoundingSec = Math.min(afterBreakSec, capSec);
  const roundedSec = roundSeconds(beforeRoundingSec, creditRules.roundingMode, effectiveUnit);
  const creditedMinutes = Math.min(creditRules.dailyCapMinutes, Math.max(0, Math.trunc(roundedSec / 60)));

  return {
    recordedMinutes: Math.trunc(recordedSeconds / 60),
    insideMinutes: Math.trunc(insideSeconds / 60),
    gapInWindowMinutes: Math.trunc(totalGapInWindowSec / 60),
    appliedBreakDeductionMinutes: Math.trunc(additionalBreakSec / 60),
    beforeRoundingMinutes: Math.trunc(beforeRoundingSec / 60),
    capped,
    clipped,
    creditedMinutes,
  };
}
