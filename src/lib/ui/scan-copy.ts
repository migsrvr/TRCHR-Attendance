/**
 * Words for the scan screen's failure and blocked states. Kept apart from
 * the views so every reason is covered by tests and reads consistently.
 */

import { permissionHelp, type MobilePlatform, type PermissionHelp } from "@/lib/device/platform";
import type { BlockReason, FailureDetail, ScanAction } from "@/lib/ui/scan-state";

export type CopyAction = { label: string; action: "reset" } | { label: string; href: string };

export interface FailureFact {
  label: string;
  value: string;
  limit: string;
}

export interface FailureCopy {
  icon: "location" | "network" | "alert";
  headline: string;
  outcome: string;
  body: string;
  facts: FailureFact[];
  tips: string[];
  primary: CopyAction;
  secondary?: { label: string; href: string };
}

const actionName = (action: ScanAction) => (action === "TIME_IN" ? "Time in" : "Time out");
const CORRECTION = { label: "Request a correction", href: "/corrections/new" } as const;
const SCAN_AGAIN = { label: "Scan again", action: "reset" } as const;

function geofenceFacts(failure: FailureDetail): FailureFact[] {
  const facts: FailureFact[] = [];
  if (failure.distanceMeters !== undefined && failure.radiusMeters !== undefined) {
    facts.push({
      label: "Your distance",
      value: `${Math.round(failure.distanceMeters)} m`,
      limit: `allowed: ${Math.round(failure.radiusMeters)} m`,
    });
  }
  if (failure.accuracyMeters !== undefined && failure.maxAccuracyMeters !== undefined) {
    facts.push({
      label: "Location accuracy",
      value: `±${Math.round(failure.accuracyMeters)} m`,
      limit: `needed: ±${Math.round(failure.maxAccuracyMeters)} m or better`,
    });
  }
  return facts;
}

export function failureCopy(failure: FailureDetail, attempted: ScanAction): FailureCopy {
  const outcome = `No ${actionName(attempted)} was recorded.`;
  const icon: FailureCopy["icon"] = ["outside", "accuracy", "location-timeout", "location-unavailable"].includes(
    failure.reason,
  )
    ? "location"
    : failure.reason === "network"
      ? "network"
      : "alert";
  const base = { icon, outcome, facts: [] as FailureFact[], tips: [] as string[] };

  switch (failure.reason) {
    case "outside":
      return {
        ...base,
        headline: "You're outside the office area",
        body: "Nothing was sent to HR.",
        facts: geofenceFacts(failure),
        tips: [
          "Walk to the office entrance where the QR codes are posted.",
          "Turn on precise location for your browser.",
          "Scan the code again.",
        ],
        primary: SCAN_AGAIN,
        secondary: CORRECTION,
      };
    case "accuracy":
      return {
        ...base,
        headline: "Your location isn't precise enough",
        body: "Your phone gave only a rough location, so the scan couldn't be checked.",
        facts: geofenceFacts(failure),
        tips: [
          "Turn on precise location (iPhone: Precise Location; Android: Use precise location).",
          "Step near the entrance or a window, away from thick walls.",
          "Scan the code again.",
        ],
        primary: SCAN_AGAIN,
        secondary: CORRECTION,
      };
    case "invalid-qr":
      return {
        ...base,
        headline: "That isn't an office attendance code",
        body: "Scan the IN or OUT code posted at the office entrance.",
        primary: SCAN_AGAIN,
      };
    case "expired-qr":
      return {
        ...base,
        headline: "This code is no longer valid",
        body: "HR has replaced it. Scan the new code at the entrance, or tell HR if there isn't one.",
        primary: SCAN_AGAIN,
      };
    case "already-in":
      return {
        ...base,
        outcome: "Nothing new was recorded.",
        headline: "You're already timed in",
        body: "You timed in earlier today. Scan the OUT code when you leave.",
        primary: { label: "Scan the OUT code", action: "reset" },
      };
    case "not-in":
      return {
        ...base,
        outcome: "Nothing new was recorded.",
        headline: "You haven't timed in yet today",
        body: "Scan the IN code first. If you forgot to scan when you arrived, request a correction.",
        primary: { label: "Scan the IN code", action: "reset" },
        secondary: CORRECTION,
      };
    case "session-expired":
      return {
        ...base,
        headline: "You've been signed out",
        body: "Sign in again, then scan the code.",
        primary: { label: "Sign in", href: "/sign-in" },
      };
    case "network":
      return {
        ...base,
        headline: "No connection",
        body: "Your phone couldn't reach the office server, so nothing was saved. Check your mobile data or Wi-Fi.",
        primary: SCAN_AGAIN,
      };
    case "location-timeout":
      return {
        ...base,
        headline: "Couldn't get your location in time",
        body: "Indoors this can be slow. Move near the entrance or a window.",
        primary: SCAN_AGAIN,
        secondary: CORRECTION,
      };
    case "location-unavailable":
      return {
        ...base,
        headline: "Your phone couldn't find your location",
        body: "Turn on Location in your phone's settings, then scan again.",
        primary: SCAN_AGAIN,
        secondary: CORRECTION,
      };
    case "not-saved":
      return {
        ...base,
        headline: "Your scan wasn't saved",
        body: "The office server has no record of it. Scan the code again.",
        primary: SCAN_AGAIN,
      };
    case "server":
      return {
        ...base,
        headline: "Something went wrong on our side",
        body: "Wait a moment and scan again. If it keeps happening, tell HR.",
        primary: SCAN_AGAIN,
      };
    default: {
      const unhandled: never = failure.reason;
      throw new Error(`No copy for ${String(unhandled)}`);
    }
  }
}

export interface BlockedCopy {
  icon: "camera" | "location" | "browser" | "alert";
  headline: string;
  body: string;
  help: PermissionHelp[];
  /** Shown instead of permission steps when the page is open inside a social app. */
  inAppSteps?: string[];
  primary: string;
}

function helpFor(kind: "camera" | "location", platform: MobilePlatform): PermissionHelp[] {
  return platform === "other"
    ? [permissionHelp(kind, "ios"), permissionHelp(kind, "android")]
    : [permissionHelp(kind, platform)];
}

export function blockedCopy(
  reason: BlockReason,
  context: { platform: MobilePlatform; inApp: string | null },
): BlockedCopy {
  if (context.inApp && reason !== "location-denied") {
    const browser = context.platform === "ios" ? "Safari" : "Chrome";
    return {
      icon: "browser",
      headline: `${context.inApp} can't use the camera here`,
      body: `Open this page in ${browser} to scan. Attendance works best there.`,
      help: [],
      inAppSteps: [
        "Tap the ••• menu in the corner of this screen.",
        `Choose Open in ${browser} (it may say Open in browser).`,
        "Sign in there if asked, then scan again.",
      ],
      primary: "Try again",
    };
  }

  switch (reason) {
    case "camera-denied":
      return {
        icon: "camera",
        headline: "Camera access is off",
        body: "The scanner needs your camera to read the office QR code. It never records photos or video.",
        help: helpFor("camera", context.platform),
        primary: "Try again",
      };
    case "location-denied":
      return {
        icon: "location",
        headline: "Location is off",
        body: "Scans can't be saved until this page can check that you're at the office.",
        help: helpFor("location", context.platform),
        primary: "Try again",
      };
    case "camera-busy":
      return {
        icon: "camera",
        headline: "The camera is in use",
        body: "Another app is using the camera. Close the camera app or any video call, then try again.",
        help: [],
        primary: "Try again",
      };
    case "no-camera":
      return {
        icon: "camera",
        headline: "No camera found",
        body: "This browser can't reach a camera. Open the page on your phone in Safari (iPhone) or Chrome (Android).",
        help: [],
        primary: "Try again",
      };
    case "insecure":
      return {
        icon: "alert",
        headline: "This page needs a secure connection",
        body: "Phones only allow the camera on secure pages. Open the https:// address of the attendance app.",
        help: [],
        primary: "Try again",
      };
    case "camera-failed":
      return {
        icon: "camera",
        headline: "The camera didn't start",
        body: "Try again. If it keeps failing, restart your browser.",
        help: [],
        primary: "Try again",
      };
    default: {
      const unhandled: never = reason;
      throw new Error(`No copy for ${String(unhandled)}`);
    }
  }
}
