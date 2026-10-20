import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TodaySummary } from "@/lib/scan/api";
import { formatClock, formatDelta, formatDuration, formatReceiptId, formatShortDate, officeDateIso } from "@/lib/ui/format";
import { hoursProgress } from "@/lib/ui/hours";
import type { ScanReceipt } from "@/lib/ui/scan-state";

function TimeOutSummary({ summary }: { summary: TodaySummary | null | "error" }) {
  if (summary === null) {
    return (
      <section aria-busy="true" className="rounded-panel border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
        Updating your hours…
      </section>
    );
  }
  if (summary === "error") {
    return (
      <section className="rounded-panel border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
        Your hours will update shortly. Your Time out is saved.
      </section>
    );
  }

  const progress = hoursProgress({ creditedMinutes: summary.creditedTotalMinutes, requiredMinutes: summary.requiredMinutes });
  return (
    <section className="rounded-panel border border-border bg-card px-5 py-4 shadow-card">
      {summary.sessionStart && summary.sessionEnd ? (
        <div className="flex items-baseline justify-between gap-3 text-[13px] leading-[18px]">
          <span className="text-muted-foreground">Today</span>
          <span className="font-mono">
            {summary.sessionStart} → {summary.sessionEnd}
          </span>
        </div>
      ) : null}
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] leading-[18px] text-muted-foreground">Credited today</span>
        <span className="font-mono text-[15px] font-bold leading-5 text-settled">{formatDelta(summary.creditedTodayMinutes)}</span>
      </div>
      <div className="mt-4 border-t border-hairline pt-4">
        <p className="flex items-baseline gap-1.5">
          <span className="font-heading text-[28px] font-bold leading-8 tabular-nums">
            {formatDuration(summary.creditedTotalMinutes)}
          </span>
          <span className="text-[13px] text-muted-foreground">of {Math.round(summary.requiredMinutes / 60)}h</span>
        </p>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
          <div className="h-full rounded-full bg-settled" style={{ width: `${progress.percent}%` }} />
        </div>
        <p className="mt-2 text-xs leading-[18px] text-muted-foreground">
          <span className="font-mono font-semibold text-foreground">{formatDuration(progress.remainingMinutes)}</span> left
          {summary.pendingCorrections > 0
            ? ` · ${summary.pendingCorrections} correction${summary.pendingCorrections === 1 ? "" : "s"} still waiting on HR`
            : ""}
        </p>
      </div>
    </section>
  );
}

/** Shown only after the server committed the scan (receipt in hand). */
export function ScanSavedView({
  receipt,
  name,
  timeZone,
  summary,
  onDone,
}: {
  receipt: ScanReceipt;
  name: string;
  timeZone: string;
  summary: TodaySummary | null | "error";
  onDone: () => void;
}) {
  const isTimeIn = receipt.action === "TIME_IN";
  const received = new Date(receipt.receivedAtUtc);
  const [hh, mm, ss] = formatClock(received, timeZone, { seconds: true }).split(":");

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 pb-safe-or-4">
      <section
        aria-live="polite"
        className="flex flex-col items-center rounded-panel border border-border bg-card px-5 pb-5 pt-7 text-center shadow-card"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-settled text-white">
          <Check aria-hidden="true" className="size-8" strokeWidth={2.5} />
        </span>
        <h1 className="mt-4 font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.02em] text-settled">
          {isTimeIn ? "Time in saved" : "Time out saved"}
        </h1>
        <p className="mt-1 text-lg font-semibold leading-6">{name}</p>
        <p className="mt-4 flex items-baseline justify-center gap-0.5">
          <span className="font-heading text-[56px] font-bold leading-[56px] tabular-nums">
            {hh}:{mm}
          </span>
          <span className="font-mono text-base text-muted-foreground">:{ss}</span>
        </p>
        <p className="mt-2 text-sm leading-[21px] text-muted-foreground">
          {formatShortDate(officeDateIso(received, timeZone), { weekday: true })} · {receipt.checkpointName}
        </p>
        <div className="mt-5 w-full border-t border-hairline pt-3">
          <p className="text-xs leading-[18px] text-muted-foreground">Time from the office server, not your phone</p>
          <p className="font-mono text-xs leading-[18px] text-muted-foreground">Receipt {formatReceiptId(receipt.receiptId)}</p>
        </div>
      </section>

      {isTimeIn ? (
        <div className="flex items-start gap-3 rounded-card bg-pend-bg px-4 py-3.5">
          <span className="font-heading text-base font-bold leading-5 text-pend">OUT</span>
          <p className="text-[13px] leading-[19px]">
            Scan the OUT code before you leave. Without it, today stays incomplete and earns no hours.
          </p>
        </div>
      ) : (
        <TimeOutSummary summary={summary} />
      )}

      <div className="mt-auto pt-2">
        <Button size="lg" className="w-full" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
