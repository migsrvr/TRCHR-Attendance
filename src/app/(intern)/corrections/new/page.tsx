import type { Metadata } from "next";

import { InternShell } from "@/components/shell/intern-shell";
import { NewCorrectionForm } from "@/components/views/intern/new-correction-form";
import { getNewCorrection } from "@/lib/ui/queries/intern";

export const metadata: Metadata = {
  title: "Request a correction · Top Realty Attendance",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewCorrectionPage({ searchParams }: { searchParams: SearchParams }) {
  const { date } = await searchParams;
  const data = await getNewCorrection(typeof date === "string" ? date : undefined);

  return (
    <InternShell initials={data.identity.initials} showTabs={false} back={{ href: "/corrections", label: "Corrections" }}>
      {/* The mock corrections server exists only in development. */}
      <NewCorrectionForm data={data} mock={process.env.NODE_ENV !== "production"} />
    </InternShell>
  );
}
