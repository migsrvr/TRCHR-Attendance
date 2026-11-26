import type { Metadata } from "next";
import { Suspense } from "react";

import { HrShell } from "@/components/shell/hr-shell";
import { PageContentSkeleton } from "@/components/ui/section-skeleton";
import { AttendanceView } from "@/components/views/hr/attendance-view";
import { isMockModeEnabled } from "@/lib/auth/session";
import { getAttendance, getHrShell } from "@/lib/ui/queries/hr";
import type { AttendanceStatusFilter } from "@/lib/ui/view-models";

export const metadata: Metadata = {
  title: "Attendance · Top Realty HR",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function AttendanceContent({
  filters,
}: {
  filters: {
    query?: string;
    internId?: string;
    department?: string;
    status?: AttendanceStatusFilter;
    session?: string;
    from?: string;
    to?: string;
  };
}) {
  const data = await getAttendance(filters);
  return <AttendanceView data={data} mock={isMockModeEnabled()} />;
}

export default async function HrAttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const [params, shell] = await Promise.all([searchParams, getHrShell()]);
  const single = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const filters = {
    query: single("q"),
    internId: single("intern"),
    department: single("department"),
    status: single("status") as AttendanceStatusFilter | undefined,
    session: single("session"),
    from: single("from"),
    to: single("to"),
  };

  return (
    <HrShell shell={shell} active="attendance" title="Attendance">
      <Suspense fallback={<PageContentSkeleton rows={7} />}>
        <AttendanceContent filters={filters} />
      </Suspense>
    </HrShell>
  );
}
