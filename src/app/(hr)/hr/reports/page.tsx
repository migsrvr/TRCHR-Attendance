import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { ReportsView } from "@/components/views/hr/reports-view";
import { getDtrReport, getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "DTR reports · Top Realty HR",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HrReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const single = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, typeof value === "string" ? value : undefined]),
  );
  const [shell, data] = await Promise.all([getHrShell(), getDtrReport(single)]);

  return (
    <HrShell shell={shell} active="reports" title="DTR reports">
      <ReportsView data={data} />
    </HrShell>
  );
}
