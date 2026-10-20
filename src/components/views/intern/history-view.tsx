import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { sessionSummary } from "@/components/attendance/day-timeline";
import { StatusMark } from "@/components/ui/status-mark";
import { formatDuration, formatMonthLabel, shiftMonth } from "@/lib/ui/format";
import type { HistoryDayVM, InternHistoryVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

function dayParts(dateIso: string) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date),
    day: String(date.getUTCDate()),
  };
}

function DayStatus({ day }: { day: HistoryDayVM }): ReactNode {
  if (day.kind === "open") return <StatusMark kind={{ type: "session", value: "OPEN" }} audience="intern" />;
  if (day.corrected) {
    return <StatusMark kind={{ type: "correction", value: "APPROVED" }} audience="intern" label="Corrected by HR" />;
  }
  if (day.correction) {
    const waiting = day.correction.status === "PENDING";
    return (
      <StatusMark
        kind={{ type: "correction", value: day.correction.status }}
        audience="intern"
        label={waiting ? "Correction waiting on HR" : undefined}
      />
    );
  }
  if (day.kind === "complete") return <StatusMark kind={{ type: "session", value: "COMPLETE" }} audience="intern" />;
  return null;
}

function DayRow({ day }: { day: HistoryDayVM }) {
  const { weekday, day: dayNumber } = dayParts(day.dateIso);
  const needsRequest = !day.correction && (day.kind === "none" || day.kind === "incomplete");

  const body = (
    <>
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase leading-[14px] text-muted-foreground">{weekday}</p>
        <p className={cn("font-heading text-lg font-bold leading-[22px]", day.kind === "none" && "text-muted-foreground")}>
          {dayNumber}
        </p>
      </div>
      <div className="min-w-0">
        {day.sessions.length > 0 ? (
          <p className="font-mono text-[13px] leading-[18px]">{sessionSummary(day.sessions, day.kind === "open" ? "now" : undefined)}</p>
        ) : (
          <p className="text-[13px] italic leading-[18px] text-muted-foreground">No scans</p>
        )}
        <div className="mt-0.5 [&>span]:text-xs">
          <DayStatus day={day} />
        </div>
        {needsRequest ? (
          <span className="mt-0.5 inline-block text-xs font-semibold leading-4 text-primary">Request a correction</span>
        ) : null}
      </div>
      <span
        className={cn(
          "text-right font-mono text-[13px]",
          day.creditedMinutes ? "font-semibold" : "text-muted-foreground",
        )}
      >
        {day.creditedMinutes === null ? "—" : formatDuration(day.creditedMinutes)}
      </span>
    </>
  );

  // Rows that lead somewhere are links across their full height, so the tap
  // target is the whole row rather than a small text link.
  const rowClass = "grid grid-cols-[40px_minmax(0,1fr)_64px] items-center gap-3 px-3.5 py-2.5";
  const href = day.correction
    ? `/corrections/${day.correction.id}`
    : needsRequest
      ? `/corrections/new?date=${day.dateIso}`
      : null;
  return (
    <li data-day={day.dateIso} className="border-t border-hairline first:border-t-0">
      {href ? (
        <Link href={href} className={cn(rowClass, day.correction && "bg-background", "active:bg-muted")}>
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

export function HistoryView({ data }: { data: InternHistoryVM }) {
  const previous = shiftMonth(data.monthIso, -1);
  const next = shiftMonth(data.monthIso, 1);
  const monthLabel = formatMonthLabel(data.monthIso);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.01em]">History</h1>
        <nav aria-label="Month" className="flex items-center">
          <Link
            href={`/history?month=${previous}`}
            aria-label={`Previous month, ${formatMonthLabel(previous)}`}
            className="flex size-11 items-center justify-center rounded-btn active:bg-muted"
          >
            <ChevronLeft aria-hidden="true" className="size-[18px]" />
          </Link>
          <span className="min-w-[110px] text-center text-sm font-semibold">{monthLabel}</span>
          {data.canGoNext ? (
            <Link
              href={`/history?month=${next}`}
              aria-label={`Next month, ${formatMonthLabel(next)}`}
              className="flex size-11 items-center justify-center rounded-btn active:bg-muted"
            >
              <ChevronRight aria-hidden="true" className="size-[18px]" />
            </Link>
          ) : (
            <span aria-hidden="true" className="flex size-11 items-center justify-center text-border">
              <ChevronRight className="size-[18px]" />
            </span>
          )}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border">
        <div className="bg-card px-3.5 py-3">
          <p className="text-xs leading-4 text-muted-foreground">Credited this month</p>
          <p className="mt-0.5 font-heading text-[22px] font-bold leading-7">{formatDuration(data.creditedMinutes)}</p>
        </div>
        <div className="bg-card px-3.5 py-3">
          <p className="text-xs leading-4 text-muted-foreground">Days with hours</p>
          <p className="mt-0.5 font-heading text-[22px] font-bold leading-7">
            {data.daysWithHours}{" "}
            {data.workdays > 0 ? (
              <span className="font-sans text-xs font-normal text-muted-foreground">of {data.workdays} workdays</span>
            ) : null}
          </p>
        </div>
      </div>

      {data.days.length === 0 ? (
        <section className="rounded-card border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm font-semibold">No attendance recorded in {monthLabel}</p>
          <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
            Days you scan in appear here with the hours they earned.
          </p>
        </section>
      ) : (
        <ul className="overflow-hidden rounded-card border border-border bg-card">
          {data.days.map((day) => (
            <DayRow key={day.dateIso} day={day} />
          ))}
        </ul>
      )}
    </div>
  );
}
