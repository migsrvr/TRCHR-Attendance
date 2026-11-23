"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 p-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-attn-bg text-attn">
        <TriangleAlert aria-hidden="true" className="size-6" />
      </span>
      <h1 className="font-heading text-2xl font-bold uppercase tracking-[0.01em]">Something went wrong</h1>
      <p className="text-sm leading-[21px] text-muted-foreground">
        We couldn&apos;t load this page right now. Your saved attendance records were not affected.
      </p>
      <Button onClick={reset}>
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </main>
  );
}
