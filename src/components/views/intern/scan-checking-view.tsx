import { Check, MapPin, QrCode } from "lucide-react";

import type { CheckingStep, ScanAction } from "@/lib/ui/scan-state";
import { cn } from "@/lib/utils";

const ORDER: CheckingStep[] = ["intent", "location", "saving"];
const actionName = (action: ScanAction) => (action === "TIME_IN" ? "Time in" : "Time out");

/** Between decode and the server's answer. Never styled like success (spec 7). */
export function ScanCheckingView({
  step,
  attempted,
  checkpointName,
  rechecking = false,
}: {
  step: CheckingStep;
  attempted: ScanAction;
  checkpointName?: string;
  rechecking?: boolean;
}) {
  const current = ORDER.indexOf(step);
  const steps = [
    {
      id: "intent" as const,
      label: current > 0 ? "Code read" : "Checking the code",
      detail: current > 0 ? checkpointName : undefined,
    },
    {
      id: "location" as const,
      label: "Checking your location",
      detail: step === "location" ? "If your phone asks, choose Allow." : undefined,
    },
    {
      id: "saving" as const,
      label: rechecking ? "Looking up your scan" : `Saving your ${actionName(attempted)}`,
      detail: undefined,
    },
  ];

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      <div className="flex h-[200px] shrink-0 flex-col items-center justify-center gap-2 rounded-panel bg-viewfinder px-6 text-center [@media(max-height:700px)]:h-[120px]">
        <QrCode aria-hidden="true" className="size-9 text-sidebar-foreground" strokeWidth={1.5} />
        <p className="text-[13px] font-semibold leading-[18px] text-white">Camera paused</p>
        <p className="text-xs leading-4 text-sidebar-foreground">It won&apos;t read another code until this one finishes.</p>
      </div>

      <section role="status" aria-live="polite" className="rounded-card border border-border bg-card p-5 shadow-card">
        <p className="font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.01em] text-pend">
          {rechecking ? "Checking again…" : "Checking…"}
        </p>
        <p className="mt-1 text-sm leading-[21px]">
          Not saved yet. Keep this screen open until you see your name and the time.
        </p>
        <ol className="mt-4">
          {steps.map((item, index) => {
            const state = index < current ? "done" : index === current ? "active" : "todo";
            return (
              <li
                key={item.id}
                className={cn("grid grid-cols-[20px_minmax(0,1fr)] items-start gap-2.5 py-2.5", index > 0 && "border-t border-hairline")}
              >
                {state === "done" ? (
                  <span className="mt-px flex size-5 items-center justify-center rounded-full bg-settled text-white">
                    <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                  </span>
                ) : state === "active" ? (
                  <span
                    aria-hidden="true"
                    className="mt-px size-5 rounded-full border-2 border-pend border-r-pend-bg motion-safe:animate-spin"
                  />
                ) : (
                  <span aria-hidden="true" className="mt-px size-5 rounded-full border-2 border-border" />
                )}
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm leading-5",
                      state === "active" && "font-semibold text-pend",
                      state === "todo" && "text-muted-foreground",
                    )}
                  >
                    {item.label}
                    <span className="sr-only">{state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}</span>
                  </span>
                  {item.detail ? <span className="block text-xs leading-[18px] text-muted-foreground">{item.detail}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="flex items-start gap-2 text-xs leading-[18px] text-muted-foreground">
        <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        Indoors this can take a few seconds. Standing near the entrance helps.
      </p>
    </div>
  );
}
