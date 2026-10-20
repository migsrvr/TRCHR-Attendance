"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import type { AuditEntryVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const TD = "border-b border-hairline px-3 py-3 align-top text-[13px] leading-[18px]";

const when = (at: string) => {
  const [date, time] = at.split(" ");
  const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  return `${label} · ${time}`;
};

/** One audit entry; entries with a revision expand into a before/after grid. */
export function AuditRow({ entry }: { entry: AuditEntryVM }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <>
      <tr>
        <td className={cn(TD, "whitespace-nowrap pl-5 font-mono text-xs")}>{when(entry.at)}</td>
        <td className={TD}>
          {entry.actor.kind === "system" ? <span className="italic text-muted-foreground">{entry.actor.name}</span> : entry.actor.name}
        </td>
        <td className={TD}>{entry.action}</td>
        <td className={TD}>
          {entry.record.href ? (
            <Link href={entry.record.href} className="font-semibold text-primary hover:underline">
              {entry.record.label}
            </Link>
          ) : (
            entry.record.label
          )}
        </td>
        <td className={cn(TD, "pr-5 text-muted-foreground")}>
          {entry.detail ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => setOpen((current) => !current)}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              {entry.change}
              <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
          ) : (
            entry.change
          )}
        </td>
      </tr>
      {entry.detail ? (
        <tr id={detailId} hidden={!open}>
          <td colSpan={5} className="border-b border-hairline bg-background px-5 py-4">
            <div className="flex flex-wrap gap-6">
              <div role="table" aria-label="Before and after" className="grid min-w-0 flex-1 basis-72 grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)] text-[13px] leading-[18px]">
                <div role="row" className="contents">
                  <span role="columnheader" className="pb-1.5 text-xs font-semibold text-muted-foreground">
                    <span className="sr-only">Field</span>
                  </span>
                  <span role="columnheader" className="pb-1.5 text-xs font-semibold text-muted-foreground">
                    Before
                  </span>
                  <span role="columnheader" className="pb-1.5 text-xs font-semibold text-muted-foreground">
                    After
                  </span>
                </div>
                {entry.detail.rows.map((row) => (
                  <div role="row" key={row.label} className="contents">
                    <span role="rowheader" className="border-t border-hairline py-1.5 text-muted-foreground">
                      {row.label}
                    </span>
                    <span role="cell" className={cn("border-t border-hairline py-1.5 font-mono", row.before === "none" && "font-sans italic text-muted-foreground")}>
                      {row.before}
                    </span>
                    <span role="cell" className="border-t border-hairline py-1.5 font-mono">
                      {row.before !== row.after ? <span className="rounded-chip bg-pend-bg px-1.5 py-0.5 font-semibold text-pend">{row.after}</span> : row.after}
                    </span>
                  </div>
                ))}
              </div>
              <dl className="grid min-w-0 flex-1 basis-60 grid-cols-[auto_minmax(0,1fr)] content-start gap-x-3 gap-y-1.5 text-[13px] leading-[18px]">
                {entry.detail.facts.map((fact) => (
                  <div key={fact.label} className="contents">
                    <dt className="text-muted-foreground">{fact.label}</dt>
                    <dd className={fact.label === "Reference" ? "font-mono text-xs" : ""}>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
