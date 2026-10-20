"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { createHttpAccountsApi, createMockAccountsApi } from "@/lib/accounts/api";

/** Sends a fresh setup link to an intern who hasn't chosen a password yet. */
export function ResendLinkButton({ internId, mock }: { internId: string; mock: boolean }) {
  const [api] = useState(() => (mock ? createMockAccountsApi() : createHttpAccountsApi()));
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function resend() {
    if (state === "sending") return;
    setState("sending");
    const result = await api.resendSetupLink(internId);
    setState(result.ok ? "sent" : "failed");
  }

  if (state === "sent") {
    return (
      <span role="status" className="font-semibold text-settled">
        New link sent
      </span>
    );
  }
  return (
    <>
      <button type="button" onClick={resend} aria-busy={state === "sending"} className="font-semibold text-primary hover:underline">
        {state === "sending" ? "Sending…" : state === "failed" ? "Try again" : "Resend"}
      </button>
      {state === "failed" ? (
        <span role="alert" className="ml-1 text-attn">
          Couldn&apos;t send.
        </span>
      ) : null}
    </>
  );
}

/**
 * Row "more" button: a small disclosure with the row's links. The list is
 * placed against the viewport (fixed) so the table's scroll box can't clip
 * it. Closes on Escape (focus back on the button), a click elsewhere, or a
 * scroll or resize that would leave it detached from its button.
 */
export function RowActions({ name, links }: { name: string; links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const menuId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onMove = () => setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative inline-block">
      <button
        ref={button}
        type="button"
        aria-label={`More actions for ${name}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          const rect = button.current?.getBoundingClientRect();
          if (rect) setPlace({ top: rect.bottom + 4, right: document.documentElement.clientWidth - rect.right });
          setOpen((current) => !current);
        }}
        className="flex size-8 items-center justify-center rounded-btnsm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </button>
      <ul
        id={menuId}
        hidden={!open}
        style={{ top: place.top, right: place.right }}
        className="fixed z-30 min-w-44 rounded-btn border border-border bg-card p-1 text-left shadow-card"
      >
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="block rounded-btnsm px-3 py-2 text-[13px] text-foreground hover:bg-muted">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

