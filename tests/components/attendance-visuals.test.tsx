import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DayTimeline } from "@/components/attendance/day-timeline";
import { HoursProgress } from "@/components/attendance/hours-progress";
import { InternShell } from "@/components/shell/intern-shell";
import { StatusMark } from "@/components/ui/status-mark";

describe("DayTimeline", () => {
  it("draws one block per session, hides the bar from screen readers, and keeps a text summary", () => {
    const html = renderToStaticMarkup(
      <DayTimeline
        sessions={[
          { start: "08:30", end: "12:02" },
          { start: "13:01", end: "14:32" },
        ]}
        schedule={{ start: "09:00", end: "18:00" }}
      />,
    );
    expect(html.match(/data-segment="complete"/g)).toHaveLength(2);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("08:30–12:02 · 13:01–14:32");
  });

  it("draws an open session up to now with a now marker", () => {
    const html = renderToStaticMarkup(<DayTimeline sessions={[{ start: "08:57", end: null }]} nowClock="14:41" />);
    expect(html).toContain('data-segment="open"');
    expect(html).toContain("data-now");
    expect(html).toContain("08:57 → now");
  });

  it("marks an incomplete past day", () => {
    const html = renderToStaticMarkup(<DayTimeline sessions={[{ start: "09:04", end: null }]} />);
    expect(html).toContain("09:04 → no Time out");
  });
});

describe("HoursProgress", () => {
  it("shows credited, required, remaining and pace", () => {
    const html = renderToStaticMarkup(
      <HoursProgress creditedMinutes={18750} requiredMinutes={29160} endDateIso="2026-11-28" workdaysLeft={29} />,
    );
    expect(html).toContain("312h 30m");
    expect(html).toContain("of 486h");
    expect(html).toContain("173h 30m");
    expect(html).toContain("Ends Nov 28");
    expect(html).toContain("6h 00m");
    expect(html).toContain('aria-valuenow="64"');
  });
});

describe("StatusMark label override", () => {
  it("keeps the shape but changes the word", () => {
    const html = renderToStaticMarkup(
      <StatusMark kind={{ type: "correction", value: "APPROVED" }} audience="intern" label="Corrected by HR" />,
    );
    expect(html).toContain("Corrected by HR");
    expect(html).toContain("bg-settled");
  });
});

describe("InternShell back header", () => {
  it("replaces the brand with a back link and hides the tabs", () => {
    const html = renderToStaticMarkup(
      <InternShell initials="AR" showTabs={false} back={{ href: "/corrections", label: "Corrections" }}>
        <p>content</p>
      </InternShell>,
    );
    expect(html).toContain('href="/corrections"');
    expect(html).toContain("Corrections");
    expect(html).not.toContain('aria-label="App"');
  });
});
