import { describe, expect, it } from "vitest";

import { clockToMinutes, layoutTimeline, nowMarker, scheduleBand } from "@/lib/ui/timeline";

const win = { startMin: clockToMinutes("08:00"), endMin: clockToMinutes("20:00") };

describe("clockToMinutes", () => {
  it("parses HH:MM", () => {
    expect(clockToMinutes("00:00")).toBe(0);
    expect(clockToMinutes("09:04")).toBe(544);
    expect(clockToMinutes("23:59")).toBe(1439);
  });

  it("rejects malformed input", () => {
    expect(() => clockToMinutes("9:4")).toThrow();
    expect(() => clockToMinutes("24:00")).toThrow();
  });
});

describe("layoutTimeline", () => {
  it("positions a complete session (canvas: 09:04-18:05)", () => {
    const [box] = layoutTimeline(win, [{ startMin: 544, endMin: 1085, state: "complete" }]);
    expect(box!.leftPct).toBeCloseTo(8.89, 2);
    expect(box!.widthPct).toBeCloseTo(75.14, 2);
    expect(box!.openRight).toBe(false);
    expect(box!.state).toBe("complete");
  });

  it("extends an open session to now", () => {
    const [box] = layoutTimeline(win, [{ startMin: 537, endMin: null, state: "open" }], 881);
    expect(box!.widthPct).toBeCloseTo(((881 - 537) / 720) * 100, 2);
    expect(box!.openRight).toBe(false);
  });

  it("runs an unbounded open session to the edge and flags it", () => {
    const [box] = layoutTimeline(win, [{ startMin: 544, endMin: null, state: "open" }]);
    expect(box!.leftPct + box!.widthPct).toBeCloseTo(100, 5);
    expect(box!.openRight).toBe(true);
  });

  it("clamps sessions that start before or end after the window", () => {
    const [early] = layoutTimeline(win, [{ startMin: 420, endMin: 600, state: "complete" }]);
    expect(early!.leftPct).toBe(0);
    expect(early!.widthPct).toBeCloseTo((120 / 720) * 100, 2);
    const [late] = layoutTimeline(win, [{ startMin: 970, endMin: 1480, state: "review" }]);
    expect(late!.leftPct + late!.widthPct).toBeCloseTo(100, 5);
    expect(late!.openRight).toBe(true);
  });

  it("drops sessions entirely outside the window", () => {
    expect(layoutTimeline(win, [{ startMin: 1260, endMin: 1300, state: "complete" }])).toEqual([]);
  });
});

describe("scheduleBand and nowMarker", () => {
  it("places the scheduled hours", () => {
    const band = scheduleBand(win, { startMin: 540, endMin: 1080 });
    expect(band.leftPct).toBeCloseTo(8.33, 2);
    expect(band.widthPct).toBeCloseTo(75, 5);
  });

  it("places now, or hides it outside the window", () => {
    expect(nowMarker(win, 840)).toBeCloseTo(50, 5);
    expect(nowMarker(win, 1300)).toBeNull();
  });
});
