import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { AttendanceView } from "@/components/views/hr/attendance-view";
import { getAttendance, getHrShell } from "@/lib/ui/queries/hr";
import type { AttendanceStatusFilter } from "@/lib/ui/view-models";

export const metadata: Metadata = {
  title: "Attendance · Top Realty HR",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HrAttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const single = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const [shell, data] = await Promise.all([
    getHrShell(),
    getAttendance({
      query: single("q"),
      department: single("department"),
      status: single("status") as AttendanceStatusFilter | undefined,
      session: single("session"),
    }),
  ]);

  return (
    <HrShell shell={shell} active="attendance" title="Attendance">
      <AttendanceView data={data} mock={process.env.NODE_ENV !== "production"} />
    </HrShell>
  );
}
