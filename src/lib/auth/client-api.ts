/**
 * Browser-side sign-in, password setup, and sign-out client.
 * - Sign-in and sign-out call Better Auth routes (/api/auth/sign-in/email, /api/auth/sign-out).
 * - Password setup calls POST /api/v1/auth/setup-password so redeeming the link
 *   atomically activates the PENDING account and establishes a live session cookie.
 */

export type SignInFailure = "invalid" | "disabled" | "rate-limited" | "network";
export type SetPasswordFailure = "expired" | "weak" | "rate-limited" | "network";

export type SignInResult = { ok: true; redirectTo: string } | { ok: false; reason: SignInFailure };
export type SetPasswordResult = { ok: true } | { ok: false; reason: SetPasswordFailure };

export interface AuthApi {
  signIn(input: { email: string; password: string; rememberMe: boolean }): Promise<SignInResult>;
  setPassword(input: { token: string; newPassword: string }): Promise<SetPasswordResult>;
  signOut(): Promise<void>;
}

type AuthFailure = SignInFailure | SetPasswordFailure;

const CODE_TO_REASON: Record<string, AuthFailure> = {
  INVALID_EMAIL_OR_PASSWORD: "invalid",
  INVALID_EMAIL: "invalid",
  INVALID_PASSWORD: "invalid",
  ACCOUNT_DISABLED: "disabled",
  ACCOUNT_PENDING: "invalid",
  USER_BANNED: "disabled",
  INVALID_TOKEN: "expired",
  TOKEN_EXPIRED: "expired",
  PASSWORD_TOO_SHORT: "weak",
  PASSWORD_TOO_LONG: "weak",
};

export function mapAuthError(status: number, body: unknown): AuthFailure {
  const obj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  const nestedError =
    typeof obj?.error === "object" && obj.error !== null ? (obj.error as { code?: unknown }) : undefined;
  const code = typeof obj?.code === "string" ? obj.code : typeof nestedError?.code === "string" ? nestedError.code : undefined;

  if (code && CODE_TO_REASON[code]) return CODE_TO_REASON[code];
  if (status === 429) return "rate-limited";
  if (status === 401) return "invalid";
  return "network";
}

async function post(path: string, body: unknown): Promise<{ status: number; json: unknown } | null> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
    });
    return { status: response.status, json: await response.json().catch(() => null) };
  } catch {
    return null;
  }
}

/** Where a signed-in user lands, by role. */
function homeFor(json: unknown): string {
  const role = (json as { user?: { role?: unknown } } | null)?.user?.role;
  return role === "HR" ? "/hr" : "/dashboard";
}

export function createHttpAuthApi(base = "/api/auth", v1Base = "/api/v1"): AuthApi {
  return {
    async signIn({ email, password, rememberMe }) {
      const result = await post(`${base}/sign-in/email`, { email: email.trim(), password, rememberMe });
      if (!result) return { ok: false, reason: "network" };
      if (result.status < 300) return { ok: true, redirectTo: homeFor(result.json) };
      return { ok: false, reason: mapAuthError(result.status, result.json) as SignInFailure };
    },
    async setPassword({ token, newPassword }) {
      const result = await post(`${v1Base}/auth/setup-password`, { token, newPassword });
      if (!result) return { ok: false, reason: "network" };
      if (result.status < 300) return { ok: true };
      return { ok: false, reason: mapAuthError(result.status, result.json) as SetPasswordFailure };
    },
    async signOut() {
      await post(`${base}/sign-out`, {});
    },
  };
}

/**
 * Development stand-in when USE_MOCK_APIS=1.
 */
export function createMockAuthApi(options: { delayMs?: number } = {}): AuthApi {
  const { delayMs = 700 } = options;
  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));
  return {
    async signIn({ email, password }) {
      await wait();
      if (password === "wrong") return { ok: false, reason: "invalid" };
      return { ok: true, redirectTo: email.trim().toLowerCase().startsWith("hr") ? "/hr" : "/dashboard" };
    },
    async setPassword({ token }) {
      await wait();
      return token === "expired" ? { ok: false, reason: "expired" } : { ok: true };
    },
    async signOut() {
      await wait();
    },
  };
}
