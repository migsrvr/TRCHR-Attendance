/**
 * Browser-side sign-in and password setup, against Better Auth's routes
 * (better-auth 1.7: POST /api/auth/sign-in/email, POST /api/auth/reset-password).
 * The HR setup link carries a reset token; setting the password redeems it.
 */

export type SignInFailure = "invalid" | "disabled" | "rate-limited" | "network";
export type SetPasswordFailure = "expired" | "weak" | "rate-limited" | "network";

export type SignInResult = { ok: true; redirectTo: string } | { ok: false; reason: SignInFailure };
export type SetPasswordResult = { ok: true } | { ok: false; reason: SetPasswordFailure };

export interface AuthApi {
  signIn(input: { email: string; password: string; rememberMe: boolean }): Promise<SignInResult>;
  setPassword(input: { token: string; newPassword: string }): Promise<SetPasswordResult>;
}

type AuthFailure = SignInFailure | SetPasswordFailure;

const CODE_TO_REASON: Record<string, AuthFailure> = {
  INVALID_EMAIL_OR_PASSWORD: "invalid",
  INVALID_EMAIL: "invalid",
  INVALID_PASSWORD: "invalid",
  ACCOUNT_DISABLED: "disabled",
  USER_BANNED: "disabled",
  INVALID_TOKEN: "expired",
  TOKEN_EXPIRED: "expired",
  PASSWORD_TOO_SHORT: "weak",
  PASSWORD_TOO_LONG: "weak",
};

export function mapAuthError(status: number, body: unknown): AuthFailure {
  const code = typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;
  if (typeof code === "string" && CODE_TO_REASON[code]) return CODE_TO_REASON[code];
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

export function createHttpAuthApi(base = "/api/auth"): AuthApi {
  return {
    async signIn({ email, password, rememberMe }) {
      const result = await post(`${base}/sign-in/email`, { email: email.trim(), password, rememberMe });
      if (!result) return { ok: false, reason: "network" };
      if (result.status < 300) return { ok: true, redirectTo: homeFor(result.json) };
      return { ok: false, reason: mapAuthError(result.status, result.json) as SignInFailure };
    },
    async setPassword({ token, newPassword }) {
      const result = await post(`${base}/reset-password`, { token, newPassword });
      if (!result) return { ok: false, reason: "network" };
      if (result.status < 300) return { ok: true };
      return { ok: false, reason: mapAuthError(result.status, result.json) as SetPasswordFailure };
    },
  };
}

/**
 * Development stand-in while the database isn't connected. Emails starting
 * with "hr" land on the HR panel; the password "wrong" fails; the setup token
 * "expired" is refused.
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
  };
}
