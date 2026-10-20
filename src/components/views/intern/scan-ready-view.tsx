import { LoaderCircle, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { StatusMark } from "@/components/ui/status-mark";
import type { ScanAction } from "@/lib/ui/scan-state";
import type { StatusKind } from "@/lib/ui/status";
import { cn } from "@/lib/utils";

export interface ScanIdentity {
  name: string;
  department: string;
  dateLabel: string;
}

const Corner = ({ className }: { className: string }) => (
  <span className={cn("absolute size-9 border-white", className)} />
);

/**
 * Scan screen, camera running. The viewfinder takes all remaining height,
 * so the layout fits a 667pt iPhone SE and a 932pt Pro Max alike.
 */
export function ScanReadyView({
  identity,
  status,
  statusMeta,
  expected,
  cameraState,
  cameraSlot,
  devPanel,
}: {
  identity: ScanIdentity;
  status: StatusKind;
  statusMeta?: string;
  expected: ScanAction;
  cameraState: "starting" | "ready";
  /** The <video> element the camera streams into. */
  cameraSlot: ReactNode;
  devPanel?: ReactNode;
}) {
  const code = expected === "TIME_IN" ? "IN" : "OUT";

  return (
    <div className="flex min-h-full flex-col gap-3 p-4">
      <section className="flex shrink-0 items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3 shadow-card">
        <div className="min-w-0">
          <p className="text-xs leading-4 text-muted-foreground">Signed in as</p>
          <p className="truncate text-base font-semibold leading-[22px]">{identity.name}</p>
          <p className="truncate text-xs leading-[18px] text-muted-foreground">
            {identity.department} · {identity.dateLabel}
          </p>
        </div>
        <StatusMark kind={status} audience="intern" meta={statusMeta} />
      </section>

      <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-panel bg-viewfinder">
        {cameraSlot}

        {/* Centered in the area above the hint label so the two never overlap. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-14 top-0 flex items-center justify-center"
        >
          <div className="viewfinder-target relative">
            <Corner className="left-0 top-0 rounded-tl-xl border-l-4 border-t-4" />
            <Corner className="right-0 top-0 rounded-tr-xl border-r-4 border-t-4" />
            <Corner className="bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4" />
            <Corner className="bottom-0 right-0 rounded-br-xl border-b-4 border-r-4" />
          </div>
        </div>

        <p className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <span className="rounded-full bg-black/55 px-3.5 py-1.5 text-center text-sm font-semibold leading-5 text-white">
            Point your camera at the {code} code
          </span>
        </p>

        {cameraState === "starting" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-viewfinder px-6 text-center">
            <LoaderCircle aria-hidden="true" className="size-7 text-white motion-safe:animate-spin" />
            <p className="text-sm font-semibold text-white">Starting camera…</p>
            <p className="max-w-[260px] text-xs leading-[18px] text-sidebar-foreground">
              If your phone asks to use the camera, choose Allow.
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2">
        {(["IN", "OUT"] as const).map((label) => {
          const isNext = label === code;
          return (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2.5 rounded-btn p-3",
                isNext ? "bg-pend-bg" : "border border-border bg-card",
              )}
            >
              <span className={cn("font-heading text-base font-bold", isNext ? "text-pend" : "text-muted-foreground")}>
                {label}
              </span>
              <span className={cn("text-xs leading-4", isNext ? "text-foreground" : "text-muted-foreground")}>
                {label === "IN" ? "Scan when you arrive" : "Scan before you leave"}
              </span>
            </div>
          );
        })}
      </div>

      <p className="flex shrink-0 items-start gap-2 text-xs leading-[18px] text-muted-foreground [@media(max-height:700px)]:hidden">
        <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        Your location is checked once, only at the moment you scan. Your name comes from your account.
      </p>

      {devPanel}
    </div>
  );
}
