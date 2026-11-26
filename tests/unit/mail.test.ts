import { describe, expect, it } from "vitest";

import { sendCorrectionRequestedEmail, sendMail, sendSetupLinkEmail } from "@/lib/mail";

describe("mail delivery (Node SMTP + dev console fallback)", () => {
  it("falls back to console transport when SMTP_HOST is unset in dev/test", async () => {
    const result = await sendMail(
      {
        to: "ana.reyes@school.edu.ph",
        subject: "Test message",
        text: "Hello Ana",
      },
      { env: { SMTP_HOST: "", NODE_ENV: "test" } },
    );

    expect(result.delivered).toBe(true);
    expect(result.transport).toBe("console");
  });

  it("fails loudly in production when SMTP_HOST is unset", async () => {
    await expect(
      sendMail(
        {
          to: "ana.reyes@school.edu.ph",
          subject: "Test message",
          text: "Hello Ana",
        },
        { env: { SMTP_HOST: "", NODE_ENV: "production" } },
      ),
    ).rejects.toThrow("SMTP_HOST is required in production");
  });

  it("formats setup link emails without embedding any password", async () => {
    let captured: { to: string; subject: string; text: string } | null = null;
    const result = await sendSetupLinkEmail(
      {
        to: "rina@school.edu.ph",
        firstName: "Rina",
        role: "INTERN",
        setupUrl: "https://app.toprealty.local/set-password?token=abc123",
        expiresLabel: "Oct 25 at 6:00 PM",
      },
      {
        transport: async (msg) => {
          captured = msg;
          return { delivered: true, transport: "console" };
        },
      },
    );

    expect(result.delivered).toBe(true);
    expect(captured).not.toBeNull();
    expect(captured!.to).toBe("rina@school.edu.ph");
    expect(captured!.text).toContain("https://app.toprealty.local/set-password?token=abc123");
    expect(captured!.text).toContain("Oct 25 at 6:00 PM");
  });

  it("formats correction request notice emails with date and link", async () => {
    let captured: { to: string; subject: string; text: string } | null = null;
    const result = await sendCorrectionRequestedEmail(
      {
        to: "marco@school.edu.ph",
        firstName: "Marco",
        dateIso: "2026-10-16",
        correctionUrl: "https://app.toprealty.local/corrections/new?date=2026-10-16",
      },
      {
        transport: async (msg) => {
          captured = msg;
          return { delivered: true, transport: "console" };
        },
      },
    );

    expect(result.delivered).toBe(true);
    expect(captured!.text).toContain("2026-10-16");
    expect(captured!.text).toContain("/corrections/new?date=2026-10-16");
  });
});
