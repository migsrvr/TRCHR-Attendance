import { FileDown, Lock, Search, User, X } from "lucide-react";
import Link from "next/link";

import { DayTimeline, sessionSummary } from "@/components/attendance/day-timeline";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusMark } from "@/components/ui/status-mark";
import { AskCorrectionButton } from "@/components/views/hr/ask-correction-button";
import { formatDayHeading, formatDuration, formatShortDate } from "@/lib/ui/format";
import type { AttendanceDayVM, AttendanceRowVM, AttendanceVM, SessionDetailVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const TH = "border-b border-border px-3 py-2.5 text-left text-xs font-semibold leading-4 text-muted-foreground";
const TD = "border-b border-hairline px-3 py-3 align-middle text-[13px] leading-[18px]";

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "open", label: "Open" },
  { value: "complete", label: "Complete" },
  { value: "review", label: "Held or waiting on a request" },
  { value: "rejected", label: "Scan rejected" },
];

function attendanceHref(data: AttendanceVM, session?: string) {
  const search = new URLSearchParams();
  if (data.query) search.set("q", data.query);
  if (data.department) search.set("department", data.department);
  if (data.status !== "all") search.set("status", data.status);
  if (data.from) search.set("from", data.from);
  if (data.to) search.set("to", data.to);
  if (session) search.set("session", session);
  const qs = search.toString();
  return `/hr/attendance${qs ? `?${qs}` : ""}${session ? "#session-detail" : ""}`;
}

function Legend() {
  const item = "inline-flex items-center gap-1.5";
  return (
    <div aria-label="Timeline key" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className={item}>
        <span aria-hidden="true" className="h-2.5 w-4 rounded-chip bg-settled" />
        Complete
      </span>
      <span className={item}>
        <span aria-hidden="true" className="h-2.5 w-4 rounded-chip border-[1.5px] border-pend bg-pend-bg" />
        Open
      </span>
      <span className={item}>
        <span aria-hidden="true" className="h-2.5 w-4 rounded-chip border-[1.5px] border-dashed border-attn bg-attn-bg" />
        Held for review
      </span>
      <span className={item}>
        <span aria-hidden="true" className="h-2.5 w-4 rounded-chip bg-schedule-band" />
        Scheduled
      </span>
    </div>
  );
}

function Row({ row, day, data }: { row: AttendanceRowVM; day: AttendanceDayVM; data: AttendanceVM }) {
  const selected = data.selected?.id === row.id;
  const now = day.isToday ? data.nowClock : undefined;
  return (
    <tr aria-current={selected ? "true" : undefined} data-attendance-row className={cn(selected && "bg-muted")}>
      <td className={cn(TD, "pl-5")}>
        <Link href={attendanceHref(data, row.id)} className="font-semibold text-foreground hover:underline">
          {row.internName}
        </Link>
        <div className="text-xs text-muted-foreground">{row.department}</div>
      </td>
      <td className={cn(TD, "w-[48%]")}>
        <DayTimeline sessions={row.sessions} schedule={data.schedule} nowClock={now} review={row.held} summary={false} />
        <p className="mt-1 font-mono text-xs leading-[18px] text-muted-foreground">
          {row.summary ?? sessionSummary(row.sessions, now)}
          {row.note ? (
            <>
              {" · "}
              <Link href={row.note.href} className="font-sans font-semibold text-primary hover:underline">
                {row.note.label}
              </Link>
            </>
          ) : null}
        </p>
      </td>
      {row.held ? (
        <td data-credited="held" className={cn(TD, "text-right font-mono text-xs italic text-muted-foreground")}>
          held
        </td>
      ) : row.creditedMinutes === null ? (
        <td data-credited="open" className={cn(TD, "text-right font-mono text-muted-foreground")}>
          —
        </td>
      ) : (
        <td data-credited="minutes" className={cn(TD, "text-right font-mono")}>
          {formatDuration(row.creditedMinutes)}
        </td>
      )}
      <td className={cn(TD, "pr-5")}>
        <StatusMark kind={row.status} audience="hr" />
      </td>
    </tr>
  );
}

function at(dateIso: string, time: string | null) {
  return time ? `${formatShortDate(dateIso)} · ${time}` : null;
}

function SessionPanel({ detail, data, mock }: { detail: SessionDetailVM; data: AttendanceVM; mock: boolean }) {
  const firstName = detail.internName.split(" ")[0]!;
  const held = detail.status.type === "session" && detail.status.value === "REVIEW";
  const label = "text-xs font-semibold leading-4 text-muted-foreground";

  return (
    <aside
      id="session-detail"
      aria-label="Session detail"
      className="min-w-0 shrink grow basis-80 scroll-mt-4 rounded-card border border-border bg-card shadow-card"
    >
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5">
            {detail.internName} · {formatShortDate(detail.dateIso)}
          </h3>
          <p className="mt-0.5 text-xs leading-[18px] text-muted-foreground">
            {detail.department} · session v{detail.version} · policy v{detail.policyVersion}
          </p>
        </div>
        <Link
          href={attendanceHref(data)}
          aria-label="Close session detail"
          className="flex size-8 shrink-0 items-center justify-center rounded-btnsm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <div className="px-5 pb-4">
        <StatusMark kind={detail.status} audience="hr" />
      </div>

      {detail.heldReason ? (
        <p className="mx-5 mb-4 rounded-btn border border-attn/35 bg-attn-bg px-3.5 py-3 text-[13px] leading-[19px]">
          <span className="font-semibold">{held ? "Held for review." : "No credit yet."}</span> {detail.heldReason}
        </p>
      ) : null}

      <div className="border-t border-hairline px-5 py-4">
        <p className={label}>Effective session</p>
        {detail.effective.length ? (
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px] leading-[18px]">
            {detail.effective.map((session, index) => (
              <div key={index} className="contents">
                <dt className="text-muted-foreground">Time in</dt>
                <dd className={session.timeIn ? "font-mono" : "italic text-muted-foreground"}>
                  {at(detail.dateIso, session.timeIn) ?? "Not recorded"}
                </dd>
                <dt className="text-muted-foreground">Time out</dt>
                <dd className={session.timeOut ? "font-mono" : "italic text-muted-foreground"}>
                  {at(session.timeOutDateIso ?? detail.dateIso, session.timeOut) ?? "Not recorded"}
                </dd>
              </div>
            ))}
            {detail.elapsedMinutes !== null ? (
              <>
                <dt className="text-muted-foreground">Elapsed</dt>
                <dd className="font-mono">
                  {formatDuration(detail.elapsedMinutes)}
                  {detail.creditedMinutes === null ? (
                    <span className="ml-1.5 font-sans text-xs text-muted-foreground">raw, not credited</span>
                  ) : null}
                </dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Credited</dt>
            <dd className="font-mono">{detail.creditedMinutes === null ? "—" : formatDuration(detail.creditedMinutes)}</dd>
          </dl>
        ) : (
          <p className="mt-1.5 text-[13px] italic text-muted-foreground">No session: nothing was accepted this day.</p>
        )}
      </div>

      <div className="border-t border-hairline px-5 py-4">
        <p className={cn(label, "flex items-center justify-between")}>
          Original scans
          <span className="inline-flex items-center gap-1 font-normal">
            <Lock aria-hidden="true" className="size-3" />
            HR only
          </span>
        </p>
        {detail.scans.length ? (
          <ul className="mt-2 flex flex-col gap-3">
            {detail.scans.map((scan) => (
              <li
                key={`${scan.dateIso ?? ""}${scan.time}`}
                className="flex flex-col gap-1.5 rounded-btn border border-hairline bg-background/50 p-2.5 text-[13px] leading-[18px]"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                  <span className="font-mono">
                    {scan.dateIso ? `${formatShortDate(scan.dateIso)} · ` : ""}
                    {scan.time}
                  </span>
                  <span className="min-w-0 flex-1">
                    {scan.qrLabel} <span className="text-xs text-muted-foreground">· {scan.distanceM} m</span>
                  </span>
                  <StatusMark kind={{ type: "scan", value: scan.accepted ? "ACCEPTED" : "REJECTED" }} audience="hr" />
                </div>
                {scan.rejectReason ? (
                  <span className="text-xs text-muted-foreground">Rejected: {scan.rejectReason}</span>
                ) : null}
                {scan.photoDataUrl || scan.wallPosterDataUrl ? (
                  <div className="mt-1 flex items-center gap-2">
                    {scan.photoDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={scan.photoDataUrl}
                        alt={`${detail.internName} verification selfie at ${scan.time}`}
                        title={scan.photoSha256 ? `SHA-256: ${scan.photoSha256.slice(0, 16)}…` : undefined}
                        loading="lazy"
                        decoding="async"
                        className="h-14 w-20 rounded border border-border object-cover"
                      />
                    ) : null}
                    {scan.wallPosterDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={scan.wallPosterDataUrl}
                        alt={`Wall QR poster frame at ${scan.time}`}
                        loading="lazy"
                        decoding="async"
                        className="h-14 w-20 rounded border border-border object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 text-[11px] leading-4 text-muted-foreground">
                      <p className="font-medium text-settled">In-app photo verified</p>
                      {scan.photoSha256 ? (
                        <p className="truncate font-mono">sha256:{scan.photoSha256.slice(0, 12)}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {scan.securityWarnings?.length ? (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {scan.securityWarnings.map((warning) => (
                      <span
                        key={warning}
                        className="rounded-chip border border-attn/35 bg-attn-bg px-2 py-0.5 text-[11px] font-medium text-attn"
                      >
                        {warning}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[13px] italic text-muted-foreground">No scans this day.</p>
        )}
      </div>

      <div className="border-t border-hairline px-5 py-4">
        <p className={label}>Revisions</p>
        {detail.revisions.length ? (
          <ul className="mt-2 flex flex-col gap-2">
            {detail.revisions.map((revision) => (
              <li key={revision.atLabel} className="text-[13px] leading-[18px]">
                <p className="font-medium">{revision.label}</p>
                <p className="font-mono text-xs text-muted-foreground">{revision.atLabel}</p>
                <p className="mt-0.5 font-mono text-xs">
                  <span className={revision.before === "Not recorded" ? "font-sans italic text-muted-foreground" : ""}>{revision.before}</span>
                  {" → "}
                  <span className="font-semibold text-pend">{revision.after}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[13px] leading-[19px] text-muted-foreground">
            None yet. Approved corrections appear here with before and after values.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline px-5 py-4">
        {detail.canAskForCorrection ? <AskCorrectionButton sessionId={detail.id} firstName={firstName} mock={mock} /> : null}
        {detail.correction ? (
          <ButtonLink href={detail.correction.href} variant={detail.canAskForCorrection ? "outline" : "primary"} className="w-full">
            {detail.correction.label}
          </ButtonLink>
        ) : null}
        <ButtonLink href={`/hr/interns/${detail.internId}`} variant="outline" className="w-full">
          <User aria-hidden="true" />
          Intern profile
        </ButtonLink>
      </div>
    </aside>
  );
}

export function AttendanceView({ data, mock }: { data: AttendanceVM; mock: boolean }) {
  const filtered = Boolean(data.query || data.department || data.status !== "all" || data.hasCustomRange);

  return (
    <>
      <PageHeader
        title="Attendance records"
        subtitle={`Every session, grouped by office day · ${data.periodLabel} · times in ${data.timeZone ?? "Asia/Manila"}`}
        actions={
          <ButtonLink href="/hr/reports" variant="outline">
            <FileDown aria-hidden="true" />
            Export filtered view
          </ButtonLink>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action="/hr/attendance" role="search" className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 w-56 items-center gap-2 rounded-btn border border-border bg-card px-3 text-[13px] text-muted-foreground focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
            <Search aria-hidden="true" className="size-4 shrink-0" />
            <span className="sr-only">Search by intern</span>
            <input
              type="search"
              name="q"
              defaultValue={data.query}
              placeholder="Search by intern"
              className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <label htmlFor="attendance-filter-department" className="sr-only">
            Department
          </label>
          <AutoSubmitSelect
            id="attendance-filter-department"
            name="department"
            value={data.department ?? ""}
            options={[{ value: "", label: "All departments" }, ...data.departments.map((d) => ({ value: d, label: d }))]}
          />
          <label htmlFor="attendance-filter-status" className="sr-only">
            Status
          </label>
          <AutoSubmitSelect id="attendance-filter-status" name="status" value={data.status === "all" ? "" : data.status} options={STATUS_OPTIONS} />
          <label htmlFor="attendance-filter-from" className="sr-only">
            From date
          </label>
          <input
            id="attendance-filter-from"
            type="date"
            name="from"
            defaultValue={data.from ?? ""}
            aria-label="From date"
            className="h-9 rounded-btn border border-border bg-card px-2.5 font-mono text-xs text-foreground"
          />
          <label htmlFor="attendance-filter-to" className="sr-only">
            To date
          </label>
          <input
            id="attendance-filter-to"
            type="date"
            name="to"
            defaultValue={data.to ?? ""}
            aria-label="To date"
            className="h-9 rounded-btn border border-border bg-card px-2.5 font-mono text-xs text-foreground"
          />
          <Button type="submit" variant="outline" size="sm">
            Apply
          </Button>
        </form>
        <Legend />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="shrink grow-[2] basis-[560px]">
          {data.days.length ? (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className={cn(TH, "pl-5")}>
                      Intern
                    </th>
                    <th scope="col" className={TH}>
                      Day · 08:00 to 20:00
                    </th>
                    <th scope="col" className={cn(TH, "text-right")}>
                      Credited
                    </th>
                    <th scope="col" className={cn(TH, "pr-5")}>
                      Status
                    </th>
                  </tr>
                </thead>
                {data.days.map((day) => (
                  <tbody key={day.dateIso}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={4}
                        className="border-b border-border bg-background px-5 py-2 text-left text-xs font-semibold leading-4"
                      >
                        {formatDayHeading(day.dateIso)}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {day.isToday ? "today · " : ""}
                          {day.scans} scans
                        </span>
                      </th>
                    </tr>
                    {day.rows.map((row) => (
                      <Row key={row.id} row={row} day={day} data={data} />
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 px-5 py-8">
              <p className="text-sm text-muted-foreground">No sessions match these filters.</p>
              {filtered ? (
                <ButtonLink href="/hr/attendance" variant="outline" size="sm">
                  Clear filters
                </ButtonLink>
              ) : null}
            </div>
          )}
          <p className="px-5 py-3 text-xs leading-[18px] text-muted-foreground">
            Credited uses completed sessions only. Open and held sessions add nothing until they close or are corrected.
          </p>
        </Card>

        {data.selected ? <SessionPanel detail={data.selected} data={data} mock={mock} /> : null}
      </div>
    </>
  );
}
