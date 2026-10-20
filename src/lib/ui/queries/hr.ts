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
import { REVIEW_COUNTS, REVIEW_DETAILS, REVIEW_ROWS } from "@/lib/ui/fixtures/reviews";
import { ANA_HOURS, CORRECTIONS, OCTOBER_DAYS, SCHEDULE, SNAPSHOT_NOW, SNAPSHOT_TODAY } from "@/lib/ui/fixtures/intern";
import { DEFAULT_REQUIRED_HOURS } from "@/lib/ui/intern-form";
import type { StatusKind } from "@/lib/ui/status";
import type {
  HrOverviewVM,
  HrShellVM,
  InternAccountTab,
  InternListVM,
  InternProfileVM,
  ReviewDetailVM,
  ReviewQueueVM,
  ReviewTab,
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
