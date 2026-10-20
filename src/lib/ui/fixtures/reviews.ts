/**
 * Sample data for the Reviews queue and review detail, transcribed from the
 * canvas Reviews and Review detail artboards. Only src/lib/ui/queries/* may
 * import this file.
 *
 * "Waiting on you" is the Overview's Needs you list (corrections plus a held
 * session), so the count agrees everywhere. Weekend dates on the canvas are
 * moved to weekdays like the other fixtures. Ana's requests come from the
 * intern fixtures so HR and Ana see the same thread.
 */

import { HOURS_ROWS, NEEDS_YOU } from "@/lib/ui/fixtures/hr";
import { ANA, CORRECTIONS, SCHEDULE } from "@/lib/ui/fixtures/intern";
import type { ReviewDetailVM, ReviewRowVM, ReviewTab } from "@/lib/ui/view-models";

const needsYou = (id: string) => NEEDS_YOU.find((item) => item.id === id)!;

function waitingRow(id: string, department: string, request: ReviewRowVM["request"], jevCategory: string | null): ReviewRowVM {
  const item = needsYou(id);
  return {
    id,
    href: item.href,
    internName: item.internName,
    department,
    dateIso: item.dateIso,
    request,
    jevCategory,
    status: item.status,
    ageDays: item.ageDays,
    tab: "you",
  };
}

export const REVIEW_ROWS: ReviewRowVM[] = [
  waitingRow("corr-oct15", "Marketing", { label: "Add Time out", value: "18:05" }, "Missed clock-out"),
  waitingRow("corr-paolo-oct16", "Sales Ops", { label: "Change Time in to", value: "08:40" }, "Technical issue"),
  waitingRow("corr-bea-oct14", "Finance", { label: "Missing day", value: "09:00–18:00" }, null),
  waitingRow("sess-luis-oct16", "Sales Ops", { label: "Time out after midnight", value: "00:40" }, null),
  {
    id: "corr-marco-oct16",
    href: "/hr/reviews/corr-marco-oct16",
    internName: "Marco Dela Cruz",
    department: "Marketing",
    dateIso: "2026-10-16",
    request: { label: "Add Time in", value: "09:10" },
    jevCategory: "Missed clock-in",
    status: { type: "correction", value: "NEEDS_INFO" },
    ageDays: 2,
    tab: "intern",
  },
  {
    id: "corr-jessa-oct14",
    href: "/hr/reviews/corr-jessa-oct14",
    internName: "Jessa Lim",
    department: "IT",
    dateIso: "2026-10-14",
    request: { label: "Scanned IN instead of OUT" },
    jevCategory: "Wrong action",
    status: { type: "correction", value: "NEEDS_INFO" },
    ageDays: 5,
    tab: "intern",
  },
  {
    id: "corr-oct13",
    href: "/hr/reviews/corr-oct13",
    internName: ANA.name,
    department: ANA.department,
    dateIso: "2026-10-13",
    request: { label: "Add Time in", value: "09:10" },
    jevCategory: "Missed clock-in",
    status: { type: "correction", value: "APPROVED" },
    ageDays: 1,
    tab: "decided",
  },
  {
    id: "corr-sep22",
    href: "/hr/reviews/corr-sep22",
    internName: ANA.name,
    department: ANA.department,
    dateIso: "2026-09-22",
    request: { label: "Missing day", value: "09:00–18:00" },
    jevCategory: "Technical issue",
    status: { type: "correction", value: "REJECTED" },
    ageDays: 1,
    tab: "decided",
  },
];

/** Decided requests on the canvas; the rows above show a sample of them. */
const DECIDED_TOTAL = 38;

export const REVIEW_COUNTS: Record<ReviewTab, number> = (() => {
  const you = REVIEW_ROWS.filter((row) => row.tab === "you").length;
  const intern = REVIEW_ROWS.filter((row) => row.tab === "intern").length;
  return { you, intern, decided: DECIDED_TOTAL, all: you + intern + DECIDED_TOTAL };
})();

const POLICY_NOTE = "policy v2, 60-minute break deducted once per day";

function hoursFor(internId: string) {
  const row = HOURS_ROWS.find((candidate) => candidate.internId === internId)!;
  return { creditedMinutes: row.creditedMinutes, requiredMinutes: row.requiredMinutes };
}

/** Ana's requests, as HR sees them: same thread, her name instead of "You". */
function fromAna(id: string, extra: Pick<ReviewDetailVM, "version" | "recorded" | "proposed" | "jev" | "evidence" | "history"> & Partial<ReviewDetailVM>): ReviewDetailVM {
  const correction = CORRECTIONS.find((candidate) => candidate.id === id)!;
  const waiting = NEEDS_YOU.find((item) => item.id === id);
  return {
    id,
    internId: "ana-reyes",
    internName: ANA.name,
    department: ANA.department,
    dateIso: correction.dateIso,
    reason: correction.reason,
    state: correction.status,
    status: waiting ? waiting.status : { type: "correction", value: correction.status },
    submittedLabel: correction.submittedLabel,
    policyNote: POLICY_NOTE,
    schedule: SCHEDULE,
    hours: hoursFor("ana-reyes"),
    comments: correction.messages.map((message) => ({
      id: message.id,
      author: message.author,
      name: message.author === "intern" ? ANA.name : message.name,
      label: message.label?.replace(/^HR /, ""),
      atLabel: message.atLabel,
      body: message.body,
    })),
    decisionNote: correction.decisionNote,
    ...extra,
  };
}

const ENTRANCE_IN = "Main entrance · IN";
const ENTRANCE_OUT = "Main entrance · OUT";

export const REVIEW_DETAILS: Record<string, ReviewDetailVM> = {
  "corr-oct15": fromAna("corr-oct15", {
    version: 3,
    recorded: { timeIn: "09:04", timeOut: null, creditedMinutes: 0 },
    proposed: { timeIn: "09:04", timeOut: "18:05", creditedMinutes: 481 },
    jev: { status: "read", category: "Missed clock-out", categoryScore: 0.91, detailsScore: 0.78, version: 3, model: "jev-1.13.0", atLabel: "Oct 17, 9:14 AM" },
    evidence: [{ action: "Time in", time: "09:04:12", qrLabel: ENTRANCE_IN, distanceM: 18, radiusM: 60, accuracyM: 12, accepted: true }],
    evidenceNote: "No Time out scan on Oct 15, accepted or rejected.",
    history: [
      { label: "Jev read version 3", atLabel: "Oct 17 · 09:14" },
      { label: "Ana replied · version 3", atLabel: "Oct 17 · 08:51" },
      { label: "HR asked for more info · version 2", atLabel: "Oct 16 · 10:03" },
      { label: "Ana submitted the request", atLabel: "Oct 15 · 18:22" },
    ],
  }),
  "corr-oct13": fromAna("corr-oct13", {
    version: 2,
    recorded: { timeIn: null, timeOut: "17:45", creditedMinutes: 0 },
    proposed: { timeIn: "09:10", timeOut: "17:45", creditedMinutes: 455 },
    jev: { status: "read", category: "Missed clock-in", categoryScore: 0.9, detailsScore: 0.85, version: 1, model: "jev-1.13.0", atLabel: "Oct 13, 6:01 PM" },
    evidence: [{ action: "Time out", time: "17:45:31", qrLabel: ENTRANCE_OUT, distanceM: 22, radiusM: 60, accuracyM: 10, accepted: true }],
    evidenceNote: "No Time in scan on Oct 13, accepted or rejected.",
    history: [
      { label: "HR approved · version 2", atLabel: "Oct 14 · 11:32" },
      { label: "Jev read version 1", atLabel: "Oct 13 · 18:01" },
      { label: "Ana submitted the request", atLabel: "Oct 13 · 17:58" },
    ],
  }),
  "corr-sep22": fromAna("corr-sep22", {
    version: 2,
    recorded: { timeIn: null, timeOut: null, creditedMinutes: 0 },
    proposed: { timeIn: "09:00", timeOut: "18:00", creditedMinutes: 480 },
    jev: { status: "read", category: "Technical issue", categoryScore: 0.71, detailsScore: 0.4, version: 1, model: "jev-1.12.2", atLabel: "Sep 22, 7:13 PM" },
    evidence: [{ action: "Time in", time: "09:03:40", qrLabel: ENTRANCE_IN, distanceM: 41, radiusM: 60, accuracyM: 95, accepted: false }],
    evidenceNote: "The 09:03 scan was rejected: location accuracy ±95 m, needed ±25 m or better.",
    history: [
      { label: "HR rejected · version 2", atLabel: "Sep 23 · 09:48" },
      { label: "Jev read version 1", atLabel: "Sep 22 · 19:13" },
      { label: "Ana submitted the request", atLabel: "Sep 22 · 19:10" },
    ],
  }),
  "corr-paolo-oct16": {
    id: "corr-paolo-oct16",
    version: 1,
    internId: "paolo-cruz",
    internName: "Paolo Cruz",
    department: "Sales Ops",
    dateIso: "2026-10-16",
    reason: "technical_issue",
    state: "PENDING",
    status: needsYou("corr-paolo-oct16").status,
    submittedLabel: "Oct 16, 9:41 AM",
    recorded: { timeIn: "09:22", timeOut: "18:01", creditedMinutes: 459 },
    proposed: { timeIn: "08:40", timeOut: "18:01", creditedMinutes: 501 },
    policyNote: POLICY_NOTE,
    schedule: SCHEDULE,
    hours: hoursFor("paolo-cruz"),
    comments: [
      {
        id: "p1",
        author: "intern",
        name: "Paolo Cruz",
        atLabel: "Oct 16, 9:41 AM",
        body: "The scanner wouldn't open when I arrived at 8:40, so I scanned again after the morning huddle.",
      },
    ],
    jev: { status: "read", category: "Technical issue", categoryScore: 0.84, detailsScore: 0.66, version: 1, model: "jev-1.13.0", atLabel: "Oct 16, 9:44 AM" },
    evidence: [
      { action: "Time in", time: "09:22:05", qrLabel: ENTRANCE_IN, distanceM: 15, radiusM: 60, accuracyM: 9, accepted: true },
      { action: "Time out", time: "18:01:12", qrLabel: ENTRANCE_OUT, distanceM: 20, radiusM: 60, accuracyM: 11, accepted: true },
    ],
    history: [
      { label: "Jev read version 1", atLabel: "Oct 16 · 09:44" },
      { label: "Paolo submitted the request", atLabel: "Oct 16 · 09:41" },
    ],
  },
  "corr-bea-oct14": {
    id: "corr-bea-oct14",
    version: 1,
    internId: "bea-santos",
    internName: "Bea Santos",
    department: "Finance",
    dateIso: "2026-10-14",
    reason: "technical_issue",
    state: "PENDING",
    status: needsYou("corr-bea-oct14").status,
    submittedLabel: "Oct 17, 8:20 PM",
    recorded: { timeIn: null, timeOut: null, creditedMinutes: 0 },
    proposed: { timeIn: "09:00", timeOut: "18:00", creditedMinutes: 480 },
    policyNote: POLICY_NOTE,
    schedule: SCHEDULE,
    hours: hoursFor("bea-santos"),
    comments: [
      {
        id: "b1",
        author: "intern",
        name: "Bea Santos",
        atLabel: "Oct 17, 8:20 PM",
        body: "My phone died on the way in, so I couldn't scan at all. I was at the Finance desk all day.",
      },
    ],
    jev: { status: "unavailable" },
    evidence: [],
    evidenceNote: "No scans on Oct 14, accepted or rejected.",
    history: [
      { label: "Jev couldn't read it · manual review", atLabel: "Oct 17 · 20:21" },
      { label: "Bea submitted the request", atLabel: "Oct 17 · 20:20" },
    ],
  },
  "corr-marco-oct16": {
    id: "corr-marco-oct16",
    version: 2,
    internId: "marco-dela-cruz",
    internName: "Marco Dela Cruz",
    department: "Marketing",
    dateIso: "2026-10-16",
    reason: "missed_clock_in",
    state: "NEEDS_INFO",
    status: { type: "correction", value: "NEEDS_INFO" },
    submittedLabel: "Oct 16, 6:12 PM",
    recorded: { timeIn: null, timeOut: "18:00", creditedMinutes: 0 },
    proposed: { timeIn: "09:10", timeOut: "18:00", creditedMinutes: 470 },
    policyNote: POLICY_NOTE,
    schedule: SCHEDULE,
    hours: hoursFor("marco-dela-cruz"),
    comments: [
      { id: "mc1", author: "intern", name: "Marco Dela Cruz", atLabel: "Oct 16, 6:12 PM", body: "I came in at 9:10 and forgot to scan IN." },
      {
        id: "mc2",
        author: "hr",
        name: "[HR NAME]",
        label: "asked for more info",
        atLabel: "Oct 17, 9:30 AM",
        body: "Did anyone see you arrive? A name is enough.",
      },
    ],
    jev: { status: "read", category: "Missed clock-in", categoryScore: 0.88, detailsScore: 0.52, version: 1, model: "jev-1.13.0", atLabel: "Oct 16, 6:14 PM" },
    evidence: [{ action: "Time out", time: "18:00:22", qrLabel: ENTRANCE_OUT, distanceM: 24, radiusM: 60, accuracyM: 14, accepted: true }],
    evidenceNote: "No Time in scan on Oct 16, accepted or rejected.",
    history: [
      { label: "HR asked for more info · version 2", atLabel: "Oct 17 · 09:30" },
      { label: "Jev read version 1", atLabel: "Oct 16 · 18:14" },
      { label: "Marco submitted the request", atLabel: "Oct 16 · 18:12" },
    ],
  },
  "corr-jessa-oct14": {
    id: "corr-jessa-oct14",
    version: 2,
    internId: "jessa-lim",
    internName: "Jessa Lim",
    department: "IT",
    dateIso: "2026-10-14",
    reason: "wrong_action",
    state: "NEEDS_INFO",
    status: { type: "correction", value: "NEEDS_INFO" },
    submittedLabel: "Oct 14, 6:20 PM",
    recorded: { timeIn: "09:02", timeOut: null, creditedMinutes: 0 },
    proposed: { timeIn: "09:02", timeOut: "18:03", creditedMinutes: 481 },
    policyNote: POLICY_NOTE,
    schedule: SCHEDULE,
    hours: hoursFor("jessa-lim"),
    comments: [
      { id: "j1", author: "intern", name: "Jessa Lim", atLabel: "Oct 14, 6:20 PM", body: "I tapped the IN code again when I left at 6:03." },
      {
        id: "j2",
        author: "hr",
        name: "[HR NAME]",
        label: "asked for more info",
        atLabel: "Oct 15, 10:12 AM",
        body: "The second IN scan was at 18:03. Can you confirm that was you leaving, not coming back in?",
      },
    ],
    jev: { status: "read", category: "Wrong action", categoryScore: 0.93, detailsScore: 0.81, version: 1, model: "jev-1.13.0", atLabel: "Oct 14, 6:22 PM" },
    evidence: [
      { action: "Time in", time: "09:02:44", qrLabel: ENTRANCE_IN, distanceM: 12, radiusM: 60, accuracyM: 8, accepted: true },
      { action: "Time in", time: "18:03:10", qrLabel: ENTRANCE_IN, distanceM: 16, radiusM: 60, accuracyM: 10, accepted: true },
    ],
    evidenceNote: "The 18:03 scan used the IN code, so no Time out was recorded.",
    history: [
      { label: "HR asked for more info · version 2", atLabel: "Oct 15 · 10:12" },
      { label: "Jev read version 1", atLabel: "Oct 14 · 18:22" },
      { label: "Jessa submitted the request", atLabel: "Oct 14 · 18:20" },
    ],
  },
};
