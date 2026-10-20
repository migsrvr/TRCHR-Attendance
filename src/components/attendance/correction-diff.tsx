import { formatDelta, formatDuration } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

export interface DiffRow {
  label: string;
  recorded: string | null;
  proposed: string | null;
}

const CELL = "border-t border-hairline px-3 py-2.5";

/** Recorded values against the proposal. Only values that change are highlighted. */
export function CorrectionDiff({
  rows,
  creditedBefore,
  creditedAfter,
  labels = { recorded: "Recorded now", proposed: "If approved" },
}: {
  rows: DiffRow[];
  creditedBefore: number;
  creditedAfter: number;
  labels?: { recorded: string; proposed: string };
}) {
  return (
    <div role="table" aria-label="Recorded values and the proposed change" className="grid grid-cols-[minmax(72px,140px)_minmax(0,1fr)_minmax(0,1fr)]">
      <div role="row" className="contents">
        <span role="columnheader" className="px-3 pb-2 text-xs font-semibold text-muted-foreground">
          <span className="sr-only">Value</span>
        </span>
        <span role="columnheader" className="px-3 pb-2 text-xs font-semibold text-muted-foreground">
          {labels.recorded}
        </span>
        <span role="columnheader" className="px-3 pb-2 text-xs font-semibold text-muted-foreground">
          {labels.proposed}
        </span>
      </div>
      {rows.map((row) => {
        const changed = row.proposed !== row.recorded;
        return (
          <div role="row" key={row.label} className="contents">
            <span role="rowheader" className={cn(CELL, "text-[13px] text-muted-foreground")}>
              {row.label}
            </span>
            <span role="cell" className={cn(CELL, row.recorded ? "font-mono text-sm font-medium" : "text-[13px] italic text-muted-foreground")}>
              {row.recorded ?? "Not recorded"}
            </span>
            <span role="cell" className={cn(CELL, "font-mono text-sm font-medium")}>
              {changed ? (
                <span data-changed="true" className="rounded-chip bg-pend-bg px-1.5 py-0.5 font-semibold text-pend">
                  {row.proposed ?? "Removed"}
                </span>
              ) : (
                <>
                  {row.proposed ?? <span className="font-sans text-[13px] italic text-muted-foreground">Not recorded</span>}
                  {row.proposed ? <span className="inline-block pl-1.5 font-sans text-xs font-normal text-muted-foreground">unchanged</span> : null}
                </>
              )}
            </span>
          </div>
        );
      })}
      <div role="row" className="contents">
        <span role="rowheader" className={cn(CELL, "text-[13px] text-muted-foreground")}>
          Credited
        </span>
        <span role="cell" className={cn(CELL, "font-mono text-sm font-medium")}>
          {formatDuration(creditedBefore)}
        </span>
        <span role="cell" className={cn(CELL, "flex items-baseline gap-2")}>
          <span className="font-mono text-sm font-semibold">{formatDuration(creditedAfter)}</span>
          {creditedAfter !== creditedBefore ? (
            <span className={cn("font-mono text-xs font-semibold", creditedAfter > creditedBefore ? "text-settled" : "text-negative")}>
              {formatDelta(creditedAfter - creditedBefore)}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
