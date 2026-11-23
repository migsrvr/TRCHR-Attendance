import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { PoliciesView } from "@/components/views/hr/policies-view";
import { isMockModeEnabled } from "@/lib/auth/session";
import { getHrShell, getPolicies } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Policies · Top Realty HR",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HrPoliciesPage({ searchParams }: { searchParams: SearchParams }) {
  const { version } = await searchParams;
  const [shell, data] = await Promise.all([getHrShell(), getPolicies(typeof version === "string" ? Number(version) : undefined)]);
  return (
    <HrShell shell={shell} active="policies" title="Policies">
      <PoliciesView data={data} mock={isMockModeEnabled()} />
    </HrShell>
  );
}
