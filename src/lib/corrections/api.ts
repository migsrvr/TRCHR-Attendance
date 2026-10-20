/**
 * Client-side corrections API (Technical Design sections 8 and 10).
 *
 * Proposed times are sent as office-local "HH:MM" with the office-local
 * date; the server converts them to UTC with the office time zone and checks
 * them against the intern's recorded attendance. `clientRequestId` makes a
 * resend after a dropped connection return the same request.
 */

import type { CorrectionReason } from "@/lib/ui/correction-form";
import { newId } from "@/lib/ui/id";

export interface CreateCorrectionRequest {
  clientRequestId: string;
  attendanceDate: string;
  reason: CorrectionReason;
  explanation: string;
  proposedTimeIn?: string;
  proposedTimeOut?: string;
}

export interface CreatedCorrection {
  id: string;
  status: "PENDING";
}

export interface PostedComment {
  id: string;
  createdAtUtc: string;
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface CorrectionsApi {
  create(request: CreateCorrectionRequest, signal?: AbortSignal): Promise<ApiResult<CreatedCorrection>>;
  reply(correctionId: string, message: string, signal?: AbortSignal): Promise<ApiResult<PostedComment>>;
}

const GENERIC = "Couldn't send. Check your connection and try again.";

/** Error codes the corrections routes are expected to return; proposed here, the routes must match. */
const MESSAGES: Record<string, string> = {
  OPEN_REQUEST_EXISTS: "You already have an open request for this day. Add details to it instead.",
  REQUEST_FINALIZED: "HR has already decided this request, so it can't take replies.",
  INTERVAL_INVALID: "Those times don't work for that day. Check Time in and Time out.",
  DATE_OUT_OF_RANGE: "Pick a day within your internship.",
  UNAUTHENTICATED: "You've been signed out. Sign in again, then send it again.",
};

export function correctionErrorMessage(status: number, body: unknown): string {
  const error =
    typeof body === "object" && body !== null ? (body as { error?: { code?: unknown } }).error : undefined;
  const code = typeof error?.code === "string" ? error.code : undefined;
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (status === 401) return MESSAGES.UNAUTHENTICATED!;
  return GENERIC;
}

async function send<T>(url: string, body: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
      signal,
    });
    const json: unknown = await response.json().catch(() => null);
    return response.ok
      ? { ok: true, value: json as T }
      : { ok: false, message: correctionErrorMessage(response.status, json) };
  } catch {
    return { ok: false, message: GENERIC };
  }
}

export function createHttpCorrectionsApi(base = "/api/v1"): CorrectionsApi {
  return {
    create: (request, signal) => send<CreatedCorrection>(`${base}/corrections`, request, signal),
    reply: (correctionId, message, signal) =>
      send<PostedComment>(`${base}/corrections/${encodeURIComponent(correctionId)}/comments`, { message }, signal),
  };
}

/** Development stand-in until the corrections routes exist. */
export function createMockCorrectionsApi(options: { delayMs?: number; fail?: boolean } = {}): CorrectionsApi {
  const { delayMs = 700, fail = false } = options;
  const created = new Map<string, CreatedCorrection>();
  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));

  return {
    async create(request) {
      await wait();
      if (fail) return { ok: false, message: GENERIC };
      const existing = created.get(request.clientRequestId);
      if (existing) return { ok: true, value: existing };
      const value: CreatedCorrection = { id: newId(), status: "PENDING" };
      created.set(request.clientRequestId, value);
      return { ok: true, value };
    },
    async reply() {
      await wait();
      if (fail) return { ok: false, message: GENERIC };
      return { ok: true, value: { id: newId(), createdAtUtc: new Date().toISOString() } };
    },
  };
}
