import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { formatShortDate } from "@/lib/ui/format";
import type { PolicyVersionVM } from "@/lib/ui/view-models";

/** Marks numbers as placeholders until HR confirms them (spec section 3). */
export function ExampleValuesBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-btn bg-pend-bg px-4 py-3">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pend" />
      <p className="text-[13px] leading-[19px]">
        <span className="font-semibold text-pend">Example values.</span> {children}
      </p>
    </div>
  );
}

/** "Sep 1 onward" or "Jul 1 – Aug 31". */
export function versionRange(version: PolicyVersionVM): string {
  return version.toIso ? `${formatShortDate(version.fromIso)} – ${formatShortDate(version.toIso)}` : `${formatShortDate(version.fromIso)} onward`;
}
