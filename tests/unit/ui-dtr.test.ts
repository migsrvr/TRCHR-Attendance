import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/ui/csv";
import { defaultPeriod, formatRange, parseDtrScope, periodRange, validateRange, workdaysBetween } from "@/lib/ui/dtr";

describe("DTR periods", () => {
  it("splits a month at the 15th, ending on the month's last day", () => {
    expect(periodRange("first", "2026-10-19")).toEqual({ from: "2026-10-01", to: "2026-10-15" });
    expect(periodRange("second", "2026-10-03")).toEqual({ from: "2026-10-16", to: "2026-10-31" });
    expect(periodRange("second", "2028-02-10")).toEqual({ from: "2028-02-16", to: "2028-02-29" });
  });

  it("defaults to the latest finished half-month", () => {
    expect(defaultPeriod("2026-10-19")).toEqual({ period: "first", from: "2026-10-01", to: "2026-10-15" });
    expect(defaultPeriod("2026-10-15")).toEqual({ period: "second", from: "2026-09-16", to: "2026-09-30" });
    expect(defaultPeriod("2027-01-05")).toEqual({ period: "second", from: "2026-12-16", to: "2026-12-31" });
  });

  it("counts Monday to Friday", () => {
    expect(workdaysBetween("2026-10-01", "2026-10-15")).toBe(11);
    expect(workdaysBetween("2026-10-17", "2026-10-18")).toBe(0);
  });

  it("rejects reversed or overly long ranges", () => {
    expect(validateRange("2026-10-15", "2026-10-01")).toMatch(/after/);
    expect(validateRange("2026-08-01", "2026-10-15")).toMatch(/62 days/);
    expect(validateRange("2026-10-01", "2026-10-15")).toBeNull();
  });

  it("formats ranges compactly", () => {
    expect(formatRange("2026-10-01", "2026-10-15")).toBe("Oct 1–15, 2026");
    expect(formatRange("2026-10-16", "2026-11-03")).toBe("Oct 16 – Nov 3, 2026");
    expect(formatRange("2026-12-16", "2027-01-05")).toBe("Dec 16, 2026 – Jan 5, 2027");
  });
});

describe("parseDtrScope", () => {
  const defaults = { todayIso: "2026-10-19", defaultInternId: "ana-reyes" };

  it("fills sensible defaults", () => {
    expect(parseDtrScope({}, defaults)).toEqual({
      scope: {
        subject: { kind: "intern", id: "ana-reyes" },
        period: "first",
        from: "2026-10-01",
        to: "2026-10-15",
        eachSession: true,
        includePending: true,
        includeRaw: false,
      },
      error: null,
    });
  });

  it("reads a department, a named half and unchecked options", () => {
    const { scope } = parseDtrScope({ subject: "department:Marketing", period: "second", from: "2026-10-05", options: "1", raw: "1" }, defaults);
    expect(scope).toMatchObject({
      subject: { kind: "department", name: "Marketing" },
      from: "2026-10-16",
      to: "2026-10-31",
      eachSession: false,
      includePending: false,
      includeRaw: true,
    });
  });

  it("keeps a bad custom range and reports it", () => {
    const { scope, error } = parseDtrScope({ period: "custom", from: "2026-10-20", to: "2026-10-01" }, defaults);
    expect(scope.period).toBe("custom");
    expect(error).toMatch(/after/);
  });
});

describe("toCsv", () => {
  it("quotes commas, quotes and line breaks, and uses CRLF with a BOM", () => {
    const csv = toCsv([
      ["Date", "Notes"],
      ["2026-10-06", 'Gap, "short"\nnext'],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿Date,Notes\r\n2026-10-06,"Gap, ""short""\nnext"\r\n');
  });

  it("defuses cells a spreadsheet would run as formulas", () => {
    expect(toCsv([["=HYPERLINK(1)", "+1", "-2", "@x", "8h 01m"]])).toBe("﻿'=HYPERLINK(1),'+1,'-2,'@x,8h 01m\r\n");
  });
});
