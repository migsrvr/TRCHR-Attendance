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
