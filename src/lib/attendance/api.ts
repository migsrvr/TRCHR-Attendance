/**
 * Client-side attendance actions for HR. For now only "ask the intern for a
 * correction" on a held session: it sends the intern a notice with a link to
 * the request form for that day. The route is proposed here and must match.
 */

export type ApiResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface AttendanceApi {
  askForCorrection(sessionId: string): Promise<ApiResult<{ notified: true }>>;
}

const GENERIC = "Couldn't send. Check your connection and try again.";

export function createHttpAttendanceApi(base = "/api/v1"): AttendanceApi {
  return {
    async askForCorrection(sessionId) {
      try {
        const response = await fetch(`${base}/sessions/${encodeURIComponent(sessionId)}/correction-request`, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
        return response.ok ? { ok: true, value: { notified: true } } : { ok: false, message: GENERIC };
      } catch {
        return { ok: false, message: GENERIC };
      }
    },
  };
}

/** Development stand-in. */
export function createMockAttendanceApi(options: { delayMs?: number } = {}): AttendanceApi {
  const { delayMs = 600 } = options;
  return {
    async askForCorrection() {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { ok: true, value: { notified: true } };
    },
  };
}
