"use client";

import { CheckCircle2, Printer, RotateCw, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { createHttpSetupApi, createMockSetupApi } from "@/lib/setup/api";
import { formatLongDate } from "@/lib/ui/format";
import { DEFAULT_QR_EXPIRY_OPTION, QR_EXPIRY_OPTIONS } from "@/lib/ui/qr-expiry";

/** Rotates all active office checkpoints (IN and OUT) together for monthly paper poster replacement. */
export function RotateAllCheckpointsDialog({
  officeId,
  activeCount,
  mock,
}: {
  officeId?: string;
  activeCount: number;
  mock: boolean;
}) {
  const [api] = useState(() => (mock ? createMockSetupApi() : createHttpSetupApi()));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [expiresInDays, setExpiresInDays] = useState<string>(DEFAULT_QR_EXPIRY_OPTION);
  const [state, setState] = useState<
    | { kind: "idle" | "rotating" }
    | { kind: "rotated"; count: number; expiresIso: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function close() {
    dialogRef.current?.close();
  }

  function onClosed() {
    if (state.kind === "rotated" && !mock) window.location.reload();
    if (state.kind === "rotated" || state.kind === "error") setState({ kind: "idle" });
  }

  async function rotateAll() {
    setState({ kind: "rotating" });
    const result = await api.rotateAllCheckpoints({
      ...(officeId ? { officeId } : {}),
      expiresInDays: Number(expiresInDays),
    });
    if (result.ok) {
      setState({ kind: "rotated", count: result.value.rotatedCount, expiresIso: result.value.expiresIso });
    } else {
      setState({ kind: "error", message: result.message });
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => dialogRef.current?.showModal()}>
        <RotateCw aria-hidden="true" />
        Rotate all
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="rotate-all-title"
        onClose={onClosed}
        className="w-[calc(100%-32px)] max-w-[460px] rounded-card border border-border bg-card p-0 text-left text-foreground shadow-[0_12px_32px_rgb(var(--foreground)/0.18)] backdrop:bg-foreground/40"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div>
            <h2 id="rotate-all-title" className="font-heading text-lg font-bold uppercase leading-6 tracking-[0.01em]">
              Rotate all {activeCount} active codes?
            </h2>
            <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
              Best for monthly poster swaps. Every currently posted IN and OUT sheet stops working immediately until you
              print and hang the new ones.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-btn text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="size-[18px]" />
          </button>
        </div>

        {state.kind === "rotated" ? (
          <div className="flex flex-col gap-4 px-6 pb-6 pt-3">
            <div role="status" className="flex items-start gap-3 rounded-btn bg-pend-bg px-4 py-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-settled" />
              <p className="text-sm leading-[21px]">
                Rotated all <span className="font-semibold">{state.count} active checkpoints</span>. New posters are
                valid until{" "}
                <span className="font-semibold">{formatLongDate(state.expiresIso).replace(/^\w+, /, "")}</span>. Print
                and post them now.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/hr/setup/qr/print-all" className={buttonClasses({ variant: "primary" })}>
                <Printer aria-hidden="true" />
                Print all new posters
              </Link>
              <Button variant="outline" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-6 pb-6 pt-3">
            {state.kind === "error" ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-btn border border-attn/35 bg-attn-bg px-3.5 py-2.5 text-[13px]"
              >
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attn" />
                <p>{state.message}</p>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rotate-all-expiry" className="text-xs font-semibold leading-4">
                New poster validity
              </label>
              <select
                id="rotate-all-expiry"
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
                className="h-9 rounded-btn border border-border bg-card px-3 text-sm text-foreground"
              >
                {QR_EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={rotateAll} aria-busy={state.kind === "rotating"}>
                {state.kind === "rotating" ? "Rotating…" : "Rotate all now"}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
