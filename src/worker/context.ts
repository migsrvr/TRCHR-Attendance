/**
 * PII-minimized context builder and deterministic input fingerprinting for
 * TypeSafe Jev advisory assessments (Technical Design v1.0 section 9).
 *
 * Strips emails, phone numbers, GPS coordinate pairs, and UUIDs before
 * sending correction prose outside the application boundary. Never includes
 * intern names, emails, precise GPS, passwords, QR tokens, or full history.
 */

import type { CorrectionReasonCategory } from "@prisma/client";

import { canonicalPayloadHash } from "@/lib/http/guard";

export const JEV_MODEL_VERSION = process.env.JEV_MODEL_VERSION?.trim() || "jev-1.13.0";
export const JEV_CRITERIA_VERSION = process.env.JEV_CRITERIA_VERSION?.trim() || "2026-10-v1";

export interface JevDeterministicFacts {
  readonly hasExistingSession: boolean;
  readonly hasRecordedTimeIn: boolean;
  readonly hasRecordedTimeOut: boolean;
  readonly proposesTimeIn: boolean;
  readonly proposesTimeOut: boolean;
}

export interface JevContextInput {
  readonly requestVersion: number;
  readonly reasonCategory: CorrectionReasonCategory;
  readonly explanation: string;
  readonly comments: readonly { readonly role: "INTERN" | "HR"; readonly message: string }[];
  readonly facts: JevDeterministicFacts;
}

export interface MinimizedJevContext {
  readonly inputFingerprint: string;
  readonly inputSnapshot: {
    readonly requestVersion: number;
    readonly reasonCategory: CorrectionReasonCategory;
    readonly explanation: string;
    readonly comments: readonly { readonly role: "INTERN" | "HR"; readonly message: string }[];
    readonly facts: JevDeterministicFacts;
  };
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d[\d\s()-]{7,16}\d)/g;
const COORDS_RE = /-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function minimizeFreeText(text: string, maxChars = 600): string {
  return text
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(COORDS_RE, "[COORDS]")
    .replace(UUID_RE, "[ID]")
    .replace(PHONE_RE, "[PHONE]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

export function buildMinimizedJevContext(input: JevContextInput): MinimizedJevContext {
  const inputSnapshot = {
    requestVersion: input.requestVersion,
    reasonCategory: input.reasonCategory,
    explanation: minimizeFreeText(input.explanation, 600),
    comments: input.comments.slice(-6).map((c) => ({
      role: c.role,
      message: minimizeFreeText(c.message, 400),
    })),
    facts: { ...input.facts },
  };

  return {
    inputFingerprint: canonicalPayloadHash(inputSnapshot),
    inputSnapshot,
  };
}
