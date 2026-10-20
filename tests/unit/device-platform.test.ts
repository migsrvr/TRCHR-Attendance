import { describe, expect, it } from "vitest";

import {
  cameraSupport,
  classifyCameraError,
  classifyLocationError,
  detectInAppBrowser,
  detectPlatform,
  permissionHelp,
} from "@/lib/device/platform";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
  ipadDesktopMode:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  messengerIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/476.0.0.38.109;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.6]",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
};

describe("detectPlatform", () => {
  it("detects iPhone and Android phones", () => {
    expect(detectPlatform(UA.iphoneSafari)).toBe("ios");
    expect(detectPlatform(UA.androidChrome)).toBe("android");
  });

  it("treats an iPad in desktop mode (Mac UA with touch) as iOS", () => {
    expect(detectPlatform(UA.ipadDesktopMode, 5)).toBe("ios");
    expect(detectPlatform(UA.ipadDesktopMode, 0)).toBe("other");
  });

  it("falls back to other for desktops", () => {
    expect(detectPlatform(UA.desktopChrome)).toBe("other");
  });
});

describe("detectInAppBrowser", () => {
  it("spots Messenger, Facebook and Instagram in-app browsers", () => {
    expect(detectInAppBrowser(UA.messengerIos)).toBe("Messenger");
    expect(detectInAppBrowser(UA.facebookAndroid)).toBe("Facebook");
    expect(detectInAppBrowser(UA.instagram)).toBe("Instagram");
  });

  it("returns null for normal browsers", () => {
    expect(detectInAppBrowser(UA.iphoneSafari)).toBeNull();
    expect(detectInAppBrowser(UA.androidChrome)).toBeNull();
  });
});

describe("cameraSupport", () => {
  it("needs a secure context (HTTPS) first", () => {
    expect(cameraSupport({ isSecureContext: false, hasGetUserMedia: false })).toBe("insecure");
  });

  it("reports a missing camera API", () => {
    expect(cameraSupport({ isSecureContext: true, hasGetUserMedia: false })).toBe("no-camera");
  });

  it("is fine when both are present", () => {
    expect(cameraSupport({ isSecureContext: true, hasGetUserMedia: true })).toBeNull();
  });
});

describe("classifyCameraError", () => {
  const err = (name: string) => Object.assign(new Error(name), { name });

  it.each([
    ["NotAllowedError", "camera-denied"],
    ["SecurityError", "camera-denied"],
    ["NotFoundError", "no-camera"],
    ["OverconstrainedError", "no-camera"],
    ["NotReadableError", "camera-busy"],
    ["AbortError", "camera-busy"],
    ["TypeError", "camera-failed"],
  ] as const)("%s -> %s", (name, reason) => {
    expect(classifyCameraError(err(name))).toBe(reason);
  });

  it("handles non-errors", () => {
    expect(classifyCameraError("boom")).toBe("camera-failed");
  });
});

describe("classifyLocationError", () => {
  it("maps GeolocationPositionError codes", () => {
    expect(classifyLocationError(1)).toBe("denied");
    expect(classifyLocationError(2)).toBe("location-unavailable");
    expect(classifyLocationError(3)).toBe("location-timeout");
  });
});

describe("permissionHelp", () => {
  it("gives Safari steps on iOS", () => {
    const help = permissionHelp("camera", "ios");
    expect(help.browser).toBe("Safari on iPhone");
    expect(help.steps.join(" ")).toMatch(/Website Settings/);
  });

  it("gives Chrome steps on Android", () => {
    const help = permissionHelp("location", "android");
    expect(help.browser).toBe("Chrome on Android");
    expect(help.steps.join(" ")).toMatch(/Permissions/);
  });

  it("mentions precise location for location help on both platforms", () => {
    expect(permissionHelp("location", "ios").steps.join(" ")).toMatch(/Precise Location/);
    expect(permissionHelp("location", "android").steps.join(" ")).toMatch(/precise location/i);
  });
});
