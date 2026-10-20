import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { NotBuiltView } from "@/components/views/hr/not-built-view";
import { getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Office and QR · Top Realty HR",
};

export default async function HrOfficeSetupPage() {
  const shell = await getHrShell();
  return (
    <HrShell shell={shell} active="office" title="Office and QR">
      <NotBuiltView title="Office and QR" summary="Office location, geofence and the QR checkpoints." />
    </HrShell>
  );
}
