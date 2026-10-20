/**
 * View-model queries for the HR screens. They return canvas sample data
 * (src/lib/ui/fixtures/hr.ts) until the attendance, corrections and
 * internship modules are implemented. Each TODO names what replaces it.
 */

import {
  ANA_PROFILE,
  DEPARTMENTS,
  HOURS_ROWS,
  HR_IDENTITY,
  INTERN_COUNTS,
  INTERN_ROWS,
  NEEDS_YOU,
  OFFICE_LABEL,
  OFFICE_NAME,
  OFFICE_TODAY,
  OVERVIEW_COUNTS,
  POLICY_LABEL,
} from "@/lib/ui/fixtures/hr";
import { ATTENDANCE_DAYS, ATTENDANCE_PERIOD_LABEL, canAskForCorrection, SESSION_EXTRAS } from "@/lib/ui/fixtures/attendance";
import { DTR_NOTES, DTR_POLICY_LABEL } from "@/lib/ui/fixtures/dtr";
import { REVIEW_COUNTS, REVIEW_DETAILS, REVIEW_ROWS } from "@/lib/ui/fixtures/reviews";
import { hrReasonLabel } from "@/lib/ui/correction-form";
import { datesBetween, defaultPeriod, dtrSearch, formatRange, isWeekend, parseDtrScope, workdaysBetween } from "@/lib/ui/dtr";
import { hoursProgress } from "@/lib/ui/hours";
import { ANA_HOURS, CORRECTIONS, OCTOBER_DAYS, SCHEDULE, SNAPSHOT_NOW, SNAPSHOT_TODAY } from "@/lib/ui/fixtures/intern";
import { DEFAULT_REQUIRED_HOURS } from "@/lib/ui/intern-form";
import type { StatusKind } from "@/lib/ui/status";
import { clockToMinutes } from "@/lib/ui/timeline";
import type {
  AttendanceRowVM,
  DtrDayVM,
  DtrDepartmentReportVM,
  DtrInternReportVM,
  DtrPageVM,
  AttendanceStatusFilter,
  AttendanceVM,
  HrOverviewVM,
  HrShellVM,
  InternAccountTab,
  InternListVM,
  InternProfileVM,
  ReviewDetailVM,
  ReviewQueueVM,
  ReviewTab,
  SessionDetailVM,
  SessionScanVM,
} from "@/lib/ui/view-models";

const HOURS_ROWS_SHOWN = 4;

/** The frame every HR page shares. */
export async function getHrShell(): Promise<HrShellVM> {
  // TODO(module): signed-in HR user from the Better Auth session; review
  // count from src/modules/corrections countWaitingOnHr (corrections + held sessions).
  return { identity: HR_IDENTITY, reviewCount: NEEDS_YOU.length, officeLabel: OFFICE_LABEL };
}

export async function getHrOverview(): Promise<HrOverviewVM> {
  // TODO(module): src/modules/attendance getTodaySummary, src/modules/corrections
  // listWaitingOnHr, src/modules/internships listHoursProgress.
  const byPace = [...HOURS_ROWS].sort((a, b) => a.paceDeltaMinutes - b.paceDeltaMinutes);
  const byEndDate = [...HOURS_ROWS].sort((a, b) => a.endDateIso.localeCompare(b.endDateIso));
  return {
    todayIso: SNAPSHOT_TODAY,
    updatedAt: SNAPSHOT_NOW,
    kpis: {
      inOffice: OVERVIEW_COUNTS.inOffice,
      activeInterns: OVERVIEW_COUNTS.activeInterns,
      completedToday: OVERVIEW_COUNTS.completedToday,
      missingClockOut: OVERVIEW_COUNTS.missingClockOut,
      waitingOnHr: NEEDS_YOU.length,
      oldestWaitingDays: NEEDS_YOU[0]?.ageDays ?? null,
    },
    needsYou: NEEDS_YOU,
    officeToday: OFFICE_TODAY,
    scansToday: OVERVIEW_COUNTS.scansToday,
    behindPace: byPace.slice(0, HOURS_ROWS_SHOWN),
    finishingSoon: byEndDate.slice(0, HOURS_ROWS_SHOWN),
  };
}

const TABS: InternAccountTab[] = ["all", "active", "pending", "finished", "disabled"];
const PAGE_SIZE = 25;

export async function getInternList(filters: {
  tab?: InternAccountTab;
  query?: string;
  department?: string | null;
  page?: number;
}): Promise<InternListVM> {
  // TODO(module): src/modules/accounts listInterns (paged, with counts per account tab).
  const tab = filters.tab && TABS.includes(filters.tab) ? filters.tab : "all";
  const query = (filters.query ?? "").trim();
  const department = filters.department && DEPARTMENTS.includes(filters.department) ? filters.department : null;
  const needle = query.toLowerCase();
  const rows = INTERN_ROWS.filter(
    (row) =>
      (tab === "all" || row.tab === tab) &&
      (!department || row.department === department) &&
      (!needle || row.name.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle)),
  );
  const filtered = Boolean(query || department);
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  return {
    tab,
    query,
    department,
    counts: INTERN_COUNTS,
    rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    // The sample rows are one page of the canvas totals; a search only covers the sample.
    total: filtered ? rows.length : INTERN_COUNTS[tab],
    hasNextPage: rows.length > page * PAGE_SIZE,
    page,
    departments: DEPARTMENTS,
    officeLabel: OFFICE_LABEL,
    defaultRequiredMinutes: DEFAULT_REQUIRED_HOURS * 60,
  };
}

/** The office date `days` before an office date ("YYYY-MM-DD"). */
function daysBefore(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

/** HR's view of a correction: pending ones escalate with age, like on the Overview. */
function hrCorrectionStatus(id: string, value: (typeof CORRECTIONS)[number]["status"]): StatusKind {
  const waiting = NEEDS_YOU.find((item) => item.id === id);
  return waiting ? waiting.status : { type: "correction", value };
}

export async function getInternProfile(id: string): Promise<InternProfileVM | null> {
  // TODO(module): src/modules/internships getInternProfile and
  // src/modules/attendance listDays (last 7 office days).
  const row = INTERN_ROWS.find((candidate) => candidate.id === id);
  if (!row || row.tab === "pending") return null;
  const live = OFFICE_TODAY.find((item) => item.internId === id);
  const base: InternProfileVM = {
    id: row.id,
    name: row.name,
    initials: initials(row.name),
    email: row.email,
    department: row.department,
    departmentSinceIso: row.startDateIso,
    startDateIso: row.startDateIso,
    endDateIso: row.endDateIso,
    officeName: OFFICE_NAME,
    todayIso: SNAPSHOT_TODAY,
    nowClock: SNAPSHOT_NOW,
    today: live ? { status: live.status, time: live.time } : null,
    hours: {
      creditedMinutes: row.creditedMinutes,
      requiredMinutes: row.requiredMinutes,
      pendingCorrections: 0,
      pendingCreditMinutes: 0,
    },
    policyLabel: POLICY_LABEL,
    schedule: SCHEDULE,
    account: { status: row.tab === "disabled" ? "DISABLED" : "ACTIVE" },
    recentDays: [],
    corrections: [],
    assignments: [{ department: row.department, fromIso: row.startDateIso, toIso: row.tab === "finished" ? row.endDateIso : null }],
  };
  if (id !== "ana-reyes") return base;

  const pending = CORRECTIONS.filter((correction) => correction.status === "PENDING");
  const count = (status: (typeof CORRECTIONS)[number]["status"]) =>
    CORRECTIONS.filter((correction) => correction.status === status).length;
  return {
    ...base,
    departmentSinceIso: ANA_PROFILE.departmentSinceIso,
    hours: {
      ...base.hours,
      workdaysLeft: ANA_HOURS.workdaysLeft,
      pendingCorrections: pending.length,
      pendingCreditMinutes: pending.reduce((sum, correction) => sum + (correction.estimatedCreditMinutes ?? 0), 0),
    },
    stats: {
      daysAttended: ANA_PROFILE.daysAttended,
      corrections: {
        total: CORRECTIONS.length,
        approved: count("APPROVED"),
        rejected: count("REJECTED"),
        open: count("PENDING") + count("NEEDS_INFO"),
      },
      rejectedScans: ANA_PROFILE.rejectedScans,
      lastRejectedScan: ANA_PROFILE.lastRejectedScan,
    },
    account: { status: "ACTIVE", lastSignInLabel: ANA_PROFILE.lastSignInLabel },
    recentDays: OCTOBER_DAYS.filter((day) => day.dateIso >= daysBefore(SNAPSHOT_TODAY, 6)).reverse(),
    corrections: CORRECTIONS.map((correction) => ({
      id: correction.id,
      dateIso: correction.dateIso,
      reason: correction.reason,
      status: hrCorrectionStatus(correction.id, correction.status),
    })),
  };
}

const REVIEW_TABS: ReviewTab[] = ["you", "intern", "decided", "all"];

export async function getReviewQueue(filters: {
  tab?: ReviewTab;
  query?: string;
  department?: string | null;
  jev?: ReviewQueueVM["jev"];
}): Promise<ReviewQueueVM> {
  // TODO(module): src/modules/corrections listForReview (plus held sessions from attendance), oldest first.
  const tab = filters.tab && REVIEW_TABS.includes(filters.tab) ? filters.tab : "you";
  const query = (filters.query ?? "").trim();
  const department = filters.department && DEPARTMENTS.includes(filters.department) ? filters.department : null;
  const jev = filters.jev === "read" || filters.jev === "manual" ? filters.jev : "all";
  const needle = query.toLowerCase();
  return {
    tab,
    query,
    department,
    jev,
    counts: REVIEW_COUNTS,
    rows: REVIEW_ROWS.filter(
      (row) =>
        (tab === "all" || row.tab === tab) &&
        (!department || row.department === department) &&
        (jev === "all" || (jev === "read") === (row.jevCategory !== null)) &&
        (!needle || row.internName.toLowerCase().includes(needle)),
    ),
    departments: DEPARTMENTS,
  };
}

export async function getReviewDetail(id: string): Promise<ReviewDetailVM | null> {
  // TODO(module): src/modules/corrections getCorrectionForReview (with version,
  // revisions, Jev run and the day's scan evidence).
  return REVIEW_DETAILS[id] ?? null;
}

const ATTENDANCE_FILTERS: AttendanceStatusFilter[] = ["all", "open", "complete", "review", "rejected"];

/** Sample scans for a session's times: an IN at each start and an OUT at each end. */
function sampleScans(row: AttendanceRowVM): SessionScanVM[] {
  return row.sessions.flatMap((session, index) => {
    const seconds = (offset: number) => String((row.id.length * 7 + index * 13 + offset) % 60).padStart(2, "0");
    const scans: SessionScanVM[] = [
      { action: "IN", time: `${session.start}:${seconds(0)}`, qrLabel: "Main entrance · IN", distanceM: 14 + index * 5, accepted: true },
    ];
    if (session.end) {
      scans.push({ action: "OUT", time: `${session.end}:${seconds(29)}`, qrLabel: "Main entrance · OUT", distanceM: 19 + index * 4, accepted: true });
    }
    return scans;
  });
}

function sessionDetail(row: AttendanceRowVM, dateIso: string): SessionDetailVM {
  const extra = SESSION_EXTRAS[row.id] ?? {};
  const closed = row.sessions.filter((session) => session.end);
  return {
    id: row.id,
    internId: row.internId,
    internName: row.internName,
    department: row.department,
    dateIso,
    version: 1,
    policyVersion: 2,
    status: row.status,
    effective: row.sessions.map((session) => ({ timeIn: session.start, timeOut: session.end })),
    elapsedMinutes:
      closed.length && closed.length === row.sessions.length
        ? closed.reduce((sum, session) => sum + clockToMinutes(session.end!) - clockToMinutes(session.start), 0)
        : null,
    creditedMinutes: row.creditedMinutes,
    scans: sampleScans(row),
    revisions: [],
    correction: row.note ? { label: "Open the request", href: row.note.href } : undefined,
    canAskForCorrection: canAskForCorrection(row),
    ...extra,
  };
}

export async function getAttendance(filters: {
  query?: string;
  department?: string | null;
  status?: AttendanceStatusFilter;
  session?: string;
}): Promise<AttendanceVM> {
  // TODO(module): src/modules/attendance listSessionsByDay (office-day grouping,
  // effective sessions) and getSessionDetail (original scans, revisions).
  const query = (filters.query ?? "").trim();
  const department = filters.department && DEPARTMENTS.includes(filters.department) ? filters.department : null;
  const status = filters.status && ATTENDANCE_FILTERS.includes(filters.status) ? filters.status : "all";
  const needle = query.toLowerCase();
  const days = ATTENDANCE_DAYS.map((day) => ({
    ...day,
    isToday: day.dateIso === SNAPSHOT_TODAY,
    rows: day.rows.filter(
      (row) =>
        (status === "all" || row.filter === status) &&
        (!department || row.department === department) &&
        (!needle || row.internName.toLowerCase().includes(needle)),
    ),
  })).filter((day) => day.rows.length);

  let selected: SessionDetailVM | null = null;
  for (const day of ATTENDANCE_DAYS) {
    const row = day.rows.find((candidate) => candidate.id === filters.session);
    if (row) selected = sessionDetail(row, day.dateIso);
  }

  return {
    query,
    department,
    status,
    periodLabel: ATTENDANCE_PERIOD_LABEL,
    todayIso: SNAPSHOT_TODAY,
    nowClock: SNAPSHOT_NOW,
    schedule: SCHEDULE,
    departments: DEPARTMENTS,
    days,
    selected,
  };
}

/** An intern's DTR days in a range. Only Ana has daily records in the sample data. */
function dtrDays(internId: string, from: string, to: string): DtrDayVM[] {
  if (internId !== "ana-reyes") return [];
  const notes = DTR_NOTES[internId] ?? {};
  return datesBetween(from, to > SNAPSHOT_TODAY ? SNAPSHOT_TODAY : to).flatMap((dateIso): DtrDayVM[] => {
    const day = OCTOBER_DAYS.find((candidate) => candidate.dateIso === dateIso);
    if (!day) {
      return isWeekend(dateIso) ? [] : [{ dateIso, sessions: [], state: "none", creditedMinutes: 0, rawMinutes: null }];
    }
    const closed = day.sessions.every((session) => session.end);
    const rawMinutes = closed && day.sessions.length
      ? day.sessions.reduce((sum, session) => sum + clockToMinutes(session.end!) - clockToMinutes(session.start), 0)
      : null;
    const correction = day.correction
      ? {
          status: hrCorrectionStatus(day.correction.id, day.correction.status),
          href: `/hr/reviews/${day.correction.id}`,
          label: day.correction.status === "APPROVED" ? "Approved correction" : "Correction open",
        }
      : undefined;
    const state: DtrDayVM["state"] =
      day.kind === "complete" ? "credited" : day.kind === "open" ? "open" : day.kind === "incomplete" ? "pending" : "none";
    return [{ dateIso, sessions: day.sessions, state, creditedMinutes: state === "credited" ? day.creditedMinutes ?? 0 : 0, rawMinutes, note: notes[dateIso], correction }];
  });
}

export async function getDtrReport(params: Record<string, string | undefined>): Promise<DtrPageVM> {
  // TODO(module): src/modules/reports buildDtr (same calculation engine as the dashboard).
  const parsed = parseDtrScope(params, { todayIso: SNAPSHOT_TODAY, defaultInternId: "ana-reyes" });
  const reportable = INTERN_ROWS.filter((row) => row.tab !== "pending");
  const subject = parsed.scope.subject;
  const known =
    subject.kind === "intern" ? reportable.some((row) => row.id === subject.id) : DEPARTMENTS.includes(subject.name);
  const scope = known ? parsed.scope : { ...parsed.scope, subject: { kind: "intern" as const, id: "ana-reyes" } };
  // A bad custom range keeps the form as typed but previews the default period.
  const range = parsed.error ? defaultPeriod(SNAPSHOT_TODAY) : { from: scope.from, to: scope.to };
  const workdays = workdaysBetween(range.from, range.to);
  const subtitleTail = `${DTR_POLICY_LABEL} · Asia/Manila · preview generated today, ${SNAPSHOT_NOW}`;

  let report: DtrInternReportVM | DtrDepartmentReportVM;
  let title: string;
  let subtitle: string;
  if (scope.subject.kind === "intern") {
    const internId = scope.subject.id;
    const row = reportable.find((candidate) => candidate.id === internId)!;
    const all = dtrDays(row.id, range.from, range.to);
    const pendingDays = all.filter((day) => day.state === "pending");
    report = {
      kind: "intern",
      intern: { id: row.id, name: row.name, department: row.department },
      days: scope.includePending ? all : all.filter((day) => day.state === "credited" || day.state === "none"),
      creditedMinutes: all.reduce((sum, day) => sum + day.creditedMinutes, 0),
      daysCredited: all.filter((day) => day.state === "credited" && day.creditedMinutes > 0).length,
      workdays,
      pending: pendingDays.map((day) => {
        const correction = CORRECTIONS.find((candidate) => candidate.dateIso === day.dateIso && candidate.status === "PENDING");
        return {
          dateIso: day.dateIso,
          reason: correction ? hrReasonLabel(correction.reason).toLowerCase() : "held session",
          href: day.correction?.href ?? `/hr/attendance?q=${encodeURIComponent(row.name)}`,
        };
      }),
      remainingMinutes: hoursProgress(row).remainingMinutes,
    };
    title = `${row.name} · ${formatRange(range.from, range.to)}`;
    subtitle = `${row.department} · ${subtitleTail}`;
  } else {
    const department = scope.subject.name;
    const interns = reportable
      .filter((row) => row.department === department)
      .map((row) => {
        const days = dtrDays(row.id, range.from, range.to);
        return {
          id: row.id,
          name: row.name,
          creditedMinutes: days.reduce((sum, day) => sum + day.creditedMinutes, 0),
          daysCredited: days.filter((day) => day.state === "credited" && day.creditedMinutes > 0).length,
          pendingCount: days.filter((day) => day.state === "pending").length,
        };
      });
    report = {
      kind: "department",
      department,
      interns,
      creditedMinutes: interns.reduce((sum, intern) => sum + intern.creditedMinutes, 0),
      workdays,
      pendingCount: interns.reduce((sum, intern) => sum + intern.pendingCount, 0),
    };
    title = `${department} · ${formatRange(range.from, range.to)}`;
    subtitle = `${plural(interns.length, "intern")} · ${subtitleTail}`;
  }

  return {
    scope,
    rangeError: parsed.error,
    subjects: [
      ...reportable.map((row) => ({ value: row.id, label: `${row.name} · ${row.department}` })),
      ...DEPARTMENTS.map((name) => ({ value: `department:${name}`, label: `All interns in ${name}` })),
    ],
    title,
    subtitle,
    report,
    exportHref: `/hr/reports/export?${dtrSearch(parsed.error ? { ...scope, ...range } : scope)}`,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
