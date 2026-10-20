import { Info, Search } from "lucide-react";
import Link from "next/link";

import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JevTag } from "@/components/ui/jev-tag";
import { PageHeader } from "@/components/ui/page-header";
import { StatusMark } from "@/components/ui/status-mark";
import { formatShortDate } from "@/lib/ui/format";
import { isOverdue } from "@/lib/ui/status";
import type { ReviewQueueVM, ReviewRowVM, ReviewTab } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const TABS: { id: ReviewTab; label: string }[] = [
  { id: "you", label: "Waiting on you" },
  { id: "intern", label: "Waiting on intern" },
  { id: "decided", label: "Decided" },
  { id: "all", label: "All" },
];

const TH = "border-b border-border px-3 py-2.5 text-left text-xs font-semibold leading-4 text-muted-foreground";
const TD = "border-b border-hairline px-3 py-3 align-middle text-[13px] leading-[18px]";

function queueHref(data: ReviewQueueVM, tab: ReviewTab) {
  const search = new URLSearchParams();
  if (tab !== "you") search.set("tab", tab);
  if (data.query) search.set("q", data.query);
  if (data.department) search.set("department", data.department);
  if (data.jev !== "all") search.set("jev", data.jev);
  const qs = search.toString();
  return qs ? `/hr/reviews?${qs}` : "/hr/reviews";
}

function ReviewRow({ row }: { row: ReviewRowVM }) {
  return (
    <tr>
      <td className={cn(TD, "pl-5")}>
        <Link href={row.href} className="font-semibold text-foreground hover:underline">
          {row.internName}
        </Link>
        <div className="text-xs text-muted-foreground">{row.department}</div>
      </td>
      <td className={cn(TD, "whitespace-nowrap font-mono text-xs")}>{formatShortDate(row.dateIso)}</td>
      <td className={TD}>
        {row.request.label}
        {row.request.value ? <span className="ml-1.5 font-mono text-xs font-semibold">{row.request.value}</span> : null}
      </td>
      <td className={TD}>
        <JevTag category={row.jevCategory} />
      </td>
      <td className={TD}>
        <StatusMark kind={row.status} audience="hr" />
      </td>
      <td
        className={cn(
          TD,
          "pr-5 text-right font-mono text-xs",
          isOverdue(row.status) ? "font-semibold text-attn" : "text-muted-foreground",
        )}
      >
        {row.tab === "decided" ? "—" : `${row.ageDays}d`}
      </td>
    </tr>
  );
}

export function ReviewsView({ data }: { data: ReviewQueueVM }) {
  const { counts } = data;
  const filtered = Boolean(data.query || data.department || data.jev !== "all");

  return (
    <>
      <PageHeader
        title="Correction reviews"
        subtitle={`${counts.you} waiting on you · ${counts.intern} waiting on interns · decisions recalculate hours right away`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Review status" className="inline-flex flex-wrap gap-1 rounded-btn bg-muted p-1">
          {TABS.map((tab) => {
            const active = tab.id === data.tab;
            return (
              <Link
                key={tab.id}
                href={queueHref(data, tab.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-[30px] items-center gap-1.5 rounded-btnsm px-3 text-[13px]",
                  active ? "bg-card font-semibold text-foreground shadow-card" : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "font-mono text-xs",
                    tab.id === "you" && counts.you > 0 ? "font-semibold text-attn" : "font-medium text-muted-foreground",
                  )}
                >
                  {counts[tab.id]}
                </span>
              </Link>
            );
          })}
        </nav>
        <form action="/hr/reviews" role="search" className="flex flex-wrap items-center gap-2">
          {data.tab !== "you" ? <input type="hidden" name="tab" value={data.tab} /> : null}
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
          <label htmlFor="review-filter-department" className="sr-only">
            Department
          </label>
          <AutoSubmitSelect
            id="review-filter-department"
            name="department"
            value={data.department ?? ""}
            options={[{ value: "", label: "All departments" }, ...data.departments.map((d) => ({ value: d, label: d }))]}
          />
          <label htmlFor="review-filter-jev" className="sr-only">
            Jev reading
          </label>
          <AutoSubmitSelect
            id="review-filter-jev"
            name="jev"
            value={data.jev === "all" ? "" : data.jev}
            options={[
              { value: "", label: "Any Jev reading" },
              { value: "read", label: "Read by Jev" },
              { value: "manual", label: "Manual review" },
            ]}
          />
        </form>
      </div>

      <Card>
        {data.rows.length ? (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, "pl-5")}>
                    Intern
                  </th>
                  <th scope="col" className={TH}>
                    Date
                  </th>
                  <th scope="col" className={TH}>
                    Request
                  </th>
                  <th scope="col" className={TH}>
                    Jev reading
                  </th>
                  <th scope="col" className={TH}>
                    Status
                  </th>
                  <th scope="col" className={cn(TH, "pr-5 text-right")}>
                    Waiting
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <ReviewRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 px-5 py-8">
            <p className="text-sm text-muted-foreground">
              {filtered ? "No requests match these filters." : data.tab === "you" ? "Nothing waiting on you." : "No requests here."}
            </p>
            {filtered ? (
              <ButtonLink href={queueHref({ ...data, query: "", department: null, jev: "all" }, data.tab)} variant="outline" size="sm">
                Clear filters
              </ButtonLink>
            ) : null}
          </div>
        )}
        <p className="px-5 py-3 text-xs leading-[18px] text-muted-foreground">
          Oldest first. Requests waiting on interns move back to &ldquo;Waiting on you&rdquo; when they reply.
        </p>
      </Card>

      <section className="flex items-start gap-2.5 rounded-btn bg-pend-bg px-4 py-3">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pend" />
        <p className="text-[13px] leading-[19px]">
          Jev readings sort and label requests. They never approve, reject, or change hours. Every decision here is yours.
        </p>
      </section>
    </>
  );
}
