export const INTERN_TABS = [
  { id: "home", label: "Home", href: "/dashboard" },
  { id: "scan", label: "Scan", href: "/scan" },
  { id: "history", label: "History", href: "/history" },
  { id: "corrections", label: "Corrections", href: "/corrections" },
] as const;

export type InternTabId = (typeof INTERN_TABS)[number]["id"];

export const HR_NAV = [
  { id: "overview", label: "Overview", href: "/hr", section: "main" },
  { id: "interns", label: "Interns", href: "/hr/interns", section: "main" },
  { id: "attendance", label: "Attendance", href: "/hr/attendance", section: "main" },
  { id: "reviews", label: "Reviews", href: "/hr/reviews", section: "main" },
  { id: "reports", label: "DTR reports", href: "/hr/reports", section: "main" },
  { id: "office", label: "Office and QR", href: "/hr/setup", section: "setup" },
  { id: "policies", label: "Policies", href: "/hr/setup/policies", section: "setup" },
  { id: "departments", label: "Departments", href: "/hr/setup/departments", section: "setup" },
  { id: "team", label: "HR team", href: "/hr/setup/team", section: "setup" },
  { id: "audit", label: "Audit log", href: "/hr/audit", section: "setup" },
] as const;

export type HrNavId = (typeof HR_NAV)[number]["id"];
