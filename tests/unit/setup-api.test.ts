import { describe, expect, it } from "vitest";

import { createMockSetupApi, setupErrorMessage } from "@/lib/setup/api";

describe("setup API", () => {
  it("refuses a duplicate department name, ignoring case and spaces", async () => {
    const api = createMockSetupApi({ delayMs: 0, existingNames: ["Marketing"] });
    expect(await api.addDepartment(" marketing ")).toEqual({ ok: false, message: setupErrorMessage(409, { error: { code: "NAME_TAKEN" } }) });
    expect(await api.addDepartment("Property Management")).toEqual({ ok: true, value: { id: "dept-property-management" } });
    expect((await api.addDepartment("Property Management")).ok).toBe(false);
  });

  it("maps locked versions, revoked checkpoints, and permissions to plain messages", () => {
    expect(setupErrorMessage(409, { error: { code: "VERSION_LOCKED" } })).toMatch(/locked/);
    expect(setupErrorMessage(409, { error: { code: "ALREADY_REVOKED" } })).toMatch(/revoked/i);
    expect(setupErrorMessage(403, null)).toMatch(/Only HR/);
    expect(setupErrorMessage(500, null)).toMatch(/connection/);
  });

  it("creates, bulk-rotates, and revokes checkpoints in mock mode", async () => {
    const api = createMockSetupApi({ delayMs: 0 });
    const created = await api.createCheckpoint({ name: "3rd floor reception", action: "TIME_IN", expiresInDays: 30 });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.action).toBe("IN");
      expect(created.value.codeVersion).toBe(1);
      const revoked = await api.revokeCheckpoint(created.value.id);
      expect(revoked.ok).toBe(true);
    }
    const rotatedAll = await api.rotateAllCheckpoints({ expiresInDays: 30 });
    expect(rotatedAll.ok).toBe(true);
    if (rotatedAll.ok) {
      expect(rotatedAll.value.rotatedCount).toBe(2);
    }
    expect(setupErrorMessage(404, { error: { code: "NO_ACTIVE_CHECKPOINTS" } })).toMatch(/no active QR/i);
  });
});
