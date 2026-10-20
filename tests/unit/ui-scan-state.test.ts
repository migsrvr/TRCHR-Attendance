import { describe, expect, it } from "vitest";

import {
  initialScanState,
  scanReducer,
  type LocationFix,
  type ScanIntent,
  type ScanReceipt,
  type ScanState,
} from "@/lib/ui/scan-state";

const intent: ScanIntent = {
  intentId: "intent-1",
  action: "TIME_IN",
  checkpointName: "Main entrance · IN",
  expiresAtUtc: "2026-10-19T01:00:00Z",
};
const location: LocationFix = {
  latitude: 14.55,
  longitude: 121.02,
  accuracyMeters: 12,
  capturedAtUtc: "2026-10-19T00:57:10Z",
};
const receipt: ScanReceipt = {
  receiptId: "4f2a91c0-0000",
  action: "TIME_IN",
  receivedAtUtc: "2026-10-19T00:57:12Z",
  checkpointName: "Main entrance · IN",
};

function run(state: ScanState, ...events: Parameters<typeof scanReducer>[1][]): ScanState {
  return events.reduce(scanReducer, state);
}

const ready = run(initialScanState("TIME_IN"), { type: "camera-ready" });
const decoded = scanReducer(ready, { type: "decoded", token: "TR-IN", requestKey: "k1" });
const saving = run(decoded, { type: "intent-ok", intent }, { type: "location-ok", location });

describe("camera start", () => {
  it("starts in 'starting' and becomes ready when the camera runs", () => {
    expect(initialScanState("TIME_IN").status).toBe("starting");
    expect(ready).toMatchObject({ status: "ready", expected: "TIME_IN" });
  });

  it("blocks on a camera error and can retry", () => {
    const blocked = scanReducer(initialScanState("TIME_IN"), { type: "camera-error", reason: "camera-denied" });
    expect(blocked).toMatchObject({ status: "blocked", reason: "camera-denied" });
    expect(scanReducer(blocked, { type: "retry-camera" }).status).toBe("starting");
  });
});

describe("checking", () => {
  it("goes ready -> checking on decode and keeps one request key", () => {
    expect(decoded).toMatchObject({ status: "checking", step: "intent", requestKey: "k1", token: "TR-IN" });
  });

  it("ignores a second decode while checking", () => {
    expect(scanReducer(decoded, { type: "decoded", token: "TR-OUT", requestKey: "k2" })).toBe(decoded);
  });

  it("ignores a decode before the camera is ready", () => {
    const starting = initialScanState("TIME_IN");
    expect(scanReducer(starting, { type: "decoded", token: "TR-IN", requestKey: "k1" })).toBe(starting);
  });

  it("walks intent -> location -> saving", () => {
    const located = scanReducer(decoded, { type: "intent-ok", intent });
    expect(located).toMatchObject({ status: "checking", step: "location", intent });
    expect(saving).toMatchObject({ status: "checking", step: "saving", intent, location, requestKey: "k1" });
  });

  it("blocks when location permission is denied", () => {
    const located = scanReducer(decoded, { type: "intent-ok", intent });
    expect(scanReducer(located, { type: "location-denied" })).toMatchObject({
      status: "blocked",
      reason: "location-denied",
    });
  });
});

describe("outcomes", () => {
  it("shows saved only with a committed receipt while saving", () => {
    expect(scanReducer(saving, { type: "saved", receipt })).toMatchObject({ status: "saved", receipt });
  });

  it("never shows saved from ready or from an earlier step", () => {
    expect(scanReducer(ready, { type: "saved", receipt })).toBe(ready);
    expect(scanReducer(decoded, { type: "saved", receipt })).toBe(decoded);
  });

  it("fails with details from any checking step", () => {
    const failed = scanReducer(saving, {
      type: "failed",
      failure: { reason: "outside", distanceMeters: 412, radiusMeters: 60, accuracyMeters: 35, maxAccuracyMeters: 25 },
    });
    expect(failed).toMatchObject({ status: "failed", failure: { reason: "outside", distanceMeters: 412 } });
  });

  it("remembers which action was attempted (the code's, once known)", () => {
    const outIntent: ScanIntent = { ...intent, action: "TIME_OUT" };
    const located = run(decoded, { type: "intent-ok", intent: outIntent });
    expect(scanReducer(located, { type: "failed", failure: { reason: "accuracy" } })).toMatchObject({
      attempted: "TIME_OUT",
    });
    expect(scanReducer(decoded, { type: "failed", failure: { reason: "invalid-qr" } })).toMatchObject({
      attempted: "TIME_IN",
    });
  });

  it("treats a timeout before saving as a network failure (nothing was sent)", () => {
    expect(scanReducer(decoded, { type: "timeout" })).toMatchObject({
      status: "failed",
      failure: { reason: "network" },
    });
  });
});

describe("lost response", () => {
  const unconfirmed = scanReducer(saving, { type: "timeout" });

  it("lands on unconfirmed after a timeout while saving", () => {
    expect(unconfirmed).toMatchObject({ status: "unconfirmed", requestKey: "k1", intent, location });
  });

  it("re-checks with the same key and payload, as a receipt lookup", () => {
    expect(scanReducer(unconfirmed, { type: "recheck" })).toMatchObject({
      status: "checking",
      step: "saving",
      requestKey: "k1",
      intent,
      location,
      rechecking: true,
    });
  });

  it("does not mark a first save as a recheck", () => {
    expect(saving).toMatchObject({ rechecking: false });
  });

  it("cannot be abandoned with a reset (no new scan while the old one may have saved)", () => {
    expect(scanReducer(unconfirmed, { type: "reset" })).toBe(unconfirmed);
  });
});

describe("reset", () => {
  it("expects Time out after a saved Time in", () => {
    const saved = scanReducer(saving, { type: "saved", receipt });
    expect(scanReducer(saved, { type: "reset" })).toMatchObject({ status: "starting", expected: "TIME_OUT" });
  });

  it("expects Time in after a saved Time out", () => {
    const saved = scanReducer(saving, { type: "saved", receipt: { ...receipt, action: "TIME_OUT" } });
    expect(scanReducer(saved, { type: "reset" })).toMatchObject({ status: "starting", expected: "TIME_IN" });
  });

  it("keeps the expected action after a failure", () => {
    const failed = scanReducer(saving, { type: "failed", failure: { reason: "accuracy" } });
    expect(scanReducer(failed, { type: "reset" })).toMatchObject({ status: "starting", expected: "TIME_IN" });
  });
});
