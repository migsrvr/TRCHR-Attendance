import { Lock, User } from "lucide-react";

import { CorrectionDiff } from "@/components/attendance/correction-diff";
import { DayTimeline } from "@/components/attendance/day-timeline";
import { GeofenceMark } from "@/components/attendance/geofence-mark";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusMark } from "@/components/ui/status-mark";
import { DecisionForm } from "@/components/views/hr/decision-form";
import { JevRetryButton } from "@/components/views/hr/jev-retry-button";
import { hrReasonLabel } from "@/lib/ui/correction-form";
import { formatDuration, formatHours, formatShortDate } from "@/lib/ui/format";
import type { ReviewDetailVM, ReviewTimesVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name.startsWith("[")
    ? "HR"
    : name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join("");

function timesSummary(times: ReviewTimesVM): string {
  if (times.timeIn && times.timeOut) return `${times.timeIn} – ${times.timeOut}`;
  if (times.timeIn) return `${times.timeIn} · no Time out`;
  if (times.timeOut) return `no Time in · ${times.timeOut}`;
  return "Nothing recorded";
}

function TimesTimeline({ title, times, data, ticks }: { title: string; times: ReviewTimesVM; data: ReviewDetailVM; ticks?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold leading-4 text-muted-foreground">{title}</p>
      <DayTimeline
        sessions={times.timeIn ? [{ start: times.timeIn, end: times.timeOut }] : []}
        schedule={data.schedule}
        ticks={ticks}
        summary={false}
      />
      <p className="mt-1 font-mono text-xs leading-[18px] text-muted-foreground">{timesSummary(times)}</p>
    </div>
  );
}

function JevCard({ data, firstName, mock, open }: { data: ReviewDetailVM; firstName: string; mock: boolean; open: boolean }) {
  const { jev } = data;
  return (
    <Card labelledBy="jev-title">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <h3 id="jev-title" className="flex items-baseline gap-2 text-sm font-semibold leading-5">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-settled">JEV</span>
          Reading
        </h3>
        <span className="text-xs leading-4 text-muted-foreground">Advisory only</span>
      </div>
      {jev.status === "read" ? (
        <div className="flex flex-col gap-3.5 px-5 pb-5">
          <div>
            <p className="text-xs leading-4 text-muted-foreground">Category</p>
            <p className="mt-0.5 flex items-baseline justify-between gap-2 text-sm font-semibold leading-5">
              {jev.category}
              <span className="font-mono text-xs font-medium text-muted-foreground">{jev.categoryScore.toFixed(2)}</span>
            </p>
          </div>
          <div>
            <p className="flex justify-between gap-2 text-xs leading-4 text-muted-foreground">
              Required details present<span className="font-mono text-foreground">{jev.detailsScore.toFixed(2)}</span>
            </p>
            <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track">
              <div className="h-full rounded-full bg-settled" style={{ width: `${Math.round(jev.detailsScore * 100)}%` }} />
            </div>
          </div>
          <p className="border-t border-hairline pt-3 text-xs leading-[18px] text-muted-foreground">
            Reads request version {jev.version} · {jev.model} · {jev.atLabel}. Jev can&apos;t confirm where {firstName} was or
            check times.
            {jev.version < data.version ? ` ${firstName} changed the request after this reading.` : ""}
          </p>
        </div>
      ) : jev.status === "pending" ? (
        <div className="px-5 pb-5">
          <p className="text-sm font-semibold leading-5">Reading…</p>
          <p className="mt-1 text-xs leading-[18px] text-muted-foreground">
            Jev is evaluating request version {data.version}. You can decide manually anytime without waiting.
          </p>
        </div>
      ) : jev.status === "superseded" ? (
        <div className="flex flex-col gap-2.5 px-5 pb-5">
          <div>
            <p className="text-xs leading-4 text-muted-foreground">Prior category (superseded)</p>
            <p className="mt-0.5 text-sm font-medium leading-5 text-muted-foreground line-through">{jev.category}</p>
          </div>
          <p className="border-t border-hairline pt-2.5 text-xs leading-[18px] text-muted-foreground">
            Covers request version {jev.version} · {jev.model} · {jev.atLabel}. {firstName} updated the request to version{" "}
            {data.version}; a fresh reading is queued.
          </p>
        </div>
      ) : (
        <div className="px-5 pb-5">
          <p className="text-sm font-semibold leading-5">Manual review</p>
          <p className="mt-1 text-xs leading-[18px] text-muted-foreground">
            Jev couldn&apos;t read this request, so it has no category. Decide from the explanation and the scans.
          </p>
          {jev.canRetry && open ? <JevRetryButton correctionId={data.id} mock={mock} /> : null}
        </div>
      )}
    </Card>
  );
}

function EvidenceCard({ data }: { data: ReviewDetailVM }) {
  return (
    <Card labelledBy="evidence-title">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <h3 id="evidence-title" className="text-sm font-semibold leading-5">
          Scan evidence
        </h3>
        <span className="inline-flex items-center gap-1 text-xs leading-4 text-muted-foreground">
          <Lock aria-hidden="true" className="size-3" />
          HR only
        </span>
      </div>
      {data.evidence.map((scan) => (
        <div key={scan.time} className="flex flex-col gap-3 px-5 pb-4">
          <div className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-4">
            <GeofenceMark distanceM={scan.distanceM} radiusM={scan.radiusM} accuracyM={scan.accuracyM} accepted={scan.accepted} />
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px] leading-[18px]">
              <dt className="text-muted-foreground">{scan.action}</dt>
              <dd className="font-mono">{scan.time}</dd>
              <dt className="text-muted-foreground">QR</dt>
              <dd>{scan.qrLabel}</dd>
              <dt className="text-muted-foreground">Distance</dt>
              <dd className="font-mono">
                {scan.distanceM} m of {scan.radiusM} m
              </dd>
              <dt className="text-muted-foreground">Accuracy</dt>
              <dd className="font-mono">±{scan.accuracyM} m</dd>
              <dt className="text-muted-foreground">Result</dt>
              <dd>
                <StatusMark kind={{ type: "scan", value: scan.accepted ? "ACCEPTED" : "REJECTED" }} audience="hr" />
              </dd>
            </dl>
          </div>
          {scan.photoDataUrl || scan.wallPosterDataUrl ? (
            <div className="flex items-center gap-2.5 rounded-btn border border-hairline bg-background/60 p-2.5">
              {scan.photoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={scan.photoDataUrl}
                  alt={`Verification selfie at ${scan.time}`}
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
              <div className="min-w-0 text-xs leading-4 text-muted-foreground">
                <p className="font-medium text-settled">In-app camera verified</p>
                {scan.photoSha256 ? (
                  <p className="truncate font-mono text-[11px]">sha256:{scan.photoSha256.slice(0, 12)}</p>
                ) : null}
              </div>
            </div>
          ) : null}
          {scan.securityWarnings?.length ? (
            <div className="flex flex-wrap gap-1.5">
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
        </div>
      ))}
      {data.evidenceNote ? (
        <p className="border-t border-hairline px-5 pb-4 pt-3 text-[13px] leading-[19px] text-muted-foreground">{data.evidenceNote}</p>
      ) : null}
    </Card>
  );
}

export function ReviewDetailView({
  data,
  mock,
  initialConflict = false,
}: {
  data: ReviewDetailVM;
  mock: boolean;
  /** Development switch to preview the 409 state. */
  initialConflict?: boolean;
}) {
  const firstName = data.internName.split(" ")[0]!;
  const dateLabel = formatShortDate(data.dateIso);
  const open = data.state === "PENDING" || data.state === "NEEDS_INFO";
  const delta = data.proposed.creditedMinutes - data.recorded.creditedMinutes;
  const labels = open
    ? { recorded: "Recorded now", proposed: "If approved" }
    : { recorded: "Originally recorded", proposed: data.state === "APPROVED" ? "Approved times" : "Proposed, not applied" };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.01em]">
              {hrReasonLabel(data.reason)} · {dateLabel}
            </h2>
            <StatusMark kind={data.status} audience="hr" />
          </div>
          <p className="mt-1 text-sm leading-[21px] text-muted-foreground">
            {data.internName} · {data.department} · submitted {data.submittedLabel} · request version {data.version}
          </p>
        </div>
        <ButtonLink href={`/hr/interns/${data.internId}`} variant="outline">
          <User aria-hidden="true" />
          Intern profile
        </ButtonLink>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 shrink grow-[2] basis-[560px] flex-col gap-5">
          <Card labelledBy="change-title">
            <CardHeader
              id="change-title"
              title="The change"
              description={`Recorded values against what ${firstName} proposes · ${data.policyNote}`}
            />
            <div className="px-2">
              <CorrectionDiff
                rows={[
                  { label: "Time in", recorded: data.recorded.timeIn, proposed: data.proposed.timeIn },
                  { label: "Time out", recorded: data.recorded.timeOut, proposed: data.proposed.timeOut },
                ]}
                creditedBefore={data.recorded.creditedMinutes}
                creditedAfter={data.proposed.creditedMinutes}
                labels={labels}
              />
            </div>
            <div className="mt-2 flex flex-col gap-3.5 border-t border-hairline px-5 pb-5 pt-4">
              <TimesTimeline title={labels.recorded} times={data.recorded} data={data} />
              <TimesTimeline title={labels.proposed} times={data.proposed} data={data} ticks />
              <p className="text-xs leading-[18px] text-muted-foreground">
                Shaded band: scheduled hours {data.schedule.start}–{data.schedule.end}.
                {open && delta
                  ? ` Approving moves ${firstName} from ${formatDuration(data.hours.creditedMinutes)} to ${formatDuration(
                      data.hours.creditedMinutes + delta,
                    )} of ${formatHours(data.hours.requiredMinutes)}.`
                  : ""}
              </p>
            </div>
          </Card>

          <Card labelledBy="comments-title">
            <CardHeader id="comments-title" title="Explanation and comments" />
            <ol className="flex flex-col gap-4 px-5 pb-5">
              {data.comments.map((comment, index) => (
                <li key={comment.id} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-xs font-semibold",
                      comment.author === "hr" ? "bg-primary text-primary-foreground" : "bg-pend-bg text-pend",
                    )}
                  >
                    {initials(comment.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] leading-[18px]">
                      <span className="font-semibold">{comment.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {comment.author === "hr" ? "HR" : "Intern"}
                        {comment.label ? ` · ${comment.label}` : index === 0 ? " · reason" : ""} · {comment.atLabel}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-[21px]">{comment.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {open ? (
              <DecisionForm
                correctionId={data.id}
                version={data.version}
                expectedSessionVersion={data.expectedSessionVersion}
                expectedAttendanceVersion={data.expectedAttendanceVersion}
                firstName={firstName}
                dateLabel={dateLabel}
                mock={mock}
                initialConflict={initialConflict}
              />
            ) : data.decisionNote ? (
              <div className="border-t border-hairline px-5 py-4">
                <p className="text-xs font-semibold leading-4 text-muted-foreground">Decision note</p>
                <p className="mt-1 text-sm leading-[21px]">{data.decisionNote}</p>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="flex min-w-0 shrink grow basis-80 flex-col gap-5">
          <JevCard data={data} firstName={firstName} mock={mock} open={open} />
          <EvidenceCard data={data} />
          <Card labelledBy="history-title">
            <CardHeader id="history-title" title="History" />
            <ol className="flex flex-col gap-3 px-5 pb-5">
              {data.history.map((entry) => (
                <li key={`${entry.label}-${entry.atLabel}`} className="grid grid-cols-[12px_minmax(0,1fr)] gap-2.5">
                  <span aria-hidden="true" className="mt-1.5 size-[7px] rounded-full border-[1.5px] border-pend" />
                  <div>
                    <p className="text-[13px] font-medium leading-[18px]">{entry.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">{entry.atLabel}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
