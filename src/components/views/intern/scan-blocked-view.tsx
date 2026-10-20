import { Camera, ExternalLink, MapPin, RefreshCw, TriangleAlert } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import type { BlockedCopy } from "@/lib/ui/scan-copy";

const ICONS = { camera: Camera, location: MapPin, browser: ExternalLink, alert: TriangleAlert } as const;

/** Camera or location can't be used. Shows the steps for the intern's phone. */
export function ScanBlockedView({ copy, onRetry }: { copy: BlockedCopy; onRetry: () => void }) {
  const Icon = ICONS[copy.icon];

  return (
    <div className="flex min-h-full flex-col gap-3.5 p-4 pb-safe-or-4">
      <section role="alert" className="flex items-start gap-3.5 rounded-card border border-border bg-card p-4 shadow-card">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-attn-bg text-attn">
          <Icon aria-hidden="true" className="size-[22px]" />
        </span>
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold uppercase leading-[26px] tracking-[0.01em] text-attn">{copy.headline}</h1>
          <p className="mt-1 text-sm leading-[21px]">{copy.body}</p>
        </div>
      </section>

      {copy.inAppSteps ? (
        <section className="rounded-card border border-border bg-card p-4">
          <h2 className="text-sm font-semibold leading-5">Open in your browser</h2>
          <ol className="mt-2.5 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-5">
            {copy.inAppSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {copy.help.map((help) => (
        <section key={help.browser} className="rounded-card border border-border bg-card p-4">
          <h2 className="text-sm font-semibold leading-5">{help.browser}</h2>
          <ol className="mt-2.5 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-5">
            {help.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ))}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Button size="lg" className="w-full" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          {copy.primary}
        </Button>
        <ButtonLink size="lg" variant="outline" className="w-full font-medium" href="/corrections/new">
          Request a correction instead
        </ButtonLink>
      </div>
    </div>
  );
}
