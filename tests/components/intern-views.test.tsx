import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CorrectionsView } from "@/components/views/intern/corrections-view";
import { HistoryView } from "@/components/views/intern/history-view";
import { HomeView } from "@/components/views/intern/home-view";
import { getInternCorrections, getInternHistory, getInternHome } from "@/lib/ui/queries/intern";

describe("HomeView", () => {
  it("greets Ana and shows today's open session with a Scan OUT action", async () => {
    const html = renderToStaticMarkup(<HomeView data={await getInternHome()} />);
    expect(html).toContain("Good afternoon, Ana");
    expect(html).toContain("Monday, October 19");
    expect(html).toContain("In office");
    expect(html).toContain("since 08:57");
    expect(html).toContain('href="/scan"');
    expect(html).toContain("Scan OUT");
    expect(html).toContain("312h 30m");
    expect(html).toContain('href="/corrections/corr-oct15"');
    expect(html).toContain("Waiting on HR");
  });

  it("asks for the IN scan when nothing is recorded yet", async () => {
    const home = await getInternHome();
    const html = renderToStaticMarkup(
      <HomeView data={{ ...home, nowClock: "08:10", today: { openSince: null, sessions: [] }, openCorrection: null }} />,
    );
    expect(html).toContain("Good morning, Ana");
    expect(html).toContain("No Time in yet");
    expect(html).toContain("Scan IN");
    expect(html).not.toContain("/corrections/corr-");
  });
});

describe("HistoryView", () => {
  it("shows the month totals and one row per day", async () => {
    const html = renderToStaticMarkup(<HistoryView data={await getInternHistory("2026-10")} />);
    expect(html).toContain("October 2026");
    expect(html).toContain("76h 40m");
    expect(html).toContain("of 13 workdays");
    expect(html.match(/data-day=/g)).toHaveLength(13);
  });

  it("links days to their correction or to a new request", async () => {
    const html = renderToStaticMarkup(<HistoryView data={await getInternHistory("2026-10")} />);
    expect(html).toContain('href="/corrections/corr-oct15"');
    expect(html).toContain("Correction waiting on HR");
    expect(html).toContain('href="/corrections/new?date=2026-10-09"');
    expect(html).toContain("Corrected by HR");
  });

  it("steps back a month, and can't go past the current one", async () => {
    const html = renderToStaticMarkup(<HistoryView data={await getInternHistory("2026-10")} />);
    expect(html).toContain('href="/history?month=2026-09"');
    expect(html).not.toContain('href="/history?month=2026-11"');
  });

  it("explains an empty month", async () => {
    const html = renderToStaticMarkup(<HistoryView data={await getInternHistory("2026-09")} />);
    expect(html).toContain("No attendance recorded in September 2026");
    expect(html).toContain('href="/history?month=2026-10"');
  });
});

describe("CorrectionsView", () => {
  it("lists open and decided requests with the right status and outcome", async () => {
    const html = renderToStaticMarkup(<CorrectionsView data={await getInternCorrections()} />);
    expect(html).toContain('href="/corrections/new"');
    expect(html).toContain("Thu, Oct 15 · Forgot to scan OUT");
    expect(html).toContain("You proposed Time out");
    expect(html).toContain("Waiting on HR");
    expect(html).toContain("+7h 35m");
    expect(html).toContain("Rejected");
    expect(html).toContain("approved leave");
  });

  it("invites a request when there are none", async () => {
    const data = await getInternCorrections();
    const html = renderToStaticMarkup(<CorrectionsView data={{ ...data, open: [], decided: [] }} />);
    expect(html).toContain("No requests yet");
  });
});
