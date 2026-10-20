import { describe, expect, it } from "vitest";

import {
  getCorrectionDetail,
  getInternCorrections,
  getInternHistory,
  getInternHome,
  getNewCorrection,
} from "@/lib/ui/queries/intern";

describe("intern sample data", () => {
  it("history totals match the canvas (76h 40m over 10 of 13 workdays)", async () => {
    const history = await getInternHistory("2026-10");
    expect(history.creditedMinutes).toBe(4600);
    expect(history.daysWithHours).toBe(10);
    expect(history.workdays).toBe(13);
    expect(history.creditedMinutes).toBe(
      history.days.reduce((sum, day) => sum + (day.creditedMinutes ?? 0), 0),
    );
  });

  it("lists days newest first", async () => {
    const { days } = await getInternHistory("2026-10");
    const dates = days.map((day) => day.dateIso);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(dates[0]).toBe("2026-10-19");
  });

  it("returns an empty month instead of failing", async () => {
    const history = await getInternHistory("2026-09");
    expect(history.days).toEqual([]);
    expect(history.creditedMinutes).toBe(0);
  });

  it("links every corrected history day to a real correction", async () => {
    const { days } = await getInternHistory("2026-10");
    for (const day of days.filter((d) => d.correction)) {
      await expect(getCorrectionDetail(day.correction!.id)).resolves.not.toBeNull();
    }
  });

  it("home shows Ana's hours and the open correction", async () => {
    const home = await getInternHome();
    expect(home.hours).toMatchObject({ creditedMinutes: 18750, requiredMinutes: 29160, workdaysLeft: 29 });
    expect(home.today.openSince).toBe("08:57");
    expect(home.openCorrection).toMatchObject({ id: "corr-oct15", status: "PENDING" });
  });

  it("splits corrections into open and decided", async () => {
    const corrections = await getInternCorrections();
    expect(corrections.open.map((c) => c.id)).toEqual(["corr-oct15"]);
    expect(corrections.decided.map((c) => [c.id, c.status])).toEqual([
      ["corr-oct13", "APPROVED"],
      ["corr-sep22", "REJECTED"],
    ]);
    expect(corrections.decided[0]!.creditedDeltaMinutes).toBe(455);
  });

  it("correction detail carries the thread and only open requests take replies", async () => {
    const open = await getCorrectionDetail("corr-oct15");
    expect(open).toMatchObject({
      recorded: { timeIn: "09:04", timeOut: null },
      proposal: { timeOut: "18:05" },
      canReply: true,
    });
    expect(open!.messages.map((m) => m.author)).toEqual(["intern", "hr", "intern"]);
    const decided = await getCorrectionDetail("corr-oct13");
    expect(decided!.canReply).toBe(false);
    await expect(getCorrectionDetail("nope")).resolves.toBeNull();
  });

  it("the request form knows what was recorded on each day", async () => {
    const form = await getNewCorrection();
    expect(form.recordedByDate["2026-10-15"]).toEqual({ timeIn: "09:04", timeOut: null });
    expect(form.recordedByDate["2026-10-16"]).toEqual({ timeIn: "09:01", timeOut: "18:04" });
    expect(form.recordedByDate["2026-10-09"]).toBeUndefined();
    expect((await getNewCorrection("2026-10-09")).initialDateIso).toBe("2026-10-09");
  });
});
