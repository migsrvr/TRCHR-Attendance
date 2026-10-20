import { ChevronRight, QrCode } from "lucide-react";
import Link from "next/link";

import { DayTimeline } from "@/components/attendance/day-timeline";
import { HoursProgress } from "@/components/attendance/hours-progress";
import { ButtonLink } from "@/components/ui/button";
import { StatusMark } from "@/components/ui/status-mark";
import { formatLongDate, formatShortDate } from "@/lib/ui/format";
import type { InternHomeVM } from "@/lib/ui/view-models";

function greeting(nowClock: string): string {
  const hour = Number(nowClock.slice(0, 2));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeView({ data }: { data: InternHomeVM }) {
  const firstName = data.identity.name.split(" ")[0];
  const { openSince, sessions } = data.today;
  const scansToday = sessions.length > 0;

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <div>
        <h1 className="font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.01em]">
          {greeting(data.nowClock)}, {firstName}
        </h1>
        <p className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground">
          {formatLongDate(data.todayIso, { year: false })} · {data.identity.department}
        </p>
      </div>

      <section className="rounded-panel border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold leading-5">Today</h2>
          {openSince ? (
            <StatusMark kind={{ type: "session", value: "OPEN" }} audience="intern" meta={`since ${openSince}`} />
          ) : scansToday ? (
            <StatusMark kind={{ type: "session", value: "COMPLETE" }} audience="intern" />
          ) : (
            <StatusMark kind={{ type: "today", value: "NOT_STARTED" }} audience="intern" />
          )}
        </div>

        {scansToday ? (
          <DayTimeline
            className="mt-3.5"
            sessions={sessions}
            schedule={data.schedule}
            nowClock={data.nowClock}
            ticks
            summary={false}
          />
        ) : null}

        <p className="mt-3 text-[13px] leading-[19px]">
          {openSince
            ? "Scan OUT before you leave. Today's hours count once the session is closed."
            : scansToday
              ? "Back in the office? Scan IN to start another session."
              : "Scan the IN code at the entrance when you arrive."}
        </p>

        <ButtonLink href="/scan" size="lg" className="mt-3.5 w-full">
          <QrCode aria-hidden="true" />
          {openSince ? "Scan OUT" : "Scan IN"}
        </ButtonLink>
      </section>

      <section className="rounded-panel border border-border bg-card p-4 shadow-card">
        <h2 className="mb-2 text-sm font-semibold leading-5">Internship hours</h2>
        <HoursProgress
          creditedMinutes={data.hours.creditedMinutes}
          requiredMinutes={data.hours.requiredMinutes}
          endDateIso={data.hours.endDateIso}
          workdaysLeft={data.hours.workdaysLeft}
        />
        {openSince ? (
          <p className="mt-2 text-xs leading-[18px] text-muted-foreground">Today&apos;s hours are added after you scan OUT.</p>
        ) : null}
      </section>

      {data.openCorrection ? (
        <Link
          href={`/corrections/${data.openCorrection.id}`}
          className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3.5 active:bg-muted"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-[18px]">
              {formatShortDate(data.openCorrection.dateIso)} correction
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-[18px] text-muted-foreground">
              <StatusMark kind={{ type: "correction", value: data.openCorrection.status }} audience="intern" />
              <span>{data.openCorrection.activity}</span>
            </div>
          </div>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}
    </div>
  );
}
