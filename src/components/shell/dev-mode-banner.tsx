"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export type MockModeReason = "explicit" | "no-database" | null;

const MockModeContext = createContext<{ mock: boolean; reason: MockModeReason }>({
  mock: false,
  reason: null,
});

export function MockModeProvider({
  mock,
  reason,
  children,
}: {
  mock: boolean;
  reason: MockModeReason;
  children: ReactNode;
}) {
  return <MockModeContext.Provider value={{ mock, reason }}>{children}</MockModeContext.Provider>;
}

export function useMockMode() {
  return useContext(MockModeContext);
}

/** Subtle non-production banner shown when the UI is reading sample fixtures instead of PostgreSQL. */
export function DevModeBanner({ compact = false }: { compact?: boolean }) {
  const { mock, reason } = useMockMode();
  const [dismissed, setDismissed] = useState(false);

  if (!mock || !reason || dismissed) return null;

  const text =
    reason === "no-database"
      ? "Dev fixture mode · DATABASE_URL is not configured yet."
      : "Dev fixture mode · USE_MOCK_APIS=1 is active.";

  return (
    <div
      role="status"
      data-dev-banner="true"
      className="flex items-center justify-between gap-2 border-b border-pend/25 bg-pend-bg px-4 py-1.5 text-xs text-pend"
    >
      <span className="truncate font-medium">{compact ? "Dev fixture mode" : text}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss fixture mode notice"
        className="flex size-5 shrink-0 items-center justify-center rounded text-pend/80 hover:bg-pend/10 hover:text-pend"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}
