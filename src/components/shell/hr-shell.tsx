import type { ReactNode } from "react";

import { HrSidebar } from "@/components/shell/hr-sidebar";
import { HrTopbar } from "@/components/shell/hr-topbar";
import type { HrNavId } from "@/components/shell/nav";
import type { HrShellVM } from "@/lib/ui/view-models";

/**
 * Desktop frame for every HR page: sidebar, 64px top bar, and a fluid page
 * capped at 1280px. Below 800px the sidebar sits above the page.
 */
export function HrShell({
  shell,
  active,
  title,
  children,
}: {
  shell: HrShellVM;
  active: HrNavId;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground min-[800px]:grid min-[800px]:grid-cols-[224px_minmax(0,1fr)]">
      <a
        href="#hr-main"
        className="sr-only z-50 rounded-btn bg-card px-4 py-2 text-sm font-semibold text-primary shadow-card focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <HrSidebar active={active} reviewCount={shell.reviewCount} officeLabel={shell.officeLabel} />
      <div className="flex min-w-0 flex-col">
        <HrTopbar title={title} identity={shell.identity} reviewCount={shell.reviewCount} />
        <main id="hr-main" className="flex-1 p-4 sm:p-8">
          <div className="mx-auto flex max-w-content flex-col gap-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
