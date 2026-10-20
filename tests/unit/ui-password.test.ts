import { describe, expect, it } from "vitest";

import { checkPassword, MIN_PASSWORD_LENGTH } from "@/lib/ui/password";

const email = "rina.mendoza@school.edu.ph";

describe("checkPassword", () => {
  it("passes a good password", () => {
    expect(checkPassword({ password: "leasing2026", repeat: "leasing2026", email })).toEqual({
      minLength: true,
      notTooLong: true,
      notEmail: true,
      matches: true,
      allMet: true,
    });
  });

  it("uses Better Auth's default minimum of 8", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(checkPassword({ password: "short", repeat: "short", email }).minLength).toBe(false);
  });

  it("rejects the email address or its name part, in any case", () => {
    expect(checkPassword({ password: email, repeat: email, email }).notEmail).toBe(false);
    expect(checkPassword({ password: "Rina.Mendoza", repeat: "Rina.Mendoza", email }).notEmail).toBe(false);
  });

  it("requires both entries to match, and an empty repeat never matches", () => {
    expect(checkPassword({ password: "leasing2026", repeat: "leasing2027", email }).matches).toBe(false);
    expect(checkPassword({ password: "", repeat: "", email }).matches).toBe(false);
  });

  it("caps the length at 128", () => {
    const long = "a".repeat(129);
    expect(checkPassword({ password: long, repeat: long, email }).notTooLong).toBe(false);
  });
});
