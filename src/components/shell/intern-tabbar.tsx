import { ClipboardCheck, Clock, LayoutDashboard, QrCode, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { INTERN_TABS, type InternTabId } from "@/components/shell/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<InternTabId, LucideIcon> = {
  home: LayoutDashboard,
  scan: QrCode,
  history: Clock,
  corrections: ClipboardCheck,
};

/**
 * Bottom tab bar. It sits in normal flow at the end of the app frame (not
 * position: fixed), which avoids iOS Safari's fixed-element jumps when the
 * toolbar collapses, and pads itself above the iPhone home indicator.
 */
export function InternTabBar({ active }: { active?: InternTabId }) {
  return (
    <nav aria-label="App" className="shrink-0 border-t border-border bg-card px-safe pb-safe-or-2">
      <ul className="grid h-14 grid-cols-4 px-2 pt-1">
        {INTERN_TABS.map((tab) => {
          const Icon = ICONS[tab.id];
          const current = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-11 flex-col items-center justify-center gap-1 text-[11px] leading-[14px]",
                  current ? "font-bold text-primary" : "font-medium text-muted-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={2} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
