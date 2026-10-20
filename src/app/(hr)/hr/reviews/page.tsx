import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { ReviewsView } from "@/components/views/hr/reviews-view";
import { getHrShell, getReviewQueue } from "@/lib/ui/queries/hr";
import type { ReviewQueueVM, ReviewTab } from "@/lib/ui/view-models";

export const metadata: Metadata = {
  title: "Reviews · Top Realty HR",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HrReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const single = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const [shell, data] = await Promise.all([
    getHrShell(),
    getReviewQueue({
      tab: single("tab") as ReviewTab | undefined,
      query: single("q"),
      department: single("department"),
      jev: single("jev") as ReviewQueueVM["jev"] | undefined,
    }),
  ]);

  return (
    <HrShell shell={shell} active="reviews" title="Reviews">
      <ReviewsView data={data} />
    </HrShell>
  );
}
