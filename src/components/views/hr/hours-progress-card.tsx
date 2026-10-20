"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";

import { CardHeader } from "@/components/ui/card";
import { formatDuration, formatHours, formatShortDate } from "@/lib/ui/format";
import { hoursProgress, paceStatus } from "@/lib/ui/hours";
import type { HoursRowVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "behind", label: "Behind pace" },
  { id: "finishing", label: "Finishing soon" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TH = "px-3 py-2.5 text-xs font-semibold leading-4 text-muted-foreground border-b border-border";
const TD = "px-3 py-3 border-b border-hairline group-last:border-b-0";

function HoursTable({ rows }: { rows: HoursRowVM[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr>
            <th scope="col" className={cn(TH, "pl-5 text-left")}>
              Intern
            </th>
            <th scope="col" className={cn(TH, "w-[38%] text-left")}>
              Credited
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              Remaining
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              End date
            </th>
            <th scope="col" className={cn(TH, "pr-5 text-right")}>
              Pace
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const progress = hoursProgress(row);
            const pace = paceStatus(row.paceDeltaMinutes);
            return (
              <tr key={row.internId} className="group">
                <td className={cn(TD, "pl-5")}>
                  <Link href={`/hr/interns/${row.internId}`} className="text-[13px] font-semibold text-foreground hover:underline">
                    {row.name}
                  </Link>
                  <div className="text-xs leading-[18px] text-muted-foreground">{row.department}</div>
                </td>
                <td className={TD}>
                  <div className="flex items-center gap-2.5">
                    <div aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                      <div className="h-full rounded-full bg-settled" style={{ width: `${progress.percent}%` }} />
                    </div>
                    <span className="whitespace-nowrap font-mono text-xs">
                      {formatDuration(row.creditedMinutes)} / {formatHours(row.requiredMinutes)}
                    </span>
                  </div>
                </td>
                <td className={cn(TD, "text-right font-mono text-[13px]")}>{formatDuration(progress.remainingMinutes)}</td>
                <td className={cn(TD, "text-right font-mono text-[13px]")}>{formatShortDate(row.endDateIso)}</td>
                <td
                  className={cn(
                    TD,
                    "pr-5 text-right font-mono text-[13px]",
                    pace.alert ? "font-semibold text-attn" : "text-muted-foreground",
                  )}
                >
                  {pace.label}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Hours progress with a Behind pace / Finishing soon switch (WAI-ARIA tabs, arrow keys move between them). */
export function HoursProgressCard({ behindPace, finishingSoon }: { behindPace: HoursRowVM[]; finishingSoon: HoursRowVM[] }) {
  const [active, setActive] = useState<TabId>("behind");
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ behind: null, finishing: null });

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.id === active);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    const id = TABS[next]!.id;
    setActive(id);
    tabRefs.current[id]?.focus();
  }

  return (
    <section aria-labelledby="hours-title" className="min-w-0 rounded-card border border-border bg-card shadow-card">
      <CardHeader
        id="hours-title"
        title="Hours progress"
        description={
          active === "behind"
            ? "Credited hours against each intern's required hours · furthest behind first"
            : "Credited hours against each intern's required hours · nearest end date first"
        }
        action={
          <div role="tablist" aria-label="Hours view" className="inline-flex gap-1 rounded-btn bg-muted p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[tab.id] = node;
                }}
                type="button"
                role="tab"
                id={`hours-tab-${tab.id}`}
                aria-controls="hours-panel"
                aria-selected={active === tab.id}
                tabIndex={active === tab.id ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={onKeyDown}
                className={cn(
                  "h-[30px] rounded-btnsm px-3 text-[13px]",
                  active === tab.id
                    ? "bg-card font-semibold text-foreground shadow-card"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />
      <div role="tabpanel" id="hours-panel" aria-labelledby={`hours-tab-${active}`}>
        <HoursTable rows={active === "behind" ? behindPace : finishingSoon} />
      </div>
    </section>
  );
}
