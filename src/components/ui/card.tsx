import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({
  labelledBy,
  className,
  children,
}: {
  /** id of the CardHeader title, so the section is named for screen readers. */
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn("min-w-0 rounded-card border border-border bg-card shadow-card", className)}
    >
      {children}
    </section>
  );
}

/** Section title (Oswald, uppercase), optional description and an action on the right. */
export function CardHeader({
  id,
  title,
  description,
  action,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div className="min-w-0">
        <h3 id={id} className="font-heading text-base font-semibold uppercase leading-[22px] tracking-[0.02em]">
          {title}
        </h3>
        {description ? <p className="mt-1 text-xs leading-[18px] text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
