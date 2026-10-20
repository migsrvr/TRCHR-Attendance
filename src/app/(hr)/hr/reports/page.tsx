import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { NotBuiltView } from "@/components/views/hr/not-built-view";
import { getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "DTR reports · Top Realty HR",
};

export default async function HrReportsPage() {
  const shell = await getHrShell();
  return (
    <HrShell shell={shell} active="reports" title="DTR reports">
      <NotBuiltView title="DTR reports" summary="Daily time records by intern or department, ready to export." />
    </HrShell>
  );
}
