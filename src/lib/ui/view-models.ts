/**
 * View models: the exact data each screen renders. Queries build these;
 * views accept nothing else. Times are office-local "HH:MM", dates are
 * office-local "YYYY-MM-DD", durations are integer minutes.
 */

import type { CorrectionRequestStatus } from "@prisma/client";

import type { CorrectionProposal, CorrectionReason, RecordedDay } from "@/lib/ui/correction-form";

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
