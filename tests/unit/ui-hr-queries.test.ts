import { describe, expect, it } from "vitest";

import { getHrOverview, getHrShell } from "@/lib/ui/queries/hr";
import { getInternHome } from "@/lib/ui/queries/intern";

describe("HR sample data", () => {
  it("shows the same waiting count in the sidebar, the KPI and the Needs you list", async () => {
    const [shell, overview] = await Promise.all([getHrShell(), getHrOverview()]);
    expect(shell.reviewCount).toBe(overview.kpis.waitingOnHr);
    expect(overview.needsYou).toHaveLength(overview.kpis.waitingOnHr);
    expect(overview.kpis.oldestWaitingDays).toBe(overview.needsYou[0]!.ageDays);
  });

  it("keeps HR's name as a bracketed placeholder", async () => {
    expect((await getHrShell()).identity.name).toBe("[HR NAME]");
  });

  it("lists Needs you oldest first and keeps records on weekdays", async () => {
    const { needsYou } = await getHrOverview();
    const ages = needsYou.map((item) => item.ageDays);
    expect(ages).toEqual([...ages].sort((a, b) => b - a));
    for (const item of needsYou) {
      const weekday = new Date(`${item.dateIso}T00:00:00Z`).getUTCDay();
      expect(weekday === 0 || weekday === 6).toBe(false);
    }
  });

  it("sorts hours furthest behind first and finishing soonest first", async () => {
    const { behindPace, finishingSoon } = await getHrOverview();
    const paces = behindPace.map((row) => row.paceDeltaMinutes);
    expect(paces).toEqual([...paces].sort((a, b) => a - b));
    const ends = finishingSoon.map((row) => row.endDateIso);
    expect(ends).toEqual([...ends].sort());
  });

  it("agrees with Ana's own Home screen", async () => {
    const [{ behindPace }, home] = await Promise.all([getHrOverview(), getInternHome()]);
    const ana = behindPace.find((row) => row.name === "Ana Reyes")!;
    expect(ana.creditedMinutes).toBe(home.hours.creditedMinutes);
    expect(ana.requiredMinutes).toBe(home.hours.requiredMinutes);
    expect(ana.endDateIso).toBe(home.hours.endDateIso);
  });
});
