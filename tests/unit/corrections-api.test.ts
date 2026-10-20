import { describe, expect, it } from "vitest";

import { correctionErrorMessage, createMockCorrectionsApi } from "@/lib/corrections/api";

describe("correctionErrorMessage", () => {
  it("explains known error codes", () => {
    expect(correctionErrorMessage(409, { error: { code: "OPEN_REQUEST_EXISTS" } })).toBe(
      "You already have an open request for this day. Add details to it instead.",
    );
    expect(correctionErrorMessage(409, { error: { code: "REQUEST_FINALIZED" } })).toBe(
      "HR has already decided this request, so it can't take replies.",
    );
    expect(correctionErrorMessage(422, { error: { code: "INTERVAL_INVALID" } })).toBe(
      "Those times don't work for that day. Check Time in and Time out.",
    );
  });

  it("falls back on the HTTP status", () => {
    expect(correctionErrorMessage(401, null)).toBe("You've been signed out. Sign in again, then send it again.");
    expect(correctionErrorMessage(500, "boom")).toBe("Couldn't send. Check your connection and try again.");
  });
});

describe("createMockCorrectionsApi", () => {
  const request = {
    clientRequestId: "c1",
    attendanceDate: "2026-10-15",
    reason: "missed_clock_out" as const,
    explanation: "The client meeting ran late.",
    proposedTimeOut: "18:05",
  };

  it("accepts a request and a reply", async () => {
    const api = createMockCorrectionsApi({ delayMs: 0 });
    await expect(api.create(request)).resolves.toMatchObject({ ok: true, value: { status: "PENDING" } });
    await expect(api.reply("corr-oct15", "More detail")).resolves.toMatchObject({ ok: true });
  });

  it("returns the same request for a repeated client request id", async () => {
    const api = createMockCorrectionsApi({ delayMs: 0 });
    const first = await api.create(request);
    const second = await api.create(request);
    expect(first).toEqual(second);
  });

  it("can simulate a failure", async () => {
    const api = createMockCorrectionsApi({ delayMs: 0, fail: true });
    await expect(api.create(request)).resolves.toMatchObject({ ok: false });
    await expect(api.reply("corr-oct15", "x")).resolves.toMatchObject({ ok: false });
  });
});
