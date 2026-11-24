/**
 * Office vicinity cybersecurity & anti-spoofing verifiers
 * (Technical Design v1.0 sections 5, 6, and 10).
 *
 * Defends against:
 * 1. Native Camera / Google Lens / URL scanning (non-URL token check).
 * 2. Pre-cached or stale GPS replay (capturedAtUtc >= intent.issuedAtUtc - 2s).
 * 3. Fake-GPS / Mock-Location apps (rejects synthetic accuracy <= 0.5m and
 *    flags zero-jitter duplicate coordinates across consecutive scans).
 * 4. Virtual / covered / tampered camera feeds (verifies photo data URL format,
 *    SHA-256 integrity digest, and minimum pixel luma standard deviation).
 * 5. Buddy punching (detects two different interns scanning from the same
 *    HttpOnly device token within 12 hours and flags for HR review).
 */

import { createHash } from "node:crypto";

export const MIN_PLAUSIBLE_GPS_ACCURACY_METERS = 0.5;
export const PRE_INTENT_CLOCK_TOLERANCE_MS = 2_000;
export const MIN_CAMERA_FRAME_VARIANCE = 6.0;
export const MAX_PHOTO_DATA_URL_CHARS = 96_000;
export const BUDDY_PUNCH_WINDOW_MS = 12 * 60 * 60 * 1000;

export interface PhotoCaptureFrame {
  readonly dataUrl: string;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
  readonly frameVariance: number;
  readonly facingMode: "environment" | "user";
  readonly capturedAtUtc: string;
}

export interface ScanPhotoEvidence {
  readonly wallPoster?: PhotoCaptureFrame;
  readonly selfie: PhotoCaptureFrame;
}

export type SecurityCheckOutcome =
  | { readonly ok: true; readonly warnings: readonly string[] }
  | {
      readonly ok: false;
      readonly code:
        | "LOCATION_STALE"
        | "LOCATION_PRE_INTENT"
        | "LOCATION_SPOOF_SUSPECTED"
        | "PHOTO_EVIDENCE_REQUIRED"
        | "PHOTO_TAMPERED"
        | "PHOTO_BLANK_FRAME";
      readonly message: string;
    };

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hashDeviceId(rawDeviceId: string): string {
  return createHash("sha256").update(`trchr-device:${rawDeviceId}`, "utf8").digest("hex").slice(0, 32);
}

/** Verify a single captured camera frame for format, SHA-256 match, and non-blank pixel variance. */
export function verifyPhotoFrame(frame: PhotoCaptureFrame): SecurityCheckOutcome {
  if (
    !frame.dataUrl.startsWith("data:image/jpeg;base64,") &&
    !frame.dataUrl.startsWith("data:image/webp;base64,")
  ) {
    return {
      ok: false,
      code: "PHOTO_EVIDENCE_REQUIRED",
      message: "Scan photo must be a valid live camera JPEG or WebP frame.",
    };
  }
  if (frame.dataUrl.length < 120 || frame.dataUrl.length > MAX_PHOTO_DATA_URL_CHARS) {
    return {
      ok: false,
      code: "PHOTO_EVIDENCE_REQUIRED",
      message: "Scan photo size is invalid.",
    };
  }
  if (frame.width < 120 || frame.height < 120) {
    return {
      ok: false,
      code: "PHOTO_EVIDENCE_REQUIRED",
      message: "Camera frame resolution is too small.",
    };
  }

  const computedHash = sha256Hex(frame.dataUrl);
  if (computedHash !== frame.sha256.toLowerCase()) {
    return {
      ok: false,
      code: "PHOTO_TAMPERED",
      message: "Camera photo integrity check failed.",
    };
  }

  if (!Number.isFinite(frame.frameVariance) || frame.frameVariance < MIN_CAMERA_FRAME_VARIANCE) {
    return {
      ok: false,
      code: "PHOTO_BLANK_FRAME",
      message: "Camera image appears blank or covered. Keep the lens clear and try again.",
    };
  }

  return { ok: true, warnings: [] };
}

/** Verify both the selfie frame and optional wall-poster snapshot. */
export function verifyScanPhotoEvidence(
  photoEvidence: ScanPhotoEvidence | null | undefined,
  options: { readonly requirePhoto: boolean },
): SecurityCheckOutcome {
  if (!photoEvidence) {
    if (!options.requirePhoto) return { ok: true, warnings: [] };
    return {
      ok: false,
      code: "PHOTO_EVIDENCE_REQUIRED",
      message: "In-app camera photo confirmation is required to record attendance.",
    };
  }

  const selfieCheck = verifyPhotoFrame(photoEvidence.selfie);
  if (!selfieCheck.ok) return selfieCheck;

  if (photoEvidence.wallPoster) {
    const wallCheck = verifyPhotoFrame(photoEvidence.wallPoster);
    if (!wallCheck.ok) return wallCheck;
  }

  return { ok: true, warnings: [] };
}

/**
 * Evaluate GPS anti-spoofing rules:
 * 1. Sample must be taken after the server issued the ScanIntent (within 2s clock skew).
 * 2. Synthetic accuracy <= 0.5m (common in mock-location apps) is rejected.
 * 3. Identical 7-decimal coordinates across consecutive scans are flagged for HR review.
 */
export function evaluateGpsIntegrity(input: {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly capturedAtUtc: Date;
  readonly intentIssuedAtUtc: Date;
  readonly previousScanLocation?: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracyMeters: number;
  } | null;
}): SecurityCheckOutcome {
  if (input.capturedAtUtc.getTime() < input.intentIssuedAtUtc.getTime() - PRE_INTENT_CLOCK_TOLERANCE_MS) {
    return {
      ok: false,
      code: "LOCATION_PRE_INTENT",
      message: "Location fix predates the QR scan. Scan again to take a fresh GPS reading.",
    };
  }

  if (!Number.isFinite(input.accuracyMeters) || input.accuracyMeters <= MIN_PLAUSIBLE_GPS_ACCURACY_METERS) {
    return {
      ok: false,
      code: "LOCATION_SPOOF_SUSPECTED",
      message: "Location reading appears synthetic or mocked. Turn off mock location apps and try again.",
    };
  }

  const warnings: string[] = [];
  if (input.previousScanLocation) {
    const latDelta = Math.abs(input.latitude - input.previousScanLocation.latitude);
    const lngDelta = Math.abs(input.longitude - input.previousScanLocation.longitude);
    const accDelta = Math.abs(input.accuracyMeters - input.previousScanLocation.accuracyMeters);
    if (latDelta < 1e-7 && lngDelta < 1e-7 && accDelta < 1e-4) {
      warnings.push("ZERO_JITTER_COORDINATES");
    }
  }

  return { ok: true, warnings };
}

/**
 * Check whether the same physical browser/phone device token was used by a
 * different intern within the 12-hour buddy-punch window.
 */
export function detectSharedDeviceBuddyPunch(input: {
  readonly currentInternUserId: string;
  readonly deviceIdHash: string | null | undefined;
  readonly recentDeviceScans: readonly {
    readonly internUserId: string;
    readonly internName: string;
    readonly receivedAtUtc: Date;
  }[];
  readonly nowUtc: Date;
}): { readonly flagged: boolean; readonly sharedWithInternName?: string } {
  if (!input.deviceIdHash) return { flagged: false };

  const cutoffMs = input.nowUtc.getTime() - BUDDY_PUNCH_WINDOW_MS;
  for (const scan of input.recentDeviceScans) {
    if (
      scan.internUserId !== input.currentInternUserId &&
      scan.receivedAtUtc.getTime() >= cutoffMs
    ) {
      return {
        flagged: true,
        sharedWithInternName: scan.internName,
      };
    }
  }

  return { flagged: false };
}
