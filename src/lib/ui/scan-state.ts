/**
 * Scan screen state machine (spec section 7, Technical Design section 6).
 *
 * Pure reducer: no I/O. The scan screen dispatches events as the camera,
 * the scan-intent call, the location fix and the save call resolve.
 *
 * Invariants:
 * - "saved" is reachable only from the saving step, i.e. only with a receipt
 *   the server committed. A timeout while saving never looks like success.
 * - A lost response lands on "unconfirmed", which can only re-check the same
 *   request key; it cannot be reset into a new scan.
 */

export type ScanAction = "TIME_IN" | "TIME_OUT";
export type CheckingStep = "intent" | "location" | "saving";

export type BlockReason =
  | "insecure"
  | "no-camera"
  | "camera-denied"
  | "camera-busy"
  | "camera-failed"
  | "location-denied";

export type FailReason =
  | "invalid-qr"
  | "expired-qr"
  | "outside"
  | "accuracy"
  | "photo-invalid"
  | "already-in"
  | "not-in"
  | "session-expired"
  | "network"
  | "location-timeout"
  | "location-unavailable"
  | "not-saved"
  | "server";

export interface PhotoCaptureFrame {
  dataUrl: string;
  sha256: string;
  capturedAtUtc: string;
  facingMode: "environment" | "user";
  width: number;
  height: number;
  frameVariance: number;
}

export interface ScanPhotoEvidence {
  wallPoster?: PhotoCaptureFrame;
  selfie: PhotoCaptureFrame;
}

export interface ScanIntent {
  intentId: string;
  action: ScanAction;
  checkpointName: string;
  expiresAtUtc: string;
}

export interface LocationFix {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAtUtc: string;
}

export interface ScanReceipt {
  receiptId: string;
  action: ScanAction;
  receivedAtUtc: string;
  checkpointName: string;
}

export interface FailureDetail {
  reason: FailReason;
  distanceMeters?: number;
  radiusMeters?: number;
  accuracyMeters?: number;
  maxAccuracyMeters?: number;
}

export type ScanState =
  | { status: "starting"; expected: ScanAction }
  | { status: "ready"; expected: ScanAction }
  | {
      status: "checking";
      expected: ScanAction;
      step: CheckingStep;
      token: string;
      requestKey: string;
      intent?: ScanIntent;
      location?: LocationFix;
      /** True when re-checking a lost response: look up the receipt, don't resend. */
      rechecking: boolean;
    }
  | { status: "saved"; expected: ScanAction; receipt: ScanReceipt }
  | { status: "failed"; expected: ScanAction; failure: FailureDetail; attempted: ScanAction }
  | {
      status: "unconfirmed";
      expected: ScanAction;
      token: string;
      requestKey: string;
      intent: ScanIntent;
      location: LocationFix;
    }
  | { status: "blocked"; expected: ScanAction; reason: BlockReason };

export type ScanEvent =
  | { type: "camera-ready" }
  | { type: "camera-error"; reason: BlockReason }
  | { type: "retry-camera" }
  | { type: "decoded"; token: string; requestKey: string }
  | { type: "intent-ok"; intent: ScanIntent }
  | { type: "location-ok"; location: LocationFix }
  | { type: "location-denied" }
  | { type: "saved"; receipt: ScanReceipt }
  | { type: "failed"; failure: FailureDetail }
  | { type: "timeout" }
  | { type: "recheck" }
  | { type: "reset" };

export function initialScanState(expected: ScanAction): ScanState {
  return { status: "starting", expected };
}

const opposite = (action: ScanAction): ScanAction => (action === "TIME_IN" ? "TIME_OUT" : "TIME_IN");

export function scanReducer(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case "camera-ready":
      return state.status === "starting" ? { status: "ready", expected: state.expected } : state;

    case "camera-error":
      return state.status === "starting" || state.status === "ready"
        ? { status: "blocked", expected: state.expected, reason: event.reason }
        : state;

    case "retry-camera":
      return state.status === "blocked" ? initialScanState(state.expected) : state;

    case "decoded":
      return state.status === "ready"
        ? {
            status: "checking",
            expected: state.expected,
            step: "intent",
            token: event.token,
            requestKey: event.requestKey,
            rechecking: false,
          }
        : state;

    case "intent-ok":
      return state.status === "checking" && state.step === "intent"
        ? { ...state, step: "location", intent: event.intent }
        : state;

    case "location-ok":
      return state.status === "checking" && state.step === "location"
        ? { ...state, step: "saving", location: event.location }
        : state;

    case "location-denied":
      return state.status === "checking"
        ? { status: "blocked", expected: state.expected, reason: "location-denied" }
        : state;

    case "saved":
      return state.status === "checking" && state.step === "saving"
        ? { status: "saved", expected: state.expected, receipt: event.receipt }
        : state;

    case "failed":
      return state.status === "checking"
        ? {
            status: "failed",
            expected: state.expected,
            failure: event.failure,
            attempted: state.intent?.action ?? state.expected,
          }
        : state;

    case "timeout":
      if (state.status !== "checking") return state;
      if (state.step === "saving" && state.intent && state.location) {
        return {
          status: "unconfirmed",
          expected: state.expected,
          token: state.token,
          requestKey: state.requestKey,
          intent: state.intent,
          location: state.location,
        };
      }
      return {
        status: "failed",
        expected: state.expected,
        failure: { reason: "network" },
        attempted: state.intent?.action ?? state.expected,
      };

    case "recheck":
      return state.status === "unconfirmed"
        ? {
            status: "checking",
            expected: state.expected,
            step: "saving",
            token: state.token,
            requestKey: state.requestKey,
            intent: state.intent,
            location: state.location,
            rechecking: true,
          }
        : state;

    case "reset":
      if (state.status === "saved") return initialScanState(opposite(state.receipt.action));
      if (state.status === "failed" || state.status === "blocked") return initialScanState(state.expected);
      return state;

    default: {
      const unhandled: never = event;
      throw new Error(`Unhandled scan event: ${JSON.stringify(unhandled)}`);
    }
  }
}
