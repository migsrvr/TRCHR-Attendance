/**
 * Camera and location permission requests for the first-run screens.
 *
 * Browsers differ: Chrome on Android answers navigator.permissions for both;
 * iOS Safari can't be asked about the camera at all and only recently about
 * location. So "unknown" is a normal answer, and the reliable test is to
 * request the permission and see what happens.
 */

import { cameraSupport, classifyCameraError } from "@/lib/device/platform";
import type { BlockReason } from "@/lib/ui/scan-state";

export type PermissionStatus = "granted" | "denied" | "prompt" | "unknown";

export function normalizePermissionState(state: unknown): PermissionStatus {
  return state === "granted" || state === "denied" || state === "prompt" ? state : "unknown";
}

/** Best-effort check without prompting. */
export async function queryPermission(name: "camera" | "geolocation"): Promise<PermissionStatus> {
  try {
    const status = await navigator.permissions?.query({ name: name as PermissionName });
    return normalizePermissionState(status?.state);
  } catch {
    return "unknown";
  }
}

/** Asks for the rear camera, then releases it straight away. */
export async function requestCameraPermission(): Promise<"granted" | BlockReason> {
  const unsupported = cameraSupport({
    isSecureContext: window.isSecureContext,
    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
  });
  if (unsupported) return unsupported;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    stream.getTracks().forEach((track) => track.stop());
    return "granted";
  } catch (error) {
    return classifyCameraError(error);
  }
}

/**
 * Turns a location attempt into a permission answer. A slow or unavailable
 * fix (codes 2 and 3) still means the intern allowed location; only code 1 is
 * a refusal.
 */
export function locationOutcome(result: { ok: true } | { ok: false; code: number | null }): "granted" | "denied" | "unsupported" {
  if (result.ok) return "granted";
  if (result.code === null) return "unsupported";
  return result.code === 1 ? "denied" : "granted";
}

export function requestLocationPermission(timeoutMs = 10_000): Promise<"granted" | "denied" | "unsupported"> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(locationOutcome({ ok: false, code: null }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve(locationOutcome({ ok: true })),
      (error) => resolve(locationOutcome({ ok: false, code: error.code })),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
  });
}
