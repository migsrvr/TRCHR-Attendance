/**
 * Client-side scan API (Technical Design sections 6, 10 and 11).
 *
 * The scan screen talks to this interface only. `createHttpScanApi` calls the
 * versioned routes; `createMockScanApi` (mock-api.ts) stands in during
 * development until those routes exist.
 *
 * Network errors and aborts are thrown, not returned: the screen needs to
 * tell "the server said no" (a result) apart from "we never heard back"
 * (an exception), because only the second can mean the scan was saved anyway.
 */

import type { FailReason, FailureDetail, LocationFix, ScanIntent, ScanReceipt } from "@/lib/ui/scan-state";

export type ScanResult<T> = { ok: true; value: T } | { ok: false; failure: FailureDetail };

export interface SubmitScanRequest {
  intentId: string;
  requestKey: string;
  location: LocationFix;
}

export interface TodaySummary {
  /** Office-local "HH:MM" of the session the last scan touched. */
  sessionStart?: string;
  sessionEnd?: string;
  creditedTodayMinutes: number;
  creditedTotalMinutes: number;
  requiredMinutes: number;
  pendingCorrections: number;
}

export interface ScanApi {
  createIntent(qrToken: string, signal?: AbortSignal): Promise<ScanResult<ScanIntent>>;
  submitScan(request: SubmitScanRequest, signal?: AbortSignal): Promise<ScanResult<ScanReceipt>>;
  /** The committed outcome for a request key, or null if nothing was committed. */
  getReceipt(requestKey: string, signal?: AbortSignal): Promise<ScanReceipt | null>;
  getTodaySummary(signal?: AbortSignal): Promise<TodaySummary>;
}

/**
 * Error codes the scan routes are expected to return in
 * `{ error: { code, message, retryable, correlationId, details? } }`.
 * Proposed here; the routes must use the same strings.
 */
const CODE_TO_REASON: Record<string, FailReason> = {
  QR_INVALID: "invalid-qr",
  QR_EXPIRED: "expired-qr",
  QR_REVOKED: "expired-qr",
  OUTSIDE_GEOFENCE: "outside",
  LOCATION_UNCERTAIN: "accuracy",
  ACCURACY_TOO_LOW: "accuracy",
  ALREADY_TIMED_IN: "already-in",
  NO_OPEN_SESSION: "not-in",
  UNAUTHENTICATED: "session-expired",
};

const DETAIL_KEYS = ["distanceMeters", "radiusMeters", "accuracyMeters", "maxAccuracyMeters"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** Turn an error response into a failure the screen can explain. */
export function mapScanError(status: number, body: unknown): FailureDetail {
  const error = asRecord(asRecord(body)?.error);
  const code = typeof error?.code === "string" ? error.code : undefined;
  const reason: FailReason =
    (code ? CODE_TO_REASON[code] : undefined) ??
    (status === 401 ? "session-expired" : status === 422 ? "accuracy" : status === 409 ? "not-saved" : "server");

  const failure: FailureDetail = { reason };
  const details = asRecord(error?.details);
  for (const key of DETAIL_KEYS) {
    const value = details?.[key];
    if (typeof value === "number" && Number.isFinite(value)) failure[key] = value;
  }
  return failure;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Calls the /api/v1 scan routes with same-origin cookies. */
export function createHttpScanApi(base = "/api/v1"): ScanApi {
  const post = (path: string, body: unknown, signal?: AbortSignal) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
      signal,
    });

  return {
    async createIntent(qrToken, signal) {
      const response = await post("/scan-intents", { qrToken }, signal);
      const body = await readJson(response);
      return response.ok
        ? { ok: true, value: body as ScanIntent }
        : { ok: false, failure: mapScanError(response.status, body) };
    },

    async submitScan(request, signal) {
      const response = await post("/attendance/scans", request, signal);
      const body = await readJson(response);
      return response.ok
        ? { ok: true, value: body as ScanReceipt }
        : { ok: false, failure: mapScanError(response.status, body) };
    },

    async getReceipt(requestKey, signal) {
      const response = await fetch(`${base}/attendance/receipts/${encodeURIComponent(requestKey)}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      if (response.status === 404) return null;
      const body = asRecord(await readJson(response));
      if (!response.ok || !body) throw new Error(`Receipt lookup failed (${response.status})`);
      return Number(body.httpStatus) < 300 ? (body.result as ScanReceipt) : null;
    },

    async getTodaySummary(signal) {
      const response = await fetch(`${base}/me/summary`, { credentials: "same-origin", cache: "no-store", signal });
      if (!response.ok) throw new Error(`Summary failed (${response.status})`);
      return (await response.json()) as TodaySummary;
    },
  };
}
