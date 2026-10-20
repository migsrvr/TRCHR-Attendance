import { clockToMinutes, DEFAULT_WINDOW, layoutTimeline, nowMarker, scheduleBand } from "@/lib/ui/timeline";
import type { DaySessionVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const SEGMENT_STYLE = {
  complete: "bg-settled",
  open: "border-[1.5px] border-pend bg-pend-bg",
  review: "border-[1.5px] border-dashed border-attn bg-attn-bg",
} as const;

/** "08:30–12:02 · 13:01–14:32", "08:57 → now" or "09:04 → no Time out". */
export function sessionSummary(sessions: DaySessionVM[], nowClock?: string): string {
  return sessions
    .map((session) =>
      session.end ? `${session.start}–${session.end}` : `${session.start} → ${nowClock ? "now" : "no Time out"}`,
    )
    .join(" · ");
}

/**
 * One office day from 08:00 to 20:00. The bar is decorative (aria-hidden);
 * the text summary under it carries the same information for everyone.
 */
export function DayTimeline({
  sessions,
  schedule,
  nowClock,
  review = false,
  ticks = false,
  summary = true,
  className,
}: {
  sessions: DaySessionVM[];
  schedule?: { start: string; end: string };
  /** Office-local time to draw an open session up to; omit for past days. */
  nowClock?: string;
  /** Draw sessions as held for review. */
  review?: boolean;
  ticks?: boolean;
  summary?: boolean;
  className?: string;
}) {
  const nowMin = nowClock ? clockToMinutes(nowClock) : undefined;
  const boxes = layoutTimeline(
    DEFAULT_WINDOW,
    sessions.map((session) => ({
      startMin: clockToMinutes(session.start),
      endMin: session.end ? clockToMinutes(session.end) : null,
      state: review ? ("review" as const) : session.end ? ("complete" as const) : ("open" as const),
    })),
    nowMin,
  );
  const band = schedule
    ? scheduleBand(DEFAULT_WINDOW, { startMin: clockToMinutes(schedule.start), endMin: clockToMinutes(schedule.end) })
    : null;
  const now = nowMin !== undefined && sessions.some((s) => s.end === null) ? nowMarker(DEFAULT_WINDOW, nowMin) : null;

  return (
    <div className={className}>
      <div aria-hidden="true" className="relative h-6 rounded-nav bg-track">
        {band ? (
          <div className="absolute inset-y-0 bg-schedule-band" style={{ left: `${band.leftPct}%`, width: `${band.widthPct}%` }} />
        ) : null}
        {boxes.map((box, index) => (
          <div
            key={index}
            data-segment={box.state}
            className={cn(
              "absolute inset-y-1 box-border rounded-chip",
              SEGMENT_STYLE[box.state],
              box.openRight && "rounded-r-none border-r-0",
            )}
            style={{ left: `${box.leftPct}%`, width: `${box.widthPct}%` }}
          />
        ))}
        {now !== null ? (
          <div data-now className="absolute -inset-y-[3px] -ml-px w-0.5 rounded-full bg-pend" style={{ left: `${now}%` }} />
        ) : null}
      </div>
      {ticks ? (
        <div aria-hidden="true" className="mt-1 flex justify-between font-mono text-[11px] leading-4 text-muted-foreground">
          <span>08:00</span>
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
        </div>
      ) : null}
      {summary ? (
        <p className="mt-1 font-mono text-xs leading-[18px] text-muted-foreground">{sessionSummary(sessions, nowClock)}</p>
      ) : null}
    </div>
  );
}
