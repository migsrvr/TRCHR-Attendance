import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GeofenceMark } from "@/components/attendance/geofence-mark";
import { ReviewDetailView } from "@/components/views/hr/review-detail-view";
import { ReviewsView } from "@/components/views/hr/reviews-view";
import { getReviewDetail, getReviewQueue } from "@/lib/ui/queries/hr";

describe("ReviewsView", () => {
  it("shows status tabs with counts, Waiting on you in the attention color", async () => {
    const html = renderToStaticMarkup(<ReviewsView data={await getReviewQueue({ tab: "you" })} />);
    expect(html).toContain("Correction reviews");
    expect(html).toMatch(/aria-current="page"[^>]*>Waiting on you<span[^>]*text-attn[^>]*>4<\/span>/);
    expect(html).toContain('href="/hr/reviews?tab=intern"');
    expect(html).toMatch(/All<span[^>]*>44<\/span>/);
  });

  it("has exactly one overdue chip among corrections, plus the held session", async () => {
    const html = renderToStaticMarkup(<ReviewsView data={await getReviewQueue({ tab: "you" })} />);
    expect(html.match(/Needs review/g)).toHaveLength(2);
    expect(html).toContain('href="/hr/reviews/corr-oct15"');
    expect(html).toContain("Add Time out");
    expect(html).toContain("Manual review");
    expect(html).toMatch(/text-attn[^>]*>4d</);
  });

  it("draws waiting-on-intern rows as rings and keeps the advisory note", async () => {
    const html = renderToStaticMarkup(<ReviewsView data={await getReviewQueue({ tab: "intern" })} />);
    expect(html).toContain("Waiting on intern");
    expect(html).toContain("border-pend");
    expect(html).toContain("They never approve, reject, or change hours");
  });

  it("explains an empty tab", async () => {
    const html = renderToStaticMarkup(<ReviewsView data={await getReviewQueue({ tab: "you", query: "zzz" })} />);
    expect(html).toContain("No requests match");
  });
});

describe("ReviewDetailView", () => {
  it("highlights only the changed value and shows both timelines", async () => {
    const html = renderToStaticMarkup(<ReviewDetailView data={(await getReviewDetail("corr-oct15"))!} mock />);
    expect(html).toContain("Missed clock-out · Oct 15");
    expect(html).toContain("request version 3");
    expect(html.match(/data-changed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/data-changed="true"[^>]*bg-pend-bg[^>]*text-pend[^>]*>18:05</);
    expect(html).toContain("Not recorded");
    expect(html).toContain("+8h 01m");
    expect(html).toContain("Recorded now");
    expect(html).toContain("If approved");
    expect(html.match(/data-segment=/g)?.length).toBe(2);
    expect(html).toContain("312h 30m to 320h 31m of 486h");
  });

  it("lists the conversation in order and asks for a labelled, required note", async () => {
    const html = renderToStaticMarkup(<ReviewDetailView data={(await getReviewDetail("corr-oct15"))!} mock />);
    const first = html.indexOf("I forgot to scan OUT");
    const second = html.indexOf("Which meeting was this");
    const third = html.indexOf("The leasing debrief");
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
    expect(html).toContain('for="decision-note"');
    expect(html).toMatch(/<textarea[^>]*id="decision-note"[^>]*required=""/);
    for (const label of ["Ask for more info", "Reject", "Approve correction"]) expect(html).toContain(label);
  });

  it("labels Jev as advisory with the version it read, and shows HR-only evidence", async () => {
    const html = renderToStaticMarkup(<ReviewDetailView data={(await getReviewDetail("corr-oct15"))!} mock />);
    expect(html).toContain("Advisory only");
    expect(html).toContain("Reads request version 3");
    expect(html).toContain("HR only");
    expect(html).toContain("09:04:12");
    expect(html).toMatch(/role="img"[^>]*aria-label="[^"]*18 metres[^"]*inside the 60 metre radius/);
  });

  it("shows the conflict banner when the request changed", async () => {
    const html = renderToStaticMarkup(<ReviewDetailView data={(await getReviewDetail("corr-oct15"))!} mock initialConflict />);
    expect(html).toMatch(/role="alert"[\s\S]*This request changed while you were reading it/);
    expect(html).toContain("Refresh request");
  });

  it("says Jev was unavailable for a manual review", async () => {
    const html = renderToStaticMarkup(<ReviewDetailView data={(await getReviewDetail("corr-bea-oct14"))!} mock />);
    expect(html).toContain("Manual review");
    expect(html).not.toContain("Reads request version");
  });

  it("shows a decided request read-only with HR's note", async () => {
    const html = renderToStaticMarkup(<ReviewDetailView data={(await getReviewDetail("corr-oct13"))!} mock />);
    expect(html).toContain("Approved");
    expect(html).toContain("Confirmed with the Marketing lead");
    expect(html).not.toContain("<textarea");
  });
});

describe("GeofenceMark", () => {
  it("states distance, radius and the result", () => {
    const html = renderToStaticMarkup(<GeofenceMark distanceM={84} radiusM={60} accuracyM={30} accepted={false} />);
    expect(html).toMatch(/aria-label="Scan location 84 metres from the office centre, outside the 60 metre radius/);
  });
});
