import { describe, expect, it } from "vitest";

import {
  getHrOverview,
  getHrShell,
  getInternList,
  getInternProfile,
  getReviewDetail,
  getReviewQueue,
} from "@/lib/ui/queries/hr";
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

describe("Interns sample data", () => {
  it("counts match the Overview and add up", async () => {
    const [list, overview] = await Promise.all([getInternList({}), getHrOverview()]);
    const { all, active, pending, finished, disabled } = list.counts;
    expect(active).toBe(overview.kpis.activeInterns);
    expect(all).toBe(active + pending + finished + disabled);
    expect(list.total).toBe(all);
  });

  it("filters by tab, search and department", async () => {
    const pending = await getInternList({ tab: "pending" });
    expect(pending.rows.every((row) => row.tab === "pending")).toBe(true);
    expect(pending.rows.map((row) => row.name)).toContain("Rina Mendoza");
    const search = await getInternList({ query: "BEA" });
    expect(search.rows.map((row) => row.name)).toEqual(["Bea Santos"]);
    const marketing = await getInternList({ department: "Marketing" });
    expect(marketing.rows.length).toBeGreaterThan(0);
    expect(marketing.rows.every((row) => row.department === "Marketing")).toBe(true);
    expect((await getInternList({ tab: "nonsense" as never })).tab).toBe("all");
  });

  it("has a profile for every row that links to one, and Ana's matches her Home", async () => {
    const list = await getInternList({});
    for (const row of list.rows.filter((r) => r.tab !== "pending")) {
      expect(await getInternProfile(row.id)).not.toBeNull();
    }
    expect(await getInternProfile("nobody")).toBeNull();
    const [ana, home] = await Promise.all([getInternProfile("ana-reyes"), getInternHome()]);
    expect(ana!.hours.creditedMinutes).toBe(home.hours.creditedMinutes);
    expect(ana!.recentDays.map((day) => day.dateIso)).toEqual([
      "2026-10-19",
      "2026-10-16",
      "2026-10-15",
      "2026-10-14",
      "2026-10-13",
    ]);
  });
});

describe("Reviews sample data", () => {
  it("waiting on you is the Overview's Needs you list", async () => {
    const [queue, overview] = await Promise.all([getReviewQueue({ tab: "you" }), getHrOverview()]);
    expect(queue.counts.you).toBe(overview.kpis.waitingOnHr);
    expect(queue.rows.map((row) => row.id)).toEqual(overview.needsYou.map((item) => item.id));
    const { you, intern, decided, all } = queue.counts;
    expect(all).toBe(you + intern + decided);
  });

  it("filters by tab, intern search, department and Jev reading", async () => {
    expect((await getReviewQueue({ tab: "intern" })).rows.every((row) => row.tab === "intern")).toBe(true);
    expect((await getReviewQueue({ query: "paolo" })).rows.map((row) => row.internName)).toEqual(["Paolo Cruz"]);
    expect((await getReviewQueue({ department: "Finance" })).rows.every((row) => row.department === "Finance")).toBe(true);
    const manual = await getReviewQueue({ jev: "manual" });
    expect(manual.rows.map((row) => row.internName)).toContain("Bea Santos");
    expect(manual.rows.every((row) => row.jevCategory === null)).toBe(true);
  });

  it("has a detail page for every correction anyone links to", async () => {
    const [queue, ana] = await Promise.all([getReviewQueue({ tab: "all" }), getInternProfile("ana-reyes")]);
    const ids = new Set([
      ...queue.rows.filter((row) => row.href.startsWith("/hr/reviews/")).map((row) => row.id),
      ...ana!.corrections.map((correction) => correction.id),
    ]);
    for (const id of ids) expect(await getReviewDetail(id), id).not.toBeNull();
    expect(await getReviewDetail("nope")).toBeNull();
  });

  it("matches Ana's own view of her Oct 15 request", async () => {
    const detail = (await getReviewDetail("corr-oct15"))!;
    expect(detail.version).toBe(3);
    expect(detail.proposed.creditedMinutes - detail.recorded.creditedMinutes).toBe(481);
    expect(detail.comments.map((comment) => comment.author)).toEqual(["intern", "hr", "intern"]);
    expect(detail.jev).toMatchObject({ status: "read", version: 3 });
    expect(detail.hours.creditedMinutes).toBe(18750);
  });
});
