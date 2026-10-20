import { describe, expect, it } from "vitest";

import { createMockAuthApi, mapAuthError } from "@/lib/auth/client-api";

describe("mapAuthError", () => {
  it("maps Better Auth error codes", () => {
    expect(mapAuthError(401, { code: "INVALID_EMAIL_OR_PASSWORD" })).toBe("invalid");
    expect(mapAuthError(400, { code: "INVALID_TOKEN" })).toBe("expired");
    expect(mapAuthError(400, { code: "PASSWORD_TOO_SHORT" })).toBe("weak");
    expect(mapAuthError(403, { code: "ACCOUNT_DISABLED" })).toBe("disabled");
  });

  it("falls back on the status", () => {
    expect(mapAuthError(429, null)).toBe("rate-limited");
    expect(mapAuthError(401, null)).toBe("invalid");
    expect(mapAuthError(500, "boom")).toBe("network");
  });
});

describe("createMockAuthApi", () => {
  it("signs interns in to Home and HR to the HR panel", async () => {
    const api = createMockAuthApi({ delayMs: 0 });
    await expect(api.signIn({ email: "ana.reyes@school.edu.ph", password: "anything1", rememberMe: true })).resolves.toEqual({
      ok: true,
      redirectTo: "/dashboard",
    });
    await expect(api.signIn({ email: "hr@toprealty.com.ph", password: "anything1", rememberMe: false })).resolves.toEqual({
      ok: true,
      redirectTo: "/hr",
    });
  });

  it("rejects the password 'wrong' so the error state can be tested", async () => {
    const api = createMockAuthApi({ delayMs: 0 });
    await expect(api.signIn({ email: "ana.reyes@school.edu.ph", password: "wrong", rememberMe: true })).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("sets a password unless the token is 'expired'", async () => {
    const api = createMockAuthApi({ delayMs: 0 });
    await expect(api.setPassword({ token: "demo-intern", newPassword: "leasing2026" })).resolves.toEqual({ ok: true });
    await expect(api.setPassword({ token: "expired", newPassword: "leasing2026" })).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
  });
});
