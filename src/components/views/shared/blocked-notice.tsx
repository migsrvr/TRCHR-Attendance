import { Camera, ExternalLink, MapPin, TriangleAlert } from "lucide-react";

import type { BlockedCopy } from "@/lib/ui/scan-copy";

const ICONS = { camera: Camera, location: MapPin, browser: ExternalLink, alert: TriangleAlert } as const;

/** Why the camera or location can't be used, in an alert card. */
export function BlockedNotice({ copy }: { copy: Pick<BlockedCopy, "icon" | "headline" | "body"> }) {
  const Icon = ICONS[copy.icon];

  return (
    <section role="alert" className="flex items-start gap-3.5 rounded-card border border-border bg-card p-4 shadow-card">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-attn-bg text-attn">
        <Icon aria-hidden="true" className="size-[22px]" />
      </span>
      <div className="min-w-0">
        <h1 className="font-heading text-xl font-bold uppercase leading-[26px] tracking-[0.01em] text-attn">{copy.headline}</h1>
        <p className="mt-1 text-sm leading-[21px]">{copy.body}</p>
      </div>
    </section>
  );
}
