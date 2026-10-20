/**
 * Sample data for HR Attendance records, transcribed from the canvas
 * Attendance artboard for the week of Oct 13–19. Only src/lib/ui/queries/*
 * may import this file.
 *
 * Agrees with the other fixtures: Ana's days are her History, today's rows
 * are the Overview's "At the office today", the two missing clock-outs are
 * the Overview KPI, and rows with requests link to the Reviews fixtures.
 * Luis's after-midnight session is on Fri Oct 16 (the canvas used a Sunday).
 */

import { NEEDS_YOU } from "@/lib/ui/fixtures/hr";
import { OCTOBER_DAYS } from "@/lib/ui/fixtures/intern";
import type { AttendanceDayVM, AttendanceRowVM, SessionDetailVM, SessionScanVM } from "@/lib/ui/view-models";

const anaDay = (dateIso: string) => OCTOBER_DAYS.find((day) => day.dateIso === dateIso)!;
const waiting = (id: string) => NEEDS_YOU.find((item) => item.id === id)!.status;

const ana = { internId: "ana-reyes", internName: "Ana Reyes", department: "Marketing" } as const;
const marco = { internId: "marco-dela-cruz", internName: "Marco Dela Cruz", department: "Marketing" } as const;
const jessa = { internId: "jessa-lim", internName: "Jessa Lim", department: "IT" } as const;
const paolo = { internId: "paolo-cruz", internName: "Paolo Cruz", department: "Sales Ops" } as const;
const carlo = { internId: "carlo-bautista", internName: "Carlo Bautista", department: "Sales Ops" } as const;
const luis = { internId: "luis-ramos", internName: "Luis Ramos", department: "Sales Ops" } as const;
const bea = { internId: "bea-santos", internName: "Bea Santos", department: "Finance" } as const;

export const ATTENDANCE_DAYS: Omit<AttendanceDayVM, "isToday">[] = [
  {
    dateIso: "2026-10-19",
    scans: 21,
    rows: [
      { id: "sess-ana-oct19", ...ana, sessions: anaDay("2026-10-19").sessions, held: false, creditedMinutes: null, status: { type: "session", value: "OPEN" }, filter: "open" },
      {
        id: "sess-jessa-oct19",
        ...jessa,
        sessions: [
          { start: "08:30", end: "12:02" },
          { start: "13:01", end: "14:32" },
        ],
        held: false,
        creditedMinutes: 272,
        status: { type: "session", value: "COMPLETE" },
        filter: "complete",
      },
      {
        id: "sess-marco-oct19",
        ...marco,
        sessions: [
          { start: "08:52", end: "12:00" },
          { start: "13:01", end: null },
        ],
        held: false,
        creditedMinutes: 180,
        status: { type: "session", value: "OPEN" },
        filter: "open",
      },
      { id: "sess-paolo-oct19", ...paolo, sessions: [{ start: "08:49", end: null }], held: false, creditedMinutes: null, status: { type: "session", value: "OPEN" }, filter: "open" },
      {
        id: "scan-carlo-oct19",
        ...carlo,
        sessions: [],
        held: false,
        summary: "08:44 rejected · 412 m from office",
        creditedMinutes: 0,
        status: { type: "scan", value: "REJECTED" },
        filter: "rejected",
      },
    ],
  },
  {
    dateIso: "2026-10-16",
    scans: 46,
    rows: [
      {
        id: "sess-luis-oct16",
        ...luis,
        sessions: [{ start: "16:10", end: null }],
        held: true,
        summary: "16:10 → 00:40 next day",
        creditedMinutes: null,
        status: waiting("sess-luis-oct16"),
        filter: "review",
      },
      {
        id: "sess-paolo-oct16",
        ...paolo,
        sessions: [{ start: "09:22", end: "18:01" }],
        held: false,
        note: { label: "correction pending", href: "/hr/reviews/corr-paolo-oct16" },
        creditedMinutes: 459,
        status: { type: "session", value: "COMPLETE" },
        filter: "complete",
      },
      { id: "sess-ana-oct16", ...ana, sessions: anaDay("2026-10-16").sessions, held: false, creditedMinutes: 479, status: { type: "session", value: "COMPLETE" }, filter: "complete" },
      {
        id: "sess-marco-oct16",
        ...marco,
        sessions: [],
        held: false,
        summary: "no Time in · 18:00",
        note: { label: "correction waiting on Marco", href: "/hr/reviews/corr-marco-oct16" },
        creditedMinutes: null,
        status: { type: "correction", value: "NEEDS_INFO" },
        filter: "review",
      },
    ],
  },
  {
    dateIso: "2026-10-15",
    scans: 44,
    rows: [
      {
        id: "sess-ana-oct15",
        ...ana,
        sessions: anaDay("2026-10-15").sessions,
        held: false,
        note: { label: "correction open", href: "/hr/reviews/corr-oct15" },
        creditedMinutes: null,
        status: waiting("corr-oct15"),
        filter: "review",
      },
    ],
  },
  {
    dateIso: "2026-10-14",
    scans: 45,
    rows: [
      {
        id: "sess-jessa-oct14",
        ...jessa,
        sessions: [{ start: "09:02", end: null }],
        held: false,
        summary: "09:02 → no Time out · second IN at 18:03",
        note: { label: "correction waiting on Jessa", href: "/hr/reviews/corr-jessa-oct14" },
        creditedMinutes: null,
        status: { type: "correction", value: "NEEDS_INFO" },
        filter: "review",
      },
      { id: "sess-ana-oct14", ...ana, sessions: anaDay("2026-10-14").sessions, held: false, creditedMinutes: 478, status: { type: "session", value: "COMPLETE" }, filter: "complete" },
      {
        id: "day-bea-oct14",
        ...bea,
        sessions: [],
        held: false,
        summary: "No scans",
        note: { label: "correction pending", href: "/hr/reviews/corr-bea-oct14" },
        creditedMinutes: null,
        status: waiting("corr-bea-oct14"),
        filter: "review",
      },
    ],
  },
  {
    dateIso: "2026-10-13",
    scans: 43,
    rows: [
      {
        id: "sess-ana-oct13",
        ...ana,
        sessions: anaDay("2026-10-13").sessions,
        held: false,
        note: { label: "approved correction", href: "/hr/reviews/corr-oct13" },
        creditedMinutes: 455,
        status: { type: "session", value: "COMPLETE" },
        filter: "complete",
      },
    ],
  },
];

export const ATTENDANCE_PERIOD_LABEL = "Oct 13 – Oct 19";

const IN = "Main entrance · IN";
const OUT = "Main entrance · OUT";

/** Scans and explanations that can't be derived from the row alone. */
export const SESSION_EXTRAS: Record<string, Partial<SessionDetailVM> & { scans?: SessionScanVM[] }> = {
  "sess-luis-oct16": {
    heldReason:
      "Time out landed on the next calendar day. Policy v2 only credits same-day sessions, so this one earns nothing until a correction is approved.",
    effective: [{ timeIn: "16:10", timeOut: "00:40", timeOutDateIso: "2026-10-17" }],
    elapsedMinutes: 510,
    scans: [
      { action: "IN", time: "16:10:07", qrLabel: IN, distanceM: 22, accepted: true },
      { action: "OUT", time: "00:40:51", dateIso: "2026-10-17", qrLabel: OUT, distanceM: 31, accepted: true },
    ],
  },
  "sess-ana-oct15": {
    heldReason: "No Time out was recorded, so this day earns nothing until the open correction is decided.",
  },
  "sess-jessa-oct14": {
    heldReason: "The 18:03 scan used the IN code, so no Time out was recorded. The day earns nothing until the correction is decided.",
    scans: [
      { action: "IN", time: "09:02:44", qrLabel: IN, distanceM: 12, accepted: true },
      { action: "IN", time: "18:03:10", qrLabel: IN, distanceM: 16, accepted: true },
    ],
  },
  "sess-marco-oct16": {
    heldReason: "No Time in was recorded, so the day earns nothing until the correction is decided.",
    effective: [{ timeIn: null, timeOut: "18:00" }],
    scans: [{ action: "OUT", time: "18:00:22", qrLabel: OUT, distanceM: 24, accepted: true }],
  },
  "scan-carlo-oct19": {
    effective: [],
    scans: [{ action: "IN", time: "08:44:18", qrLabel: IN, distanceM: 412, accepted: false, rejectReason: "outside the 60 m office area" }],
  },
  "day-bea-oct14": { effective: [] },
  "sess-ana-oct13": {
    version: 2,
    revisions: [
      { label: "Time in added · approved correction", atLabel: "Oct 14 · 11:32 · version 2", before: "Not recorded", after: "09:10" },
    ],
    scans: [{ action: "OUT", time: "17:45:31", qrLabel: OUT, distanceM: 22, accepted: true }],
  },
};

/** Rows that should offer "Ask … for a correction": held, with no request yet. */
export function canAskForCorrection(row: AttendanceRowVM): boolean {
  return row.held && !row.note;
}
