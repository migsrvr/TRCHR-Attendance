/**
 * Sample data for the Setup pages and the Audit log, transcribed from the
 * canvas Office and QR, Policies, Departments and Audit log artboards.
 * Only src/lib/ui/queries/* may import this file.
 *
 * Numbers are examples until HR confirms them (spec section 3). They agree
 * with the rest of the sample data: policy v2 reproduces Ana's credited days,
 * department counts add up to the Overview's 24 active and 9 finished, and
 * audit entries link to the same requests and sessions. The workweek is
 * Mon–Fri to match the DTR (the canvas policy card said Mon–Sat).
 */

import type { PolicyRules } from "@/lib/ui/policy";
import type { AuditEntryVM, CheckpointVM, DepartmentRowVM, HrUserRowVM, PolicyVersionVM } from "@/lib/ui/view-models";

const V2_RULES: PolicyRules = {
  workdays: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "18:00",
  breakMinutes: 60,
  breakWindow: { start: "12:00", end: "14:00" },
  gapCountsTowardBreak: true,
  capMinutes: 480,
  rounding: "none",
};

export const POLICY_VERSIONS: PolicyVersionVM[] = [
  {
    version: 3,
    state: "DRAFT",
    fromIso: "2026-11-01",
    toIso: null,
    sessionsUsing: 0,
    rules: { ...V2_RULES, rounding: "down5" },
    copiedFrom: 2,
  },
  { version: 2, state: "ACTIVE", fromIso: "2026-09-01", toIso: null, sessionsUsing: 1214, rules: V2_RULES },
  {
    version: 1,
    state: "SUPERSEDED",
    fromIso: "2026-07-01",
    toIso: "2026-08-31",
    sessionsUsing: 812,
    rules: { ...V2_RULES, gapCountsTowardBreak: false, rounding: "down15" },
  },
];

export const POLICY_EXAMPLE = [
  { start: "08:52", end: "12:00" },
  { start: "13:03", end: "18:21" },
];

export const OFFICE = {
  name: "Top Realty office",
  pinLabel: "[LATITUDE], [LONGITUDE]",
  timeZone: "Asia/Manila",
  radiusM: 60,
  maxAccuracyM: 25,
  settingsVersion: 3,
};

export const CHECKPOINTS: CheckpointVM[] = [
  { id: "chk-main-in-v2", name: "Main entrance", action: "IN", codeVersion: 2, expiresIso: "2026-12-31", status: { type: "checkpoint", value: "ACTIVE" } },
  { id: "chk-main-out-v2", name: "Main entrance", action: "OUT", codeVersion: 2, expiresIso: "2026-12-31", status: { type: "checkpoint", value: "ACTIVE" } },
  {
    id: "chk-main-in-v1",
    name: "Main entrance",
    action: "IN",
    codeVersion: 1,
    expiresIso: null,
    status: { type: "checkpoint", value: "REVOKED" },
    revokedIso: "2026-09-01",
  },
];

/**
 * What a printed code encodes in development: the tokens the mock scan
 * server accepts. Real codes carry a signed checkpoint reference.
 */
export const DEV_PRINT_TOKENS: Record<CheckpointVM["action"], string> = { IN: "TR-IN", OUT: "TR-OUT" };

const active = { type: "department", value: "ACTIVE" } as const;

export const DEPARTMENT_ROWS: DepartmentRowVM[] = [
  { id: "dept-finance", name: "Finance", activeInterns: 4, settingUp: 0, finished: 2, status: active },
  { id: "dept-it", name: "IT", activeInterns: 3, settingUp: 0, finished: 3, status: active },
  { id: "dept-leasing", name: "Leasing", activeInterns: 4, settingUp: 1, finished: 0, status: active },
  { id: "dept-marketing", name: "Marketing", activeInterns: 8, settingUp: 0, finished: 2, status: active },
  { id: "dept-sales-ops", name: "Sales Ops", activeInterns: 5, settingUp: 0, finished: 1, status: active },
  {
    id: "dept-admin",
    name: "Admin",
    activeInterns: 0,
    settingUp: 0,
    finished: 1,
    status: { type: "department", value: "INACTIVE" },
    inactiveSinceIso: "2026-08-01",
  },
];

const HR = { kind: "hr", name: "[HR NAME]" } as const;
const SYSTEM = { kind: "system", name: "System" } as const;

/** Newest first. */
export const AUDIT_ENTRIES: AuditEntryVM[] = [
  {
    id: "a01",
    at: "2026-10-19 09:10",
    actor: HR,
    action: "Changed office settings",
    category: "office",
    record: { label: "Top Realty office", href: "/hr/setup" },
    change: "Accept radius 50 m → 60 m · settings v3",
  },
  {
    id: "a02",
    at: "2026-10-18 16:41",
    actor: HR,
    action: "Sent setup link",
    category: "accounts",
    record: { label: "Rina Mendoza", href: "/hr/interns?tab=pending&q=Rina" },
    change: "Expires Oct 25",
  },
  {
    id: "a03",
    at: "2026-10-18 16:40",
    actor: HR,
    action: "Created intern",
    category: "accounts",
    record: { label: "Rina Mendoza", href: "/hr/interns?tab=pending&q=Rina" },
    change: "Leasing · 486h · starts Oct 26",
  },
  {
    id: "a04",
    at: "2026-10-17 09:30",
    actor: HR,
    action: "Asked for more info",
    category: "corrections",
    record: { label: "Marco Dela Cruz · Oct 16 correction", href: "/hr/reviews/corr-marco-oct16" },
    change: "Request v1 → v2",
  },
  {
    id: "a05",
    at: "2026-10-17 00:41",
    actor: SYSTEM,
    action: "Held session for review",
    category: "attendance",
    record: { label: "Luis Ramos · Oct 16", href: "/hr/attendance?session=sess-luis-oct16" },
    change: "Time out landed after midnight",
  },
  {
    id: "a06",
    at: "2026-10-16 10:03",
    actor: HR,
    action: "Asked for more info",
    category: "corrections",
    record: { label: "Ana Reyes · Oct 15 correction", href: "/hr/reviews/corr-oct15" },
    change: "Request v1 → v2",
  },
  {
    id: "a07",
    at: "2026-10-15 10:12",
    actor: HR,
    action: "Asked for more info",
    category: "corrections",
    record: { label: "Jessa Lim · Oct 14 correction", href: "/hr/reviews/corr-jessa-oct14" },
    change: "Request v1 → v2",
  },
  {
    id: "a08",
    at: "2026-10-14 11:32",
    actor: HR,
    action: "Approved correction",
    category: "corrections",
    record: { label: "Ana Reyes · Oct 13", href: "/hr/reviews/corr-oct13" },
    change: "Session revised",
    detail: {
      rows: [
        { label: "Time in", before: "none", after: "09:10" },
        { label: "Time out", before: "17:45", after: "17:45" },
        { label: "Status", before: "Missing Time in", after: "Complete" },
        { label: "Credited", before: "0h 00m", after: "7h 35m" },
      ],
      facts: [
        { label: "Note", value: "Confirmed with the Marketing lead that you arrived at 9:10." },
        { label: "Request", value: "Version 2" },
        { label: "Session", value: "v1 → v2" },
        { label: "Reference", value: "c-7f3a-21e9" },
      ],
    },
  },
  {
    id: "a09",
    at: "2026-10-12 15:05",
    actor: HR,
    action: "Disabled account",
    category: "accounts",
    record: { label: "Joel Navarro", href: "/hr/interns/joel-navarro" },
    change: "Signed out of all devices · records kept",
  },
  {
    id: "a10",
    at: "2026-10-10 18:20",
    actor: HR,
    action: "Marked internship finished",
    category: "accounts",
    record: { label: "Miguel Torres", href: "/hr/interns/miguel-torres" },
    change: "486h 00m of 486h credited",
  },
  {
    id: "a11",
    at: "2026-09-23 09:48",
    actor: HR,
    action: "Rejected correction",
    category: "corrections",
    record: { label: "Ana Reyes · Sep 22", href: "/hr/reviews/corr-sep22" },
    change: "“On approved leave that day”",
  },
  {
    id: "a12",
    at: "2026-09-01 08:00",
    actor: HR,
    action: "Rotated QR codes",
    category: "qr",
    record: { label: "Main entrance IN and OUT", href: "/hr/setup" },
    change: "v1 revoked · v2 issued",
  },
  {
    id: "a13",
    at: "2026-08-28 14:15",
    actor: HR,
    action: "Published policy",
    category: "policy",
    record: { label: "Version 2", href: "/hr/setup/policies?version=2" },
    change: "Applies from Sep 1",
  },
];

/** Entries in the last 60 days; the sample rows are the newest page. */
export const AUDIT_TOTAL = 186;

export const HR_TEAM_ROWS: HrUserRowVM[] = [
  {
    id: "hr-admin-1",
    name: "[HR NAME]",
    email: "hr@toprealty.ph",
    status: "ACTIVE",
    isCurrentUser: true,
    lastSignInLabel: "Today, 08:42",
  },
  {
    id: "hr-admin-2",
    name: "Clarisse Villanueva",
    email: "clarisse.villanueva@toprealty.ph",
    status: "PENDING",
    isCurrentUser: false,
    setupLinkSentIso: "2026-10-18",
  },
  {
    id: "hr-admin-3",
    name: "Ramon Cruz",
    email: "ramon.cruz@toprealty.ph",
    status: "DISABLED",
    isCurrentUser: false,
    lastSignInLabel: "Sep 14, 17:10",
  },
];
