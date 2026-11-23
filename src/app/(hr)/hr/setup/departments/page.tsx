import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { DepartmentsView } from "@/components/views/hr/departments-view";
import { isMockModeEnabled } from "@/lib/auth/session";
import { getDepartments, getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Departments · Top Realty HR",
};

export default async function HrDepartmentsPage() {
  const [shell, rows] = await Promise.all([getHrShell(), getDepartments()]);
  return (
    <HrShell shell={shell} active="departments" title="Departments">
      <DepartmentsView rows={rows} mock={isMockModeEnabled()} />
    </HrShell>
  );
}
