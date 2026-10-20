import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReportsView } from "@/components/views/hr/reports-view";
import { getDtrReport } from "@/lib/ui/queries/hr";

describe("ReportsView", () => {
  it("has a labelled scope form that submits with GET", async () => {
    const html = renderToStaticMarkup(<ReportsView data={await getDtrReport({})} />);
    expect(html).toContain("Daily time records");
    expect(html).toMatch(/<form[^>]*action="\/hr\/reports"/);
    expect(html).toContain('for="dtr-subject"');
    expect(html).toContain("All interns in Marketing");
    expect(html).toMatch(/<legend[^>]*>Period<\/legend>/);
    const first = html.match(/<input type="radio"[^>]*value="first"[^>]*>/)?.[0] ?? "";
    expect(first).toContain('name="period"');
    expect(first).toContain('checked=""');
    expect(html).toMatch(/<legend[^>]*>Include<\/legend>/);
    expect(html).toContain("Each session on its own line");
    expect(html).toContain("Update preview");
  });

  it("previews totals, the pending notice and one line per session", async () => {
    const html = renderToStaticMarkup(<ReportsView data={await getDtrReport({})} />);
    expect(html).toContain("Ana Reyes · Oct 1–15, 2026");
    expect(html).toContain("68h 41m");
    expect(html).toContain("of 11 workdays");
    expect(html).toContain("Oct 15 is not in the total yet.");
    expect(html).toContain('href="/hr/reviews/corr-oct15"');
    expect(html).toMatch(/08:58–12:01<br\/>13:00–17:30/);
    expect(html).toContain("Capped at schedule");
    expect(html).toContain("Needs review");
    expect(html).toContain("Total credited");
  });

  it("exports CSV for the same scope, and marks PDF as waiting on HR", async () => {
    const html = renderToStaticMarkup(<ReportsView data={await getDtrReport({})} />);
    expect(html).toMatch(/href="\/hr\/reports\/export\?subject=ana-reyes&amp;period=first&amp;from=2026-10-01[^"]*"[^>]*download=""/);
    expect(html).toContain("Export CSV");
    const pdf = html.slice(html.indexOf('aria-disabled="true"'));
    expect(pdf.slice(0, pdf.indexOf("</span>"))).toContain("PDF layout");
    expect(html).toContain("needs HR template");
  });

  it("shows a department summary", async () => {
    const html = renderToStaticMarkup(<ReportsView data={await getDtrReport({ subject: "department:Marketing" })} />);
    expect(html).toContain("Marketing · Oct 1–15, 2026");
    expect(html).toContain("Ana Reyes");
    expect(html).toContain("Marco Dela Cruz");
  });

  it("explains a bad custom range next to the dates", async () => {
    const html = renderToStaticMarkup(<ReportsView data={await getDtrReport({ period: "custom", from: "2026-10-20", to: "2026-10-01" })} />);
    expect(html).toMatch(/role="alert"[^>]*>The end date is before the start date/);
    expect(html).toContain("Showing Oct 1–15, 2026 until the range is fixed.");
  });
});
