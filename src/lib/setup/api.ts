/**
 * Client-side Setup actions for HR: office settings, QR rotation, policy
 * drafts, departments. Routes and error codes are proposed here; the server
 * must match. Every change is written to the audit log server-side.
 */

import type { PolicyRules } from "@/lib/ui/policy";

export type ApiResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface SetupApi {
  saveOffice(input: { radiusM: number; maxAccuracyM: number }): Promise<ApiResult<{ settingsVersion: number }>>;
  rotateCheckpoint(checkpointId: string): Promise<ApiResult<{ codeVersion: number }>>;
  savePolicyDraft(input: { version: number; fromIso: string; rules: PolicyRules }): Promise<ApiResult<{ savedAt: string }>>;
  publishPolicy(version: number): Promise<ApiResult<{ version: number }>>;
  addDepartment(name: string): Promise<ApiResult<{ id: string }>>;
  renameDepartment(id: string, name: string): Promise<ApiResult<{ id: string }>>;
  setDepartmentActive(id: string, active: boolean): Promise<ApiResult<{ active: boolean }>>;
}

const GENERIC = "Couldn't save. Check your connection and try again.";

const MESSAGES: Record<string, string> = {
  NAME_TAKEN: "A department already has that name. Names must be unique.",
  VERSION_LOCKED: "That version is in use, so it's locked. Start a new draft instead.",
  START_IN_PAST: "A new version can't start before tomorrow. Pick a later date.",
  FORBIDDEN: "Only HR can change setup. Sign in with an HR account.",
};

export function setupErrorMessage(status: number, body: unknown): string {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  if (typeof code === "string" && MESSAGES[code]) return MESSAGES[code];
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
    return response.ok ? { ok: true, value: json as T } : { ok: false, message: setupErrorMessage(response.status, json) };
  } catch {
    return { ok: false, message: GENERIC };
  }
}

export function createHttpSetupApi(base = "/api/v1"): SetupApi {
  return {
    saveOffice: (input) => send(`${base}/office`, input),
    rotateCheckpoint: (id) => send(`${base}/checkpoints/${encodeURIComponent(id)}/rotate`, {}),
    savePolicyDraft: (input) => send(`${base}/policies/${input.version}`, input),
    publishPolicy: (version) => send(`${base}/policies/${version}/publish`, {}),
    addDepartment: (name) => send(`${base}/departments`, { name }),
    renameDepartment: (id, name) => send(`${base}/departments/${encodeURIComponent(id)}`, { name }),
    setDepartmentActive: (id, active) => send(`${base}/departments/${encodeURIComponent(id)}/status`, { active }),
  };
}

/** Development stand-in. `existingNames` makes duplicate department names fail like the server would. */
export function createMockSetupApi(options: { delayMs?: number; existingNames?: string[] } = {}): SetupApi {
  const { delayMs = 600 } = options;
  const names = new Set((options.existingNames ?? []).map((name) => name.toLowerCase()));
  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));
  const taken = (name: string) => names.has(name.trim().toLowerCase());
  return {
    async saveOffice() {
      await wait();
      return { ok: true, value: { settingsVersion: 4 } };
    },
    async rotateCheckpoint() {
      await wait();
      return { ok: true, value: { codeVersion: 3 } };
    },
    async savePolicyDraft() {
      await wait();
      return { ok: true, value: { savedAt: new Date().toISOString() } };
    },
    async publishPolicy(version) {
      await wait();
      return { ok: true, value: { version } };
    },
    async addDepartment(name) {
      await wait();
      if (taken(name)) return { ok: false, message: MESSAGES.NAME_TAKEN! };
      names.add(name.trim().toLowerCase());
      return { ok: true, value: { id: `dept-${name.trim().toLowerCase().replace(/\s+/g, "-")}` } };
    },
    async renameDepartment(id, name) {
      await wait();
      if (taken(name)) return { ok: false, message: MESSAGES.NAME_TAKEN! };
      names.add(name.trim().toLowerCase());
      return { ok: true, value: { id } };
    },
    async setDepartmentActive(_id, active) {
      await wait();
      return { ok: true, value: { active } };
    },
  };
}
