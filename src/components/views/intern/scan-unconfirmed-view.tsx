import { Clock, RefreshCw, ShieldCheck } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import type { ScanAction } from "@/lib/ui/scan-state";

/**
 * The connection dropped after the scan was sent. It may have been saved, so
 * the only action is to look it up again with the same request key; starting
 * a new scan here could double-count (Technical Design section 6).
 */
export function ScanUnconfirmedView({
  attempted,
  checkpointName,
  onCheckAgain,
}: {
  attempted: ScanAction;
  checkpointName: string;
  onCheckAgain: () => void;
}) {
  const action = attempted === "TIME_IN" ? "Time in" : "Time out";

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 pb-safe-or-4">
      <section
        role="status"
        className="flex flex-col items-center rounded-panel border border-border bg-card px-5 pb-5 pt-7 text-center shadow-card"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-pend-bg text-pend">
          <Clock aria-hidden="true" className="size-[30px]" />
        </span>
        <h1 className="mt-4 font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.02em] text-pend">
          Couldn&apos;t confirm
        </h1>
        <p className="mt-1 text-base font-semibold leading-[22px]">Your {action} may already be saved</p>
        <p className="mt-2 text-sm leading-[21px] text-muted-foreground">
          Your connection dropped before the office server answered. Check again to find out.
        </p>
        <dl className="mt-5 grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-hairline pt-4 text-left text-[13px] leading-[18px]">
          <dt className="text-muted-foreground">Code</dt>
          <dd>{checkpointName}</dd>
        </dl>
      </section>

      <div className="flex items-start gap-2.5 rounded-card bg-pend-bg px-4 py-3.5">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pend" />
        <p className="text-[13px] leading-[19px]">
          Don&apos;t scan a new code yet. Checking again looks up this same scan, so it can never count twice.
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Button size="lg" className="w-full" onClick={onCheckAgain}>
          <RefreshCw aria-hidden="true" />
          Check again
        </Button>
        <ButtonLink size="lg" variant="outline" className="w-full font-medium" href="/history">
          See today&apos;s history
        </ButtonLink>
      </div>
    </div>
  );
}
