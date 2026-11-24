/**
 * Office QR credential signer (Technical Design v1.0 section 5).
 *
 * Issues an application-specific HS256 JWS carrying iss, aud, kid, nbf, exp,
 * checkpointId, action, and credentialVersion. Never embeds intern PII.
 */

import { SignJWT } from "jose";

export interface QrCredentialClaims {
  /** Issuer of the credential (office-scoped issuer id). */
  readonly iss: string;
  /** Intended audience (application id). */
  readonly aud: string;
  /** Key id within the QR signing keyring. */
  readonly kid: string;
  /** Checkpoint UUID this credential is bound to. */
  readonly checkpointId: string;
  /** TIME_IN or TIME_OUT. */
  readonly action: "TIME_IN" | "TIME_OUT";
  /** Credential version at issue time; an increment revokes old copies. */
  readonly credentialVersion: number;
}

export interface SignQrCredentialInput extends QrCredentialClaims {
  readonly expiresAtUtc: Date;
  readonly notBeforeUtc?: Date;
}

export interface QrKeyringConfig {
  readonly issuer: string;
  readonly audience: string;
  readonly activeKid: string;
  readonly keyring: Readonly<Record<string, string>>;
}

const MIN_SECRET_LENGTH = 16;

/**
 * Custom application prefix prepended to signed QR tokens so native iOS/Android
 * camera apps and Google Lens treat the poster as an opaque TRCHR credential
 * rather than a clickable web URL.
 */
export const QR_TOKEN_PREFIX = "trchr1.";

export async function signQrCredential(
  input: SignQrCredentialInput,
  signingSecret: string,
): Promise<string> {
  if (!signingSecret || signingSecret.length < MIN_SECRET_LENGTH) {
    throw new Error("QR signing secret must be at least 16 characters");
  }
  if (!input.kid.trim()) {
    throw new Error("QR signing kid is required");
  }
  if (!Number.isInteger(input.credentialVersion) || input.credentialVersion <= 0) {
    throw new Error("credentialVersion must be a positive integer");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const nbfSec = input.notBeforeUtc ? Math.floor(input.notBeforeUtc.getTime() / 1000) : nowSec;
  const expSec = Math.floor(input.expiresAtUtc.getTime() / 1000);

  const jws = await new SignJWT({
    checkpointId: input.checkpointId,
    action: input.action,
    credentialVersion: input.credentialVersion,
  })
    .setProtectedHeader({ alg: "HS256", kid: input.kid, typ: "JWT" })
    .setIssuer(input.iss)
    .setAudience(input.aud)
    .setIssuedAt(nowSec)
    .setNotBefore(nbfSec)
    .setExpirationTime(expSec)
    .sign(new TextEncoder().encode(signingSecret));

  return `${QR_TOKEN_PREFIX}${jws}`;
}

/** Load the server QR keyring and active kid from environment variables. */
export function loadQrKeyringConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): QrKeyringConfig {
  const issuer = env.QR_ISSUER?.trim() || "trchr:office";
  const audience = env.QR_AUDIENCE?.trim() || "trchr:attendance";
  const activeKid = env.QR_ACTIVE_KID?.trim() || "k1";

  const rawJson = env.QR_SIGNING_KEYS_JSON?.trim();
  let keyring: Record<string, string> = {};

  if (rawJson) {
    const parsed: unknown = JSON.parse(rawJson);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("QR_SIGNING_KEYS_JSON must be a JSON object mapping kid to secret");
    }
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.length >= MIN_SECRET_LENGTH) {
        keyring[k] = v;
      }
    }
  } else if (env.QR_SIGNING_KEY_SECRET && env.QR_SIGNING_KEY_SECRET.length >= MIN_SECRET_LENGTH) {
    keyring = { [activeKid]: env.QR_SIGNING_KEY_SECRET };
  }

  if (!keyring[activeKid]) {
    throw new Error(`QR signing key not configured for active kid "${activeKid}"`);
  }

  return { issuer, audience, activeKid, keyring };
}
