import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InternShell } from "@/components/shell/intern-shell";
import { CorrectionDetailView } from "@/components/views/intern/correction-detail-view";
import { isMockModeEnabled } from "@/lib/auth/session";
import { getCorrectionDetail } from "@/lib/ui/queries/intern";

export const metadata: Metadata = {
  title: "Correction · Top Realty Attendance",
};

export default async function CorrectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCorrectionDetail(id);
  if (!data) notFound();

  return (
    <InternShell initials={data.identity.initials} showTabs={false} back={{ href: "/corrections", label: "Corrections" }}>
      <CorrectionDetailView data={data} mock={isMockModeEnabled()} />
    </InternShell>
  );
}
