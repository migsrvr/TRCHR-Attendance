import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HrShell } from "@/components/shell/hr-shell";
import { InternProfileView } from "@/components/views/hr/intern-profile-view";
import { isMockModeEnabled } from "@/lib/auth/session";
import { getHrShell, getInternProfile } from "@/lib/ui/queries/hr";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const profile = await getInternProfile((await params).id);
  return { title: `${profile?.name ?? "Intern"} · Top Realty HR` };
}

export default async function HrInternProfilePage({ params }: { params: Params }) {
  const { id } = await params;
  const [shell, profile] = await Promise.all([getHrShell(), getInternProfile(id)]);
  if (!profile) notFound();

  return (
    <HrShell shell={shell} active="interns" title={profile.name} breadcrumb={{ href: "/hr/interns", label: "Interns" }}>
      <InternProfileView data={profile} mock={isMockModeEnabled()} />
    </HrShell>
  );
}
