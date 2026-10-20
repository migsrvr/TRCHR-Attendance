/**
 * Canvas sample data for the intern screens (Ana Reyes, October 2026).
 * Only src/lib/ui/queries/* may import this file.
 *
 * Snapshot date: Monday, Oct 19, 2026 at 14:41, Ana in the office since 08:57.
 * Weekdays only. Credited minutes are what the calculation engine would
 * produce under the example policy (09:00–18:00, 60-minute break, 8h cap).
 */

import type { CorrectionDetailVM, HistoryDayVM, InternIdentityVM } from "@/lib/ui/view-models";

export const SNAPSHOT_TODAY = "2026-10-19";
export const SNAPSHOT_NOW = "14:41";

export const ANA: InternIdentityVM = {
  name: "Ana Reyes",
  initials: "AR",
  department: "Marketing",
  timeZone: "Asia/Manila",
};

export const ANA_HOURS = {
  creditedMinutes: 18750,
  requiredMinutes: 29160,
  endDateIso: "2026-11-28",
  workdaysLeft: 29,
  startDateIso: "2026-07-21",
};

export const SCHEDULE = { start: "09:00", end: "18:00" };

/** October 2026, oldest first. */
export const OCTOBER_DAYS: HistoryDayVM[] = [
  { dateIso: "2026-10-01", sessions: [{ start: "09:02", end: "18:01" }], creditedMinutes: 478, kind: "complete" },
  { dateIso: "2026-10-02", sessions: [{ start: "08:55", end: "18:05" }], creditedMinutes: 480, kind: "complete" },
  { dateIso: "2026-10-05", sessions: [{ start: "09:15", end: "18:00" }], creditedMinutes: 465, kind: "complete" },
  {
    dateIso: "2026-10-06",
    sessions: [
      { start: "08:58", end: "12:01" },
      { start: "13:00", end: "17:30" },
    ],
    creditedMinutes: 450,
    kind: "complete",
  },
  { dateIso: "2026-10-07", sessions: [{ start: "09:00", end: "18:02" }], creditedMinutes: 480, kind: "complete" },
  { dateIso: "2026-10-08", sessions: [{ start: "09:05", end: "16:00" }], creditedMinutes: 355, kind: "complete" },
  { dateIso: "2026-10-09", sessions: [], creditedMinutes: 0, kind: "none" },
  { dateIso: "2026-10-12", sessions: [{ start: "08:59", end: "18:00" }], creditedMinutes: 480, kind: "complete" },
  {
    dateIso: "2026-10-13",
    sessions: [{ start: "09:10", end: "17:45" }],
    creditedMinutes: 455,
    kind: "complete",
    corrected: true,
    correction: { id: "corr-oct13", status: "APPROVED" },
  },
  {
    dateIso: "2026-10-14",
    sessions: [
      { start: "08:58", end: "12:00" },
      { start: "13:02", end: "18:10" },
    ],
    creditedMinutes: 478,
    kind: "complete",
  },
  {
    dateIso: "2026-10-15",
    sessions: [{ start: "09:04", end: null }],
    creditedMinutes: 0,
    kind: "incomplete",
    correction: { id: "corr-oct15", status: "PENDING" },
  },
  { dateIso: "2026-10-16", sessions: [{ start: "09:01", end: "18:04" }], creditedMinutes: 479, kind: "complete" },
  { dateIso: "2026-10-19", sessions: [{ start: "08:57", end: null }], creditedMinutes: null, kind: "open" },
];

export const OCTOBER_WORKDAYS = 13;

/** Recorded scans for days the form can be opened on (before corrections are applied). */
export const RECORDED_EXTRA: Record<string, { timeIn: string | null; timeOut: string | null }> = {
  // Oct 13 as originally recorded: the Time in scan was missing.
  "2026-10-13": { timeIn: null, timeOut: "17:45" },
};

export const CORRECTIONS: CorrectionDetailVM[] = [
  {
    identity: ANA,
    id: "corr-oct15",
    dateIso: "2026-10-15",
    reason: "missed_clock_out",
    status: "PENDING",
    submittedLabel: "Oct 15, 6:22 PM",
    recorded: { timeIn: "09:04", timeOut: null },
    proposal: { timeOut: "18:05" },
    estimatedCreditMinutes: 481,
    messages: [
      {
        id: "m1",
        author: "intern",
        name: "You",
        atLabel: "Oct 15, 6:22 PM",
        body: "I forgot to scan OUT. The client meeting ran late and I left the office at 6:05 PM.",
      },
      {
        id: "m2",
        author: "hr",
        name: "[HR NAME]",
        atLabel: "Oct 16, 10:03 AM",
        body: "Which meeting was this, and who was with you?",
        label: "HR asked for more info",
      },
      {
        id: "m3",
        author: "intern",
        name: "You",
        atLabel: "Oct 17, 8:51 AM",
        body: "The leasing debrief with [SUPERVISOR NAME] in the 3rd-floor conference room. It ended a little before 6.",
      },
    ],
    canReply: true,
  },
  {
    identity: ANA,
    id: "corr-oct13",
    dateIso: "2026-10-13",
    reason: "missed_clock_in",
    status: "APPROVED",
    submittedLabel: "Oct 13, 5:58 PM",
    recorded: { timeIn: null, timeOut: "17:45" },
    proposal: { timeIn: "09:10" },
    estimatedCreditMinutes: 455,
    creditedDeltaMinutes: 455,
    decisionNote: "Confirmed with the Marketing lead that you arrived at 9:10.",
    messages: [
      {
        id: "m1",
        author: "intern",
        name: "You",
        atLabel: "Oct 13, 5:58 PM",
        body: "The scanner kept spinning when I arrived, so I went straight to the team meeting. I arrived at 9:10.",
      },
      {
        id: "m2",
        author: "hr",
        name: "[HR NAME]",
        atLabel: "Oct 14, 11:32 AM",
        body: "Confirmed with the Marketing lead that you arrived at 9:10.",
        label: "HR approved",
      },
    ],
    canReply: false,
  },
  {
    identity: ANA,
    id: "corr-sep22",
    dateIso: "2026-09-22",
    reason: "technical_issue",
    status: "REJECTED",
    submittedLabel: "Sep 22, 7:10 PM",
    recorded: null,
    proposal: { timeIn: "09:00", timeOut: "18:00" },
    estimatedCreditMinutes: 480,
    decisionNote: "You were on approved leave that day, so no hours apply.",
    messages: [
      {
        id: "m1",
        author: "intern",
        name: "You",
        atLabel: "Sep 22, 7:10 PM",
        body: "My location wouldn't load all day, so none of my scans saved.",
      },
      {
        id: "m2",
        author: "hr",
        name: "[HR NAME]",
        atLabel: "Sep 23, 9:48 AM",
        body: "You were on approved leave that day, so no hours apply.",
        label: "HR rejected",
      },
    ],
    canReply: false,
  },
];

export const CORRECTION_ACTIVITY: Record<string, string> = {
  "corr-oct15": "You replied Oct 17",
  "corr-oct13": "Approved Oct 14",
  "corr-sep22": "Rejected Sep 23",
};
