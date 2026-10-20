import { describe, expect, it } from "vitest";

import { locationOutcome, normalizePermissionState } from "@/lib/device/permissions";

describe("normalizePermissionState", () => {
  it("passes through the standard states", () => {
    expect(normalizePermissionState("granted")).toBe("granted");
    expect(normalizePermissionState("denied")).toBe("denied");
    expect(normalizePermissionState("prompt")).toBe("prompt");
  });

  it("treats anything else as unknown (iOS Safari can't query the camera)", () => {
    expect(normalizePermissionState(undefined)).toBe("unknown");
    expect(normalizePermissionState("weird")).toBe("unknown");
  });
});

describe("locationOutcome", () => {
  it("counts a fix as granted", () => {
    expect(locationOutcome({ ok: true })).toBe("granted");
  });

  it("only a permission error means denied; slow or unavailable fixes still mean permission was given", () => {
    expect(locationOutcome({ ok: false, code: 1 })).toBe("denied");
    expect(locationOutcome({ ok: false, code: 2 })).toBe("granted");
    expect(locationOutcome({ ok: false, code: 3 })).toBe("granted");
  });

  it("reports a missing geolocation API", () => {
    expect(locationOutcome({ ok: false, code: null })).toBe("unsupported");
  });
});
