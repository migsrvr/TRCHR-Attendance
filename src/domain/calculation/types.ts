/**
 * Deterministic calculation engine - type definitions.
 *
 * The engine converts effective (COMPLETE) attendance intervals and a pinned
 * policy version into integer credited minutes. It performs no I/O and no AI
 * calls. See Technical Design v1.0 section 7.
 */

/** A fully bounded work interval, in UTC. */
export interface AttendanceInterval {
  readonly timeInUtc: Date;
  readonly timeOutUtc: Date;
}

export type RoundingMode = "FLOOR" | "CEIL" | "NEAREST_HALF_UP";

/** A daily allowed schedule window expressed in office-local minutes from midnight. */
export interface ScheduleWindow {
  readonly startMinutes: number;
  readonly endMinutes: number;
}

/** A required break and the window its qualifying recorded gap must fall within. */
export interface BreakRule {
  readonly requiredBreakMinutes: number;
  readonly windowStartMinutes: number;
  readonly windowEndMinutes: number;
}

/** Day-level cap and rounding configuration. */
export interface CreditRules {
  readonly roundingMode: RoundingMode;
  readonly roundingUnitMinutes: number;
  readonly dailyCapMinutes: number;
}

/** An immutable, validated policy version pinned to a session. */
export interface AttendancePolicy {
  readonly version: number;
  readonly scheduleRules: readonly ScheduleWindow[];
  readonly breakRules: readonly BreakRule[];
  readonly creditRules: CreditRules;
}

/** Result of one day-level calculation. */
export interface DailyCreditResult {
  readonly recordedMinutes: number;
  readonly appliedBreakDeductionMinutes: number;
  readonly capped: boolean;
  readonly creditedMinutes: number;
}

/** Aggregate of daily credited minutes against a target. */
export interface AttendanceSummary {
  readonly creditedMinutes: number;
  readonly requiredMinutes: number;
  readonly remainingMinutes: number;
}
