/**
 * Shared attendance credit aggregation, policy-to-UI conversion, and scan
 * timing helpers used across attendance, accounts, corrections, and reports.
 */

import type { AttendanceSessionStatus } from "@prisma/client";

import { calculateDailyCredit } from "@/domain/calculation/engine";
import type { DailyCreditResult } from "@/domain/calculation/types";
import { creditRoundingToUiRounding, parseStoredPolicy } from "@/domain/policy/schemas";
import type { PolicyRules } from "@/lib/ui/policy";

export const INTENT_LIFETIME_MS = 60_000;
export const MAX_LOCATION_AGE_MS = 30_000;
export const MAX_LOCATION_FUTURE_SKEW_MS = 5_000;

export interface CreditableSessionRow {
  readonly attendanceDateIso: string;
  readonly status: AttendanceSessionStatus;
  readonly effectiveTimeInUtc: Date | null;
  readonly effectiveTimeOutUtc: Date | null;
  readonly timezoneSnapshot: string;
  readonly policyVersion: {
    readonly version: number;
    readonly scheduleRules: unknown;
    readonly breakRules: unknown;
    readonly creditRules: unknown;
  };
}

export interface AggregatedCredits {
  readonly byDate: Map<string, DailyCreditResult>;
  readonly totalCreditedMinutes: number;
  readonly remainingMinutes: number;
}

export function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function minutesToClock(minutes: number): string {
  const safe = Math.max(0, Math.min(24 * 60, Math.trunc(minutes)));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function policyToUiRules(row: {
  readonly version: number;
  readonly scheduleRules: unknown;
  readonly breakRules: unknown;
  readonly creditRules: unknown;
}): PolicyRules {
  const parsed = parseStoredPolicy(row);
  const firstWindow = parsed.scheduleRules[0] ?? { startMinutes: 8 * 60, endMinutes: 19 * 60 };
  const firstBreak = parsed.breakRules[0];
  return {
    workdays: [...(parsed.workdays ?? [1, 2, 3, 4, 5])],
    start: minutesToClock(firstWindow.startMinutes),
    end: minutesToClock(firstWindow.endMinutes),
    breakMinutes: firstBreak?.requiredBreakMinutes ?? 0,
    breakWindow: {
      start: minutesToClock(firstBreak?.windowStartMinutes ?? 12 * 60),
      end: minutesToClock(firstBreak?.windowEndMinutes ?? 14 * 60),
    },
    gapCountsTowardBreak: firstBreak?.gapCountsTowardBreak ?? true,
    capMinutes: parsed.creditRules.dailyCapMinutes,
    rounding: creditRoundingToUiRounding(
      parsed.creditRules.roundingMode,
      parsed.creditRules.roundingUnitMinutes,
    ),
  };
}

/**
 * Group eligible COMPLETE sessions by office-local attendance date and run the
 * deterministic calculation engine once per day using that day's pinned policy.
 */
export function aggregateDayCredits(
  sessions: readonly CreditableSessionRow[],
  requiredMinutes: number,
): AggregatedCredits {
  const grouped = new Map<string, CreditableSessionRow[]>();

  for (const session of sessions) {
    if (session.status !== "COMPLETE") continue;
    if (!session.effectiveTimeInUtc || !session.effectiveTimeOutUtc) continue;
    const list = grouped.get(session.attendanceDateIso);
    if (list) list.push(session);
    else grouped.set(session.attendanceDateIso, [session]);
  }

  const byDate = new Map<string, DailyCreditResult>();
  let totalCreditedMinutes = 0;

  for (const [dateIso, daySessions] of grouped) {
    const first = daySessions[0]!;
    const policy = parseStoredPolicy(first.policyVersion);
    const intervals = daySessions.map((s) => ({
      timeInUtc: s.effectiveTimeInUtc!,
      timeOutUtc: s.effectiveTimeOutUtc!,
    }));
    const daily = calculateDailyCredit(intervals, policy, {
      attendanceDate: dateIso,
      timeZone: first.timezoneSnapshot,
    });
    byDate.set(dateIso, daily);
    totalCreditedMinutes += daily.creditedMinutes;
  }

  return {
    byDate,
    totalCreditedMinutes,
    remainingMinutes: Math.max(requiredMinutes - totalCreditedMinutes, 0),
  };
}

export function validateLocationFreshness(
  capturedAtUtc: Date,
  serverNowUtc: Date,
): { readonly ok: true } | { readonly ok: false; readonly code: "LOCATION_STALE" } {
  const ageMs = serverNowUtc.getTime() - capturedAtUtc.getTime();
  if (!Number.isFinite(ageMs)) return { ok: false, code: "LOCATION_STALE" };
  if (ageMs > MAX_LOCATION_AGE_MS || ageMs < -MAX_LOCATION_FUTURE_SKEW_MS) {
    return { ok: false, code: "LOCATION_STALE" };
  }
  return { ok: true };
}

export function computeIntentExpiry(
  credentialExpiresAtUtc: Date,
  serverNowUtc: Date,
  intentLifetimeMs = INTENT_LIFETIME_MS,
): Date {
  const maxIntentTime = serverNowUtc.getTime() + intentLifetimeMs;
  return new Date(Math.min(credentialExpiresAtUtc.getTime(), maxIntentTime));
}
