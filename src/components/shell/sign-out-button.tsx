"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { createHttpAuthApi } from "@/lib/auth/client-api";
import { cn } from "@/lib/utils";

/** Signs out the current Better Auth session and navigates cleanly to /sign-in. */
export function SignOutButton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await createHttpAuthApi().signOut();
    } finally {
      window.location.assign("/sign-in");
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      aria-label="Sign out"
      title="Sign out"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-btn text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60",
        compact ? "size-9" : "h-9 px-2.5",
        className,
      )}
    >
      <LogOut aria-hidden="true" className="size-4 shrink-0" />
      {compact ? <span className="sr-only">Sign out</span> : <span>{busy ? "Signing out…" : "Sign out"}</span>}
    </button>
  );
}
