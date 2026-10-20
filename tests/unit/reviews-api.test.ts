import { describe, expect, it } from "vitest";

import { createMockReviewsApi, reviewErrorMessage } from "@/lib/reviews/api";
import { validateDecisionNote } from "@/lib/ui/review-decision";

describe("validateDecisionNote", () => {
  it("requires a short explanation the intern will read", () => {
    expect(validateDecisionNote("")).toMatch(/note/i);
    expect(validateDecisionNote("  ok ")).toMatch(/note/i);
    expect(validateDecisionNote("Confirmed with the team lead.")).toBeNull();
    expect(validateDecisionNote("x".repeat(2001))).toMatch(/2,000/);
  });
});

describe("reviews API", () => {
  const request = { correctionId: "corr-oct15", version: 3, decision: "APPROVE" as const, note: "Confirmed with the team." };

  it("records a decision", async () => {
    const api = createMockReviewsApi({ delayMs: 0 });
    expect(await api.decide(request)).toEqual({ ok: true, value: { status: "APPROVED", version: 4 } });
    expect(await api.decide({ ...request, decision: "REJECT" })).toMatchObject({ ok: true, value: { status: "REJECTED" } });
    expect(await api.decide({ ...request, decision: "ASK_INFO" })).toMatchObject({ ok: true, value: { status: "NEEDS_INFO" } });
  });

  it("reports a changed request as a conflict, not a generic error", async () => {
    const api = createMockReviewsApi({ delayMs: 0, conflict: true });
    expect(await api.decide(request)).toEqual({ ok: false, conflict: true, message: reviewErrorMessage(409, { error: { code: "REQUEST_CHANGED" } }) });
  });

  it("maps other errors to plain messages", () => {
    expect(reviewErrorMessage(409, { error: { code: "REQUEST_FINALIZED" } })).toMatch(/already decided/);
    expect(reviewErrorMessage(500, null)).toMatch(/connection/);
  });
});
