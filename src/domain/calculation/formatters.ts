/**
 * Presentation helpers. hh:mm is derived directly from integer minutes;
 * decimal hours are presentation only. See Technical Design v1.0 section 7.
 */

/** Format integer minutes as hh:mm (e.g. 480 -> "08:00"). */
export function formatMinutesAsHhMm(minutes: number): string {
  const safe = Math.max(0, Math.trunc(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Present integer minutes as decimal hours for display only. */
export function formatMinutesAsDecimalHours(minutes: number): string {
  return (Math.max(0, minutes) / 60).toFixed(2);
}
