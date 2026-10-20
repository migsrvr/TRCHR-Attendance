import { Download, FileText, Info, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { sessionSummary } from "@/components/attendance/day-timeline";
import { Button, buttonClasses } from "@/components/ui/button";
import { StatusMark } from "@/components/ui/status-mark";
import { PageHeader } from "@/components/ui/page-header";
import { PeriodFields } from "@/components/views/hr/period-fields";
import { formatRange } from "@/lib/ui/dtr";
import { formatDuration, formatShortDate } from "@/lib/ui/format";
import type { DtrDayVM, DtrDepartmentReportVM, DtrInternReportVM, DtrPageVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const TH = "border-b border-border px-3 py-2.5 text-left text-xs font-semibold leading-4 text-muted-foreground";
const TD = "border-b border-hairline px-3 py-2.5 align-top text-[13px] leading-[18px]";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card px-5 py-3.5">
      <p className="text-xs font-medium leading-4 text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-heading text-2xl font-bold leading-[30px] tabular-nums">
        {value}
        {sub ? <span className="ml-1.5 font-sans text-xs font-normal text-muted-foreground">{sub}</span> : null}
      </p>
    </div>
  );
}

function Sessions({ day, eachSession }: { day: DtrDayVM; eachSession: boolean }) {
  if (!day.sessions.length) return <span className="font-sans italic text-muted-foreground">No attendance</span>;
  if (day.state === "pending" || day.state === "open") {
    const last = day.sessions.at(-1)!;
    return (
      <>
        {last.start} → <span className="font-sans italic text-muted-foreground">{day.state === "open" ? "in progress" : "no Time out"}</span>
      </>
    );
  }
  if (!eachSession) {
    const summary = `${day.sessions[0]!.start}–${day.sessions.at(-1)!.end}`;
    return (
      <>
        {summary}
        {day.sessions.length > 1 ? <span className="ml-1.5 font-sans text-xs text-muted-foreground">{day.sessions.length} sessions</span> : null}
      </>
    );
  }
  return (
    <>
      {day.sessions.map((session, index) => (
        <Fragment key={session.start}>
          {index > 0 ? <br /> : null}
          {sessionSummary([session])}
        </Fragment>
      ))}
    </>
  );
}

function InternTable({ report, data }: { report: DtrInternReportVM; data: DtrPageVM }) {
  const { scope } = data;
  if (!report.days.length) {
    return <p className="px-5 py-6 text-sm text-muted-foreground">No attendance recorded for {report.intern.name} in this period.</p>;
  }
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse">
        <thead>
          <tr>
            <th scope="col" className={cn(TH, "pl-5")}>
              Date
            </th>
            <th scope="col" className={TH}>
              Sessions
            </th>
            {scope.includeRaw ? (
              <th scope="col" className={cn(TH, "text-right")}>
                Raw elapsed
              </th>
            ) : null}
            <th scope="col" className={cn(TH, "text-right")}>
              Credited
            </th>
            <th scope="col" className={cn(TH, "pr-5")}>
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {report.days.map((day) => {
            const counted = day.state === "credited";
            return (
              <tr key={day.dateIso} className={cn(day.state === "pending" && "bg-background")}>
                <th scope="row" className={cn(TD, "whitespace-nowrap pl-5 text-left font-semibold")}>
                  {formatShortDate(day.dateIso, { weekday: true })}
                </th>
                <td className={cn(TD, "font-mono")}>
                  <Sessions day={day} eachSession={scope.eachSession} />
                </td>
                {scope.includeRaw ? (
                  <td className={cn(TD, "text-right font-mono text-xs text-muted-foreground")}>
                    {day.rawMinutes === null ? "—" : formatDuration(day.rawMinutes)}
                  </td>
                ) : null}
                <td className={cn(TD, "text-right font-mono", !counted && "text-muted-foreground")}>
                  {day.state === "open" ? "—" : formatDuration(day.creditedMinutes)}
                </td>
                <td className={cn(TD, "pr-5 text-muted-foreground")}>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {day.correction ? (
                      <Link href={day.correction.href} className="hover:underline">
                        <StatusMark kind={day.correction.status} audience="hr" label={day.correction.status.type === "correction" && day.correction.status.value === "APPROVED" ? "Approved correction" : undefined} />
                      </Link>
                    ) : null}
                    {day.state === "open" ? "In progress, not counted yet" : null}
                    {day.note ? <span>{day.note}</span> : null}
                  </span>
                </td>
              </tr>
            );
          })}
          <tr>
            <th scope="row" colSpan={scope.includeRaw ? 3 : 2} className="px-3 py-3 pl-5 text-left text-[13px] font-bold">
              Total credited
            </th>
            <td className="px-3 py-3 text-right font-mono text-[13px] font-bold">{formatDuration(report.creditedMinutes)}</td>
            <td className="px-3 py-3 pr-5 text-xs text-muted-foreground">
              {report.pending.length ? "Pending rows add nothing until decided" : null}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DepartmentTable({ report }: { report: DtrDepartmentReportVM }) {
  if (!report.interns.length) return <p className="px-5 py-6 text-sm text-muted-foreground">No interns in {report.department}.</p>;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr>
            <th scope="col" className={cn(TH, "pl-5")}>
              Intern
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              Days credited
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              Credited
            </th>
            <th scope="col" className={cn(TH, "pr-5 text-right")}>
              Pending
            </th>
          </tr>
        </thead>
        <tbody>
          {report.interns.map((intern) => (
            <tr key={intern.id}>
              <th scope="row" className={cn(TD, "pl-5 text-left font-semibold")}>
                {intern.name}
              </th>
              <td className={cn(TD, "text-right font-mono")}>
                {intern.daysCredited} <span className="font-sans text-xs text-muted-foreground">of {report.workdays}</span>
              </td>
              <td className={cn(TD, "text-right font-mono")}>{formatDuration(intern.creditedMinutes)}</td>
              <td className={cn(TD, "pr-5 text-right font-mono", intern.pendingCount ? "font-semibold text-pend" : "text-muted-foreground")}>
                {intern.pendingCount}
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row" colSpan={2} className="px-3 py-3 pl-5 text-left text-[13px] font-bold">
              Total credited
            </th>
            <td className="px-3 py-3 text-right font-mono text-[13px] font-bold">{formatDuration(report.creditedMinutes)}</td>
            <td className="px-3 py-3 pr-5 text-right font-mono text-[13px]">{report.pendingCount}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PendingNotice({ report }: { report: DtrInternReportVM }) {
  const first = report.intern.name.split(" ")[0];
  const [only] = report.pending;
  return (
    <div className="mx-5 mb-4 flex items-start gap-2.5 rounded-btn bg-pend-bg px-4 py-3">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pend" />
      <p className="text-[13px] leading-[19px]">
        {report.pending.length === 1 && only ? (
          <>
            <span className="font-semibold text-pend">{formatShortDate(only.dateIso)} is not in the total yet.</span> {first}&apos;s{" "}
            {only.reason} correction is still open. Decide it first if this DTR is final, or export now and the row is marked
            pending.{" "}
            <Link href={only.href} className="font-semibold text-primary hover:underline">
              Open the request
            </Link>
          </>
        ) : (
          <>
            <span className="font-semibold text-pend">{report.pending.length} days are not in the total yet.</span> Their
            requests are still open. Decide them first if this DTR is final, or export now and the rows are marked pending.
          </>
        )}
      </p>
    </div>
  );
}

export function ReportsView({ data }: { data: DtrPageVM }) {
  const { scope, report } = data;
  const subjectValue = scope.subject.kind === "intern" ? scope.subject.id : `department:${scope.subject.name}`;
  const fallbackRange = data.exportHref.match(/from=([\d-]+)/)?.[1];

  return (
    <>
      <PageHeader
        title="Daily time records"
        subtitle="Pick an intern and a period, check the preview, then export. Uses the same calculation as the dashboard."
      />

      <div className="flex flex-wrap items-start gap-5">
        <form
          action="/hr/reports"
          className="flex min-w-0 shrink grow basis-[280px] flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-card"
        >
          <h3 className="font-heading text-base font-semibold uppercase leading-[22px] tracking-[0.02em]">Report scope</h3>
          <input type="hidden" name="options" value="1" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dtr-subject" className="text-[13px] font-semibold leading-[18px]">
              Intern or department
            </label>
            <select
              id="dtr-subject"
              name="subject"
              defaultValue={subjectValue}
              className="h-9 w-full rounded-btn border border-border bg-card px-3 text-[13px] text-foreground"
            >
              {data.subjects.map((subject) => (
                <option key={subject.value} value={subject.value}>
                  {subject.label}
                </option>
              ))}
            </select>
          </div>
          <PeriodFields period={scope.period} from={scope.from} to={scope.to} error={data.rangeError} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold leading-[18px]">Include</legend>
            {[
              { name: "each", label: "Each session on its own line", checked: scope.eachSession },
              { name: "pending", label: "Pending and held items", checked: scope.includePending },
              { name: "raw", label: "Raw elapsed time, labelled", checked: scope.includeRaw },
            ].map((option) => (
              <label key={option.name} className="flex min-h-8 items-center gap-2.5 text-[13px] leading-[18px]">
                <input type="checkbox" name={option.name} value="1" defaultChecked={option.checked} className="size-4 accent-primary" />
                {option.label}
              </label>
            ))}
          </fieldset>
          <Button type="submit">
            <RefreshCw aria-hidden="true" />
            Update preview
          </Button>
        </form>

        <section
          aria-labelledby="dtr-title"
          className="min-w-0 shrink grow-[3] basis-[640px] overflow-hidden rounded-card border border-border bg-card shadow-card"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5">
            <div className="min-w-0">
              <h3 id="dtr-title" className="text-base font-semibold leading-[22px]">
                {data.title}
              </h3>
              <p className="mt-1 text-xs leading-[18px] text-muted-foreground">{data.subtitle}</p>
              {data.rangeError && fallbackRange ? (
                <p className="mt-1 text-xs font-medium leading-[18px] text-attn">
                  Showing {data.title.split(" · ").at(-1)} until the range is fixed.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                aria-disabled="true"
                title="The PDF layout waits on HR's DTR template."
                className={cn(buttonClasses({ variant: "outline" }), "pointer-events-none opacity-60")}
              >
                <FileText aria-hidden="true" />
                PDF layout <span className="text-xs font-normal text-muted-foreground">needs HR template</span>
              </span>
              <a href={data.exportHref} download="" className={buttonClasses({ variant: "primary" })}>
                <Download aria-hidden="true" />
                Export CSV
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px border-y border-border bg-border lg:grid-cols-4">
            {report.kind === "intern" ? (
              <>
                <Stat label="Credited this period" value={formatDuration(report.creditedMinutes)} />
                <Stat label="Days credited" value={String(report.daysCredited)} sub={`of ${report.workdays} workdays`} />
                <Stat label="Pending items" value={String(report.pending.length)} />
                <Stat label="Remaining overall" value={formatDuration(report.remainingMinutes)} />
              </>
            ) : (
              <>
                <Stat label="Credited this period" value={formatDuration(report.creditedMinutes)} />
                <Stat label="Interns" value={String(report.interns.length)} />
                <Stat label="Pending items" value={String(report.pendingCount)} />
                <Stat label="Workdays" value={String(report.workdays)} sub={formatRange(scope.from, scope.to).split(",")[0]} />
              </>
            )}
          </div>

          <div className="pt-4">
            {report.kind === "intern" && scope.includePending && report.pending.length ? <PendingNotice report={report} /> : null}
            {report.kind === "intern" ? <InternTable report={report} data={data} /> : <DepartmentTable report={report} />}
          </div>
        </section>
      </div>
    </>
  );
}
