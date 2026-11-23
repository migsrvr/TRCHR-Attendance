import type { Metadata } from "next";

import { HrShell } from "@/components/shell/hr-shell";
import { HrTeamView } from "@/components/views/hr/hr-team-view";
import { isMockModeEnabled } from "@/lib/auth/session";
import { getHrShell, getHrTeam } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "HR team · Top Realty HR",
};

export default async function HrTeamPage() {
  const [shell, data] = await Promise.all([getHrShell(), getHrTeam()]);
  return (
    <HrShell shell={shell} active="team" title="HR team">
      <HrTeamView data={data} mock={isMockModeEnabled()} />
    </HrShell>
  );
}
