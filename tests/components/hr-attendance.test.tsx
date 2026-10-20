import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AttendanceView } from "@/components/views/hr/attendance-view";
import { createMockAttendanceApi } from "@/lib/attendance/api";
import { getAttendance } from "@/lib/ui/queries/hr";

describe("AttendanceView", () => {
  it("groups rows under office-day headers with a timeline and text summary each", async () => {
    const data = await getAttendance({});
    const html = renderToStaticMarkup(<AttendanceView data={data} mock />);
    expect(html).toContain("Attendance records");
    expect(html).toContain("Monday, Oct 19");
    expect(html).toMatch(/today · 21 scans/);
    expect(html).toContain("Friday, Oct 16");
    const rows = data.days.flatMap((day) => day.rows);
    expect(html.match(/data-attendance-row/g)).toHaveLength(rows.length);
    expect(html).toContain("08:57 → now");
    expect(html).toContain("16:10 → 00:40 next day");
    expect(html).toContain("08:44 rejected · 412 m from office");
  });

  it("shows — for open sessions, held for held ones, and the legend", async () => {
    const html = renderToStaticMarkup(<AttendanceView data={await getAttendance({})} mock />);
    expect(html).toMatch(/data-credited="open"[^>]*>—</);
    expect(html).toMatch(/data-credited="held"[^>]*>held</);
    for (const label of ["Complete", "Open", "Held for review", "Scheduled"]) expect(html).toContain(label);
    expect(html).toContain("Credited uses completed sessions only");
  });

  it("links each row to its session detail, keeping filters", async () => {
    const html = renderToStaticMarkup(<AttendanceView data={await getAttendance({ department: "Sales Ops" })} mock />);
    expect(html).toContain('href="/hr/attendance?department=Sales+Ops&amp;session=sess-luis-oct16#session-detail"');
    expect(html).not.toContain('aria-label="Session detail"');
  });

  it("opens the session detail with HR-only scans and a close link", async () => {
    const html = renderToStaticMarkup(<AttendanceView data={await getAttendance({ session: "sess-luis-oct16" })} mock />);
    expect(html).toContain('aria-label="Session detail"');
    expect(html).toContain("Luis Ramos · Oct 16");
    expect(html).toContain("Held for review.");
    expect(html).toContain("HR only");
    expect(html).toContain("16:10:07");
    expect(html).toContain("Oct 17 · 00:40");
    expect(html).toContain("raw, not credited");
    expect(html).toContain("Ask Luis for a correction");
    expect(html).toContain('href="/hr/attendance"');
    expect(html).toMatch(/aria-current="true"[^>]*data-attendance-row/);
  });

  it("lists revisions from an approved correction", async () => {
    const html = renderToStaticMarkup(<AttendanceView data={await getAttendance({ session: "sess-ana-oct13" })} mock />);
    expect(html).toContain("Revisions");
    expect(html).toContain("Not recorded");
    expect(html).toContain("09:10");
    expect(html).toContain('href="/hr/reviews/corr-oct13"');
  });

  it("explains an empty filter", async () => {
    const html = renderToStaticMarkup(<AttendanceView data={await getAttendance({ query: "zzz" })} mock />);
    expect(html).toContain("No sessions match");
  });
});

describe("attendance API", () => {
  it("asks an intern for a correction", async () => {
    const api = createMockAttendanceApi({ delayMs: 0 });
    expect(await api.askForCorrection("sess-luis-oct16")).toEqual({ ok: true, value: { notified: true } });
  });
});
