import { Bell, ChevronRight, Search } from "lucide-react";
import Link from "next/link";

import type { HrIdentityVM } from "@/lib/ui/view-models";

export function HrTopbar({
  title,
  identity,
  reviewCount,
  breadcrumb,
}: {
  title: string;
  identity: HrIdentityVM;
  reviewCount: number;
  /** Parent page, shown before the title (e.g. Interns > Ana Reyes). */
  breadcrumb?: { href: string; label: string };
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
      {breadcrumb ? (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
          <Link href={breadcrumb.href} className="shrink-0 font-heading text-base font-bold leading-[22px] text-muted-foreground hover:text-foreground">
            {breadcrumb.label}
          </Link>
          <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <h1 className="truncate font-heading text-base font-bold leading-[22px]">{title}</h1>
        </nav>
      ) : (
        <h1 className="truncate font-heading text-base font-bold leading-[22px]">{title}</h1>
      )}
      <div className="ml-auto flex items-center gap-2">
        <form action="/hr/interns" role="search" className="hidden lg:block">
          <label className="flex h-9 w-60 items-center gap-2 rounded-btn border border-border bg-card px-3 text-[13px] text-muted-foreground focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
            <Search aria-hidden="true" className="size-4 shrink-0" />
            <span className="sr-only">Search interns</span>
            <input
              type="search"
              name="q"
              placeholder="Search interns"
              className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </form>
        {/* Notifications aren't designed yet (spec 9.2); until then the bell opens the review queue. */}
        <Link
          href="/hr/reviews"
          aria-label={reviewCount ? `Reviews, ${reviewCount} waiting on you` : "Reviews"}
          className="relative flex size-9 items-center justify-center rounded-btn text-foreground hover:bg-muted"
        >
          <Bell aria-hidden="true" className="size-[18px]" />
          {reviewCount ? (
            <span
              aria-hidden="true"
              className="absolute right-[5px] top-[5px] h-4 min-w-4 rounded-full bg-secondary px-1 text-center text-[11px] font-semibold leading-4 text-secondary-foreground"
            >
              {reviewCount}
            </span>
          ) : null}
        </Link>
        <div className="flex items-center gap-2.5 pl-2">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {identity.initials}
          </span>
          <div className="hidden whitespace-nowrap lg:block">
            <p className="text-[13px] font-semibold leading-[18px]">{identity.name}</p>
            <p className="text-xs leading-4 text-muted-foreground">{identity.roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
