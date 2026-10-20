import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CorrectionDetailView } from "@/components/views/intern/correction-detail-view";
import { NewCorrectionForm } from "@/components/views/intern/new-correction-form";
import { getCorrectionDetail, getNewCorrection } from "@/lib/ui/queries/intern";

describe("NewCorrectionForm", () => {
  it("prefills from what was recorded and suggests the reason", async () => {
    const html = renderToStaticMarkup(<NewCorrectionForm data={await getNewCorrection("2026-10-15")} mock />);
    expect(html).toContain('type="date"');
    expect(html).toContain('value="2026-10-15"');
    expect(html).toContain('max="2026-10-19"');
    expect(html).toContain("Recorded that day: Time in");
    expect(html).toContain("no Time out");
    expect(html.match(/type="radio"/g)).toHaveLength(5);
    expect(html).toMatch(/value="missed_clock_out"[^>]*checked=""|checked=""[^>]*value="missed_clock_out"/);
    expect(html).toContain('value="09:04"');
    expect(html).toContain("Send to HR");
  });

  it("uses 16px fields so iPhones don't zoom in on focus", async () => {
    const html = renderToStaticMarkup(<NewCorrectionForm data={await getNewCorrection("2026-10-15")} mock />);
    expect(html.match(/phone-field/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("labels every field", async () => {
    const html = renderToStaticMarkup(<NewCorrectionForm data={await getNewCorrection("2026-10-15")} mock />);
    for (const id of ["corr-date", "corr-time-in", "corr-time-out", "corr-explanation"]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("explains a day with no scans", async () => {
    const html = renderToStaticMarkup(<NewCorrectionForm data={await getNewCorrection("2026-10-09")} mock />);
    expect(html).toContain("No scans recorded that day");
  });
});

describe("CorrectionDetailView", () => {
  it("shows the change, the thread and a reply box for an open request", async () => {
    const detail = (await getCorrectionDetail("corr-oct15"))!;
    const html = renderToStaticMarkup(<CorrectionDetailView data={detail} mock />);
    expect(html).toContain("Thu, Oct 15 · Forgot to scan OUT");
    expect(html).toContain("Waiting on HR");
    expect(html).toContain("18:05");
    expect(html).toContain("8h 01m");
    expect(html).toContain("HR asked for more info");
    expect(html.indexOf("I forgot to scan OUT")).toBeLessThan(html.indexOf("Which meeting was this"));
    expect(html).toContain('for="reply"');
    expect(html).toContain('href="/corrections/new?date=2026-10-15"');
  });

  it("shows the outcome and no reply box once decided", async () => {
    const detail = (await getCorrectionDetail("corr-oct13"))!;
    const html = renderToStaticMarkup(<CorrectionDetailView data={detail} mock />);
    expect(html).toContain("Approved");
    expect(html).toContain("+7h 35m");
    expect(html).toContain("Confirmed with the Marketing lead");
    expect(html).not.toContain('for="reply"');
  });

  it("asks the intern to reply when HR needs more information", async () => {
    const detail = (await getCorrectionDetail("corr-oct15"))!;
    const html = renderToStaticMarkup(<CorrectionDetailView data={{ ...detail, status: "NEEDS_INFO" }} mock />);
    expect(html).toContain("Reply needed");
    expect(html).toContain("HR needs more information");
  });
});
