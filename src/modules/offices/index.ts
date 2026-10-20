/**
 * Offices module.
 *
 * SKELETON: office configuration, versioned policy publication, and checkpoint
 * credential rotation. Signature-level only. See Technical Design v1.0
 * sections 5 and 10.
 */

export interface PublishPolicyVersionInput {
  readonly officeId: string;
  readonly scheduleRules: unknown;
  readonly breakRules: unknown;
  readonly creditRules: unknown;
  readonly effectiveFromUtc: Date;
}

export interface PublishPolicyVersionResult {
  readonly policyVersionId: string;
  readonly version: number;
}

export function publishPolicyVersion(
  _input: PublishPolicyVersionInput,
): Promise<PublishPolicyVersionResult> {
  throw new Error("publishPolicyVersion is not implemented yet");
}

export interface RotateCheckpointInput {
  readonly checkpointId: string;
  readonly expiresAtUtc: Date;
}

export interface RotateCheckpointResult {
  readonly checkpointId: string;
  readonly credentialVersion: number;
  readonly qrToken: string;
}

export function rotateCheckpointCredential(
  _input: RotateCheckpointInput,
): Promise<RotateCheckpointResult> {
  throw new Error("rotateCheckpointCredential is not implemented yet");
}
