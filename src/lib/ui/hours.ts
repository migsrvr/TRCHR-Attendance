/**
 * Internship hours progress for display. Credited minutes come from the
 * calculation engine; this only derives percentages and pace.
 */

export interface HoursProgressInput {
  creditedMinutes: number;
  requiredMinutes: number;
  /** Workdays left until the end date, if known. */
  workdaysLeft?: number;
}

export interface HoursProgress {
  percent: number;
  remainingMinutes: number;
  /** Minutes per remaining workday to finish on time, rounded up to 5 minutes. */
  pacePerWorkdayMinutes?: number;
}

export function hoursProgress({ creditedMinutes, requiredMinutes, workdaysLeft }: HoursProgressInput): HoursProgress {
  const remainingMinutes = Math.max(requiredMinutes - creditedMinutes, 0);
  const percent = requiredMinutes > 0 ? Math.min(100, Math.floor((creditedMinutes / requiredMinutes) * 100)) : 100;
  const pacePerWorkdayMinutes =
    workdaysLeft && workdaysLeft > 0 && remainingMinutes > 0
      ? Math.ceil(remainingMinutes / workdaysLeft / 5) * 5
      : undefined;
  return { percent, remainingMinutes, pacePerWorkdayMinutes };
}

/** Behind pace by at least this much is flagged for HR: one full workday (confirm with HR). */
export const PACE_ALERT_MINUTES = 8 * 60;

/**
 * HR's pace column. The engine supplies credited minus expected-by-today;
 * this rounds it to whole hours ("−41h") and flags a full workday behind.
 */
export function paceStatus(deltaMinutes: number): { label: string; alert: boolean } {
  const hoursBehind = Math.round(-deltaMinutes / 60);
  if (hoursBehind <= 0) return { label: "On track", alert: false };
  return { label: `−${hoursBehind}h`, alert: -deltaMinutes >= PACE_ALERT_MINUTES };
}
