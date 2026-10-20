import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { NotBuiltView } from "@/components/views/hr/not-built-view";
import { getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Audit log · Top Realty HR",
};

export default async function HrAuditLogPage() {
  const shell = await getHrShell();
  return (
    <HrShell shell={shell} active="audit" title="Audit log">
      <NotBuiltView title="Audit log" summary="Every change HR and the system made, read-only." />
    </HrShell>
  );
}
