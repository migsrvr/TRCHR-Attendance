/**
 * Client-side Setup actions for HR (harmonized under /api/v1/hr/*).
 * Every change is written to the audit log server-side.
 */

import type { PolicyRules } from "@/lib/ui/policy";

export type ApiResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface SaveOfficeInput {
  officeId?: string;
  expectedConfigVersion?: number;
  radiusM: number;
  maxAccuracyM: number;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export interface CreateCheckpointInput {
  officeId?: string;
  name: string;
  action: "TIME_IN" | "TIME_OUT";
  expiresInDays?: number;
}

export interface CreatedCheckpoint {
  id: string;
  name: string;
  action: "IN" | "OUT";
  codeVersion: number;
  expiresIso: string;
}

export interface SetupApi {
  saveOffice(input: SaveOfficeInput): Promise<ApiResult<{ settingsVersion: number }>>;
  createCheckpoint(input: CreateCheckpointInput): Promise<ApiResult<CreatedCheckpoint>>;
  rotateCheckpoint(checkpointId: string, options?: { expiresInDays?: number }): Promise<ApiResult<{ codeVersion: number }>>;
  revokeCheckpoint(checkpointId: string): Promise<ApiResult<{ id: string; revokedIso: string }>>;
  createPolicyDraft(officeId?: string, fromVersion?: number): Promise<ApiResult<{ version: number }>>;
  savePolicyDraft(input: {
    officeId?: string;
    version: number;
    fromIso: string;
    rules: PolicyRules;
  }): Promise<ApiResult<{ savedAt: string }>>;
  publishPolicy(version: number, officeId?: string): Promise<ApiResult<{ version: number }>>;
  addDepartment(name: string): Promise<ApiResult<{ id: string }>>;
  renameDepartment(id: string, name: string): Promise<ApiResult<{ id: string }>>;
  setDepartmentActive(id: string, active: boolean): Promise<ApiResult<{ active: boolean }>>;
}

const GENERIC = "Couldn't save. Check your connection and try again.";

const MESSAGES: Record<string, string> = {
  NAME_TAKEN: "A department already has that name. Names must be unique.",
  VERSION_LOCKED: "That version is in use, so it's locked. Start a new draft instead.",
  START_IN_PAST: "A new version can't start before tomorrow. Pick a later date.",
  STALE_VERSION: "Settings were updated by someone else. Refresh the page and try again.",
  ALREADY_REVOKED: "That checkpoint is already revoked.",
  CHECKPOINT_REVOKED: "That checkpoint is revoked and can't be rotated.",
  FORBIDDEN: "Only HR can change setup. Sign in with an HR account.",
};

export function setupErrorMessage(status: number, body: unknown): string {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  if (typeof code === "string" && MESSAGES[code]) return MESSAGES[code];
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
    return response.ok ? { ok: true, value: json as T } : { ok: false, message: setupErrorMessage(response.status, json) };
  } catch {
    return { ok: false, message: GENERIC };
  }
}

export function createHttpSetupApi(base = "/api/v1/hr"): SetupApi {
  return {
    saveOffice: ({ officeId = "default", ...payload }) =>
      send(`${base}/offices/${encodeURIComponent(officeId)}`, payload, "PATCH"),
    createCheckpoint: (input) => send(`${base}/checkpoints`, input, "POST"),
    rotateCheckpoint: (id, options = {}) =>
      send(`${base}/checkpoints/${encodeURIComponent(id)}/rotate`, options, "POST"),
    revokeCheckpoint: (id) =>
      send(`${base}/checkpoints/${encodeURIComponent(id)}/revoke`, {}, "POST"),
    createPolicyDraft: (officeId = "default", fromVersion) =>
      send(`${base}/offices/${encodeURIComponent(officeId)}/policies`, fromVersion ? { fromVersion } : {}, "POST"),
    savePolicyDraft: ({ officeId = "default", version, fromIso, rules }) =>
      send(`${base}/offices/${encodeURIComponent(officeId)}/policies/${version}`, { fromIso, rules }, "PATCH"),
    publishPolicy: (version, officeId = "default") =>
      send(`${base}/offices/${encodeURIComponent(officeId)}/policies/${version}/publish`, {}, "POST"),
    addDepartment: (name) => send(`${base}/departments`, { name }, "POST"),
    renameDepartment: (id, name) => send(`${base}/departments/${encodeURIComponent(id)}`, { name }, "PATCH"),
    setDepartmentActive: (id, active) =>
      send(`${base}/departments/${encodeURIComponent(id)}/status`, { active }, "POST"),
  };
}

/** Development stand-in when USE_MOCK_APIS=1. */
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
    async createCheckpoint(input) {
      await wait();
      const days = input.expiresInDays ?? 90;
      const expiresIso = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const action = input.action === "TIME_IN" ? "IN" : "OUT";
      return {
        ok: true,
        value: {
          id: `chk-${slug}-${action.toLowerCase()}-v1`,
          name: input.name.trim(),
          action,
          codeVersion: 1,
          expiresIso,
        },
      };
    },
    async rotateCheckpoint() {
      await wait();
      return { ok: true, value: { codeVersion: 3 } };
    },
    async revokeCheckpoint(id) {
      await wait();
      return { ok: true, value: { id, revokedIso: new Date().toISOString().slice(0, 10) } };
    },
    async createPolicyDraft(_officeId, fromVersion) {
      await wait();
      return { ok: true, value: { version: (fromVersion ?? 2) + 1 } };
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
