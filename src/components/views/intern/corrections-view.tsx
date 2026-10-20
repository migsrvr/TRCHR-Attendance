import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { StatusMark } from "@/components/ui/status-mark";
import { describeProposal, reasonLabel } from "@/lib/ui/correction-form";
import { formatDelta, formatShortDate } from "@/lib/ui/format";
import type { CorrectionSummaryVM, InternCorrectionsVM } from "@/lib/ui/view-models";

function CorrectionCard({ item }: { item: CorrectionSummaryVM }) {
  const approved = item.status === "APPROVED";
  return (
    <li>
      <Link
        href={`/corrections/${item.id}`}
        className="block rounded-card border border-border bg-card px-4 py-3.5 shadow-card active:bg-muted"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5">
              {formatShortDate(item.dateIso, { weekday: true })} · {reasonLabel(item.reason)}
            </p>
            <p className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground">
              {describeProposal(item.proposal, approved)}
            </p>
          </div>
          <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-hairline pt-2.5">
          <StatusMark kind={{ type: "correction", value: item.status }} audience="intern" />
          {approved && item.creditedDeltaMinutes ? (
            <span className="font-mono text-xs font-semibold text-settled">{formatDelta(item.creditedDeltaMinutes)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{item.activity}</span>
          )}
        </div>
        {item.hrNote ? (
          <p className="mt-1.5 text-[13px] leading-[19px]">
            <span className="font-semibold">HR:</span> “{item.hrNote}”
          </p>
        ) : null}
      </Link>
    </li>
  );
}

function Section({ title, items }: { title: string; items: CorrectionSummaryVM[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="mt-1.5 text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-muted-foreground">{title}</h2>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <CorrectionCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

export function CorrectionsView({ data }: { data: InternCorrectionsVM }) {
  const empty = data.open.length === 0 && data.decided.length === 0;

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.01em]">Corrections</h1>
        <ButtonLink href="/corrections/new" className="h-11 px-3.5 font-semibold">
          <Plus aria-hidden="true" />
          New request
        </ButtonLink>
      </div>
      <p className="text-[13px] leading-[19px] text-muted-foreground">
        Use a correction when a scan failed or you forgot to scan. The times you propose add no hours until HR approves
        them.
      </p>

      {empty ? (
        <section className="rounded-card border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm font-semibold">No requests yet</p>
          <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
            If a day is missing a scan, request a correction and HR will review it.
          </p>
        </section>
      ) : (
        <>
          <Section title="Open" items={data.open} />
          <Section title="Decided" items={data.decided} />
        </>
      )}
    </div>
  );
}
