/**
 * Development stand-in for the scan routes, so the phone flow can be tested
 * on real iPhones and Android phones before the backend exists. The camera
 * and location calls are still real; only the server is simulated.
 *
 * Accepts the test codes "TR-IN" and "TR-OUT" (shown at /scan/test-codes).
 * Pick an outcome with ?scenario=… on the scan page.
 */

import type { ScanApi, TodaySummary } from "@/lib/scan/api";
import { formatClock } from "@/lib/ui/format";
import { newId } from "@/lib/ui/id";
import type { ScanAction, ScanReceipt } from "@/lib/ui/scan-state";

export const MOCK_SCENARIOS = [
  "ok",
  "outside",
  "accuracy",
  "invalid-qr",
  "expired-qr",
  "timeout",
  "lost",
  "session-expired",
] as const;

export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export function parseMockScenario(value: string | null | undefined): MockScenario {
  return (MOCK_SCENARIOS as readonly string[]).includes(value ?? "") ? (value as MockScenario) : "ok";
}

export interface MockScanApiOptions {
  scenario: MockScenario;
  /** Base latency per call; 0 in tests. */
  delayMs?: number;
  /** Office-local "HH:MM" of an already open session, or null for none. */
  openSince?: string | null;
  timeZone?: string;
}

const RADIUS_METERS = 60;
const MAX_ACCURACY_METERS = 25;

function abortError(): Error {
  return new DOMException("The request was aborted.", "AbortError");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(abortError());
    });
  });
}

/** Never resolves; rejects when aborted (simulates a response lost in transit). */
function hang(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal?.aborted) return reject(abortError());
    signal?.addEventListener("abort", () => reject(abortError()));
  });
}

export function createMockScanApi(options: MockScanApiOptions): ScanApi {
  const { scenario, delayMs = 700, timeZone = "Asia/Manila" } = options;
  let openSince: string | null = options.openSince ?? null;
  let lastSession: { start: string; end?: string } | null = openSince ? { start: openSince } : null;
  const intents = new Map<string, ScanAction>();
  const receipts = new Map<string, ScanReceipt>();

  const checkpointName = (action: ScanAction) => `Main entrance · ${action === "TIME_IN" ? "IN" : "OUT"}`;

  function commit(requestKey: string, action: ScanAction): ScanReceipt {
    const now = new Date();
    const receipt: ScanReceipt = {
      receiptId: newId(),
      action,
      receivedAtUtc: now.toISOString(),
      checkpointName: checkpointName(action),
    };
    receipts.set(requestKey, receipt);
    const clock = formatClock(now, timeZone);
    if (action === "TIME_IN") {
      openSince = clock;
      lastSession = { start: clock };
    } else {
      lastSession = { start: openSince ?? clock, end: clock };
      openSince = null;
    }
    return receipt;
  }

  return {
    async createIntent(qrToken, signal) {
      await sleep(delayMs, signal);
      if (scenario === "session-expired") return { ok: false, failure: { reason: "session-expired" } };

      const match = /^TR-(IN|OUT)$/.exec(qrToken.trim());
      if (!match) return { ok: false, failure: { reason: "invalid-qr" } };
      if (scenario === "invalid-qr") return { ok: false, failure: { reason: "invalid-qr" } };
      if (scenario === "expired-qr") return { ok: false, failure: { reason: "expired-qr" } };

      const action: ScanAction = match[1] === "IN" ? "TIME_IN" : "TIME_OUT";
      if (action === "TIME_IN" && openSince) return { ok: false, failure: { reason: "already-in" } };
      if (action === "TIME_OUT" && !openSince) return { ok: false, failure: { reason: "not-in" } };

      const intentId = newId();
      intents.set(intentId, action);
      return {
        ok: true,
        value: {
          intentId,
          action,
          checkpointName: checkpointName(action),
          expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
        },
      };
    },

    async submitScan(request, signal) {
      const action = intents.get(request.intentId);
      if (!action) return { ok: false, failure: { reason: "not-saved" } };

      // The request reached the server and was saved; only the response is lost.
      if (scenario === "timeout") {
        commit(request.requestKey, action);
        return hang(signal);
      }

      await sleep(delayMs * 1.5, signal);
      switch (scenario) {
        case "outside":
          return {
            ok: false,
            failure: {
              reason: "outside",
              distanceMeters: 412,
              radiusMeters: RADIUS_METERS,
              accuracyMeters: Math.round(request.location.accuracyMeters),
              maxAccuracyMeters: MAX_ACCURACY_METERS,
            },
          };
        case "accuracy":
          return {
            ok: false,
            failure: {
              reason: "accuracy",
              accuracyMeters: Math.max(Math.round(request.location.accuracyMeters), 48),
              maxAccuracyMeters: MAX_ACCURACY_METERS,
            },
          };
        case "lost":
          return hang(signal);
        default:
          return { ok: true, value: commit(request.requestKey, action) };
      }
    },

    async getReceipt(requestKey, signal) {
      await sleep(delayMs, signal);
      return receipts.get(requestKey) ?? null;
    },

    async getTodaySummary(signal): Promise<TodaySummary> {
      await sleep(delayMs / 2, signal);
      const creditedToday = lastSession?.end ? 480 : 0;
      return {
        sessionStart: lastSession?.start,
        sessionEnd: lastSession?.end,
        creditedTodayMinutes: creditedToday,
        creditedTotalMinutes: 18750 + creditedToday,
        requiredMinutes: 29160,
        pendingCorrections: 1,
      };
    },
  };
}
