import type { Metadata } from "next";

import { InternShell } from "@/components/shell/intern-shell";
import { NewCorrectionForm } from "@/components/views/intern/new-correction-form";
import { isMockModeEnabled } from "@/lib/auth/session";
import { getNewCorrection } from "@/lib/ui/queries/intern";

export const metadata: Metadata = {
  title: "Request a correction · Top Realty Attendance",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewCorrectionPage({ searchParams }: { searchParams: SearchParams }) {
  const { date, replace } = await searchParams;
  const data = await getNewCorrection(
    typeof date === "string" ? date : undefined,
    typeof replace === "string" ? replace : undefined,
  );

  return (
    <InternShell initials={data.identity.initials} showTabs={false} back={{ href: "/corrections", label: "Corrections" }}>
      <NewCorrectionForm data={data} mock={isMockModeEnabled()} />
    </InternShell>
  );
}
