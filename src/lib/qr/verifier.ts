/**
 * Office QR credential verifier.
 *
 * SKELETON: signature only. Verify with an explicit HS256 allowlist and a
 * separate signing keyring; validate iss, aud, kid, nbf, exp, checkpoint id,
 * action and credentialVersion. Never accept a token-supplied algorithm or key
 * URL. See Technical Design v1.0 section 5.
 */

import type { QrCredentialClaims } from "@/lib/qr/signer";

export interface VerifyQrCredentialOptions {
  /** Expected issuer. */
  readonly issuer: string;
  /** Expected audience. */
  readonly audience: string;
  /** Keyring keyed by kid. */
  readonly keyring: Readonly<Record<string, string>>;
}

export type VerifiedQrCredential = QrCredentialClaims;

export function verifyQrCredential(
  _token: string,
  _options: VerifyQrCredentialOptions,
): Promise<VerifiedQrCredential> {
  throw new Error("verifyQrCredential is not implemented yet");
}
