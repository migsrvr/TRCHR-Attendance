/**
 * Phone platform helpers for the scan flow. Pure functions: callers pass in
 * navigator values so these stay testable and safe during server rendering.
 */

import type { BlockReason } from "@/lib/ui/scan-state";

export type MobilePlatform = "ios" | "android" | "other";

/**
 * iPadOS 13+ in desktop mode reports a Mac user agent, so a Mac UA with
 * touch points is treated as iOS.
 */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): MobilePlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

/**
 * Social apps open links in their own browsers, which often refuse camera
 * access. Interns commonly receive the link through Messenger.
 */
export function detectInAppBrowser(userAgent: string): "Messenger" | "Facebook" | "Instagram" | null {
  if (/MessengerForiOS|FB_IAB\/MESSENGER|Orca-Android/i.test(userAgent)) return "Messenger";
  if (/FBAN|FBAV|FB_IAB/i.test(userAgent)) return "Facebook";
  if (/Instagram/i.test(userAgent)) return "Instagram";
  return null;
}

/** Camera access needs HTTPS (or localhost) and the getUserMedia API. */
export function cameraSupport(env: {
  isSecureContext: boolean;
  hasGetUserMedia: boolean;
}): Extract<BlockReason, "insecure" | "no-camera"> | null {
  if (!env.isSecureContext) return "insecure";
  if (!env.hasGetUserMedia) return "no-camera";
  return null;
}

/** Map a getUserMedia / video.play() rejection to a block reason. */
export function classifyCameraError(error: unknown): Extract<
  BlockReason,
  "camera-denied" | "no-camera" | "camera-busy" | "camera-failed"
> {
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "camera-denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "no-camera";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      // Another app (often the phone's own camera or a video call) holds the camera.
      return "camera-busy";
    default:
      return "camera-failed";
  }
}

/** Map a GeolocationPositionError code. */
export function classifyLocationError(code: number): "denied" | "location-unavailable" | "location-timeout" {
  if (code === 1) return "denied";
  if (code === 3) return "location-timeout";
  return "location-unavailable";
}

export interface PermissionHelp {
  browser: string;
  steps: string[];
}

const HELP: Record<"ios" | "android", Record<"camera" | "location", PermissionHelp>> = {
  ios: {
    camera: {
      browser: "Safari on iPhone",
      steps: [
        "Tap the page menu (the aA or ••• button) next to the web address.",
        "Tap Website Settings, then set Camera to Allow.",
        "Come back here and tap Try again.",
        "Still blocked? Open Settings › Apps › Safari › Camera and choose Allow.",
      ],
    },
    location: {
      browser: "Safari on iPhone",
      steps: [
        "Open Settings › Privacy & Security › Location Services and make sure it's on.",
        "Scroll to Safari Websites, choose While Using the App, and turn on Precise Location.",
        "In Safari, tap the page menu (aA) › Website Settings › Location › Allow.",
        "Come back here and tap Try again.",
      ],
    },
  },
  android: {
    camera: {
      browser: "Chrome on Android",
      steps: [
        "Tap the settings icon to the left of the web address.",
        "Tap Permissions, then turn Camera on.",
        "Come back here and tap Try again.",
        "Still blocked? Open Settings › Apps › Chrome › Permissions › Camera and choose Allow.",
      ],
    },
    location: {
      browser: "Chrome on Android",
      steps: [
        "Pull down the quick settings and make sure Location is on.",
        "Tap the settings icon to the left of the web address, tap Permissions, and turn Location on.",
        "Open Settings › Apps › Chrome › Permissions › Location and turn on Use precise location.",
        "Come back here and tap Try again.",
      ],
    },
  },
};

/** Platform-specific steps to re-enable a blocked permission. "other" gets the Android (Chrome) steps. */
export function permissionHelp(kind: "camera" | "location", platform: MobilePlatform): PermissionHelp {
  return HELP[platform === "ios" ? "ios" : "android"][kind];
}
