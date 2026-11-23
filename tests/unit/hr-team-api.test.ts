import { describe, expect, it } from "vitest";

import { createMockHrTeamApi, hrTeamErrorMessage } from "@/lib/hr-team/api";

describe("HR team API", () => {
  it("invites an HR user and rejects duplicate emails", async () => {
    const api = createMockHrTeamApi({ delayMs: 0, existingEmails: ["hr@toprealty.ph"] });
    const dup = await api.inviteHrUser({ clientRequestId: "req-1", name: "Dup", email: "HR@toprealty.ph" });
    expect(dup).toEqual({ ok: false, message: hrTeamErrorMessage(409, { error: { code: "EMAIL_TAKEN" } }) });

    const created = await api.inviteHrUser({
      clientRequestId: "req-2",
      name: "New Reviewer",
      email: "reviewer@toprealty.ph",
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.status).toBe("PENDING");
      expect(created.value.email).toBe("reviewer@toprealty.ph");
    }
  });

  it("refuses disabling the signed-in HR user and maps LAST_ACTIVE_HR clearly", async () => {
    const api = createMockHrTeamApi({ delayMs: 0, currentUserId: "hr-admin-1" });
    const selfDisable = await api.setDisabled("hr-admin-1", true);
    expect(selfDisable).toEqual({
      ok: false,
      message: hrTeamErrorMessage(409, { error: { code: "CANNOT_DISABLE_SELF" } }),
    });
    expect(hrTeamErrorMessage(409, { error: { code: "LAST_ACTIVE_HR" } })).toMatch(/active HR account/i);
  });
});
