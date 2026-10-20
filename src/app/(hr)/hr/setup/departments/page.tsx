import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { NotBuiltView } from "@/components/views/hr/not-built-view";
import { getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Departments · Top Realty HR",
};

export default async function HrDepartmentsPage() {
  const shell = await getHrShell();
  return (
    <HrShell shell={shell} active="departments" title="Departments">
      <NotBuiltView title="Departments" summary="Departments interns are assigned to." />
    </HrShell>
  );
}
