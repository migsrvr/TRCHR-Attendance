/**
 * Transactional email delivery backed by Python 3 stdlib SMTP (scripts/send_mail.py).
 *
 * No third-party email SDKs or SaaS providers required. When SMTP_HOST is unset
 * (local development), messages fall back to a structured console preview so
 * onboarding links remain testable without an external mail server.
 */

import { execFile } from "node:child_process";
import path from "node:path";

import { logInfo, logWarn } from "@/lib/http/logger";

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

export interface SendMailResult {
  readonly delivered: boolean;
  readonly transport: "smtp" | "console";
  readonly messageId?: string;
}

export type MailTransport = (message: MailMessage) => Promise<SendMailResult>;

export interface SendMailOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly transport?: MailTransport;
}

const SCRIPT_PATH = path.resolve(process.cwd(), "scripts", "send_mail.py");

function runPythonSmtp(
  message: MailMessage,
  env: Readonly<Record<string, string | undefined>>,
): Promise<SendMailResult> {
  const pythonBin = env.PYTHON_BIN?.trim() || "python";

  return new Promise((resolve, reject) => {
    const child = execFile(
      pythonBin,
      [SCRIPT_PATH],
      {
        env: { ...process.env, ...env },
        timeout: 12_000,
        maxBuffer: 256 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Python SMTP failed: ${stderr?.trim() || error.message}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim()) as { delivered?: boolean; messageId?: string };
          resolve({
            delivered: parsed.delivered === true,
            transport: "smtp",
            messageId: parsed.messageId,
          });
        } catch {
          resolve({ delivered: true, transport: "smtp" });
        }
      },
    );

    child.stdin?.write(JSON.stringify(message));
    child.stdin?.end();
  });
}

export async function sendMail(
  message: MailMessage,
  options: SendMailOptions = {},
): Promise<SendMailResult> {
  if (options.transport) {
    return options.transport(message);
  }

  const env = options.env ?? process.env;
  const host = env.SMTP_HOST?.trim();

  if (!host) {
    logInfo("mail.console_preview", {
      to: message.to,
      subject: message.subject,
    });
    if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
      // Development preview only — never logs links in production or test noise.
      console.info(`[mail:preview] To: ${message.to} | Subject: ${message.subject}\n${message.text}`);
    }
    return { delivered: true, transport: "console" };
  }

  try {
    return await runPythonSmtp(message, env);
  } catch (error) {
    logWarn("mail.smtp_failed", {
      to: message.to,
      subject: message.subject,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    throw error;
  }
}

export async function sendSetupLinkEmail(
  input: {
    readonly to: string;
    readonly firstName: string;
    readonly role: "INTERN" | "HR";
    readonly setupUrl: string;
    readonly expiresLabel: string;
  },
  options: SendMailOptions = {},
): Promise<SendMailResult> {
  const roleCopy =
    input.role === "INTERN"
      ? "HR has set up your Top Realty intern attendance account."
      : "Your Top Realty HR attendance account is ready.";

  const text = [
    `Hi ${input.firstName},`,
    "",
    roleCopy,
    "Open the link below to choose your password (passwords are never sent by email):",
    "",
    input.setupUrl,
    "",
    `This link works once and expires ${input.expiresLabel}.`,
    "If it expires, ask HR to send you a new setup link.",
  ].join("\n");

  return sendMail(
    {
      to: input.to,
      subject: "Set your Top Realty Attendance password",
      text,
    },
    options,
  );
}

export async function sendCorrectionRequestedEmail(
  input: {
    readonly to: string;
    readonly firstName: string;
    readonly dateIso: string;
    readonly correctionUrl: string;
  },
  options: SendMailOptions = {},
): Promise<SendMailResult> {
  const text = [
    `Hi ${input.firstName},`,
    "",
    `HR asked for an attendance correction for ${input.dateIso} so your session can be reviewed.`,
    "Submit your proposed times and explanation using the link below:",
    "",
    input.correctionUrl,
    "",
    "Proposed times add no credited hours until HR reviews and approves the request.",
  ].join("\n");

  return sendMail(
    {
      to: input.to,
      subject: `Attendance correction requested for ${input.dateIso}`,
      text,
    },
    options,
  );
}
