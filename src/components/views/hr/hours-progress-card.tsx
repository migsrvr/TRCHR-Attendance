"use client";

import Link from "next/link";
import { useState } from "react";

import { CardHeader } from "@/components/ui/card";
import { TabList, tabPanelProps } from "@/components/ui/tab-list";
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
    <div className="relative overflow-x-auto">
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

/** Hours progress with a Behind pace / Finishing soon switch. */
export function HoursProgressCard({ behindPace, finishingSoon }: { behindPace: HoursRowVM[]; finishingSoon: HoursRowVM[] }) {
  const [active, setActive] = useState<TabId>("behind");

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
        action={<TabList label="Hours view" idBase="hours" tabs={TABS} active={active} onChange={setActive} />}
      />
      <div {...tabPanelProps("hours", active)}>
        <HoursTable rows={active === "behind" ? behindPace : finishingSoon} />
      </div>
    </section>
  );
}
