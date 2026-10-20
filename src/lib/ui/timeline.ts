/**
 * Day timeline geometry: places sessions inside a fixed window (08:00–20:00
 * by default) as percentages. Times are office-local minutes from midnight;
 * views never do time-zone math.
 */

export interface TimelineWindow {
  startMin: number;
  endMin: number;
}

export type TimelineState = "complete" | "open" | "review";

export interface TimelineSegmentInput {
  startMin: number;
  /** null for a session with no Time out yet. */
  endMin: number | null;
  state: TimelineState;
}

export interface TimelineSegmentBox {
  leftPct: number;
  widthPct: number;
  state: TimelineState;
  /** The session continues past the right edge (no end, or ends after the window). */
  openRight: boolean;
}

export const DEFAULT_WINDOW: TimelineWindow = { startMin: 8 * 60, endMin: 20 * 60 };

/** "09:04" -> 544. */
export function clockToMinutes(clock: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);
  if (!match) throw new Error(`Invalid clock time: ${clock}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function layoutTimeline(
  window: TimelineWindow,
  segments: readonly TimelineSegmentInput[],
  nowMin?: number,
): TimelineSegmentBox[] {
  const span = window.endMin - window.startMin;
  const toPct = (minutes: number) => ((minutes - window.startMin) / span) * 100;

  return segments.flatMap((segment) => {
    const rawEnd = segment.endMin ?? nowMin ?? window.endMin;
    if (rawEnd <= window.startMin || segment.startMin >= window.endMin) return [];

    const start = clamp(segment.startMin, window.startMin, window.endMin);
    const end = clamp(rawEnd, window.startMin, window.endMin);
    const openRight = rawEnd > window.endMin || (segment.endMin === null && nowMin === undefined);
    return [{ leftPct: toPct(start), widthPct: toPct(end) - toPct(start), state: segment.state, openRight }];
  });
}

export function scheduleBand(window: TimelineWindow, schedule: TimelineWindow): { leftPct: number; widthPct: number } {
  const [box] = layoutTimeline(window, [{ startMin: schedule.startMin, endMin: schedule.endMin, state: "complete" }]);
  return box ? { leftPct: box.leftPct, widthPct: box.widthPct } : { leftPct: 0, widthPct: 0 };
}

/** Percent position of "now", or null when it falls outside the window. */
export function nowMarker(window: TimelineWindow, nowMin: number): number | null {
  if (nowMin < window.startMin || nowMin > window.endMin) return null;
  return ((nowMin - window.startMin) / (window.endMin - window.startMin)) * 100;
}
