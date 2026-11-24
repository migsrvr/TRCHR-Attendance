import { describe, expect, it } from "vitest";

import {
  detectSharedDeviceBuddyPunch,
  evaluateGpsIntegrity,
  hashDeviceId,
  sha256Hex,
  verifyScanPhotoEvidence,
  type PhotoCaptureFrame,
} from "@/modules/attendance/security";

function makeValidFrame(facingMode: "environment" | "user" = "user"): PhotoCaptureFrame {
  const dataUrl = `data:image/jpeg;base64,${"A".repeat(200)}`;
  return {
    dataUrl,
    sha256: sha256Hex(dataUrl),
    width: 480,
    height: 360,
    frameVariance: 24.5,
    facingMode,
    capturedAtUtc: "2026-11-24T08:00:02.000Z",
  };
}

describe("scan cybersecurity & double-validation checks", () => {
  it("accepts valid dual-frame (wall poster + selfie) photo evidence and rejects tampered or blank frames", () => {
    const selfie = makeValidFrame("user");
    const wallPoster = makeValidFrame("environment");

    expect(verifyScanPhotoEvidence({ wallPoster, selfie }, { requirePhoto: true })).toEqual({
      ok: true,
      warnings: [],
    });

    // Missing photo when required
    expect(verifyScanPhotoEvidence(null, { requirePhoto: true })).toMatchObject({
      ok: false,
      code: "PHOTO_EVIDENCE_REQUIRED",
    });

    // Tampered SHA-256 hash
    expect(
      verifyScanPhotoEvidence(
        { selfie: { ...selfie, sha256: "0".repeat(64) } },
        { requirePhoto: true },
      ),
    ).toMatchObject({
      ok: false,
      code: "PHOTO_TAMPERED",
    });

    // Covered lens / solid black frame (low pixel variance)
    expect(
      verifyScanPhotoEvidence(
        { selfie: { ...selfie, frameVariance: 1.2 } },
        { requirePhoto: true },
      ),
    ).toMatchObject({
      ok: false,
      code: "PHOTO_BLANK_FRAME",
    });
  });

  it("rejects pre-intent cached GPS readings and synthetic fake-GPS accuracy, and flags zero-jitter coordinates", () => {
    const intentIssuedAtUtc = new Date("2026-11-24T08:00:00Z");

    // Pre-intent cached GPS fix (10s before QR scan)
    expect(
      evaluateGpsIntegrity({
        latitude: 14.5547,
        longitude: 121.0244,
        accuracyMeters: 12,
        capturedAtUtc: new Date("2026-11-24T07:59:50Z"),
        intentIssuedAtUtc,
      }),
    ).toMatchObject({
      ok: false,
      code: "LOCATION_PRE_INTENT",
    });

    // Synthetic 0m accuracy from fake-GPS app
    expect(
      evaluateGpsIntegrity({
        latitude: 14.5547,
        longitude: 121.0244,
        accuracyMeters: 0,
        capturedAtUtc: new Date("2026-11-24T08:00:03Z"),
        intentIssuedAtUtc,
      }),
    ).toMatchObject({
      ok: false,
      code: "LOCATION_SPOOF_SUSPECTED",
    });

    // Zero-jitter duplicate coordinates across consecutive scans -> warning flag
    expect(
      evaluateGpsIntegrity({
        latitude: 14.5547291,
        longitude: 121.0244452,
        accuracyMeters: 11.5,
        capturedAtUtc: new Date("2026-11-24T08:00:03Z"),
        intentIssuedAtUtc,
        previousScanLocation: {
          latitude: 14.5547291,
          longitude: 121.0244452,
          accuracyMeters: 11.5,
        },
      }),
    ).toEqual({
      ok: true,
      warnings: ["ZERO_JITTER_COORDINATES"],
    });
  });

  it("detects shared-device buddy punching across different interns within 12 hours", () => {
    const nowUtc = new Date("2026-11-24T09:00:00Z");
    const deviceIdHash = hashDeviceId("device-cookie-123");

    const flagged = detectSharedDeviceBuddyPunch({
      currentInternUserId: "intern-b",
      deviceIdHash,
      nowUtc,
      recentDeviceScans: [
        {
          internUserId: "intern-a",
          internName: "Ana Reyes",
          receivedAtUtc: new Date("2026-11-24T08:55:00Z"),
        },
      ],
    });
    expect(flagged).toEqual({
      flagged: true,
      sharedWithInternName: "Ana Reyes",
    });

    // Same intern on same device is normal
    const sameIntern = detectSharedDeviceBuddyPunch({
      currentInternUserId: "intern-a",
      deviceIdHash,
      nowUtc,
      recentDeviceScans: [
        {
          internUserId: "intern-a",
          internName: "Ana Reyes",
          receivedAtUtc: new Date("2026-11-24T08:55:00Z"),
        },
      ],
    });
    expect(sameIntern).toEqual({ flagged: false });
  });
});
