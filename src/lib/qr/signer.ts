/**
 * Office QR credential signer.
 *
 * SKELETON: signature only. Issue an application-specific signed token carrying
 * iss, aud, kid, nbf, exp, checkpoint id, action and credentialVersion, signed
 * with HS256 from a separate keyring. Never let the token select its algorithm.
 * See Technical Design v1.0 section 5.
 */

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
}

export function signQrCredential(
  _input: SignQrCredentialInput,
  _signingSecret: string,
): Promise<string> {
  throw new Error("signQrCredential is not implemented yet");
}
