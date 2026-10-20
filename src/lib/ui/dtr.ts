/**
 * Daily time record periods and scope. Office dates are "YYYY-MM-DD" in the
 * office time zone; date math here is calendar-only (UTC noon), never local.
 */

export type DtrPeriod = "first" | "second" | "custom";

export type DtrSubject = { kind: "intern"; id: string } | { kind: "department"; name: string };

export interface DtrScope {
  subject: DtrSubject;
  period: DtrPeriod;
  from: string;
  to: string;
  /** Multiple sessions in a day each get a line; otherwise first in to last out. */
  eachSession: boolean;
  includePending: boolean;
  includeRaw: boolean;
}

export const MAX_RANGE_DAYS = 62;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const date = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (value: Date) => value.toISOString().slice(0, 10);

export function addDays(isoDate: string, days: number): string {
  const value = date(isoDate);
  value.setUTCDate(value.getUTCDate() + days);
  return iso(value);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The 1st–15th or 16th–last-day half of the month containing `anchorIso`. */
export function periodRange(period: "first" | "second", anchorIso: string): { from: string; to: string } {
  const [year, month] = anchorIso.split("-").map(Number) as [number, number];
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return period === "first"
    ? { from: `${prefix}-01`, to: `${prefix}-15` }
    : { from: `${prefix}-16`, to: `${prefix}-${lastDayOfMonth(year, month)}` };
}

/** The latest half-month that has fully ended by `todayIso`, the usual DTR cutoff. */
export function defaultPeriod(todayIso: string): { period: "first" | "second"; from: string; to: string } {
  const day = Number(todayIso.slice(8, 10));
  if (day > 15) return { period: "first", ...periodRange("first", todayIso) };
  const lastMonth = addDays(`${todayIso.slice(0, 8)}01`, -1);
  return { period: "second", ...periodRange("second", lastMonth) };
}

export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let current = from; current <= to; current = addDays(current, 1)) dates.push(current);
  return dates;
}

export const isWeekend = (isoDate: string) => [0, 6].includes(date(isoDate).getUTCDay());

export function workdaysBetween(from: string, to: string): number {
  return datesBetween(from, to).filter((day) => !isWeekend(day)).length;
}

export function validateRange(from: string, to: string): string | null {
  if (!ISO.test(from) || !ISO.test(to)) return "Choose both dates.";
  if (to < from) return "The end date is before the start date. Pick a To date on or after From.";
  if (datesBetween(from, to).length > MAX_RANGE_DAYS) return `Keep a custom range to ${MAX_RANGE_DAYS} days or less.`;
  return null;
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/** "Oct 1–15, 2026", "Oct 16 – Nov 3, 2026", "Dec 16, 2026 – Jan 5, 2027". */
export function formatRange(from: string, to: string): string {
  const [fy, , fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, , td] = to.split("-").map(Number) as [number, number, number];
  const fm = MONTH.format(date(from));
  const tm = MONTH.format(date(to));
  if (fy !== ty) return `${fm} ${fd}, ${fy} – ${tm} ${td}, ${ty}`;
  if (fm !== tm) return `${fm} ${fd} – ${tm} ${td}, ${fy}`;
  return fd === td ? `${fm} ${fd}, ${fy}` : `${fm} ${fd}–${td}, ${fy}`;
}

type Params = Record<string, string | undefined>;

/**
 * The scope from the report URL. `options=1` marks a submitted form, so an
 * unchecked box (absent from the URL) means off; on first load the defaults
 * (each session on its own line, pending items included) are on.
 */
export function parseDtrScope(
  params: Params,
  defaults: { todayIso: string; defaultInternId: string },
): { scope: DtrScope; error: string | null } {
  const subjectParam = params.subject ?? "";
  const subject: DtrSubject = subjectParam.startsWith("department:")
    ? { kind: "department", name: subjectParam.slice("department:".length) }
    : { kind: "intern", id: subjectParam || defaults.defaultInternId };

  const submitted = params.options === "1";
  const base = {
    subject,
    eachSession: submitted ? params.each === "1" : true,
    includePending: submitted ? params.pending === "1" : true,
    includeRaw: params.raw === "1",
  };

  const period = params.period === "first" || params.period === "second" || params.period === "custom" ? params.period : null;
  if (period === "custom") {
    const fallback = defaultPeriod(defaults.todayIso);
    const from = params.from && ISO.test(params.from) ? params.from : fallback.from;
    const to = params.to && ISO.test(params.to) ? params.to : fallback.to;
    return { scope: { ...base, period, from, to }, error: validateRange(from, to) };
  }
  if (period) {
    const anchor = params.from && ISO.test(params.from) ? params.from : defaults.todayIso;
    return { scope: { ...base, period, ...periodRange(period, anchor) }, error: null };
  }
  return { scope: { ...base, ...defaultPeriod(defaults.todayIso) }, error: null };
}

/** The report URL for a scope (also used by the CSV export link). */
export function dtrSearch(scope: DtrScope): string {
  const search = new URLSearchParams();
  search.set("subject", scope.subject.kind === "intern" ? scope.subject.id : `department:${scope.subject.name}`);
  search.set("period", scope.period);
  search.set("from", scope.from);
  if (scope.period === "custom") search.set("to", scope.to);
  search.set("options", "1");
  if (scope.eachSession) search.set("each", "1");
  if (scope.includePending) search.set("pending", "1");
  if (scope.includeRaw) search.set("raw", "1");
  return search.toString();
}
