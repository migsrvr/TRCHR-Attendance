import { describe, expect, it } from "vitest";

import {
  formatClock,
  formatDelta,
  formatDuration,
  formatDayHeading,
  formatHours,
  formatLongDate,
  formatMonthLabel,
  formatReceiptId,
  formatShortDate,
  shiftMonth,
} from "@/lib/ui/format";

describe("formatDuration", () => {
  it("formats minutes as hours and zero-padded minutes", () => {
    expect(formatDuration(481)).toBe("8h 01m");
    expect(formatDuration(18750)).toBe("312h 30m");
    expect(formatDuration(0)).toBe("0h 00m");
  });

  it("never goes negative", () => {
    expect(formatDuration(-5)).toBe("0h 00m");
  });
});

describe("formatDelta", () => {
  it("signs the value", () => {
    expect(formatDelta(481)).toBe("+8h 01m");
    expect(formatDelta(-360)).toBe("−6h 00m");
  });
});

describe("formatClock", () => {
  const instant = new Date("2026-10-19T00:57:12Z"); // 08:57:12 in Manila

  it("uses the office time zone and a 24-hour clock", () => {
    expect(formatClock(instant, "Asia/Manila")).toBe("08:57");
    expect(formatClock(instant, "Asia/Manila", { seconds: true })).toBe("08:57:12");
  });

  it("keeps afternoon times in 24-hour form", () => {
    expect(formatClock(new Date("2026-10-19T10:05:08Z"), "Asia/Manila")).toBe("18:05");
  });
});

describe("formatShortDate / formatLongDate", () => {
  it("formats office-local dates without shifting them", () => {
    expect(formatShortDate("2026-10-15")).toBe("Oct 15");
    expect(formatShortDate("2026-10-15", { weekday: true })).toBe("Thu, Oct 15");
    expect(formatLongDate("2026-10-19")).toBe("Monday, October 19, 2026");
  });
});

describe("formatMonthLabel / shiftMonth", () => {
  it("names a month", () => {
    expect(formatMonthLabel("2026-10")).toBe("October 2026");
  });

  it("moves across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-10", -1)).toBe("2026-09");
  });
});

describe("formatReceiptId", () => {
  it("shows the first eight characters in two groups", () => {
    expect(formatReceiptId("4f2a91c0-7d1e-4b8a-9c2f-000000000000")).toBe("4F2A-91C0");
  });
});

describe("formatHours", () => {
  it("shows a requirement in whole hours", () => {
    expect(formatHours(29160)).toBe("486h");
    expect(formatHours(36000)).toBe("600h");
  });
});

describe("formatDayHeading", () => {
  it("names the weekday in full", () => {
    expect(formatDayHeading("2026-10-19")).toBe("Monday, Oct 19");
  });
});
