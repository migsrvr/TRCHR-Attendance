/**
 * Client-side accounts API for HR (harmonized under /api/v1/hr/interns/*).
 */

import { newId } from "@/lib/ui/id";

export interface CreateInternRequest {
  clientRequestId: string;
  name: string;
  email: string;
  departmentId?: string;
  department: string;
  requiredMinutes: number;
  startDate: string;
  endDate: string | null;
}

export interface UpdateInternRequest {
  expectedAttendanceVersion?: number;
  departmentId?: string;
  requiredMinutes?: number;
  endDate?: string | null;
  status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface AccountsApi {
  createIntern(request: CreateInternRequest): Promise<ApiResult<{ id: string }>>;
  updateIntern(internId: string, request: UpdateInternRequest): Promise<ApiResult<{ internshipId: string; attendanceVersion: number }>>;
  resendSetupLink(internId: string): Promise<ApiResult<{ sentAtUtc: string }>>;
  signOutEverywhere(internId: string): Promise<ApiResult<{ sessionsEnded: number }>>;
  setDisabled(internId: string, disabled: boolean): Promise<ApiResult<{ status: "ACTIVE" | "DISABLED" }>>;
}

const GENERIC = "Couldn't save. Check your connection and try again.";

const MESSAGES: Record<string, string> = {
  EMAIL_TAKEN: "That email already has an account. Search the directory for it instead.",
  DEPARTMENT_INACTIVE: "That department is turned off. Choose another or reactivate it in Departments.",
  STALE_VERSION: "This intern's record changed. Refresh the page and try again.",
  FORBIDDEN: "Only HR can do this. Sign in with an HR account.",
  UNAUTHENTICATED: "You've been signed out. Sign in again, then try again.",
};

export function accountErrorMessage(status: number, body: unknown): string {
  const error =
    typeof body === "object" && body !== null ? (body as { error?: { code?: unknown } }).error : undefined;
  const code = typeof error?.code === "string" ? error.code : undefined;
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (status === 401) return MESSAGES.UNAUTHENTICATED!;
  if (status === 403) return MESSAGES.FORBIDDEN!;
  return GENERIC;
}

async function send<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const json: unknown = await response.json().catch(() => null);
    return response.ok ? { ok: true, value: json as T } : { ok: false, message: accountErrorMessage(response.status, json) };
  } catch {
    return { ok: false, message: GENERIC };
  }
}

export function createHttpAccountsApi(base = "/api/v1/hr"): AccountsApi {
  const intern = (id: string) => `${base}/interns/${encodeURIComponent(id)}`;
  return {
    createIntern: (request) => send(`${base}/interns`, request, "POST"),
    updateIntern: (id, request) => send(intern(id), request, "PATCH"),
    resendSetupLink: (id) => send(`${intern(id)}/setup-link`, {}, "POST"),
    signOutEverywhere: (id) => send(`${intern(id)}/sessions/revoke`, {}, "POST"),
    setDisabled: (id, disabled) => send(`${intern(id)}/status`, { status: disabled ? "DISABLED" : "ACTIVE" }, "POST"),
  };
}

/** Development stand-in. An email starting with "taken" is refused as already registered. */
export function createMockAccountsApi(options: { delayMs?: number } = {}): AccountsApi {
  const { delayMs = 600 } = options;
  const created = new Map<string, { id: string }>();
  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));

  return {
    async createIntern(request) {
      await wait();
      if (request.email.trim().toLowerCase().startsWith("taken")) {
        return { ok: false, message: accountErrorMessage(409, { error: { code: "EMAIL_TAKEN" } }) };
      }
      const value = created.get(request.clientRequestId) ?? { id: newId() };
      created.set(request.clientRequestId, value);
      return { ok: true, value };
    },
    async updateIntern(_id, request) {
      await wait();
      return { ok: true, value: { internshipId: newId(), attendanceVersion: (request.expectedAttendanceVersion ?? 1) + 1 } };
    },
    async resendSetupLink() {
      await wait();
      return { ok: true, value: { sentAtUtc: new Date().toISOString() } };
    },
    async signOutEverywhere() {
      await wait();
      return { ok: true, value: { sessionsEnded: 2 } };
    },
    async setDisabled(_id, disabled) {
      await wait();
      return { ok: true, value: { status: disabled ? "DISABLED" : "ACTIVE" } };
    },
  };
}
