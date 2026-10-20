/**
 * Sample data for the HR screens, transcribed from the canvas Overview,
 * Interns and Intern profile artboards.
 * Only src/lib/ui/queries/* may import this file.
 *
 * Canvas attendance records on Oct 17–18 (a weekend) are moved to weekdays,
 * matching the intern fixtures (spec section 9, item 5); internship end
 * dates stay as drawn. Ana's numbers come from the intern fixtures so both
 * apps agree.
 */

import { ANA, ANA_HOURS } from "@/lib/ui/fixtures/intern";
import type {
  HoursRowVM,
  HrIdentityVM,
  InternAccountTab,
  InternListRowVM,
  NeedsYouItemVM,
  OfficeTodayItemVM,
} from "@/lib/ui/view-models";

export const HR_IDENTITY: HrIdentityVM = { name: "[HR NAME]", roleLabel: "HR admin", initials: "HR" };

export const OFFICE_LABEL = "Top Realty office · Asia/Manila";

export const OVERVIEW_COUNTS = { inOffice: 18, activeInterns: 24, completedToday: 3, missingClockOut: 2, scansToday: 21 };

/** Oldest first. */
export const NEEDS_YOU: NeedsYouItemVM[] = [
  {
    id: "corr-oct15",
    href: "/hr/reviews/corr-oct15",
    internName: ANA.name,
    subject: "correction",
    dateIso: "2026-10-15",
    detail: "Missed clock-out · proposes Time out 18:05",
    jevRead: true,
    status: { type: "correction", value: "PENDING", ageWorkdays: 3 },
    ageDays: 4,
  },
  {
    id: "corr-paolo-oct16",
    href: "/hr/reviews/corr-paolo-oct16",
    internName: "Paolo Cruz",
    subject: "correction",
    dateIso: "2026-10-16",
    detail: "Technical issue · scanner would not open",
    jevRead: true,
    status: { type: "correction", value: "PENDING", ageWorkdays: 2 },
    ageDays: 3,
  },
  {
    id: "corr-bea-oct14",
    href: "/hr/reviews/corr-bea-oct14",
    internName: "Bea Santos",
    subject: "missing-day",
    dateIso: "2026-10-14",
    detail: "Manual review · Jev was unavailable",
    jevRead: false,
    status: { type: "correction", value: "PENDING", ageWorkdays: 1 },
    ageDays: 2,
  },
  {
    id: "sess-luis-oct16",
    href: "/hr/attendance?session=sess-luis-oct16",
    internName: "Luis Ramos",
    subject: "session",
    dateIso: "2026-10-16",
    detail: "Time out after midnight · held for review, no credit yet",
    jevRead: false,
    status: { type: "session", value: "REVIEW" },
    ageDays: 2,
  },
];

/** Latest scans first. */
export const OFFICE_TODAY: OfficeTodayItemVM[] = [
  { internId: "jessa-lim", name: "Jessa Lim", department: "IT", status: { type: "session", value: "COMPLETE" }, time: "14:32" },
  { internId: "marco-dela-cruz", name: "Marco Dela Cruz", department: "Marketing", status: { type: "session", value: "OPEN" }, time: "13:01" },
  { internId: "ana-reyes", name: ANA.name, department: ANA.department, status: { type: "session", value: "OPEN" }, time: "08:57" },
  { internId: "paolo-cruz", name: "Paolo Cruz", department: "Sales Ops", status: { type: "session", value: "OPEN" }, time: "08:49" },
  { internId: "carlo-bautista", name: "Carlo Bautista", department: "Sales Ops", status: { type: "scan", value: "REJECTED" }, time: "08:44" },
];

const ANA_ROW: HoursRowVM = {
  internId: "ana-reyes",
  name: ANA.name,
  department: ANA.department,
  creditedMinutes: ANA_HOURS.creditedMinutes,
  requiredMinutes: ANA_HOURS.requiredMinutes,
  endDateIso: ANA_HOURS.endDateIso,
  paceDeltaMinutes: -360,
};

/** Active internships with pace. Queries pick and sort. */
export const HOURS_ROWS: HoursRowVM[] = [
  ANA_ROW,
  { internId: "bea-santos", name: "Bea Santos", department: "Finance", creditedMinutes: 8950, requiredMinutes: 29160, endDateIso: "2026-12-12", paceDeltaMinutes: -2460 },
  { internId: "carlo-bautista", name: "Carlo Bautista", department: "Sales Ops", creditedMinutes: 16620, requiredMinutes: 36000, endDateIso: "2027-01-09", paceDeltaMinutes: -1080 },
  { internId: "marco-dela-cruz", name: "Marco Dela Cruz", department: "Marketing", creditedMinutes: 15160, requiredMinutes: 29160, endDateIso: "2026-12-19", paceDeltaMinutes: 25 },
  { internId: "jessa-lim", name: "Jessa Lim", department: "IT", creditedMinutes: 27735, requiredMinutes: 29160, endDateIso: "2026-10-30", paceDeltaMinutes: 45 },
  { internId: "paolo-cruz", name: "Paolo Cruz", department: "Sales Ops", creditedMinutes: 26500, requiredMinutes: 29160, endDateIso: "2026-11-06", paceDeltaMinutes: -200 },
  { internId: "nina-garcia", name: "Nina Garcia", department: "Leasing", creditedMinutes: 26310, requiredMinutes: 29160, endDateIso: "2026-11-13", paceDeltaMinutes: 10 },
];

export const DEPARTMENTS = ["Finance", "IT", "Leasing", "Marketing", "Sales Ops"];

export const OFFICE_NAME = "Top Realty office";

export const POLICY_LABEL = "Version 2 · 09:00–18:00, 60-min break";

/** Directory totals from the canvas; the sample rows below are one page of them. */
export const INTERN_COUNTS: Record<InternAccountTab, number> = { all: 37, active: 24, pending: 3, finished: 9, disabled: 1 };

const email = (name: string) => `${name.toLowerCase().replace(/\s+/g, ".")}@[company email]`;

function activeRow(internId: string, startDateIso: string): InternListRowVM {
  const hours = HOURS_ROWS.find((row) => row.internId === internId)!;
  return {
    id: internId,
    name: hours.name,
    email: email(hours.name),
    department: hours.department,
    creditedMinutes: hours.creditedMinutes,
    requiredMinutes: hours.requiredMinutes,
    startDateIso,
    endDateIso: hours.endDateIso,
    tab: "active",
    status: { type: "account", value: "ACTIVE" },
  };
}

/** Sample directory page, in the canvas order. */
export const INTERN_ROWS: InternListRowVM[] = [
  activeRow("ana-reyes", "2026-07-21"),
  activeRow("bea-santos", "2026-09-01"),
  activeRow("carlo-bautista", "2026-08-04"),
  {
    id: "rina-mendoza",
    name: "Rina Mendoza",
    email: email("Rina Mendoza"),
    department: "Leasing",
    creditedMinutes: 0,
    requiredMinutes: 29160,
    startDateIso: "2026-10-26",
    endDateIso: "2027-02-27",
    tab: "pending",
    status: { type: "account", value: "PENDING" },
    setupLinkSentIso: "2026-10-18",
  },
  {
    id: "miguel-torres",
    name: "Miguel Torres",
    email: email("Miguel Torres"),
    department: "IT",
    creditedMinutes: 29160,
    requiredMinutes: 29160,
    startDateIso: "2026-06-02",
    endDateIso: "2026-10-10",
    tab: "finished",
    status: { type: "internship", value: "COMPLETED" },
  },
  {
    id: "joel-navarro",
    name: "Joel Navarro",
    email: email("Joel Navarro"),
    department: "Marketing",
    creditedMinutes: 3500,
    requiredMinutes: 29160,
    startDateIso: "2026-08-18",
    endDateIso: "2026-12-19",
    tab: "disabled",
    status: { type: "account", value: "DISABLED" },
  },
  activeRow("marco-dela-cruz", "2026-08-18"),
  activeRow("jessa-lim", "2026-06-01"),
  activeRow("paolo-cruz", "2026-07-06"),
  activeRow("nina-garcia", "2026-07-13"),
];

/** Ana's profile extras beyond what the intern fixtures already hold. */
export const ANA_PROFILE = {
  departmentSinceIso: "2026-07-21",
  lastSignInLabel: "today, 08:56",
  daysAttended: 49,
  rejectedScans: 1,
  lastRejectedScan: { dateIso: "2026-09-22", reason: "poor accuracy" },
};
