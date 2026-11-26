import type { Metadata } from "next";
import { Suspense } from "react";

import { HrShell } from "@/components/shell/hr-shell";
import { PageContentSkeleton } from "@/components/ui/section-skeleton";
import { ReportsView } from "@/components/views/hr/reports-view";
import { getDtrReport, getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "DTR reports · Top Realty HR",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ReportsContent({ params }: { params: Record<string, string | undefined> }) {
  const data = await getDtrReport(params);
  return <ReportsView data={data} />;
}

export default async function HrReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, shell] = await Promise.all([searchParams, getHrShell()]);
  const single = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, typeof value === "string" ? value : undefined]),
  );

  return (
    <HrShell shell={shell} active="reports" title="DTR reports">
      <Suspense fallback={<PageContentSkeleton rows={7} />}>
        <ReportsContent params={single} />
      </Suspense>
    </HrShell>
  );
}
