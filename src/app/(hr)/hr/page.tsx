import type { Metadata } from "next";
import { Suspense } from "react";

import { HrShell } from "@/components/shell/hr-shell";
import { PageContentSkeleton } from "@/components/ui/section-skeleton";
import { OverviewView } from "@/components/views/hr/overview-view";
import { getHrOverview, getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Overview · Top Realty HR",
};

async function OverviewContent() {
  const data = await getHrOverview();
  return <OverviewView data={data} />;
}

export default async function HrOverviewPage() {
  const shell = await getHrShell();
  return (
    <HrShell shell={shell} active="overview" title="Overview">
      <Suspense fallback={<PageContentSkeleton rows={5} />}>
        <OverviewContent />
      </Suspense>
    </HrShell>
  );
}
