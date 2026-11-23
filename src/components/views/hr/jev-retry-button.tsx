"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createHttpReviewsApi, createMockReviewsApi } from "@/lib/reviews/api";

/** Re-queues a failed / manual-review Jev advisory job for HR. */
export function JevRetryButton({ correctionId, mock }: { correctionId: string; mock: boolean }) {
  const [api] = useState(() => (mock ? createMockReviewsApi() : createHttpReviewsApi()));
  const [state, setState] = useState<"idle" | "sending" | "queued" | "error">("idle");

  async function retry() {
    if (state === "sending") return;
    setState("sending");
    const result = await api.retryJev(correctionId);
    setState(result.ok ? "queued" : "error");
  }

  if (state === "queued") {
    return (
      <p role="status" className="mt-2.5 text-xs font-medium text-settled">
        Queued for a fresh Jev reading. Refresh shortly or decide manually anytime.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={retry} aria-busy={state === "sending"}>
        <RefreshCw aria-hidden="true" />
        {state === "sending" ? "Re-queuing…" : "Retry Jev reading"}
      </Button>
      {state === "error" ? (
        <p role="alert" className="text-xs text-attn">
          Couldn&apos;t queue a retry right now.
        </p>
      ) : null}
    </div>
  );
}
