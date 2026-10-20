/**
 * Attendance module.
 *
 * SKELETON: scan intent creation and the atomic scan protocol (receipt
 * reservation, internship/session locking, version checks, location rule).
 * Signature-level only. See Technical Design v1.0 section 6.
 */

import type { LatLng } from "@/lib/geo/distance";

export interface CreateScanIntentInput {
  readonly actorId: string;
  readonly qrToken: string;
}

export interface CreateScanIntentResult {
  readonly intentId: string;
  readonly action: "TIME_IN" | "TIME_OUT";
  readonly expiresAtUtc: Date;
}

export function createScanIntent(
  _input: CreateScanIntentInput,
): Promise<CreateScanIntentResult> {
  throw new Error("createScanIntent is not implemented yet");
}

export interface SubmitScanInput {
  readonly actorId: string;
  readonly intentId: string;
  readonly requestKey: string;
  readonly location: LatLng & {
    readonly accuracyMeters: number;
    readonly capturedAtUtc: Date;
  };
}

export interface SubmitScanResult {
  readonly receiptId: string;
  readonly decision: "ACCEPTED" | "REJECTED";
  readonly action: "TIME_IN" | "TIME_OUT";
  readonly sessionId: string | null;
  readonly receivedAtUtc: Date;
  readonly sessionVersion: number | null;
  readonly attendanceVersion: number;
}

export function submitScan(_input: SubmitScanInput): Promise<SubmitScanResult> {
  throw new Error("submitScan is not implemented yet");
}

export function getScanReceipt(
  _actorId: string,
  _requestKey: string,
): Promise<SubmitScanResult | null> {
  throw new Error("getScanReceipt is not implemented yet");
}
