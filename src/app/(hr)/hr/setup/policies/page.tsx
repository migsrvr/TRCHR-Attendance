import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { NotBuiltView } from "@/components/views/hr/not-built-view";
import { getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Policies · Top Realty HR",
};

export default async function HrPoliciesPage() {
  const shell = await getHrShell();
  return (
    <HrShell shell={shell} active="policies" title="Policies">
      <NotBuiltView title="Policies" summary="Schedule, break, cap and rounding rules, by version." />
    </HrShell>
  );
}
