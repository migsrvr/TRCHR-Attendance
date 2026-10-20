import { Search } from "lucide-react";
import Link from "next/link";

import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusMark } from "@/components/ui/status-mark";
import { AddInternDialog } from "@/components/views/hr/add-intern-dialog";
import { DepartmentSelect, ResendLinkButton, RowActions } from "@/components/views/hr/intern-row-controls";
import { formatDuration, formatHours, formatShortDate } from "@/lib/ui/format";
import { hoursProgress } from "@/lib/ui/hours";
import type { InternAccountTab, InternListRowVM, InternListVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const TABS: { id: InternAccountTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Setup pending" },
  { id: "finished", label: "Finished" },
  { id: "disabled", label: "Disabled" },
];

const TH = "border-b border-border px-3 py-2.5 text-left text-xs font-semibold leading-4 text-muted-foreground";
const TD = "border-b border-hairline px-3 py-3 align-middle text-[13px] leading-[18px]";

function listHref(params: { tab: InternAccountTab; query?: string; department?: string | null; page?: number }) {
  const search = new URLSearchParams();
  if (params.tab !== "all") search.set("tab", params.tab);
  if (params.query) search.set("q", params.query);
  if (params.department) search.set("department", params.department);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `/hr/interns?${qs}` : "/hr/interns";
}

const dateRange = (row: InternListRowVM) =>
  row.endDateIso ? `${formatShortDate(row.startDateIso)} – ${formatShortDate(row.endDateIso)}` : `From ${formatShortDate(row.startDateIso)}`;

function InternRow({ row, mock }: { row: InternListRowVM; mock: boolean }) {
  const pending = row.tab === "pending";
  const muted = row.tab === "disabled";
  const progress = hoursProgress(row);
  const links = pending
    ? []
    : [
        { href: `/hr/interns/${row.id}`, label: "View profile" },
        { href: `/hr/reports?intern=${row.id}`, label: "Generate DTR" },
      ];

  return (
    <tr className="group">
      <td className={cn(TD, "pl-5")}>
        {pending ? (
          <span className="font-semibold">{row.name}</span>
        ) : (
          <Link
            href={`/hr/interns/${row.id}`}
            className={cn("font-semibold hover:underline", muted ? "text-muted-foreground" : "text-foreground")}
          >
            {row.name}
          </Link>
        )}
        <div className="text-xs text-muted-foreground">{row.email}</div>
      </td>
      <td className={cn(TD, muted && "text-muted-foreground")}>{row.department}</td>
      <td className={TD}>
        {pending ? (
          <span className="text-xs text-muted-foreground">
            Starts {formatShortDate(row.startDateIso)} · {formatHours(row.requiredMinutes)} required
          </span>
        ) : (
          <div className="flex items-center gap-2.5">
            <div aria-hidden="true" className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-track">
              <div
                className={cn("h-full rounded-full", muted ? "bg-inactive" : "bg-settled")}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className={cn("whitespace-nowrap font-mono text-xs", muted && "text-muted-foreground")}>
              {formatDuration(row.creditedMinutes)} / {formatHours(row.requiredMinutes)}
            </span>
          </div>
        )}
      </td>
      <td className={cn(TD, "whitespace-nowrap font-mono text-xs", muted && "text-muted-foreground")}>{dateRange(row)}</td>
      <td className={TD}>
        <StatusMark kind={row.status} audience="hr" />
        {pending && row.setupLinkSentIso ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            Link sent {formatShortDate(row.setupLinkSentIso)} · <ResendLinkButton internId={row.id} mock={mock} />
          </div>
        ) : null}
        {muted ? <div className="mt-0.5 text-xs text-muted-foreground">Records kept</div> : null}
      </td>
      <td className={cn(TD, "pr-5 text-right")}>
        {links.length ? (
          <RowActions name={row.name} links={links} />
        ) : (
          <RowActions name={row.name} links={[{ href: "/hr/audit", label: "View setup history" }]} />
        )}
      </td>
    </tr>
  );
}

function PageLink({ data, page, enabled, label }: { data: InternListVM; page: number; enabled: boolean; label: string }) {
  const classes = buttonClasses({ variant: "outline", size: "sm" });
  return enabled ? (
    <Link href={listHref({ tab: data.tab, query: data.query, department: data.department, page })} className={classes}>
      {label}
    </Link>
  ) : (
    <span aria-disabled="true" className={cn(classes, "pointer-events-none opacity-50")}>
      {label}
    </span>
  );
}

export function InternsView({ data, mock, openAdd = false }: { data: InternListVM; mock: boolean; openAdd?: boolean }) {
  const { counts } = data;
  const filtered = Boolean(data.query || data.department);

  return (
    <>
      <PageHeader
        title="Intern directory"
        subtitle={`${counts.active} active · ${counts.pending} waiting to finish account setup · ${counts.finished} finished`}
        actions={
          <AddInternDialog
            departments={data.departments}
            officeLabel={data.officeLabel}
            defaultRequiredMinutes={data.defaultRequiredMinutes}
            mock={mock}
            openOnLoad={openAdd}
          />
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Account status" className="inline-flex flex-wrap gap-1 rounded-btn bg-muted p-1">
          {TABS.map((tab) => {
            const active = tab.id === data.tab;
            return (
              <Link
                key={tab.id}
                href={listHref({ tab: tab.id, query: data.query, department: data.department })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-[30px] items-center gap-1.5 rounded-btnsm px-3 text-[13px]",
                  active ? "bg-card font-semibold text-foreground shadow-card" : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                <span className="font-mono text-xs font-medium text-muted-foreground">{counts[tab.id]}</span>
              </Link>
            );
          })}
        </nav>
        <form action="/hr/interns" role="search" className="flex flex-wrap items-center gap-2">
          {data.tab !== "all" ? <input type="hidden" name="tab" value={data.tab} /> : null}
          <label className="flex h-9 w-60 items-center gap-2 rounded-btn border border-border bg-card px-3 text-[13px] text-muted-foreground focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
            <Search aria-hidden="true" className="size-4 shrink-0" />
            <span className="sr-only">Search name or email</span>
            <input
              type="search"
              name="q"
              defaultValue={data.query}
              placeholder="Search name or email"
              className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <label htmlFor="intern-filter-department" className="sr-only">
            Department
          </label>
          <DepartmentSelect departments={data.departments} value={data.department} />
        </form>
      </div>

      <Card>
        {data.rows.length ? (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, "pl-5")}>
                    Intern
                  </th>
                  <th scope="col" className={TH}>
                    Department
                  </th>
                  <th scope="col" className={TH}>
                    Hours credited
                  </th>
                  <th scope="col" className={TH}>
                    Internship
                  </th>
                  <th scope="col" className={TH}>
                    Account
                  </th>
                  <th scope="col" className={cn(TH, "pr-5 text-right")}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <InternRow key={row.id} row={row} mock={mock} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 px-5 py-8">
            <p className="text-sm text-muted-foreground">No interns match these filters.</p>
            {filtered ? (
              <ButtonLink href={listHref({ tab: data.tab })} variant="outline" size="sm">
                Clear search and department
              </ButtonLink>
            ) : null}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground">
          <span>
            Showing {data.rows.length} of {data.total}
          </span>
          <nav aria-label="Pages" className="flex gap-2">
            <PageLink data={data} page={data.page - 1} enabled={data.page > 1} label="Previous" />
            <PageLink data={data} page={data.page + 1} enabled={data.hasNextPage} label="Next" />
          </nav>
        </div>
      </Card>
    </>
  );
}
