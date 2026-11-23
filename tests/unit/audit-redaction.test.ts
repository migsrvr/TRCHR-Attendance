import { describe, expect, it } from "vitest";

import { redactAuditValues } from "@/modules/audit";

describe("audit value redaction", () => {
  it("strips GPS coordinates, passwords, tokens, and free-text explanations while preserving administrative metadata", () => {
    const redacted = redactAuditValues({
      status: "APPROVED",
      effectiveTimeInUtc: "2026-10-15T01:04:00.000Z",
      latitude: 14.5547,
      longitude: 121.0244,
      password: "secret",
      qrToken: "eyJhbGciOiJIUzI1NiJ9",
      explanation: "Personal medical note",
      nested: {
        coordinates: [14.55, 121.02],
        geofenceRadiusMeters: 60,
      },
    }) as Record<string, unknown>;

    expect(redacted.status).toBe("APPROVED");
    expect(redacted.effectiveTimeInUtc).toBe("2026-10-15T01:04:00.000Z");
    expect(redacted.latitude).toBeUndefined();
    expect(redacted.longitude).toBeUndefined();
    expect(redacted.password).toBeUndefined();
    expect(redacted.qrToken).toBeUndefined();
    expect(redacted.explanation).toBeUndefined();
    expect((redacted.nested as Record<string, unknown>).coordinates).toBeUndefined();
    expect((redacted.nested as Record<string, unknown>).geofenceRadiusMeters).toBe(60);
  });
});
