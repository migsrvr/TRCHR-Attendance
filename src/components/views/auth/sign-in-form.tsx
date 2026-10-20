"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { createHttpAuthApi, createMockAuthApi, type SignInFailure } from "@/lib/auth/client-api";

const FAILURE_MESSAGE: Record<SignInFailure, string> = {
  invalid: "That email and password don't match. Check both and try again.",
  disabled: "This account is turned off. Ask HR if you think that's a mistake.",
  "rate-limited": "Too many tries. Wait a minute, then try again.",
  network: "Couldn't reach the server. Check your connection and try again.",
};

/** Only same-site paths are followed after sign-in (no open redirects). */
function safeNext(next?: string): string | undefined {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
}

export function SignInForm({ mock, next }: { mock: boolean; next?: string }) {
  const [api] = useState(() => (mock ? createMockAuthApi() : createHttpAuthApi()));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ email?: boolean; password?: boolean }>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const blank = { email: !email.trim(), password: !password };
    if (blank.email || blank.password) {
      setMissing(blank);
      setError("Enter your email and password.");
      document.getElementById(blank.email ? "signin-email" : "signin-password")?.focus();
      return;
    }
    setMissing({});
    setError(null);
    setSending(true);
    const result = await api.signIn({ email, password, rememberMe: remember });
    if (result.ok) {
      // A full navigation so the next page is rendered with the new session cookie.
      window.location.assign(safeNext(next) ?? result.redirectTo);
      return;
    }
    setSending(false);
    setError(FAILURE_MESSAGE[result.reason]);
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 px-6 pb-safe-or-4 pt-6">
      <div>
        <h1 className="font-heading text-[26px] font-bold uppercase leading-8 tracking-[0.01em]">Sign in</h1>
        <p className="mt-1 text-sm leading-[21px] text-muted-foreground">Use the email your account was set up with.</p>
      </div>

      {error ? (
        <p id="signin-error" role="alert" className="rounded-btn bg-attn-bg px-3.5 py-2.5 text-[13px] font-medium leading-[19px] text-attn">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signin-email" className="text-[13px] font-semibold leading-[18px]">
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ana.reyes@school.edu.ph"
          aria-invalid={missing.email ? true : undefined}
          aria-describedby={error ? "signin-error" : undefined}
          className="phone-field h-12 w-full rounded-btn border border-border bg-card px-3.5 text-foreground aria-[invalid=true]:border-attn"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signin-password" className="text-[13px] font-semibold leading-[18px]">
          Password
        </label>
        <PasswordField
          id="signin-password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          invalid={missing.password}
          describedBy={error ? "signin-error" : undefined}
        />
      </div>

      <label className="flex min-h-11 items-center gap-2.5 text-sm leading-5">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="size-5 accent-primary"
        />
        Keep me signed in on this phone
      </label>

      <Button type="submit" size="lg" className="w-full" aria-busy={sending}>
        {sending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="mt-2 text-[13px] leading-[19px] text-muted-foreground">
        Staying signed in means each day is just one scan. Forgot your password? Ask HR for a new setup link.
      </p>
    </form>
  );
}
