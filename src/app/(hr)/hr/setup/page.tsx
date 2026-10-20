import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { OfficeSetupView } from "@/components/views/hr/office-setup-view";
import { getHrShell, getOfficeSetup } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Office and QR · Top Realty HR",
};

export default async function HrOfficeSetupPage() {
  const [shell, data] = await Promise.all([getHrShell(), getOfficeSetup()]);
  return (
    <HrShell shell={shell} active="office" title="Office and QR">
      <OfficeSetupView data={data} mock={process.env.NODE_ENV !== "production"} />
    </HrShell>
  );
}
