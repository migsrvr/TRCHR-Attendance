import { describe, expect, it } from "vitest";

import { classifyCheckpointExpiry, DEFAULT_QR_EXPIRY_OPTION } from "@/lib/ui/qr-expiry";

describe("QR checkpoint expiry classification", () => {
  it("defaults to monthly (30-day) validity", () => {
    expect(DEFAULT_QR_EXPIRY_OPTION).toBe("30");
  });

  it("classifies expired, expiring-soon (<=7d), valid, and none", () => {
    expect(classifyCheckpointExpiry(null, "2026-11-24")).toEqual({ state: "none", daysLeft: null });
    expect(classifyCheckpointExpiry("2026-11-23", "2026-11-24")).toEqual({ state: "expired", daysLeft: -1 });
    expect(classifyCheckpointExpiry("2026-11-24", "2026-11-24")).toEqual({ state: "expiring-soon", daysLeft: 0 });
    expect(classifyCheckpointExpiry("2026-12-01", "2026-11-24")).toEqual({ state: "expiring-soon", daysLeft: 7 });
    expect(classifyCheckpointExpiry("2026-12-02", "2026-11-24")).toEqual({ state: "valid", daysLeft: 8 });
  });
});
