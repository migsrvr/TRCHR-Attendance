import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { NotBuiltView } from "@/components/views/hr/not-built-view";
import { getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Attendance · Top Realty HR",
};

export default async function HrAttendancePage() {
  const shell = await getHrShell();
  return (
    <HrShell shell={shell} active="attendance" title="Attendance">
      <NotBuiltView title="Attendance" summary="Sessions by office day, with the scans behind them." />
    </HrShell>
  );
}
