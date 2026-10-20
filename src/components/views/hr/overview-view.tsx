import { ArrowRight, FileText, UserPlus } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { KpiStrip } from "@/components/ui/kpi-strip";
import { PageHeader } from "@/components/ui/page-header";
import { StatusMark } from "@/components/ui/status-mark";
import { HoursProgressCard } from "@/components/views/hr/hours-progress-card";
import { formatLongDate, formatShortDate } from "@/lib/ui/format";
import { isOverdue } from "@/lib/ui/status";
import type { HrOverviewVM, NeedsYouItemVM, OfficeTodayItemVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const SUBJECT: Record<NeedsYouItemVM["subject"], string> = {
  correction: "correction for",
  "missing-day": "missing day",
  session: "session on",
};

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

function NeedsYouRow({ item }: { item: NeedsYouItemVM }) {
  return (
    <Link
      href={item.href}
      className="grid grid-cols-[minmax(0,1fr)_auto_40px] items-center gap-3 border-t border-hairline px-5 py-3 text-foreground hover:bg-muted"
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-[18px]">
          {item.internName} · {SUBJECT[item.subject]} {formatShortDate(item.dateIso)}
        </p>
        <p className="mt-0.5 truncate text-xs leading-[18px] text-muted-foreground">
          {item.jevRead ? <span className="mr-1.5 text-[11px] font-semibold tracking-[0.06em] text-settled">JEV</span> : null}
          {item.detail}
        </p>
      </div>
      <StatusMark kind={item.status} audience="hr" />
      <span
        className={cn(
          "text-right font-mono text-xs",
          isOverdue(item.status) ? "font-semibold text-attn" : "text-muted-foreground",
        )}
      >
        {item.ageDays}d
      </span>
    </Link>
  );
}

function OfficeTodayRow({ item }: { item: OfficeTodayItemVM }) {
  const open = item.status.type === "session" && item.status.value === "OPEN";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-[18px]">{item.name}</p>
        <p className="text-xs leading-[18px] text-muted-foreground">{item.department}</p>
      </div>
      <StatusMark kind={item.status} audience="hr" meta={open ? `since ${item.time}` : item.time} />
    </div>
  );
}

export function OverviewView({ data }: { data: HrOverviewVM }) {
  const { kpis } = data;

  return (
    <>
      <PageHeader
        title="Attendance overview"
        subtitle={`${formatLongDate(data.todayIso)} · updated ${data.updatedAt}`}
        actions={
          <>
            <ButtonLink href="/hr/reports" variant="outline">
              <FileText aria-hidden="true" />
              Generate DTR
            </ButtonLink>
            <ButtonLink href="/hr/interns?add=1">
              <UserPlus aria-hidden="true" />
              Add intern
            </ButtonLink>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: "In office now", value: kpis.inOffice, sub: `of ${kpis.activeInterns} active interns` },
          { label: "Completed today", value: kpis.completedToday, sub: "sessions closed with Time out" },
          { label: "Missing clock-out", value: kpis.missingClockOut, sub: "open sessions from earlier days" },
          {
            label: "Waiting on HR",
            value: kpis.waitingOnHr,
            sub: kpis.oldestWaitingDays !== null ? `oldest has waited ${days(kpis.oldestWaitingDays)}` : "nothing waiting",
            attention: kpis.waitingOnHr > 0,
          },
        ]}
      />

      <div className="flex flex-wrap items-start gap-5">
        <Card labelledBy="needs-you-title" className="shrink grow-[2] basis-[520px]">
          <CardHeader
            id="needs-you-title"
            title="Needs you"
            description="Corrections and sessions waiting on an HR decision · oldest first"
            action={
              <ButtonLink href="/hr/reviews" variant="ghost" size="sm">
                Open reviews
                <ArrowRight aria-hidden="true" />
              </ButtonLink>
            }
          />
          {data.needsYou.length ? (
            <div className="flex flex-col">
              {data.needsYou.map((item) => (
                <NeedsYouRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="border-t border-hairline px-5 py-6 text-sm text-muted-foreground">Nothing waiting on you.</p>
          )}
        </Card>

        <Card labelledBy="office-today-title" className="shrink grow basis-80">
          <CardHeader id="office-today-title" title="At the office today" description="Latest scans first" />
          <div className="flex flex-col">
            {data.officeToday.map((item) => (
              <OfficeTodayRow key={item.internId} item={item} />
            ))}
            <Link
              href="/hr/attendance"
              className="flex items-center justify-center gap-1.5 border-t border-hairline px-5 py-3 text-xs font-semibold text-primary hover:bg-muted"
            >
              View all {data.scansToday} scans today
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </Card>
      </div>

      <HoursProgressCard behindPace={data.behindPace} finishingSoon={data.finishingSoon} />
    </>
  );
}
