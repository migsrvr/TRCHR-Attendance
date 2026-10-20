import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HrShell } from "@/components/shell/hr-shell";
import { ReviewDetailView } from "@/components/views/hr/review-detail-view";
import { formatShortDate } from "@/lib/ui/format";
import { getHrShell, getReviewDetail } from "@/lib/ui/queries/hr";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const detail = await getReviewDetail((await params).id);
  return { title: detail ? `${detail.internName} · ${formatShortDate(detail.dateIso)} · Top Realty HR` : "Review · Top Realty HR" };
}

export default async function HrReviewDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [shell, detail] = await Promise.all([getHrShell(), getReviewDetail(id)]);
  if (!detail) notFound();

  // ?conflict=1 previews the "request changed" state with the development mock.
  const isDevelopment = process.env.NODE_ENV !== "production";
  return (
    <HrShell
      shell={shell}
      active="reviews"
      title={`${detail.internName} · ${formatShortDate(detail.dateIso)}`}
      breadcrumb={{ href: "/hr/reviews", label: "Reviews" }}
    >
      <ReviewDetailView data={detail} mock={isDevelopment} initialConflict={isDevelopment && query.conflict === "1"} />
    </HrShell>
  );
}
