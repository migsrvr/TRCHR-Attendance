/**
 * Request boundary helpers: correlation IDs, same-origin CSRF checks,
 * bounded strict JSON parsing, canonical payload hashing, and PG retry helpers.
 */

import { createHash, randomUUID } from "node:crypto";

import type { z } from "zod";

import { AppError } from "@/lib/http/errors";

const DEFAULT_MAX_BODY_BYTES = 32 * 1024;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function getCorrelationId(request: Request): string {
  const incoming = request.headers.get("x-correlation-id")?.trim();
  if (incoming && /^[a-zA-Z0-9._-]{8,64}$/.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}

function originOf(urlValue: string | null | undefined): string | null {
  if (!urlValue) return null;
  try {
    return new URL(urlValue).origin;
  } catch {
    return null;
  }
}

/**
 * Reject cross-origin mutating requests to protect cookie-authenticated routes
 * (Technical Design v1.0 section 10).
 */
export function assertSameOrigin(request: Request, configuredOrigin?: string): void {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return;

  const expectedOrigins = new Set<string>();
  for (const candidate of [
    configuredOrigin,
    process.env.APP_ORIGIN,
    process.env.BETTER_AUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    request.url,
  ]) {
    const parsed = originOf(candidate);
    if (parsed) expectedOrigins.add(parsed);
  }

  const host = request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https:") ? "https" : "http");
    const hostOrigin = originOf(`${proto}://${host}`);
    if (hostOrigin) expectedOrigins.add(hostOrigin);
  }

  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const sourceOrigin = originOf(originHeader) ?? originOf(refererHeader);

  // If browser supplied an Origin or Referer, it MUST match one of our trusted origins.
  if (originHeader || refererHeader) {
    if (!sourceOrigin || !expectedOrigins.has(sourceOrigin)) {
      throw new AppError(403, "CSRF_ORIGIN_MISMATCH", "Cross-origin request rejected.", false);
    }
    return;
  }

  // In production, browsers always send Origin on same-origin fetch POSTs.
  if (process.env.NODE_ENV === "production") {
    throw new AppError(403, "CSRF_ORIGIN_MISSING", "Missing request origin.", false);
  }
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = DEFAULT_MAX_BODY_BYTES,
): Promise<T> {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declared = Number(contentLengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request payload exceeds the maximum allowed size.", false);
    }
  }

  const rawText = await request.text();
  if (Buffer.byteLength(rawText, "utf8") > maxBytes) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request payload exceeds the maximum allowed size.", false);
  }

  let parsed: unknown;
  try {
    parsed = rawText.trim().length === 0 ? {} : JSON.parse(rawText);
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON.", false);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid request body.", false, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return result.data;
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const val = record[key];
    if (val !== undefined) {
      sorted[key] = canonicalize(val);
    }
  }
  return sorted;
}

/** Stable SHA-256 hex digest over canonical key-sorted JSON. */
export function canonicalPayloadHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

/** Check whether an unknown Prisma/Postgres error matches a specific SQLSTATE or Prisma code. */
export function getDbErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const err = error as { code?: unknown; meta?: { code?: unknown } };
  if (typeof err.meta?.code === "string") return err.meta.code;
  if (typeof err.code === "string") return err.code;
  return null;
}

/**
 * Bounded retry loop for transient PostgreSQL serialization/deadlock errors
 * (SQLSTATE 40001, 40P01, Prisma P2034).
 */
export async function withTransientDbRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      const code = getDbErrorCode(error);
      const retryable = code === "40001" || code === "40P01" || code === "P2034";
      if (!retryable || attempt >= maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
    }
  }
}
