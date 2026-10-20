/**
 * View-model queries for the HR screens. They return canvas sample data
 * (src/lib/ui/fixtures/hr.ts) until the attendance, corrections and
 * internship modules are implemented. Each TODO names what replaces it.
 */

import { SNAPSHOT_NOW, SNAPSHOT_TODAY } from "@/lib/ui/fixtures/intern";
import { HOURS_ROWS, HR_IDENTITY, NEEDS_YOU, OFFICE_LABEL, OFFICE_TODAY, OVERVIEW_COUNTS } from "@/lib/ui/fixtures/hr";
import type { HrOverviewVM, HrShellVM } from "@/lib/ui/view-models";

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
