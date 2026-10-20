import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { NotBuiltView } from "@/components/views/hr/not-built-view";
import { getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Interns · Top Realty HR",
};

export default async function HrInternsPage() {
  const shell = await getHrShell();
  return (
    <HrShell shell={shell} active="interns" title="Interns">
      <NotBuiltView title="Interns" summary="Accounts, setup links and hours for every intern." />
    </HrShell>
  );
}
