import type { Metadata } from "next";
import { Suspense } from "react";

import { HrShell } from "@/components/shell/hr-shell";
import { PageContentSkeleton } from "@/components/ui/section-skeleton";
import { ReviewsView } from "@/components/views/hr/reviews-view";
import { getHrShell, getReviewQueue } from "@/lib/ui/queries/hr";
import type { ReviewQueueVM, ReviewTab } from "@/lib/ui/view-models";

export const metadata: Metadata = {
  title: "Reviews · Top Realty HR",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ReviewsContent({
  filters,
}: {
  filters: {
    tab?: ReviewTab;
    query?: string;
    department?: string;
    jev?: ReviewQueueVM["jev"];
    from?: string;
    to?: string;
  };
}) {
  const data = await getReviewQueue(filters);
  return <ReviewsView data={data} />;
}

export default async function HrReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, shell] = await Promise.all([searchParams, getHrShell()]);
  const single = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);

  return (
    <HrShell shell={shell} active="reviews" title="Reviews">
      <Suspense fallback={<PageContentSkeleton rows={6} />}>
        <ReviewsContent
          filters={{
            tab: single("tab") as ReviewTab | undefined,
            query: single("q"),
            department: single("department"),
            jev: single("jev") as ReviewQueueVM["jev"] | undefined,
            from: single("from"),
            to: single("to"),
          }}
        />
      </Suspense>
    </HrShell>
  );
}
