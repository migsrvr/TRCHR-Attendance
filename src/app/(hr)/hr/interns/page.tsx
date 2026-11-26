import type { Metadata } from "next";
import { Suspense } from "react";

import { HrShell } from "@/components/shell/hr-shell";
import { PageContentSkeleton } from "@/components/ui/section-skeleton";
import { InternsView } from "@/components/views/hr/interns-view";
import { isMockModeEnabled } from "@/lib/auth/session";
import { getHrShell, getInternList } from "@/lib/ui/queries/hr";
import type { InternAccountTab } from "@/lib/ui/view-models";

export const metadata: Metadata = {
  title: "Interns · Top Realty HR",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function InternsContent({
  filters,
  openAdd,
}: {
  filters: { tab?: InternAccountTab; query?: string; department?: string; page?: number };
  openAdd: boolean;
}) {
  const data = await getInternList(filters);
  return <InternsView data={data} mock={isMockModeEnabled()} openAdd={openAdd} />;
}

export default async function HrInternsPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, shell] = await Promise.all([searchParams, getHrShell()]);
  const single = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);

  return (
    <HrShell shell={shell} active="interns" title="Interns">
      <Suspense fallback={<PageContentSkeleton rows={7} />}>
        <InternsContent
          filters={{
            tab: single("tab") as InternAccountTab | undefined,
            query: single("q"),
            department: single("department"),
            page: Number(single("page") ?? 1) || 1,
          }}
          openAdd={single("add") === "1"}
        />
      </Suspense>
    </HrShell>
  );
}
