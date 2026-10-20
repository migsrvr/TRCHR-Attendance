/**
 * Attention-tiered status presentation (spec section 4).
 *
 * Chip = someone must act now. Ring = live or waiting on someone else.
 * Dot = settled history. The same record can tier differently for HR and
 * for the intern, because "who acts next" differs.
 */

import type {
  AttendanceSessionStatus,
  CorrectionRequestStatus,
  InternshipStatus,
  ScanValidationStatus,
  UserStatus,
} from "@prisma/client";

/** Pending corrections at least this old escalate to "Needs review" for HR (spec 4.2; confirm with HR). */
export const REVIEW_THRESHOLD_WORKDAYS = 3;

export type Audience = "hr" | "intern";

export type StatusKind =
  | { type: "session"; value: AttendanceSessionStatus }
  | { type: "correction"; value: CorrectionRequestStatus; ageWorkdays?: number }
  | { type: "scan"; value: ScanValidationStatus }
  | { type: "account"; value: UserStatus }
  | { type: "internship"; value: InternshipStatus }
  | { type: "today"; value: "NOT_STARTED" };

export type StatusShape = "chip" | "ring" | "dot" | "live";
export type StatusTone = "attn" | "pend" | "settled" | "negative" | "inactive";

export interface StatusPresentation {
  shape: StatusShape;
  tone: StatusTone;
  label: string;
  muted?: boolean;
}

const chip = (tone: "attn" | "pend", label: string): StatusPresentation => ({ shape: "chip", tone, label });
const ring = (tone: "pend" | "inactive", label: string): StatusPresentation =>
  tone === "inactive" ? { shape: "ring", tone, label, muted: true } : { shape: "ring", tone, label };
const dot = (tone: "settled" | "negative", label: string): StatusPresentation => ({ shape: "dot", tone, label });

function unreachable(value: never): never {
  throw new Error(`Unhandled status: ${String(value)}`);
}

function sessionStatus(value: AttendanceSessionStatus, audience: Audience): StatusPresentation {
  switch (value) {
    case "OPEN":
      return { shape: "live", tone: "pend", label: "In office" };
    case "COMPLETE":
      return dot("settled", "Complete");
    case "REVIEW":
      return audience === "hr" ? chip("attn", "Needs review") : ring("pend", "Waiting on HR");
    case "VOID":
      return ring("inactive", "Void");
    default:
      return unreachable(value);
  }
}

function correctionStatus(
  value: CorrectionRequestStatus,
  audience: Audience,
  ageWorkdays = 0,
): StatusPresentation {
  switch (value) {
    case "PENDING":
      if (audience === "intern") return ring("pend", "Waiting on HR");
      return ageWorkdays >= REVIEW_THRESHOLD_WORKDAYS ? chip("attn", "Needs review") : chip("pend", "Pending");
    case "NEEDS_INFO":
      return audience === "hr" ? ring("pend", "Waiting on intern") : chip("attn", "Reply needed");
    case "APPROVED":
      return dot("settled", "Approved");
    case "REJECTED":
      return dot("negative", "Rejected");
    case "SUPERSEDED":
      return ring("inactive", audience === "hr" ? "Superseded" : "Replaced");
    default:
      return unreachable(value);
  }
}

function scanStatus(value: ScanValidationStatus): StatusPresentation {
  switch (value) {
    case "ACCEPTED":
      return dot("settled", "Accepted");
    case "REJECTED":
      return dot("negative", "Scan rejected");
    case "UNCERTAIN":
      return dot("negative", "Location uncertain");
    default:
      return unreachable(value);
  }
}

function accountStatus(value: UserStatus): StatusPresentation {
  switch (value) {
    case "PENDING":
      return ring("pend", "Setup pending");
    case "ACTIVE":
      return dot("settled", "Active");
    case "DISABLED":
      return ring("inactive", "Disabled");
    default:
      return unreachable(value);
  }
}

function internshipStatus(value: InternshipStatus): StatusPresentation {
  switch (value) {
    case "ACTIVE":
      return dot("settled", "Active");
    case "COMPLETED":
      return ring("inactive", "Finished");
    case "CANCELLED":
      return ring("inactive", "Cancelled");
    default:
      return unreachable(value);
  }
}

export function presentStatus(kind: StatusKind, audience: Audience): StatusPresentation {
  switch (kind.type) {
    case "session":
      return sessionStatus(kind.value, audience);
    case "correction":
      return correctionStatus(kind.value, audience, kind.ageWorkdays);
    case "scan":
      return scanStatus(kind.value);
    case "account":
      return accountStatus(kind.value);
    case "internship":
      return internshipStatus(kind.value);
    case "today":
      return ring("inactive", "No Time in yet");
    default:
      return unreachable(kind);
  }
}
