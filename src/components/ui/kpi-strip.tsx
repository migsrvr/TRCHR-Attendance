import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export interface KpiItem {
  label: string;
  value: string | number;
  sub?: string;
  /** Someone has to act: the number turns crimson. */
  attention?: boolean;
}

/** One card split into equal cells by 1px rules: two per row, all in one row from 1024px. */
export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border shadow-card lg:grid-cols-[repeat(var(--kpi-count),minmax(0,1fr))]"
      style={{ "--kpi-count": items.length } as CSSProperties}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-card p-4">
          <p className="text-xs font-medium leading-4 text-muted-foreground">{item.label}</p>
          <p
            className={cn(
              "mt-0.5 font-heading text-[32px] font-bold leading-9 tabular-nums",
              item.attention && "text-attn",
            )}
          >
            {item.value}
          </p>
          {item.sub ? <p className="mt-0.5 text-xs leading-[18px] text-muted-foreground">{item.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
