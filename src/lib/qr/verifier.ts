/**
 * Office QR credential verifier (Technical Design v1.0 section 5).
 *
 * Verifies tokens using an explicit HS256 allowlist and a server-owned keyring
 * keyed by kid. Never accepts token-selected algorithms or remote key URLs
 * (jku, jwk, x5u, x5c).
 */

import { decodeProtectedHeader, errors, jwtVerify } from "jose";
import { z } from "zod";

import type { QrCredentialClaims } from "@/lib/qr/signer";

export type QrErrorCode = "QR_INVALID" | "QR_EXPIRED" | "QR_REVOKED";

export class QrVerificationError extends Error {
  constructor(
    readonly code: QrErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "QrVerificationError";
  }
}

export interface VerifyQrCredentialOptions {
  /** Expected issuer. */
  readonly issuer: string;
  /** Expected audience. */
  readonly audience: string;
  /** Keyring keyed by kid. */
  readonly keyring: Readonly<Record<string, string>>;
  /** Optional clock override for deterministic tests. */
  readonly currentDate?: Date;
}

export interface VerifiedQrCredential extends QrCredentialClaims {
  readonly expiresAtUtc: Date;
}

const payloadSchema = z.object({
  checkpointId: z.string().uuid(),
  action: z.enum(["TIME_IN", "TIME_OUT"]),
  credentialVersion: z.number().int().positive(),
  exp: z.number().int().positive(),
});

const FORBIDDEN_HEADER_KEYS = ["jku", "jwk", "x5u", "x5c", "crit"] as const;

export async function verifyQrCredential(
  token: string,
  options: VerifyQrCredentialOptions,
): Promise<VerifiedQrCredential> {
  if (!token || typeof token !== "string") {
    throw new QrVerificationError("QR_INVALID", "QR credential token is empty");
  }

  let header: Record<string, unknown>;
  try {
    header = decodeProtectedHeader(token) as Record<string, unknown>;
  } catch {
    throw new QrVerificationError("QR_INVALID", "Malformed QR credential header");
  }

  for (const forbidden of FORBIDDEN_HEADER_KEYS) {
    if (forbidden in header) {
      throw new QrVerificationError("QR_INVALID", `Forbidden header parameter: ${forbidden}`);
    }
  }

  if (header.alg !== "HS256") {
    throw new QrVerificationError("QR_INVALID", "Unsupported QR credential algorithm");
  }

  const kid = typeof header.kid === "string" ? header.kid.trim() : "";
  if (!kid) {
    throw new QrVerificationError("QR_INVALID", "Missing QR signing key id");
  }

  const secret = options.keyring[kid];
  if (!secret) {
    throw new QrVerificationError("QR_REVOKED", "QR signing key is no longer active");
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      issuer: options.issuer,
      audience: options.audience,
      currentDate: options.currentDate,
    });

    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new QrVerificationError("QR_INVALID", "QR credential claims failed validation");
    }

    return {
      iss: options.issuer,
      aud: options.audience,
      kid,
      checkpointId: parsed.data.checkpointId,
      action: parsed.data.action,
      credentialVersion: parsed.data.credentialVersion,
      expiresAtUtc: new Date(parsed.data.exp * 1000),
    };
  } catch (error) {
    if (error instanceof QrVerificationError) throw error;
    if (error instanceof errors.JWTExpired) {
      throw new QrVerificationError("QR_EXPIRED", "This QR code has expired");
    }
    throw new QrVerificationError("QR_INVALID", "QR credential signature or claims invalid");
  }
}
