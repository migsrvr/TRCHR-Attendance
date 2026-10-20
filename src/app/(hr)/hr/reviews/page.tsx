import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { NotBuiltView } from "@/components/views/hr/not-built-view";
import { getHrShell } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Reviews · Top Realty HR",
};

export default async function HrReviewsPage() {
  const shell = await getHrShell();
  return (
    <HrShell shell={shell} active="reviews" title="Reviews">
      <NotBuiltView title="Reviews" summary="Corrections and held sessions waiting on a decision." />
    </HrShell>
  );
}
