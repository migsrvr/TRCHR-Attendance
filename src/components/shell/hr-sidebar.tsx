import {
  Building2,
  ClipboardCheck,
  Clock,
  FileText,
  History,
  LayoutDashboard,
  QrCode,
  Scale,
  Users,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { HR_NAV, type HrNavId } from "@/components/shell/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<HrNavId, LucideIcon> = {
  overview: LayoutDashboard,
  interns: Users,
  attendance: Clock,
  reviews: ClipboardCheck,
  reports: FileText,
  office: QrCode,
  policies: Scale,
  departments: Building2,
  audit: History,
};

function NavLink({ item, active, count }: { item: (typeof HR_NAV)[number]; active: boolean; count?: number }) {
  const Icon = ICONS[item.id];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-nav px-2.5 py-2 text-[13px] leading-[18px]",
        active
          ? "bg-sidebar-accent font-semibold text-white"
          : "font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white",
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {item.label}
      {count ? (
        <span
          className={cn(
            "ml-auto min-w-[18px] rounded-full px-1.5 py-px text-center text-[11px] font-semibold leading-4",
            active ? "bg-border text-primary" : "bg-accent text-accent-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * HR navigation. A 224px column from 800px up; below that it becomes a
 * brand row and a sideways-scrolling row of links above the page.
 */
export function HrSidebar({
  active,
  reviewCount,
  officeLabel,
}: {
  active: HrNavId;
  reviewCount: number;
  officeLabel: string;
}) {
  const main = HR_NAV.filter((item) => item.section === "main");
  const setup = HR_NAV.filter((item) => item.section === "setup");

  return (
    <aside className="flex min-w-0 flex-col border-sidebar-border bg-sidebar text-sidebar-foreground min-[800px]:sticky min-[800px]:top-0 min-[800px]:h-screen min-[800px]:overflow-y-auto min-[800px]:border-r">
      <div className="flex items-center gap-2.5 border-b border-sidebar-border p-3.5">
        <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-nav bg-white p-1">
          <Image src="/brand/top-realty-mark.png" alt="Top Realty" width={40} height={16} className="h-auto w-full" priority />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-xs font-bold uppercase leading-4 tracking-[0.08em] text-white">Top Realty</p>
          <p className="mt-0.5 text-[11px] font-semibold leading-[14px]">HR Attendance</p>
        </div>
      </div>
      <nav
        aria-label="Main"
        className="flex gap-0.5 overflow-x-auto p-2.5 min-[800px]:flex-1 min-[800px]:flex-col min-[800px]:overflow-x-visible"
      >
        {main.map((item) => (
          <NavLink
            key={item.id}
            item={item}
            active={item.id === active}
            count={item.id === "reviews" ? reviewCount : undefined}
          />
        ))}
        <p className="mx-2.5 mb-1.5 mt-4 hidden text-[11px] font-semibold uppercase leading-4 tracking-[0.08em] min-[800px]:block">
          Setup
        </p>
        {setup.map((item) => (
          <NavLink key={item.id} item={item} active={item.id === active} />
        ))}
      </nav>
      <div className="hidden border-t border-sidebar-border px-3.5 py-3 min-[800px]:block">
        <p className="text-[11px] font-semibold uppercase leading-4 tracking-[0.08em]">HR</p>
        <p className="mt-1 text-xs leading-4">{officeLabel}</p>
      </div>
    </aside>
  );
}
