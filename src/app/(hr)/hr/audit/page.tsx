import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { AuditLogView } from "@/components/views/hr/audit-log-view";
import { getAuditLog, getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Audit log · Top Realty HR",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HrAuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const single = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const [shell, data] = await Promise.all([
    getHrShell(),
    getAuditLog({ query: single("q"), who: single("who"), category: single("category") }),
  ]);
  return (
    <HrShell shell={shell} active="audit" title="Audit log">
      <AuditLogView data={data} />
    </HrShell>
  );
}
