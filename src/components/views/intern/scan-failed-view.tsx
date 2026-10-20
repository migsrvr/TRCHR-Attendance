import { MapPin, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import type { FailureCopy } from "@/lib/ui/scan-copy";

const ICONS = { location: MapPin, network: WifiOff, alert: TriangleAlert } as const;

/** The server (or the phone) said no. Nothing was recorded. */
export function ScanFailedView({ copy, onReset }: { copy: FailureCopy; onReset: () => void }) {
  const Icon = ICONS[copy.icon];

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 pb-safe-or-4">
      <section
        role="alert"
        className="flex flex-col items-center rounded-panel border border-border bg-card px-5 pb-5 pt-7 text-center shadow-card"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-attn-bg text-attn">
          <Icon aria-hidden="true" className="size-[30px]" />
        </span>
        <h1 className="mt-4 font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.02em] text-attn">Not saved</h1>
        <p className="mt-1 text-base font-semibold leading-[22px]">{copy.headline}</p>
        <p className="mt-2 text-sm leading-[21px] text-muted-foreground">
          {copy.outcome} {copy.body}
        </p>
        {copy.facts.length > 0 ? (
          <dl className="mt-5 grid w-full grid-cols-2 gap-3 border-t border-hairline pt-4 text-left">
            {copy.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs leading-4 text-muted-foreground">{fact.label}</dt>
                <dd className="mt-0.5 font-mono text-[15px] font-semibold leading-5">{fact.value}</dd>
                <dd className="text-xs leading-4 text-muted-foreground">{fact.limit}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {copy.tips.length > 0 ? (
        <section className="rounded-panel border border-border bg-card px-5 py-4">
          <h2 className="text-[13px] font-semibold leading-[18px]">Try this</h2>
          <ol className="mt-2.5 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-5">
            {copy.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {"action" in copy.primary ? (
          <Button size="lg" className="w-full" onClick={onReset}>
            <RefreshCw aria-hidden="true" />
            {copy.primary.label}
          </Button>
        ) : (
          <ButtonLink size="lg" className="w-full" href={copy.primary.href}>
            {copy.primary.label}
          </ButtonLink>
        )}
        {copy.secondary ? (
          <>
            <ButtonLink size="lg" variant="outline" className="w-full font-medium" href={copy.secondary.href}>
              {copy.secondary.label}
            </ButtonLink>
            <p className="text-center text-xs leading-[18px] text-muted-foreground">
              Only if you can&apos;t scan at all. HR reviews it, and it adds no hours until approved.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
