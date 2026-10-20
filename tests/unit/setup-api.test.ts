import { describe, expect, it } from "vitest";

import { createMockSetupApi, setupErrorMessage } from "@/lib/setup/api";

describe("setup API", () => {
  it("refuses a duplicate department name, ignoring case and spaces", async () => {
    const api = createMockSetupApi({ delayMs: 0, existingNames: ["Marketing"] });
    expect(await api.addDepartment(" marketing ")).toEqual({ ok: false, message: setupErrorMessage(409, { error: { code: "NAME_TAKEN" } }) });
    expect(await api.addDepartment("Property Management")).toEqual({ ok: true, value: { id: "dept-property-management" } });
    expect((await api.addDepartment("Property Management")).ok).toBe(false);
  });

  it("maps locked versions and permissions to plain messages", () => {
    expect(setupErrorMessage(409, { error: { code: "VERSION_LOCKED" } })).toMatch(/locked/);
    expect(setupErrorMessage(403, null)).toMatch(/Only HR/);
    expect(setupErrorMessage(500, null)).toMatch(/connection/);
  });
});
