"use client";

import type { UserStatus } from "@prisma/client";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusMark } from "@/components/ui/status-mark";
import { createHttpAccountsApi, createMockAccountsApi } from "@/lib/accounts/api";

/** Account status with Sign out all devices and Disable / Enable (confirmed in a dialog). */
export function AccountActions({
  internId,
  name,
  status: initialStatus,
  lastSignInLabel,
  mock,
}: {
  internId: string;
  name: string;
  status: UserStatus;
  lastSignInLabel?: string;
  mock: boolean;
}) {
  const [api] = useState(() => (mock ? createMockAccountsApi() : createHttpAccountsApi()));
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState<"signout" | "toggle" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const disabled = status === "DISABLED";

  async function signOut() {
    if (busy) return;
    setBusy("signout");
    const result = await api.signOutEverywhere(internId);
    setBusy(null);
    setMessage(
      result.ok
        ? { tone: "ok", text: "Signed out everywhere. They'll need their password to scan again." }
        : { tone: "error", text: result.message },
    );
  }

  async function toggle() {
    if (busy) return;
    setBusy("toggle");
    const result = await api.setDisabled(internId, !disabled);
    setBusy(null);
    confirmRef.current?.close();
    if (result.ok) {
      setStatus(result.value.status);
      setMessage({ tone: "ok", text: result.value.status === "DISABLED" ? "Account disabled." : "Account turned back on." });
    } else {
      setMessage({ tone: "error", text: result.message });
    }
  }

  return (
    <div className="border-t border-hairline px-5 py-4">
      <p className="text-xs font-semibold leading-4 text-muted-foreground">Account</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-1">
        <StatusMark kind={{ type: "account", value: status }} audience="hr" />
        {lastSignInLabel && !disabled ? (
          <span className="text-xs text-muted-foreground">· last sign-in {lastSignInLabel}</span>
        ) : null}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={signOut} disabled={disabled} aria-busy={busy === "signout"}>
          {busy === "signout" ? "Signing out…" : "Sign out all devices"}
        </Button>
        {disabled ? (
          <Button variant="outline" size="sm" onClick={toggle} aria-busy={busy === "toggle"}>
            {busy === "toggle" ? "Turning on…" : "Enable account"}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => confirmRef.current?.showModal()}
            className="border-secondary text-secondary hover:bg-attn-bg"
          >
            Disable account
          </Button>
        )}
      </div>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "mt-2 text-xs text-attn" : "mt-2 text-xs text-settled"}>
          {message.text}
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-[18px] text-muted-foreground">
        Disabling stops scanning. Attendance and review history are kept.
      </p>

      <dialog
        ref={confirmRef}
        aria-labelledby="disable-title"
        className="w-[calc(100%-32px)] max-w-[440px] rounded-card border border-border bg-card p-6 text-foreground shadow-[0_12px_32px_rgb(var(--foreground)/0.18)] backdrop:bg-foreground/40"
      >
        <h2 id="disable-title" className="font-heading text-lg font-bold uppercase leading-6 tracking-[0.01em]">
          Disable {name}&apos;s account?
        </h2>
        <p className="mt-2 text-sm leading-[21px] text-muted-foreground">
          They&apos;ll be signed out and can&apos;t scan until you turn the account back on. Their attendance, corrections
          and DTR stay as they are.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => confirmRef.current?.close()}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={toggle} aria-busy={busy === "toggle"}>
            {busy === "toggle" ? "Disabling…" : "Disable account"}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
