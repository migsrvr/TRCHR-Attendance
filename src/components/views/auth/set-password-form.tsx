"use client";

import { Check, Clock } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { createHttpAuthApi, createMockAuthApi } from "@/lib/auth/client-api";
import { formatShortDate } from "@/lib/ui/format";
import { checkPassword, MIN_PASSWORD_LENGTH } from "@/lib/ui/password";
import type { SetupLinkVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

function ExpiredLink() {
  return (
    <div className="flex flex-col gap-4 px-6 pb-safe-or-4 pt-6">
      <section className="flex flex-col items-start gap-4 rounded-card border border-border bg-card p-6 shadow-card">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Clock aria-hidden="true" className="size-[22px]" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-bold uppercase leading-[30px] tracking-[0.01em]">This link has expired</h1>
          <p className="mt-2 text-sm leading-[21px] text-muted-foreground">
            Setup links work once and only for a few days. Ask HR to send you a new one, then open it on this phone.
          </p>
        </div>
      </section>
      <ButtonLink href="/sign-in" size="lg" variant="outline" className="w-full font-medium">
        Go to sign in
      </ButtonLink>
    </div>
  );
}

export function SetPasswordForm({ link, token, mock }: { link: SetupLinkVM | null; token: string; mock: boolean }) {
  const [api] = useState(() => (mock ? createMockAuthApi() : createHttpAuthApi()));
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set by a blocked submit; the message then follows the live checklist.
  const [rulesShown, setRulesShown] = useState(false);
  const [expired, setExpired] = useState(link === null);

  if (expired || !link) return <ExpiredLink />;

  const isIntern = link.role === "INTERN";
  const check = checkPassword({ password, repeat, email: link.email });
  const rules = [
    { key: "minLength", label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: check.minLength },
    { key: "notEmail", label: "Not your email address", met: check.notEmail },
    { key: "matches", label: "Both passwords match", met: check.matches },
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    if (!check.allMet) {
      setRulesShown(true);
      setError(null);
      const firstUnmet = check.minLength && check.notTooLong && check.notEmail ? "setpw-repeat" : "setpw-password";
      document.getElementById(firstUnmet)?.focus();
      return;
    }
    setError(null);
    setSending(true);
    const result = await api.setPassword({ token, newPassword: password });
    if (result.ok) {
      window.location.assign(isIntern ? "/welcome/camera" : "/hr");
      return;
    }
    setSending(false);
    if (result.reason === "expired") setExpired(true);
    else if (result.reason === "weak") setError("Choose a longer password.");
    else setError("Couldn't save. Check your connection and try again.");
  }

  const message =
    rulesShown && !check.allMet
      ? check.notTooLong
        ? "Meet all three rules first."
        : "That password is too long. Use 128 characters or fewer."
      : error;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 px-6 pb-safe-or-4 pt-6">
      <div>
        <h1 className="font-heading text-[26px] font-bold uppercase leading-8 tracking-[0.01em]">Welcome, {link.firstName}</h1>
        <p className="mt-1 text-sm leading-[21px] text-muted-foreground">
          {isIntern && link.department && link.startDateIso
            ? `HR set up your internship: ${link.department}, starting ${formatShortDate(link.startDateIso)}. Choose a password to finish your account.`
            : "Your HR account is ready. Choose a password to finish setting it up."}
        </p>
      </div>

      {message ? (
        <p id="setpw-error" role="alert" className="rounded-btn bg-attn-bg px-3.5 py-2.5 text-[13px] font-medium leading-[19px] text-attn">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="setpw-email" className="text-[13px] font-semibold leading-[18px]">
          Email
        </label>
        {/* Read-only, but present so password managers save the right username. */}
        <input
          id="setpw-email"
          type="email"
          value={link.email}
          readOnly
          autoComplete="username"
          className="phone-field h-12 w-full rounded-btn border border-border bg-muted px-3.5 text-muted-foreground"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="setpw-password" className="text-[13px] font-semibold leading-[18px]">
          New password
        </label>
        <PasswordField
          id="setpw-password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          invalid={rulesShown && !(check.minLength && check.notTooLong && check.notEmail)}
          describedBy="setpw-rules"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="setpw-repeat" className="text-[13px] font-semibold leading-[18px]">
          Type it again
        </label>
        <PasswordField
          id="setpw-repeat"
          value={repeat}
          onChange={setRepeat}
          autoComplete="new-password"
          invalid={rulesShown && !check.matches}
          describedBy="setpw-rules"
        />
      </div>

      <ul id="setpw-rules" className="flex flex-col gap-1.5 text-[13px] leading-[18px]">
        {rules.map((rule) => (
          <li key={rule.key} data-rule={rule.key} className={cn("flex items-center gap-2", !rule.met && "text-muted-foreground")}>
            {rule.met ? (
              <span className="flex size-4 items-center justify-center rounded-full bg-settled text-white">
                <Check aria-hidden="true" className="size-2.5" strokeWidth={3.5} />
              </span>
            ) : (
              <span aria-hidden="true" className="size-4 rounded-full border-[1.5px] border-inactive" />
            )}
            {rule.label}
            <span className="sr-only">{rule.met ? "(done)" : "(not yet)"}</span>
          </li>
        ))}
      </ul>

      {isIntern ? (
        <p className="text-xs leading-[18px] text-muted-foreground">
          Next, you&apos;ll allow the camera and location so you can scan at the office. It takes about a minute.
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" aria-busy={sending}>
        {sending ? "Saving…" : isIntern ? "Save and continue" : "Save password and sign in"}
      </Button>

      <p className="text-xs leading-[18px] text-muted-foreground">This link works once and expires {link.expiresLabel}.</p>
    </form>
  );
}
