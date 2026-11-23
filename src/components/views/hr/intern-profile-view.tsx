import { FileText } from "lucide-react";
import Link from "next/link";

import { DayTimeline, sessionSummary } from "@/components/attendance/day-timeline";
import { HoursProgress } from "@/components/attendance/hours-progress";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusMark } from "@/components/ui/status-mark";
import { AccountActions } from "@/components/views/hr/account-actions";
import { EditInternDialog } from "@/components/views/hr/edit-intern-dialog";
import { ProfileTabs } from "@/components/views/hr/profile-tabs";
import { reasonLabel } from "@/lib/ui/correction-form";
import { formatDuration, formatShortDate } from "@/lib/ui/format";
import type { StatusKind } from "@/lib/ui/status";
import type { HistoryDayVM, InternProfileVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function dayStatus(day: HistoryDayVM, data: InternProfileVM): { kind: StatusKind; label?: string } | null {
  if (day.kind === "open") return { kind: { type: "session", value: "OPEN" } };
  if (day.kind === "complete") return { kind: { type: "session", value: "COMPLETE" } };
  if (day.kind === "incomplete") {
    const correction = day.correction && data.corrections.find((item) => item.id === day.correction!.id);
    return correction ? { kind: correction.status } : { kind: { type: "session", value: "REVIEW" }, label: "No Time out" };
  }
  return null;
}

function DayRow({ day, data }: { day: HistoryDayVM; data: InternProfileVM }) {
  const isToday = day.dateIso === data.todayIso;
  const status = dayStatus(day, data);
  const held = day.kind === "incomplete";

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-hairline px-5 py-3.5 sm:grid-cols-[92px_minmax(0,1fr)_72px_132px]",
        held && "bg-background",
      )}
    >
      <div>
        <p className="text-[13px] font-semibold leading-[18px]">{formatShortDate(day.dateIso, { weekday: true })}</p>
        {isToday ? <p className="text-xs leading-[18px] text-muted-foreground">today</p> : null}
      </div>
      <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
        {day.sessions.length ? (
          <DayTimeline sessions={day.sessions} schedule={data.schedule} nowClock={isToday ? data.nowClock : undefined} summary={false} />
        ) : null}
        <p className="mt-1 font-mono text-xs leading-[18px] text-muted-foreground">
          {day.sessions.length ? sessionSummary(day.sessions, isToday ? data.nowClock : undefined) : <span className="font-sans italic">No scans</span>}
          {day.correction && day.correction.status === "APPROVED" ? <span className="font-sans"> · approved correction</span> : null}
          {held && day.correction ? (
            <>
              {" · "}
              <Link href={`/hr/reviews/${day.correction.id}`} className="font-sans font-semibold text-primary hover:underline">
                correction open
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <span className="hidden text-right font-mono text-[13px] sm:block">
        {day.creditedMinutes === null ? "—" : formatDuration(day.creditedMinutes)}
      </span>
      <span className="col-start-2 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto">
        {status ? <StatusMark kind={status.kind} audience="hr" label={status.label} /> : null}
      </span>
    </div>
  );
}

function AttendancePanel({ data }: { data: InternProfileVM }) {
  if (!data.recentDays.length) {
    return <p className="px-5 py-6 text-sm text-muted-foreground">No attendance in the last 7 days.</p>;
  }
  const complete = data.recentDays.filter((day) => day.kind === "complete");
  const credited = data.recentDays.reduce((sum, day) => sum + (day.creditedMinutes ?? 0), 0);
  const firstName = data.name.split(" ")[0];

  return (
    <>
      {data.recentDays.map((day) => (
        <DayRow key={day.dateIso} day={day} data={data} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground">
        <span>
          Last 7 days: <span className="font-mono font-semibold text-foreground">{formatDuration(credited)}</span> credited
          across {plural(complete.length, "complete day")}
        </span>
        <Link href={`/hr/attendance?intern=${data.id}`} className="font-semibold text-primary hover:underline">
          All attendance for {firstName}
        </Link>
      </div>
    </>
  );
}

function CorrectionsPanel({ data }: { data: InternProfileVM }) {
  if (!data.corrections.length) return <p className="px-5 py-6 text-sm text-muted-foreground">No correction requests.</p>;
  return (
    <div>
      {data.corrections.map((correction) => (
        <Link
          key={correction.id}
          href={`/hr/reviews/${correction.id}`}
          className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3 last:border-b-0 hover:bg-muted"
        >
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-[18px] text-foreground">
              {formatShortDate(correction.dateIso, { weekday: true })}
            </span>
            <span className="block text-xs text-muted-foreground">{reasonLabel(correction.reason)}</span>
          </span>
          <StatusMark kind={correction.status} audience="hr" />
        </Link>
      ))}
    </div>
  );
}

function AssignmentsPanel({ data }: { data: InternProfileVM }) {
  return (
    <ul>
      {data.assignments.map((assignment) => (
        <li key={`${assignment.department}-${assignment.fromIso}`} className="flex justify-between gap-3 border-b border-hairline px-5 py-3 text-[13px] last:border-b-0">
          <span className="font-semibold">{assignment.department}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {formatShortDate(assignment.fromIso)} – {assignment.toIso ? formatShortDate(assignment.toIso) : "present"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function InternProfileView({ data, mock }: { data: InternProfileVM; mock: boolean }) {
  const { hours, stats } = data;
  const endYear = data.endDateIso ? data.endDateIso.slice(0, 4) : data.startDateIso.slice(0, 4);
  const dates = data.endDateIso
    ? `${formatShortDate(data.startDateIso)} – ${formatShortDate(data.endDateIso)}, ${endYear}`
    : `From ${formatShortDate(data.startDateIso)}, ${endYear}`;
  const live = data.today;
  const liveOpen = live?.status.type === "session" && live.status.value === "OPEN";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-pend-bg font-heading text-xl font-semibold text-pend"
          >
            {data.initials}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.01em]">{data.name}</h2>
              {live ? (
                <StatusMark kind={live.status} audience="hr" meta={live.time ? (liveOpen ? `since ${live.time}` : live.time) : undefined} />
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-[21px] text-muted-foreground">
              {data.department} · {data.email} · {dates}
            </p>
          </div>
        </div>
        <ButtonLink href={`/hr/reports?subject=${encodeURIComponent(data.id)}`} variant="outline">
          <FileText aria-hidden="true" />
          Generate DTR
        </ButtonLink>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 shrink grow basis-80 flex-col gap-5">
          <Card labelledBy="profile-hours-title">
            <CardHeader id="profile-hours-title" title="Hours" />
            <div className="px-5 pb-5">
              <HoursProgress
                creditedMinutes={hours.creditedMinutes}
                requiredMinutes={hours.requiredMinutes}
                endDateIso={data.endDateIso ?? undefined}
                workdaysLeft={hours.workdaysLeft}
              />
              {hours.pendingCorrections ? (
                <p className="mt-2.5 text-xs leading-[18px] text-muted-foreground">
                  {plural(hours.pendingCorrections, "pending correction")} could add {formatDuration(hours.pendingCreditMinutes)}{" "}
                  once decided.
                </p>
              ) : null}
            </div>
          </Card>

          {stats ? (
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border shadow-card">
              <Stat label="Days attended" value={String(stats.daysAttended)} />
              <Stat
                label="Average per day"
                value={stats.daysAttended ? formatDuration(Math.round(hours.creditedMinutes / stats.daysAttended)) : "—"}
              />
              <Stat
                label="Corrections"
                value={String(stats.corrections.total)}
                sub={`${stats.corrections.approved} approved · ${stats.corrections.rejected} rejected · ${stats.corrections.open} open`}
              />
              <Stat
                label="Rejected scans"
                value={String(stats.rejectedScans)}
                sub={stats.lastRejectedScan ? `${formatShortDate(stats.lastRejectedScan.dateIso)} · ${stats.lastRejectedScan.reason}` : undefined}
              />
            </dl>
          ) : null}

          <Card labelledBy="profile-internship-title">
            <CardHeader
              id="profile-internship-title"
              title="Internship"
              action={<EditInternDialog data={data} mock={mock} />}
            />
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 px-5 pb-4 text-[13px] leading-[18px]">
              <dt className="text-muted-foreground">Department</dt>
              <dd>
                {data.department} <span className="text-xs text-muted-foreground">since {formatShortDate(data.departmentSinceIso)}</span>
              </dd>
              <dt className="text-muted-foreground">Office</dt>
              <dd>{data.officeName}</dd>
              <dt className="text-muted-foreground">Required</dt>
              <dd className="font-mono">{formatDuration(hours.requiredMinutes)}</dd>
              <dt className="text-muted-foreground">Policy</dt>
              <dd>{data.policyLabel}</dd>
            </dl>
            <AccountActions
              internId={data.id}
              name={data.name}
              status={data.account.status}
              lastSignInLabel={data.account.lastSignInLabel}
              mock={mock}
            />
          </Card>
        </div>

        <ProfileTabs
          correctionCount={data.corrections.length}
          panels={{
            attendance: <AttendancePanel data={data} />,
            corrections: <CorrectionsPanel data={data} />,
            assignments: <AssignmentsPanel data={data} />,
          }}
        />
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card p-4">
      <dt className="text-xs font-medium leading-4 text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-heading text-2xl font-bold leading-[30px] tabular-nums">{value}</dd>
      {sub ? <dd className="text-xs leading-[18px] text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}
