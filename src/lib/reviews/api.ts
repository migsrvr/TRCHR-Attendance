/**
 * Client-side HR review decisions (harmonized with Technical Design §§8 & 10).
 *
 * Calls POST /api/v1/hr/corrections/{id}/reviews with operationKey,
 * expectedRequestVersion, expectedSessionVersion, expectedAttendanceVersion,
 * and Prisma-aligned decision ("APPROVE" | "REJECT" | "NEEDS_INFO").
 */

import { newId } from "@/lib/ui/id";
import type { ReviewDecision } from "@/lib/ui/review-decision";

export interface DecideRequest {
  correctionId: string;
  version: number;
  operationKey?: string;
  expectedSessionVersion?: number | null;
  expectedAttendanceVersion?: number;
  decision: ReviewDecision;
  note: string;
}

export interface Decided {
  status: "APPROVED" | "REJECTED" | "NEEDS_INFO";
  version: number;
}

export type DecideResult = { ok: true; value: Decided } | { ok: false; conflict: boolean; message: string };

export interface ReviewsApi {
  decide(request: DecideRequest): Promise<DecideResult>;
  retryJev(correctionId: string): Promise<{ ok: true } | { ok: false; message: string }>;
}

const GENERIC = "Couldn't save the decision. Check your connection and try again.";

const MESSAGES: Record<string, string> = {
  REQUEST_CHANGED: "This request changed while you were reading it. Refresh to see the latest before you decide.",
  REQUEST_FINALIZED: "Someone already decided this request. Refresh to see the decision.",
  INTERVAL_OVERLAP: "The proposed times overlap another attendance session on this day.",
  NOTE_REQUIRED: "Write a short note. The intern sees it with your decision.",
  FORBIDDEN: "Only HR can decide requests. Sign in with an HR account.",
  UNAUTHENTICATED: "You've been signed out. Sign in again, then decide again.",
};

export function reviewErrorMessage(status: number, body: unknown): string {
  const error =
    typeof body === "object" && body !== null ? (body as { error?: { code?: unknown } }).error : undefined;
  const code = typeof error?.code === "string" ? error.code : undefined;
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (status === 401) return MESSAGES.UNAUTHENTICATED!;
  if (status === 403) return MESSAGES.FORBIDDEN!;
  return GENERIC;
}

const STATUS: Record<ReviewDecision, Decided["status"]> = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  ASK_INFO: "NEEDS_INFO",
};

const WIRE_DECISION: Record<ReviewDecision, "APPROVE" | "REJECT" | "NEEDS_INFO"> = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  ASK_INFO: "NEEDS_INFO",
};

export function createHttpReviewsApi(base = "/api/v1/hr"): ReviewsApi {
  return {
    async decide({ correctionId, version, operationKey, expectedSessionVersion, expectedAttendanceVersion, decision, note }) {
      try {
        const response = await fetch(`${base}/corrections/${encodeURIComponent(correctionId)}/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            operationKey: operationKey ?? newId(),
            decision: WIRE_DECISION[decision],
            note,
            expectedRequestVersion: version,
            ...(expectedSessionVersion !== undefined ? { expectedSessionVersion } : {}),
            ...(expectedAttendanceVersion !== undefined ? { expectedAttendanceVersion } : {}),
          }),
        });
        const json: unknown = await response.json().catch(() => null);
        if (response.ok) return { ok: true, value: json as Decided };
        const code = (json as { error?: { code?: string } } | null)?.error?.code;
        return { ok: false, conflict: code === "REQUEST_CHANGED", message: reviewErrorMessage(response.status, json) };
      } catch {
        return { ok: false, conflict: false, message: GENERIC };
      }
    },

    async retryJev(correctionId) {
      try {
        const response = await fetch(`${base}/corrections/${encodeURIComponent(correctionId)}/jev-retry`, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (response.ok) return { ok: true };
        const json: unknown = await response.json().catch(() => null);
        return { ok: false, message: reviewErrorMessage(response.status, json) };
      } catch {
        return { ok: false, message: GENERIC };
      }
    },
  };
}

/** Development stand-in. `conflict` makes every decision come back as REQUEST_CHANGED. */
export function createMockReviewsApi(options: { delayMs?: number; conflict?: boolean } = {}): ReviewsApi {
  const { delayMs = 700, conflict = false } = options;
  return {
    async decide(request) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (conflict) {
        return { ok: false, conflict: true, message: reviewErrorMessage(409, { error: { code: "REQUEST_CHANGED" } }) };
      }
      return { ok: true, value: { status: STATUS[request.decision], version: request.version + 1 } };
    },
    async retryJev() {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { ok: true };
    },
  };
}
