import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import type { InternTabId } from "@/components/shell/nav";
import { InternTabBar } from "@/components/shell/intern-tabbar";
import { SignOutButton } from "@/components/shell/sign-out-button";

/**
 * Phone app frame for the intern screens.
 *
 * Header, scrolling content and tab bar are a column exactly one dynamic
 * viewport tall (`app-frame`), so the tab bar stays put on both iOS Safari and
 * Android Chrome while their toolbars show and hide. Only <main> scrolls.
 * Safe-area padding keeps content clear of the notch and home indicator.
 *
 * Sub-screens (a form, a detail page) pass `back` to swap the brand for a
 * back link, and usually hide the tabs.
 */
export function InternShell({
  active,
  showTabs = true,
  initials,
  back,
  children,
}: {
  active?: InternTabId;
  showTabs?: boolean;
  initials: string;
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="app-frame flex flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card px-safe pt-safe">
        {back ? (
          <div className="flex h-14 items-center px-2">
            <Link
              href={back.href}
              className="flex h-11 items-center gap-1 rounded-btn pl-1 pr-3 text-sm font-semibold text-primary active:bg-muted"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
              {back.label}
            </Link>
          </div>
        ) : (
          <div className="flex h-14 items-center gap-2.5 px-4">
            <span className="flex h-[30px] w-10 shrink-0 items-center justify-center rounded-nav border border-hairline bg-white p-[3px]">
              <Image src="/brand/top-realty-mark.png" alt="Top Realty" width={36} height={14} priority className="h-auto w-full" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-xs font-bold uppercase leading-4 tracking-[0.08em] text-primary">Top Realty</p>
              <p className="text-[11px] font-semibold leading-[14px] text-muted-foreground">Attendance</p>
            </div>
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pend-bg text-xs font-semibold text-pend"
            >
              {initials}
            </span>
            <SignOutButton compact />
          </div>
        )}
      </header>

      <main id="app-main" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-safe">
        {children}
      </main>

      {showTabs ? <InternTabBar active={active} /> : null}
    </div>
  );
}
