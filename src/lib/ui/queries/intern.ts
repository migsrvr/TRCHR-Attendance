/**
 * View-model queries for the intern screens. They return canvas sample data
 * (src/lib/ui/fixtures/intern.ts) until the accounts, attendance and
 * corrections modules are implemented. Each TODO names what replaces it.
 */

import type { RecordedDay } from "@/lib/ui/correction-form";
import {
  ANA,
  ANA_HOURS,
  CORRECTION_ACTIVITY,
  CORRECTIONS,
  OCTOBER_DAYS,
  OCTOBER_WORKDAYS,
  RECORDED_EXTRA,
  SCHEDULE,
  SNAPSHOT_NOW,
  SNAPSHOT_TODAY,
} from "@/lib/ui/fixtures/intern";
import { officeDateIso } from "@/lib/ui/format";
import type {
  CorrectionDetailVM,
  CorrectionSummaryVM,
  InternCorrectionsVM,
  InternHistoryVM,
  InternHomeVM,
  NewCorrectionVM,
} from "@/lib/ui/view-models";

export interface ScanContext {
  internName: string;
  initials: string;
  department: string;
  /** Office-local YYYY-MM-DD for today. */
  todayIso: string;
  timeZone: string;
  /** Office-local "HH:MM" when today's open session started, or null. */
  openSince: string | null;
}

const OFFICE_TIME_ZONE = "Asia/Manila";

export async function getScanContext(options: { openSince?: string | null } = {}): Promise<ScanContext> {
  // TODO(module): replace with GET /api/v1/me (identity, active internship) and
  // the open session from src/modules/attendance once they exist.
  return {
    internName: ANA.name,
    initials: ANA.initials,
    department: ANA.department,
    todayIso: officeDateIso(new Date(), OFFICE_TIME_ZONE),
    timeZone: OFFICE_TIME_ZONE,
    openSince: options.openSince ?? null,
  };
}

export async function getInternHome(): Promise<InternHomeVM> {
  // TODO(module): GET /api/v1/me/summary and today's sessions from GET /api/v1/me/attendance.
  const today = OCTOBER_DAYS.find((day) => day.dateIso === SNAPSHOT_TODAY);
  const open = CORRECTIONS.find((c) => c.status === "PENDING" || c.status === "NEEDS_INFO");
  return {
    identity: ANA,
    todayIso: SNAPSHOT_TODAY,
    nowClock: SNAPSHOT_NOW,
    today: {
      openSince: today?.sessions.find((s) => s.end === null)?.start ?? null,
      sessions: today?.sessions ?? [],
    },
    schedule: SCHEDULE,
    hours: {
      creditedMinutes: ANA_HOURS.creditedMinutes,
      requiredMinutes: ANA_HOURS.requiredMinutes,
      endDateIso: ANA_HOURS.endDateIso,
      workdaysLeft: ANA_HOURS.workdaysLeft,
    },
    openCorrection: open
      ? { id: open.id, dateIso: open.dateIso, status: open.status, activity: CORRECTION_ACTIVITY[open.id] ?? "" }
      : null,
  };
}

export async function getInternHistory(monthIso: string): Promise<InternHistoryVM> {
  // TODO(module): GET /api/v1/me/attendance?from=…&to=… with credited minutes per day.
  const days = OCTOBER_DAYS.filter((day) => day.dateIso.startsWith(`${monthIso}-`)).reverse();
  return {
    identity: ANA,
    monthIso,
    creditedMinutes: days.reduce((sum, day) => sum + (day.creditedMinutes ?? 0), 0),
    daysWithHours: days.filter((day) => (day.creditedMinutes ?? 0) > 0).length,
    workdays: monthIso === "2026-10" ? OCTOBER_WORKDAYS : 0,
    days,
    canGoNext: monthIso < SNAPSHOT_TODAY.slice(0, 7),
  };
}

function toSummary(detail: CorrectionDetailVM): CorrectionSummaryVM {
  return {
    id: detail.id,
    dateIso: detail.dateIso,
    reason: detail.reason,
    proposal: detail.proposal,
    status: detail.status,
    activity: CORRECTION_ACTIVITY[detail.id] ?? "",
    creditedDeltaMinutes: detail.creditedDeltaMinutes,
    hrNote: detail.status === "REJECTED" ? detail.decisionNote : undefined,
  };
}

export async function getInternCorrections(): Promise<InternCorrectionsVM> {
  // TODO(module): GET /api/v1/corrections?mine (src/modules/corrections).
  const isOpen = (status: string) => status === "PENDING" || status === "NEEDS_INFO";
  return {
    identity: ANA,
    open: CORRECTIONS.filter((c) => isOpen(c.status)).map(toSummary),
    decided: CORRECTIONS.filter((c) => !isOpen(c.status) && c.status !== "SUPERSEDED").map(toSummary),
  };
}

export async function getCorrectionDetail(id: string): Promise<CorrectionDetailVM | null> {
  // TODO(module): GET /api/v1/corrections/{id} (owner only).
  return CORRECTIONS.find((c) => c.id === id) ?? null;
}

export async function getNewCorrection(dateIso?: string): Promise<NewCorrectionVM> {
  // TODO(module): recorded scans per day from GET /api/v1/me/attendance.
  const recordedByDate: Record<string, RecordedDay> = { ...RECORDED_EXTRA };
  for (const day of OCTOBER_DAYS) {
    const first = day.sessions[0];
    const last = day.sessions[day.sessions.length - 1];
    if (first && last && !day.corrected) recordedByDate[day.dateIso] = { timeIn: first.start, timeOut: last.end };
  }
  const valid = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) && dateIso <= SNAPSHOT_TODAY ? dateIso : undefined;
  return {
    identity: ANA,
    todayIso: SNAPSHOT_TODAY,
    earliestDateIso: ANA_HOURS.startDateIso,
    initialDateIso: valid ?? "2026-10-15",
    recordedByDate,
  };
}
