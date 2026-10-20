import { describe, expect, it } from "vitest";

import { mapScanError } from "@/lib/scan/api";
import { createMockScanApi } from "@/lib/scan/mock-api";

const location = { latitude: 14.55, longitude: 121.02, accuracyMeters: 12, capturedAtUtc: "2026-10-19T00:57:10Z" };

describe("mapScanError", () => {
  it("maps documented error codes", () => {
    expect(mapScanError(422, { error: { code: "OUTSIDE_GEOFENCE", details: { distanceMeters: 412, radiusMeters: 60, accuracyMeters: 35, maxAccuracyMeters: 25 } } })).toEqual({
      reason: "outside",
      distanceMeters: 412,
      radiusMeters: 60,
      accuracyMeters: 35,
      maxAccuracyMeters: 25,
    });
    expect(mapScanError(422, { error: { code: "LOCATION_UNCERTAIN" } })).toEqual({ reason: "accuracy" });
    expect(mapScanError(409, { error: { code: "ALREADY_TIMED_IN" } })).toEqual({ reason: "already-in" });
    expect(mapScanError(409, { error: { code: "NO_OPEN_SESSION" } })).toEqual({ reason: "not-in" });
    expect(mapScanError(400, { error: { code: "QR_INVALID" } })).toEqual({ reason: "invalid-qr" });
    expect(mapScanError(400, { error: { code: "QR_EXPIRED" } })).toEqual({ reason: "expired-qr" });
  });

  it("falls back on the HTTP status", () => {
    expect(mapScanError(401, null)).toEqual({ reason: "session-expired" });
    expect(mapScanError(422, {})).toEqual({ reason: "accuracy" });
    expect(mapScanError(503, "oops")).toEqual({ reason: "server" });
  });

  it("ignores non-numeric details", () => {
    expect(mapScanError(422, { error: { code: "OUTSIDE_GEOFENCE", details: { distanceMeters: "far" } } })).toEqual({
      reason: "outside",
    });
  });
});

describe("createMockScanApi", () => {
  it("issues an intent for IN and OUT test codes and rejects anything else", async () => {
    const api = createMockScanApi({ scenario: "ok", delayMs: 0 });
    await expect(api.createIntent("TR-IN")).resolves.toMatchObject({ ok: true, value: { action: "TIME_IN" } });
    const outApi = createMockScanApi({ scenario: "ok", delayMs: 0, openSince: "08:57" });
    await expect(outApi.createIntent("TR-OUT")).resolves.toMatchObject({ ok: true, value: { action: "TIME_OUT" } });
    await expect(api.createIntent("https://example.com")).resolves.toEqual({ ok: false, failure: { reason: "invalid-qr" } });
  });

  it("refuses the wrong action for the current state", async () => {
    const api = createMockScanApi({ scenario: "ok", delayMs: 0, openSince: "08:57" });
    await expect(api.createIntent("TR-IN")).resolves.toEqual({ ok: false, failure: { reason: "already-in" } });
    const fresh = createMockScanApi({ scenario: "ok", delayMs: 0 });
    await expect(fresh.createIntent("TR-OUT")).resolves.toEqual({ ok: false, failure: { reason: "not-in" } });
  });

  it("saves and then expects the opposite action", async () => {
    const api = createMockScanApi({ scenario: "ok", delayMs: 0 });
    const intent = await api.createIntent("TR-IN");
    if (!intent.ok) throw new Error("expected intent");
    const saved = await api.submitScan({ intentId: intent.value.intentId, requestKey: "k1", location });
    expect(saved).toMatchObject({ ok: true, value: { action: "TIME_IN" } });
    await expect(api.createIntent("TR-OUT")).resolves.toMatchObject({ ok: true });
  });

  it("returns geofence details in the outside scenario", async () => {
    const api = createMockScanApi({ scenario: "outside", delayMs: 0 });
    const intent = await api.createIntent("TR-IN");
    if (!intent.ok) throw new Error("expected intent");
    await expect(api.submitScan({ intentId: intent.value.intentId, requestKey: "k1", location })).resolves.toEqual({
      ok: false,
      failure: { reason: "outside", distanceMeters: 412, radiusMeters: 60, accuracyMeters: 12, maxAccuracyMeters: 25 },
    });
  });

  it("hangs on save in the timeout scenario but commits, so a receipt check finds it", async () => {
    const api = createMockScanApi({ scenario: "timeout", delayMs: 0 });
    const intent = await api.createIntent("TR-IN");
    if (!intent.ok) throw new Error("expected intent");
    const controller = new AbortController();
    const pending = api.submitScan({ intentId: intent.value.intentId, requestKey: "k1", location }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await expect(api.getReceipt("k1")).resolves.toMatchObject({ action: "TIME_IN" });
  });

  it("finds no receipt in the lost scenario", async () => {
    const api = createMockScanApi({ scenario: "lost", delayMs: 0 });
    const intent = await api.createIntent("TR-IN");
    if (!intent.ok) throw new Error("expected intent");
    const controller = new AbortController();
    const pending = api.submitScan({ intentId: intent.value.intentId, requestKey: "k1", location }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await expect(api.getReceipt("k1")).resolves.toBeNull();
  });
});
