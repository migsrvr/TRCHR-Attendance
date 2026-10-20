import { describe, expect, it } from "vitest";

import { GET } from "@/app/(hr)/hr/reports/export/route";

describe("DTR CSV export route", () => {
  it("downloads the previewed scope as CSV", async () => {
    const response = await GET(new Request("http://localhost/hr/reports/export?subject=ana-reyes&period=first&from=2026-10-01&options=1&each=1&pending=1"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="dtr-ana-reyes-2026-10-01-to-2026-10-15.csv"');
    const body = await response.text();
    expect(body).toContain("Total credited,,,,68h 41m,4121");
  });

  it("refuses an invalid custom range", async () => {
    const response = await GET(new Request("http://localhost/hr/reports/export?period=custom&from=2026-10-20&to=2026-10-01"));
    expect(response.status).toBe(400);
  });
});
