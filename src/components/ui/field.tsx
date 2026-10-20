import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Desktop text input / select look (HR screens). */
export const INPUT_CLASSES =
  "h-10 w-full rounded-btn border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-attn";

/** Label above a control, with an optional hint and an error the control should reference via aria-describedby. */
export function Field({
  id,
  label,
  optional,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold leading-[18px]">
        {label}
        {optional ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">optional</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium leading-[18px] text-attn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
