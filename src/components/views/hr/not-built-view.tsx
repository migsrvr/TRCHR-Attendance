import { ArrowLeft } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

/** Holds the place of an HR page that's designed on the canvas but not built yet. */
export function NotBuiltView({ title, summary }: { title: string; summary: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={summary} />
      <section className="flex flex-col items-start gap-4 rounded-card border border-dashed border-border bg-card p-6">
        <p className="text-sm leading-[21px] text-muted-foreground">This page is designed but not built yet.</p>
        <ButtonLink href="/hr" variant="outline">
          <ArrowLeft aria-hidden="true" />
          Back to Overview
        </ButtonLink>
      </section>
    </>
  );
}
