import type { Metadata } from "next";

import { InternShell } from "@/components/shell/intern-shell";
import { HistoryView } from "@/components/views/intern/history-view";
import { getInternHistory } from "@/lib/ui/queries/intern";

export const metadata: Metadata = {
  title: "History · Top Realty Attendance",
};

const DEFAULT_MONTH = "2026-10"; // sample-data month; becomes the current office month once wired

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InternHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const { month } = await searchParams;
  const monthIso = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : DEFAULT_MONTH;
  const data = await getInternHistory(monthIso);

  return (
    <InternShell active="history" initials={data.identity.initials}>
      <HistoryView data={data} />
    </InternShell>
  );
}
