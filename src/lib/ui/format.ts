/**
 * Display formatting for the UI (spec section 3). Durations are always
 * "8h 01m", never decimals; clock times are 24-hour in the office time zone.
 */

/** Integer minutes as "8h 01m". Negative input shows as zero. */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.trunc(minutes));
  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, "0")}m`;
}

/** A requirement in whole hours, e.g. "486h". */
export function formatHours(minutes: number): string {
  return `${Math.round(Math.max(0, minutes) / 60)}h`;
}

/** Signed duration, e.g. "+8h 01m" or "−6h 00m" (true minus sign). */
export function formatDelta(minutes: number): string {
  const sign = minutes < 0 ? "−" : "+";
  return `${sign}${formatDuration(Math.abs(minutes))}`;
}

/** A UTC instant as office-local "HH:MM" (or "HH:MM:SS"). */
export function formatClock(
  instant: Date,
  timeZone: string,
  options: { seconds?: boolean } = {},
): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...(options.seconds ? { second: "2-digit" } : {}),
    hourCycle: "h23",
    timeZone,
  }).format(instant);
}

/** The office-local calendar date (YYYY-MM-DD) of a UTC instant. */
export function officeDateIso(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(instant);
}

/** Pin an office-local YYYY-MM-DD at noon UTC so formatting never shifts the day. */
function officeDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

/** "Oct 15", or "Thu, Oct 15" with the weekday. */
export function formatShortDate(isoDate: string, options: { weekday?: boolean } = {}): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(options.weekday ? { weekday: "short" } : {}),
    timeZone: "UTC",
  }).format(officeDate(isoDate));
}

/** Day group heading, e.g. "Monday, Oct 19". */
export function formatDayHeading(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
    officeDate(isoDate),
  );
}

/** "Monday, October 19, 2026", or "Monday, October 19" without the year. */
export function formatLongDate(isoDate: string, options: { year?: boolean } = {}): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(options.year === false ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(officeDate(isoDate));
}

/** "2026-10" -> "October 2026". */
export function formatMonthLabel(monthIso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${monthIso}-15T12:00:00Z`),
  );
}

/** Move a "YYYY-MM" month by a number of months. */
export function shiftMonth(monthIso: string, delta: number): string {
  const [year, month] = monthIso.split("-").map(Number) as [number, number];
  const total = year * 12 + (month - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Short, readable receipt reference: "4F2A-91C0". */
export function formatReceiptId(receiptId: string): string {
  const compact = receiptId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
}
