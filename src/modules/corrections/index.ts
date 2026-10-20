/**
 * Corrections module.
 *
 * SKELETON: immutable correction proposals, versioned HR decisions, revisions,
 * and the review-job enqueue. Signature-level only. Every mutation records an
 * audit event and uses an operation key/expected version for retry safety.
 * See Technical Design v1.0 section 8.
 */

export interface CreateCorrectionInput {
  readonly internshipId: string;
  readonly sessionId?: string;
  readonly attendanceDate: string;
  readonly proposedTimeInUtc?: Date;
  readonly proposedTimeOutUtc?: Date;
  readonly reason: string;
  readonly clientRequestId: string;
}

export interface CreateCorrectionResult {
  readonly correctionRequestId: string;
  readonly requestVersion: number;
  readonly status: "PENDING";
}

export function createCorrection(
  _input: CreateCorrectionInput,
): Promise<CreateCorrectionResult> {
  throw new Error("createCorrection is not implemented yet");
}

export interface DecideCorrectionInput {
  readonly correctionRequestId: string;
  readonly reviewerUserId: string;
  readonly operationKey: string;
  readonly decision: "APPROVE" | "REJECT" | "NEEDS_INFO";
  readonly note?: string;
  readonly expectedRequestVersion: number;
  readonly expectedSessionVersion?: number;
  readonly expectedAttendanceVersion?: number;
}

export interface DecideCorrectionResult {
  readonly reviewId: string;
  readonly status: "APPROVED" | "REJECTED" | "NEEDS_INFO";
}

export function decideCorrection(
  _input: DecideCorrectionInput,
): Promise<DecideCorrectionResult> {
  throw new Error("decideCorrection is not implemented yet");
}
