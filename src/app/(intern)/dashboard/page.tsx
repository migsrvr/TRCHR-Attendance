import type { Metadata } from "next";

import { InternShell } from "@/components/shell/intern-shell";
import { HomeView } from "@/components/views/intern/home-view";
import { getInternHome } from "@/lib/ui/queries/intern";

export const metadata: Metadata = {
  title: "Home · Top Realty Attendance",
};

export default async function InternHomePage() {
  const data = await getInternHome();
  return (
    <InternShell active="home" initials={data.identity.initials}>
      <HomeView data={data} />
    </InternShell>
  );
}
