"use client";

import { Printer, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { createHttpSetupApi, createMockSetupApi } from "@/lib/setup/api";

/** Print and Rotate for an active checkpoint. Rotating is confirmed first: it revokes printed copies at once. */
export function CheckpointActions({ id, label, mock }: { id: string; label: string; mock: boolean }) {
  const [api] = useState(() => (mock ? createMockSetupApi() : createHttpSetupApi()));
  const [state, setState] = useState<{ kind: "idle" | "rotating" } | { kind: "rotated"; version: number } | { kind: "error"; message: string }>({ kind: "idle" });
  const confirmRef = useRef<HTMLDialogElement>(null);

  async function rotate() {
    setState({ kind: "rotating" });
    const result = await api.rotateCheckpoint(id);
    confirmRef.current?.close();
    setState(result.ok ? { kind: "rotated", version: result.value.codeVersion } : { kind: "error", message: result.message });
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
        <Button variant="ghost" size="sm" onClick={() => confirmRef.current?.showModal()}>
          <RotateCw aria-hidden="true" />
          Rotate code
        </Button>
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
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => confirmRef.current?.close()}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={rotate} aria-busy={state.kind === "rotating"}>
            {state.kind === "rotating" ? "Rotating…" : "Rotate now"}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
