import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { OverviewView } from "@/components/views/hr/overview-view";
import { getHrOverview, getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Overview · Top Realty HR",
};

export default async function HrOverviewPage() {
  const [shell, data] = await Promise.all([getHrShell(), getHrOverview()]);
  return (
    <HrShell shell={shell} active="overview" title="Overview">
      <OverviewView data={data} />
    </HrShell>
  );
}
