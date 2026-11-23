import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { InternsView } from "@/components/views/hr/interns-view";
import { isMockModeEnabled } from "@/lib/auth/session";
import { getHrShell, getInternList } from "@/lib/ui/queries/hr";
import type { InternAccountTab } from "@/lib/ui/view-models";

export const metadata: Metadata = {
  title: "Interns · Top Realty HR",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HrInternsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const single = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const [shell, data] = await Promise.all([
    getHrShell(),
    getInternList({
      tab: single("tab") as InternAccountTab | undefined,
      query: single("q"),
      department: single("department"),
      page: Number(single("page") ?? 1) || 1,
    }),
  ]);

  return (
    <HrShell shell={shell} active="interns" title="Interns">
      <InternsView data={data} mock={isMockModeEnabled()} openAdd={single("add") === "1"} />
    </HrShell>
  );
}
