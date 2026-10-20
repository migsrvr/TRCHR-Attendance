/**
 * View models: the exact data each screen renders. Queries build these;
 * views accept nothing else. Times are office-local "HH:MM", dates are
 * office-local "YYYY-MM-DD", durations are integer minutes.
 */

import type { CorrectionRequestStatus, UserStatus } from "@prisma/client";

import type { CorrectionProposal, CorrectionReason, RecordedDay } from "@/lib/ui/correction-form";
import type { StatusKind } from "@/lib/ui/status";

export interface InternIdentityVM {
  name: string;
  initials: string;
  department: string;
  timeZone: string;
}

export interface DaySessionVM {
  start: string;
  /** null while the session is still open. */
  end: string | null;
}

export interface InternHomeVM {
  identity: InternIdentityVM;
  todayIso: string;
  /** Office-local time the page was rendered, for the "now" marker. */
  nowClock: string;
  today: { openSince: string | null; sessions: DaySessionVM[] };
  schedule: { start: string; end: string };
  hours: { creditedMinutes: number; requiredMinutes: number; endDateIso: string; workdaysLeft: number };
  openCorrection: { id: string; dateIso: string; status: CorrectionRequestStatus; activity: string } | null;
}

export type HistoryDayKind = "open" | "complete" | "incomplete" | "none";

export interface HistoryDayVM {
  dateIso: string;
  sessions: DaySessionVM[];
  /** null while the day's session is still open. */
  creditedMinutes: number | null;
  kind: HistoryDayKind;
  /** Effective times were changed by an approved correction. */
  corrected?: boolean;
  correction?: { id: string; status: CorrectionRequestStatus };
}

export interface InternHistoryVM {
  identity: InternIdentityVM;
  monthIso: string;
  creditedMinutes: number;
  daysWithHours: number;
  workdays: number;
  days: HistoryDayVM[];
  canGoNext: boolean;
}

export interface CorrectionSummaryVM {
  id: string;
  dateIso: string;
  reason: CorrectionReason;
  proposal: CorrectionProposal;
  status: CorrectionRequestStatus;
  /** e.g. "You replied Oct 17". */
  activity: string;
  creditedDeltaMinutes?: number;
  hrNote?: string;
}

export interface InternCorrectionsVM {
  identity: InternIdentityVM;
  open: CorrectionSummaryVM[];
  decided: CorrectionSummaryVM[];
}

export interface NewCorrectionVM {
  identity: InternIdentityVM;
  todayIso: string;
  earliestDateIso: string;
  initialDateIso: string;
  /** Days with at least one scan; days missing here had no scans. */
  recordedByDate: Record<string, RecordedDay>;
}

export interface SetupLinkVM {
  email: string;
  firstName: string;
  role: "INTERN" | "HR";
  department?: string;
  startDateIso?: string;
  /** e.g. "Oct 25 at 6:00 PM". */
  expiresLabel: string;
}

export interface CorrectionMessageVM {
  id: string;
  author: "intern" | "hr";
  name: string;
  atLabel: string;
  body: string;
  /** e.g. "HR asked for more info". */
  label?: string;
}

export interface CorrectionDetailVM {
  identity: InternIdentityVM;
  id: string;
  dateIso: string;
  reason: CorrectionReason;
  status: CorrectionRequestStatus;
  submittedLabel: string;
  recorded: RecordedDay | null;
  proposal: CorrectionProposal;
  /** Calculation-engine estimate of credit if approved. */
  estimatedCreditMinutes: number | null;
  creditedDeltaMinutes?: number;
  decisionNote?: string;
  messages: CorrectionMessageVM[];
  canReply: boolean;
}

// HR panel

export interface HrIdentityVM {
  /** Bracketed placeholder until real HR accounts exist (spec section 3). */
  name: string;
  roleLabel: string;
  initials: string;
}

/** What every HR page's frame shows. */
export interface HrShellVM {
  identity: HrIdentityVM;
  /** Corrections and held sessions waiting on an HR decision: the sidebar Reviews count. */
  reviewCount: number;
  /** e.g. "Top Realty office · Asia/Manila". */
  officeLabel: string;
}

export interface NeedsYouItemVM {
  id: string;
  href: string;
  internName: string;
  subject: "correction" | "missing-day" | "session";
  /** The office day the item is about. */
  dateIso: string;
  /** Reason and proposal, e.g. "Missed clock-out · proposes Time out 18:05". */
  detail: string;
  /** Jev has an advisory reading; shows the JEV tag. */
  jevRead: boolean;
  status: StatusKind;
  /** Calendar days it has been waiting. */
  ageDays: number;
}

export interface OfficeTodayItemVM {
  internId: string;
  name: string;
  department: string;
  /** An open or complete session, or a rejected scan. */
  status: StatusKind;
  /** Latest scan; for an open session, its Time in. */
  time: string;
}

export interface HoursRowVM {
  internId: string;
  name: string;
  department: string;
  creditedMinutes: number;
  requiredMinutes: number;
  endDateIso: string;
  /** Credited minus expected by today (calculation engine). Negative = behind. */
  paceDeltaMinutes: number;
}

export interface HrOverviewVM {
  todayIso: string;
  /** "HH:MM" the numbers were read. */
  updatedAt: string;
  kpis: {
    inOffice: number;
    activeInterns: number;
    completedToday: number;
    /** Open sessions from earlier days. */
    missingClockOut: number;
    waitingOnHr: number;
    oldestWaitingDays: number | null;
  };
  /** Oldest first. */
  needsYou: NeedsYouItemVM[];
  /** Latest scans first; a short list. */
  officeToday: OfficeTodayItemVM[];
  scansToday: number;
  /** Furthest behind first. */
  behindPace: HoursRowVM[];
  /** Nearest end date first. */
  finishingSoon: HoursRowVM[];
}

export type InternAccountTab = "all" | "active" | "pending" | "finished" | "disabled";

export interface InternListRowVM {
  id: string;
  name: string;
  email: string;
  department: string;
  creditedMinutes: number;
  requiredMinutes: number;
  startDateIso: string;
  endDateIso: string | null;
  tab: Exclude<InternAccountTab, "all">;
  /** Account or internship status, as drawn in the Account column. */
  status: StatusKind;
  /** Setup pending: when the last link went out. */
  setupLinkSentIso?: string;
}

export interface InternListVM {
  tab: InternAccountTab;
  query: string;
  department: string | null;
  counts: Record<InternAccountTab, number>;
  rows: InternListRowVM[];
  /** Rows in the current tab before paging (from the server). */
  total: number;
  hasNextPage: boolean;
  page: number;
  departments: string[];
  officeLabel: string;
  defaultRequiredMinutes: number;
}

export interface InternProfileVM {
  id: string;
  name: string;
  initials: string;
  email: string;
  department: string;
  departmentSinceIso: string;
  startDateIso: string;
  endDateIso: string | null;
  officeName: string;
  todayIso: string;
  nowClock: string;
  /** Live status for today, e.g. In office since 08:57; null if not started. */
  today: { status: StatusKind; time?: string } | null;
  hours: {
    creditedMinutes: number;
    requiredMinutes: number;
    workdaysLeft?: number;
    pendingCorrections: number;
    /** Engine estimate of what open corrections would add if approved. */
    pendingCreditMinutes: number;
  };
  /** Missing for interns with no attendance yet. */
  stats?: {
    daysAttended: number;
    corrections: { total: number; approved: number; rejected: number; open: number };
    rejectedScans: number;
    lastRejectedScan?: { dateIso: string; reason: string };
  };
  policyLabel: string;
  schedule: { start: string; end: string };
  account: { status: UserStatus; lastSignInLabel?: string };
  /** Last 7 days, newest first. */
  recentDays: HistoryDayVM[];
  corrections: { id: string; dateIso: string; reason: CorrectionReason; status: StatusKind }[];
  assignments: { department: string; fromIso: string; toIso: string | null }[];
}
