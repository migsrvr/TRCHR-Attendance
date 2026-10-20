export const INTERN_TABS = [
  { id: "home", label: "Home", href: "/dashboard" },
  { id: "scan", label: "Scan", href: "/scan" },
  { id: "history", label: "History", href: "/history" },
  { id: "corrections", label: "Corrections", href: "/corrections" },
] as const;

export type InternTabId = (typeof INTERN_TABS)[number]["id"];
