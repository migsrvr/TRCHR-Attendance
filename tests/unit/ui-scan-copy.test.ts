import { describe, expect, it } from "vitest";

import { blockedCopy, failureCopy } from "@/lib/ui/scan-copy";
import type { FailReason } from "@/lib/ui/scan-state";

const ALL_REASONS: FailReason[] = [
  "invalid-qr",
  "expired-qr",
  "outside",
  "accuracy",
  "already-in",
  "not-in",
  "session-expired",
  "network",
  "location-timeout",
  "location-unavailable",
  "not-saved",
  "server",
];

describe("failureCopy", () => {
  it.each(ALL_REASONS)("has copy for %s", (reason) => {
    const copy = failureCopy({ reason }, "TIME_IN");
    expect(copy.headline.length).toBeGreaterThan(0);
    expect(copy.primary.label.length).toBeGreaterThan(0);
  });

  it("names the attempted action in the outcome line", () => {
    expect(failureCopy({ reason: "outside" }, "TIME_IN").outcome).toBe("No Time in was recorded.");
    expect(failureCopy({ reason: "outside" }, "TIME_OUT").outcome).toBe("No Time out was recorded.");
  });

  it("shows distance and accuracy against the limits when outside", () => {
    const copy = failureCopy(
      { reason: "outside", distanceMeters: 412, radiusMeters: 60, accuracyMeters: 35, maxAccuracyMeters: 25 },
      "TIME_IN",
    );
    expect(copy.facts).toEqual([
      { label: "Your distance", value: "412 m", limit: "allowed: 60 m" },
      { label: "Location accuracy", value: "±35 m", limit: "needed: ±25 m or better" },
    ]);
    expect(copy.secondary).toEqual({ label: "Request a correction", href: "/corrections/new" });
  });

  it("omits facts the server didn't send", () => {
    expect(failureCopy({ reason: "outside" }, "TIME_IN").facts).toEqual([]);
  });

  it("sends a signed-out intern to sign in", () => {
    expect(failureCopy({ reason: "session-expired" }, "TIME_IN").primary).toEqual({ label: "Sign in", href: "/sign-in" });
  });

  it("points an already-timed-in intern at the OUT code", () => {
    expect(failureCopy({ reason: "already-in" }, "TIME_IN").primary).toEqual({ label: "Scan the OUT code", action: "reset" });
  });
});

describe("blockedCopy", () => {
  it("gives iPhone steps for a denied camera on iOS", () => {
    const copy = blockedCopy("camera-denied", { platform: "ios", inApp: null });
    expect(copy.help.map((h) => h.browser)).toEqual(["Safari on iPhone"]);
    expect(copy.primary).toBe("Try again");
  });

  it("gives Android steps for denied location on Android", () => {
    const copy = blockedCopy("location-denied", { platform: "android", inApp: null });
    expect(copy.help.map((h) => h.browser)).toEqual(["Chrome on Android"]);
  });

  it("shows both platforms on a desktop", () => {
    expect(blockedCopy("camera-denied", { platform: "other", inApp: null }).help).toHaveLength(2);
  });

  it("tells in-app browser users to open the page in their real browser", () => {
    const copy = blockedCopy("camera-denied", { platform: "ios", inApp: "Messenger" });
    expect(copy.headline).toMatch(/Messenger/);
    expect(copy.inAppSteps?.join(" ")).toMatch(/Safari/);
    const android = blockedCopy("camera-failed", { platform: "android", inApp: "Facebook" });
    expect(android.inAppSteps?.join(" ")).toMatch(/Chrome/);
  });

  it("explains HTTPS without platform steps", () => {
    const copy = blockedCopy("insecure", { platform: "android", inApp: null });
    expect(copy.help).toEqual([]);
    expect(copy.body).toMatch(/https/i);
  });

  it("asks to close other camera apps when the camera is busy", () => {
    expect(blockedCopy("camera-busy", { platform: "android", inApp: null }).body).toMatch(/another app/i);
  });
});
