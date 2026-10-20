import type { Metadata } from "next";

import { InternShell } from "@/components/shell/intern-shell";
import { CorrectionsView } from "@/components/views/intern/corrections-view";
import { getInternCorrections } from "@/lib/ui/queries/intern";

export const metadata: Metadata = {
  title: "Corrections · Top Realty Attendance",
};

export default async function InternCorrectionsPage() {
  const data = await getInternCorrections();
  return (
    <InternShell active="corrections" initials={data.identity.initials}>
      <CorrectionsView data={data} />
    </InternShell>
  );
}
