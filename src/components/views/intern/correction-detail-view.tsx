import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { StatusMark } from "@/components/ui/status-mark";
import { CorrectionThread } from "@/components/views/intern/correction-thread";
import { reasonLabel } from "@/lib/ui/correction-form";
import { formatDelta, formatDuration, formatShortDate } from "@/lib/ui/format";
import type { CorrectionDetailVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

function ChangeRow({ label, recorded, proposed, first }: { label: string; recorded: string | null; proposed?: string; first?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2.5", !first && "border-t border-hairline")}>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {proposed ? (
        <span className="flex items-center gap-2">
          {recorded ? (
            <span className="font-mono text-sm text-muted-foreground line-through">{recorded}</span>
          ) : (
            <span className="text-xs italic text-muted-foreground">none</span>
          )}
          <ArrowRight aria-label="changed to" className="size-3.5 text-muted-foreground" />
          <span className="rounded-chip bg-pend-bg px-1.5 py-px font-mono text-sm font-semibold text-pend">{proposed}</span>
        </span>
      ) : (
        <span className="font-mono text-sm">
          {recorded ?? <span className="font-sans text-xs italic text-muted-foreground">none</span>}{" "}
          <span className="font-sans text-xs text-muted-foreground">recorded</span>
        </span>
      )}
    </div>
  );
}

export function CorrectionDetailView({ data, mock }: { data: CorrectionDetailVM; mock: boolean }) {
  const isOpen = data.status === "PENDING" || data.status === "NEEDS_INFO";

  return (
    <div className="flex flex-col gap-3.5 p-4 pb-safe-or-4">
      <div>
        <h1 className="font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.01em]">
          {formatShortDate(data.dateIso, { weekday: true })} · {reasonLabel(data.reason)}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] leading-[18px]">
          <StatusMark kind={{ type: "correction", value: data.status }} audience="intern" />
          <span className="text-muted-foreground">· sent {data.submittedLabel}</span>
        </p>
      </div>

      {data.status === "NEEDS_INFO" ? (
        <p className="rounded-card bg-attn-bg px-4 py-3 text-[13px] leading-[19px]">
          <span className="font-semibold text-attn">HR needs more information.</span> Reply below so they can decide.
        </p>
      ) : null}

      {data.status === "APPROVED" ? (
        <section className="rounded-card border border-border bg-card px-4 py-3.5">
          <p className="flex items-center justify-between gap-3">
            <StatusMark kind={{ type: "correction", value: "APPROVED" }} audience="intern" />
            {data.creditedDeltaMinutes ? (
              <span className="font-mono text-sm font-semibold text-settled">{formatDelta(data.creditedDeltaMinutes)}</span>
            ) : null}
          </p>
          {data.decisionNote ? <p className="mt-2 text-sm leading-5">{data.decisionNote}</p> : null}
        </section>
      ) : null}

      {data.status === "REJECTED" ? (
        <section className="rounded-card border border-border bg-card px-4 py-3.5">
          <StatusMark kind={{ type: "correction", value: "REJECTED" }} audience="intern" />
          {data.decisionNote ? <p className="mt-2 text-sm leading-5">{data.decisionNote}</p> : null}
          <p className="mt-1 text-xs leading-[18px] text-muted-foreground">No hours were added for this day.</p>
        </section>
      ) : null}

      <section className="rounded-card border border-border bg-card px-4 py-1">
        <ChangeRow first label="Time in" recorded={data.recorded?.timeIn ?? null} proposed={data.proposal.timeIn} />
        <ChangeRow label="Time out" recorded={data.recorded?.timeOut ?? null} proposed={data.proposal.timeOut} />
        {isOpen && data.estimatedCreditMinutes ? (
          <p className="border-t border-hairline py-2.5 text-xs leading-[18px] text-muted-foreground">
            If HR approves, about{" "}
            <span className="font-mono font-semibold text-foreground">{formatDuration(data.estimatedCreditMinutes)}</span> is
            added to your hours.
          </p>
        ) : null}
      </section>

      <CorrectionThread
        correctionId={data.id}
        messages={data.messages}
        canReply={data.canReply}
        mock={mock}
        emphasize={data.status === "NEEDS_INFO"}
      />

      {data.canReply ? (
        <p className="text-xs leading-[18px] text-muted-foreground">
          Need a different time?{" "}
          <Link
            href={`/corrections/new?date=${data.dateIso}&replace=${encodeURIComponent(data.id)}`}
            className="font-semibold text-primary"
          >
            Send a new request
          </Link>
          . It replaces this one.
        </p>
      ) : null}
    </div>
  );
}
