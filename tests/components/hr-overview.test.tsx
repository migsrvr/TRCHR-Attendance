import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OverviewView } from "@/components/views/hr/overview-view";
import { getHrOverview } from "@/lib/ui/queries/hr";

describe("OverviewView", () => {
  it("shows four KPIs with Waiting on HR in the attention color", async () => {
    const html = renderToStaticMarkup(<OverviewView data={await getHrOverview()} />);
    for (const label of ["In office now", "Completed today", "Missing clock-out", "Waiting on HR"]) {
      expect(html).toContain(label);
    }
    expect(html).toMatch(/Waiting on HR<\/p><p[^>]*text-attn[^>]*>4<\/p>/);
    expect(html).toContain("of 24 active interns");
    expect(html).toContain("oldest has waited 4 days");
    expect(html).toContain("Monday, October 19, 2026");
  });

  it("links each Needs you row to its review and flags the overdue one", async () => {
    const data = await getHrOverview();
    const html = renderToStaticMarkup(<OverviewView data={data} />);
    for (const item of data.needsYou) expect(html).toContain(`href="${item.href}"`);
    expect(html).toContain('href="/hr/reviews/corr-oct15"');
    expect(html).toContain("Ana Reyes · correction for Oct 15");
    expect(html).toMatch(/text-attn[^>]*>4d</);
    expect(html).toMatch(/text-muted-foreground[^>]*>3d</);
    expect(html.match(/>JEV</g)?.length).toBe(data.needsYou.filter((item) => item.jevRead).length);
    expect(html.match(/Needs review/g)).toHaveLength(2);
  });

  it("lists who is at the office with live and settled marks", async () => {
    const html = renderToStaticMarkup(<OverviewView data={await getHrOverview()} />);
    expect(html).toContain("At the office today");
    expect(html).toContain("since 08:57");
    expect(html).toContain("Scan rejected");
    expect(html).toContain("View all 21 scans today");
  });

  it("orders the hours table furthest behind first, with pace marks", async () => {
    const html = renderToStaticMarkup(<OverviewView data={await getHrOverview()} />);
    const bea = html.indexOf("Bea Santos</a>");
    const carlo = html.indexOf("Carlo Bautista</a>");
    const ana = html.indexOf("Ana Reyes</a>");
    expect(bea).toBeGreaterThan(-1);
    expect(bea).toBeLessThan(carlo);
    expect(carlo).toBeLessThan(ana);
    expect(html).toContain("312h 30m / 486h");
    expect(html).toMatch(/text-attn[^>]*>−41h</);
    expect(html).toMatch(/aria-selected="true"[^>]*>Behind pace</);
    expect(html).toContain("Finishing soon");
  });

  it("says when nothing is waiting", async () => {
    const data = await getHrOverview();
    const html = renderToStaticMarkup(
      <OverviewView data={{ ...data, needsYou: [], kpis: { ...data.kpis, waitingOnHr: 0, oldestWaitingDays: null } }} />,
    );
    expect(html).toContain("Nothing waiting on you.");
    expect(html).toContain("nothing waiting");
  });
});
