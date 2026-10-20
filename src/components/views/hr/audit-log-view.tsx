import { Download, Search } from "lucide-react";

import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AuditRow } from "@/components/views/hr/audit-row";
import type { AuditLogVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const TH = "border-b border-border px-3 py-2.5 text-left text-xs font-semibold leading-4 text-muted-foreground";

const CATEGORY_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "corrections", label: "Corrections" },
  { value: "attendance", label: "Attendance" },
  { value: "accounts", label: "Accounts and interns" },
  { value: "office", label: "Office settings" },
  { value: "qr", label: "QR codes" },
  { value: "policy", label: "Policies" },
];

export function AuditLogView({ data }: { data: AuditLogVM }) {
  const filtered = Boolean(data.query) || data.who !== "anyone" || data.category !== "all";

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every change made in this panel, who made it, and what it was before. Entries can't be edited or deleted."
        actions={
          <a href={data.exportHref} download="" className={buttonClasses({ variant: "outline" })}>
            <Download aria-hidden="true" />
            Export CSV
          </a>
        }
      />

      <form action="/hr/audit" role="search" className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 w-60 items-center gap-2 rounded-btn border border-border bg-card px-3 text-[13px] text-muted-foreground focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="sr-only">Search records</span>
          <input
            type="search"
            name="q"
            defaultValue={data.query}
            placeholder="Search intern or record"
            className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <label htmlFor="audit-filter-who" className="sr-only">
          Who
        </label>
        <AutoSubmitSelect
          id="audit-filter-who"
          name="who"
          value={data.who === "anyone" ? "" : data.who}
          options={[
            { value: "", label: "Anyone" },
            { value: "hr", label: "HR" },
            { value: "system", label: "System" },
          ]}
        />
        <label htmlFor="audit-filter-category" className="sr-only">
          Action
        </label>
        <AutoSubmitSelect id="audit-filter-category" name="category" value={data.category === "all" ? "" : data.category} options={CATEGORY_OPTIONS} />
        <span className="text-xs text-muted-foreground">Last 60 days</span>
      </form>

      <Card>
        {data.entries.length ? (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, "pl-5")}>
                    When
                  </th>
                  <th scope="col" className={TH}>
                    Who
                  </th>
                  <th scope="col" className={TH}>
                    Action
                  </th>
                  <th scope="col" className={TH}>
                    Record
                  </th>
                  <th scope="col" className={cn(TH, "pr-5")}>
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 px-5 py-8">
            <p className="text-sm text-muted-foreground">No entries match these filters.</p>
            {filtered ? (
              <ButtonLink href="/hr/audit" variant="outline" size="sm">
                Clear filters
              </ButtonLink>
            ) : null}
          </div>
        )}
        <p className="px-5 py-3 text-xs text-muted-foreground">
          Showing {data.entries.length} of {data.total} entries
        </p>
      </Card>

      <p className="text-xs leading-[18px] text-muted-foreground">
        Original scans, location coordinates and correction text aren&apos;t copied into this log. Open the linked record to see them.
      </p>
    </>
  );
}
