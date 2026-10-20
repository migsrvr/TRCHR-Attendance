/**
 * Deterministic calculation engine.
 *
 * SKELETON: signature only. Implementation order - intersect intervals with
 * schedule windows, sum seconds, apply qualifying break deduction, clamp,
 * apply daily cap, round once, produce integer credited minutes.
 * See Technical Design v1.0 section 7 ("Deterministic calculation order").
 */

import type {
  AttendanceInterval,
  AttendancePolicy,
  DailyCreditResult,
} from "./types";

export function calculateDailyCredit(
  _intervals: readonly AttendanceInterval[],
  _policy: AttendancePolicy,
): DailyCreditResult {
  throw new Error("calculateDailyCredit is not implemented yet");
}
