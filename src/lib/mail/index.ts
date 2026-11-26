/**
 * Transactional email delivery backed by pure Node.js SMTP (nodemailer).
 *
 * Works natively in Vercel Serverless Functions (no Python binary or external
 * email SDK required). When SMTP_HOST is unset in local development/test,
 * messages fall back to a structured console preview so onboarding links remain
 * testable without an external mail server. In production, missing SMTP_HOST
 * fails loudly so invite links are never silently dropped.
 */

import nodemailer from "nodemailer";

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

function buildSmtpConfig(env: Readonly<Record<string, string | undefined>>) {
  const host = env.SMTP_HOST?.trim() ?? "";
  const port = Number(env.SMTP_PORT?.trim() || "587");
  const security = (env.SMTP_SECURITY?.trim() || "starttls").toLowerCase();
  const user = env.SMTP_USER?.trim() || undefined;
  const pass = env.SMTP_PASS?.trim() || undefined;
  const from = env.SMTP_FROM?.trim() || "Top Realty Attendance <no-reply@toprealty.local>";

  const secure = security === "ssl" || security === "smtps" || port === 465;
  const requireTLS = security === "starttls" && !secure;

  return {
    from,
    transportOptions: {
      host,
      port: Number.isFinite(port) && port > 0 ? port : 587,
      secure,
      requireTLS,
      ...(user && pass ? { auth: { user, pass } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 12_000,
    },
  };
}

async function runNodeSmtp(
  message: MailMessage,
  env: Readonly<Record<string, string | undefined>>,
): Promise<SendMailResult> {
  const { from, transportOptions } = buildSmtpConfig(env);
  const transporter = nodemailer.createTransport(transportOptions);
  try {
    const info = await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });
    return {
      delivered: true,
      transport: "smtp",
      messageId: typeof info.messageId === "string" ? info.messageId : undefined,
    };
  } finally {
    transporter.close();
  }
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
  const nodeEnv = env.NODE_ENV ?? process.env.NODE_ENV;

  if (!host) {
    if (nodeEnv === "production") {
      throw new Error("SMTP_HOST is required in production to deliver transactional emails.");
    }
    logInfo("mail.console_preview", {
      to: message.to,
      subject: message.subject,
    });
    if (nodeEnv !== "test") {
      // Development preview only — never logs links in production or test noise.
      console.info(`[mail:preview] To: ${message.to} | Subject: ${message.subject}\n${message.text}`);
    }
    return { delivered: true, transport: "console" };
  }

  try {
    return await runNodeSmtp(message, env);
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
