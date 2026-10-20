import { presentStatus, type Audience, type StatusKind } from "@/lib/ui/status";
import { cn } from "@/lib/utils";

const MARKER = {
  live: "size-[7px] rounded-full bg-pend shadow-[0_0_0_3px_rgb(var(--pend)/0.15)]",
  dotSettled: "size-[7px] rounded-full bg-settled",
  dotNegative: "size-[7px] rounded-full bg-negative",
  ringPend: "size-2 rounded-full border-[1.5px] border-pend",
  ringInactive: "size-2 rounded-full border-[1.5px] border-inactive",
} as const;

/** The only way statuses are drawn (spec section 4): chip, ring, dot or live dot, always with a word. */
export function StatusMark({
  kind,
  audience,
  meta,
  label,
  className,
}: {
  kind: StatusKind;
  audience: Audience;
  meta?: string;
  /** Replaces the word only; shape and color still come from the status. */
  label?: string;
  className?: string;
}) {
  const presented = presentStatus(kind, audience);
  const status = label ? { ...presented, label } : presented;

  if (status.shape === "chip") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip px-2 py-[3px] text-xs font-semibold leading-4",
          status.tone === "attn" ? "bg-attn-bg text-attn" : "bg-pend-bg text-pend",
          className,
        )}
      >
        {status.label}
        {meta ? <span className="font-mono font-medium">{meta}</span> : null}
      </span>
    );
  }

  const marker =
    status.shape === "live"
      ? MARKER.live
      : status.shape === "dot"
        ? status.tone === "negative"
          ? MARKER.dotNegative
          : MARKER.dotSettled
        : status.tone === "inactive"
          ? MARKER.ringInactive
          : MARKER.ringPend;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium leading-[18px]",
        status.shape === "live" ? "text-pend" : status.muted ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("shrink-0", marker)} />
      {status.label}
      {meta ? <span className="font-mono text-xs font-normal text-muted-foreground">{meta}</span> : null}
    </span>
  );
}
