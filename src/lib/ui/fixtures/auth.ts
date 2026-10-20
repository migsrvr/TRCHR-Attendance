/**
 * Sample setup links for the set-password screen. Only src/lib/ui/queries/*
 * may import this file.
 */

import type { SetupLinkVM } from "@/lib/ui/view-models";

export const SETUP_LINKS: Record<string, SetupLinkVM> = {
  "demo-intern": {
    email: "rina.mendoza@school.edu.ph",
    firstName: "Rina",
    role: "INTERN",
    department: "Leasing",
    startDateIso: "2026-10-26",
    expiresLabel: "Oct 25 at 6:00 PM",
  },
  "demo-hr": {
    email: "hr.demo@toprealty.com.ph",
    firstName: "Dana",
    role: "HR",
    expiresLabel: "Oct 25 at 6:00 PM",
  },
};

/** Tokens that behave like an expired or already-used link. */
export const EXPIRED_TOKENS = new Set(["expired", "used"]);
