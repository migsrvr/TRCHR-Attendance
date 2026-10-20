/**
 * Client-side review decisions (Technical Design section 10). Each decision
 * names the request version HR was looking at; if the intern changed the
 * request since (a reply, a new proposal), the server answers 409
 * REQUEST_CHANGED and nothing is saved, so HR never decides on stale facts.
 */

import type { ReviewDecision } from "@/lib/ui/review-decision";

export interface DecideRequest {
  correctionId: string;
  version: number;
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
}

const GENERIC = "Couldn't save the decision. Check your connection and try again.";

/** Error codes the review routes are expected to return; proposed here, the routes must match. */
const MESSAGES: Record<string, string> = {
  REQUEST_CHANGED: "This request changed while you were reading it. Refresh to see the latest before you decide.",
  REQUEST_FINALIZED: "Someone already decided this request. Refresh to see the decision.",
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

export function createHttpReviewsApi(base = "/api/v1"): ReviewsApi {
  return {
    async decide({ correctionId, ...body }) {
      try {
        const response = await fetch(`${base}/corrections/${encodeURIComponent(correctionId)}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(body),
        });
        const json: unknown = await response.json().catch(() => null);
        if (response.ok) return { ok: true, value: json as Decided };
        const code = (json as { error?: { code?: string } } | null)?.error?.code;
        return { ok: false, conflict: code === "REQUEST_CHANGED", message: reviewErrorMessage(response.status, json) };
      } catch {
        return { ok: false, conflict: false, message: GENERIC };
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
  };
}
