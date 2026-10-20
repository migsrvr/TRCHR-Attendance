import { describe, expect, it } from "vitest";

import { accountErrorMessage, createMockAccountsApi } from "@/lib/accounts/api";

const input = {
  clientRequestId: "req-1",
  name: "Rina Mendoza",
  email: "rina.mendoza@school.edu.ph",
  department: "Leasing",
  requiredMinutes: 29160,
  startDate: "2026-10-26",
  endDate: null,
};

describe("accounts API", () => {
  it("creates an intern once per client request id", async () => {
    const api = createMockAccountsApi({ delayMs: 0 });
    const first = await api.createIntern(input);
    const again = await api.createIntern(input);
    expect(first.ok && again.ok && first.value.id === again.value.id).toBe(true);
  });

  it("refuses an email that already has an account", async () => {
    const api = createMockAccountsApi({ delayMs: 0 });
    const result = await api.createIntern({ ...input, clientRequestId: "req-2", email: "taken@example.com" });
    expect(result).toEqual({ ok: false, message: accountErrorMessage(409, { error: { code: "EMAIL_TAKEN" } }) });
  });

  it("maps codes to plain messages and falls back to a generic one", () => {
    expect(accountErrorMessage(409, { error: { code: "EMAIL_TAKEN" } })).toMatch(/already has an account/);
    expect(accountErrorMessage(403, null)).toMatch(/HR/);
    expect(accountErrorMessage(500, null)).toMatch(/connection/);
  });

  it("resends a link, signs out devices and toggles an account", async () => {
    const api = createMockAccountsApi({ delayMs: 0 });
    expect((await api.resendSetupLink("rina-mendoza")).ok).toBe(true);
    expect((await api.signOutEverywhere("ana-reyes")).ok).toBe(true);
    expect(await api.setDisabled("ana-reyes", true)).toEqual({ ok: true, value: { status: "DISABLED" } });
    expect(await api.setDisabled("ana-reyes", false)).toEqual({ ok: true, value: { status: "ACTIVE" } });
  });
});
