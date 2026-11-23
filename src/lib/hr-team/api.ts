/**
 * Client-side HR team management API (/api/v1/hr/users/*).
 */

import { newId } from "@/lib/ui/id";

export interface InviteHrUserRequest {
  clientRequestId: string;
  name: string;
  email: string;
}

export interface InvitedHrUser {
  id: string;
  name: string;
  email: string;
  status: "PENDING";
  setupLinkSentIso: string;
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface HrTeamApi {
  inviteHrUser(input: InviteHrUserRequest): Promise<ApiResult<InvitedHrUser>>;
  resendSetupLink(userId: string): Promise<ApiResult<{ sentAtUtc: string }>>;
  signOutEverywhere(userId: string): Promise<ApiResult<{ sessionsEnded: number }>>;
  setDisabled(userId: string, disabled: boolean): Promise<ApiResult<{ status: "ACTIVE" | "DISABLED" }>>;
}

const GENERIC = "Couldn't save. Check your connection and try again.";

const MESSAGES: Record<string, string> = {
  EMAIL_TAKEN: "That email already has an account.",
  CANNOT_DISABLE_SELF: "You can't disable your own HR account.",
  LAST_ACTIVE_HR: "At least one active HR account must remain.",
  ACCOUNT_DISABLED: "Reactivate this HR account before sending a setup link.",
  FORBIDDEN: "Only HR can manage team accounts. Sign in with an HR account.",
  UNAUTHENTICATED: "You've been signed out. Sign in again, then try again.",
};

export function hrTeamErrorMessage(status: number, body: unknown): string {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  if (typeof code === "string" && MESSAGES[code]) return MESSAGES[code];
  if (status === 401) return MESSAGES.UNAUTHENTICATED!;
  if (status === 403) return MESSAGES.FORBIDDEN!;
  return GENERIC;
}

async function send<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const json: unknown = await response.json().catch(() => null);
    return response.ok ? { ok: true, value: json as T } : { ok: false, message: hrTeamErrorMessage(response.status, json) };
  } catch {
    return { ok: false, message: GENERIC };
  }
}

export function createHttpHrTeamApi(base = "/api/v1/hr"): HrTeamApi {
  const user = (id: string) => `${base}/users/${encodeURIComponent(id)}`;
  return {
    inviteHrUser: (input) => send(`${base}/users`, input),
    resendSetupLink: (id) => send(`${user(id)}/setup-link`, {}),
    signOutEverywhere: (id) => send(`${user(id)}/sessions/revoke`, {}),
    setDisabled: (id, disabled) => send(`${user(id)}/status`, { status: disabled ? "DISABLED" : "ACTIVE" }),
  };
}

/** Development stand-in when fixture mode is active. */
export function createMockHrTeamApi(
  options: { delayMs?: number; existingEmails?: string[]; currentUserId?: string } = {},
): HrTeamApi {
  const { delayMs = 350, currentUserId = "hr-admin-1" } = options;
  const emails = new Set((options.existingEmails ?? []).map((email) => email.trim().toLowerCase()));
  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));

  return {
    async inviteHrUser(input) {
      await wait();
      const normalized = input.email.trim().toLowerCase();
      if (emails.has(normalized) || normalized.startsWith("taken")) {
        return { ok: false, message: hrTeamErrorMessage(409, { error: { code: "EMAIL_TAKEN" } }) };
      }
      emails.add(normalized);
      return {
        ok: true,
        value: {
          id: `hr-${newId().slice(0, 8)}`,
          name: input.name.trim(),
          email: normalized,
          status: "PENDING",
          setupLinkSentIso: new Date().toISOString().slice(0, 10),
        },
      };
    },
    async resendSetupLink() {
      await wait();
      return { ok: true, value: { sentAtUtc: new Date().toISOString() } };
    },
    async signOutEverywhere() {
      await wait();
      return { ok: true, value: { sessionsEnded: 1 } };
    },
    async setDisabled(id, disabled) {
      await wait();
      if (disabled && id === currentUserId) {
        return { ok: false, message: hrTeamErrorMessage(409, { error: { code: "CANNOT_DISABLE_SELF" } }) };
      }
      return { ok: true, value: { status: disabled ? "DISABLED" : "ACTIVE" } };
    },
  };
}
