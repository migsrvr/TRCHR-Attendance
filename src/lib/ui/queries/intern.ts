/**
 * View-model queries for the intern screens.
 * Calls live PostgreSQL domain modules scoped to the signed-in intern by default;
 * falls back to fixtures only when USE_MOCK_APIS=1 or in unit tests.
 */

import { requirePageIntern } from "@/lib/auth/session";
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
import { getInternHistoryData, getInternHomeData, getScanContextData } from "@/modules/attendance";
import { getCorrectionDetailForIntern, getNewCorrectionData, listMyCorrections } from "@/modules/corrections";

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

function useFixtures(): boolean {
  return process.env.USE_MOCK_APIS === "1" || process.env.NODE_ENV === "test";
}

export async function getScanContext(options: { openSince?: string | null } = {}): Promise<ScanContext> {
  if (useFixtures()) {
    return {
      internName: ANA.name,
      initials: ANA.initials,
      department: ANA.department,
      todayIso: officeDateIso(new Date(), OFFICE_TIME_ZONE),
      timeZone: OFFICE_TIME_ZONE,
      openSince: options.openSince ?? null,
    };
  }
  const actor = (await requirePageIntern("/scan"))!;
  return getScanContextData(actor);
}

export async function getInternHome(): Promise<InternHomeVM> {
  if (useFixtures()) {
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
  const actor = (await requirePageIntern("/dashboard"))!;
  return getInternHomeData(actor);
}

export async function getInternHistory(monthIso?: string): Promise<InternHistoryVM> {
  if (useFixtures()) {
    const targetMonth = monthIso ?? "2026-10";
    const days = OCTOBER_DAYS.filter((day) => day.dateIso.startsWith(`${targetMonth}-`)).reverse();
    return {
      identity: ANA,
      monthIso: targetMonth,
      creditedMinutes: days.reduce((sum, day) => sum + (day.creditedMinutes ?? 0), 0),
      daysWithHours: days.filter((day) => (day.creditedMinutes ?? 0) > 0).length,
      workdays: targetMonth === "2026-10" ? OCTOBER_WORKDAYS : 0,
      days,
      canGoNext: targetMonth < SNAPSHOT_TODAY.slice(0, 7),
    };
  }
  const actor = (await requirePageIntern("/history"))!;
  const resolvedMonth =
    monthIso && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthIso)
      ? monthIso
      : officeDateIso(new Date(), actor.internship.timeZone).slice(0, 7);
  return getInternHistoryData(actor, resolvedMonth);
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
  if (useFixtures()) {
    const isOpen = (status: string) => status === "PENDING" || status === "NEEDS_INFO";
    return {
      identity: ANA,
      open: CORRECTIONS.filter((c) => isOpen(c.status)).map(toSummary),
      decided: CORRECTIONS.filter((c) => !isOpen(c.status) && c.status !== "SUPERSEDED").map(toSummary),
    };
  }
  const actor = (await requirePageIntern("/corrections"))!;
  return listMyCorrections(actor);
}

export async function getCorrectionDetail(id: string): Promise<CorrectionDetailVM | null> {
  if (useFixtures()) {
    return CORRECTIONS.find((c) => c.id === id) ?? null;
  }
  const actor = (await requirePageIntern(`/corrections/${id}`))!;
  return getCorrectionDetailForIntern(actor, id);
}

export async function getNewCorrection(dateIso?: string, replaceRequestId?: string): Promise<NewCorrectionVM> {
  if (useFixtures()) {
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
      replaceRequestId,
      recordedByDate,
    };
  }
  const actor = (await requirePageIntern("/corrections/new"))!;
  return getNewCorrectionData(actor, dateIso, replaceRequestId);
}
