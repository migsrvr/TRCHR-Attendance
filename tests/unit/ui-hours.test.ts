import { describe, expect, it } from "vitest";

import { officeDateIso } from "@/lib/ui/format";
import { hoursProgress, PACE_ALERT_MINUTES, paceStatus } from "@/lib/ui/hours";

describe("hoursProgress", () => {
  it("matches Ana's numbers on the canvas", () => {
    const p = hoursProgress({ creditedMinutes: 18750, requiredMinutes: 29160, workdaysLeft: 29 });
    expect(p.percent).toBe(64);
    expect(p.remainingMinutes).toBe(10410);
    expect(p.pacePerWorkdayMinutes).toBe(360);
  });

  it("caps at 100 percent and zero remaining", () => {
    expect(hoursProgress({ creditedMinutes: 30000, requiredMinutes: 29160 })).toMatchObject({
      percent: 100,
      remainingMinutes: 0,
      pacePerWorkdayMinutes: undefined,
    });
  });

  it("handles a zero requirement without dividing by zero", () => {
    expect(hoursProgress({ creditedMinutes: 0, requiredMinutes: 0 }).percent).toBe(100);
  });
});

describe("officeDateIso", () => {
  it("returns the office-local calendar date of an instant", () => {
    // 23:30 UTC on Oct 18 is already Oct 19 in Manila (UTC+8).
    expect(officeDateIso(new Date("2026-10-18T23:30:00Z"), "Asia/Manila")).toBe("2026-10-19");
    expect(officeDateIso(new Date("2026-10-18T10:00:00Z"), "Asia/Manila")).toBe("2026-10-18");
  });
});

describe("paceStatus", () => {
  it("rounds to whole hours behind with a true minus sign", () => {
    expect(paceStatus(-2460)).toEqual({ label: "−41h", alert: true });
    expect(paceStatus(-1080)).toEqual({ label: "−18h", alert: true });
  });

  it("only alerts once an intern is a full workday behind", () => {
    expect(paceStatus(-360)).toEqual({ label: "−6h", alert: false });
    expect(paceStatus(-PACE_ALERT_MINUTES)).toMatchObject({ alert: true });
  });

  it("calls ahead, level and under half an hour behind on track", () => {
    expect(paceStatus(30)).toEqual({ label: "On track", alert: false });
    expect(paceStatus(0)).toEqual({ label: "On track", alert: false });
    expect(paceStatus(-25)).toEqual({ label: "On track", alert: false });
  });
});
