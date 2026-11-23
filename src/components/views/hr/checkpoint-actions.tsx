"use client";

import { Ban, Printer, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { createHttpSetupApi, createMockSetupApi } from "@/lib/setup/api";

const EXPIRY_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days (recommended)" },
  { value: "180", label: "180 days" },
  { value: "365", label: "365 days" },
] as const;

/** Print, Rotate, and permanently Revoke for an active checkpoint. */
export function CheckpointActions({ id, label, mock }: { id: string; label: string; mock: boolean }) {
  const [api] = useState(() => (mock ? createMockSetupApi() : createHttpSetupApi()));
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [state, setState] = useState<
    | { kind: "idle" | "rotating" | "revoking" }
    | { kind: "rotated"; version: number }
    | { kind: "revoked"; revokedIso: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const confirmRef = useRef<HTMLDialogElement>(null);
  const revokeRef = useRef<HTMLDialogElement>(null);

  async function rotate() {
    setState({ kind: "rotating" });
    const result = await api.rotateCheckpoint(id, { expiresInDays: Number(expiresInDays) });
    confirmRef.current?.close();
    setState(result.ok ? { kind: "rotated", version: result.value.codeVersion } : { kind: "error", message: result.message });
  }

  async function revoke() {
    setState({ kind: "revoking" });
    const result = await api.revokeCheckpoint(id);
    revokeRef.current?.close();
    if (result.ok) {
      setState({ kind: "revoked", revokedIso: result.value.revokedIso });
      if (!mock) window.location.reload();
    } else {
      setState({ kind: "error", message: result.message });
    }
  }

  if (state.kind === "revoked") {
    return (
      <span role="status" className="text-xs font-medium text-muted-foreground">
        Revoked {state.revokedIso}. Printed copies no longer scan.
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link href={`/hr/setup/qr/${id}/print`} className={buttonClasses({ variant: "outline", size: "sm" })}>
        <Printer aria-hidden="true" />
        Print
      </Link>
      {state.kind === "rotated" ? (
        <span role="status" className="text-xs font-medium text-settled">
          v{state.version} issued. Print and post it now.
        </span>
      ) : (
        <>
          <Button variant="ghost" size="sm" onClick={() => confirmRef.current?.showModal()}>
            <RotateCw aria-hidden="true" />
            Rotate code
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => revokeRef.current?.showModal()}
            className="text-secondary hover:bg-attn-bg"
          >
            <Ban aria-hidden="true" />
            Revoke
          </Button>
        </>
      )}
      {state.kind === "error" ? (
        <span role="alert" className="text-xs text-attn">
          {state.message}
        </span>
      ) : null}
      <dialog
        ref={confirmRef}
        aria-labelledby={`rotate-${id}-title`}
        className="w-[calc(100%-32px)] max-w-[440px] rounded-card border border-border bg-card p-6 text-left text-foreground shadow-[0_12px_32px_rgb(var(--foreground)/0.18)] backdrop:bg-foreground/40"
      >
        <h2 id={`rotate-${id}-title`} className="font-heading text-lg font-bold uppercase leading-6 tracking-[0.01em]">
          Rotate the {label} code?
        </h2>
        <p className="mt-2 text-sm leading-[21px] text-muted-foreground">
          Every printed copy of the current code stops working immediately. Interns can&apos;t scan {label} until the new code
          is posted.
        </p>
        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor={`rotate-${id}-expiry`} className="text-xs font-semibold leading-4">
            New code validity
          </label>
          <select
            id={`rotate-${id}-expiry`}
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(event.target.value)}
            className="h-9 rounded-btn border border-border bg-card px-3 text-sm text-foreground"
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => confirmRef.current?.close()}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={rotate} aria-busy={state.kind === "rotating"}>
            {state.kind === "rotating" ? "Rotating…" : "Rotate now"}
          </Button>
        </div>
      </dialog>
      <dialog
        ref={revokeRef}
        aria-labelledby={`revoke-${id}-title`}
        className="w-[calc(100%-32px)] max-w-[440px] rounded-card border border-border bg-card p-6 text-left text-foreground shadow-[0_12px_32px_rgb(var(--foreground)/0.18)] backdrop:bg-foreground/40"
      >
        <h2 id={`revoke-${id}-title`} className="font-heading text-lg font-bold uppercase leading-6 tracking-[0.01em]">
          Permanently revoke {label}?
        </h2>
        <p className="mt-2 text-sm leading-[21px] text-muted-foreground">
          Printed copies stop working immediately and this checkpoint cannot be reactivated. Past scans stay in attendance
          history.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => revokeRef.current?.close()}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={revoke} aria-busy={state.kind === "revoking"}>
            {state.kind === "revoking" ? "Revoking…" : "Revoke permanently"}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
