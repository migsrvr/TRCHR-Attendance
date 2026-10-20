import { describe, expect, it } from "vitest";

import { formatMinutesAsHhMm } from "@/domain/calculation/formatters";

describe("calculation engine", () => {
  it.todo("unions eligible intervals and excludes gaps between sessions");
  it.todo("clips intervals against allowed schedule windows");
  it.todo("applies an additional break deduction only for a short qualifying gap");
  it.todo("clamps negative durations to zero");
  it.todo("applies the daily cap before day-level rounding");
  it.todo("rounds once per day (floor, ceiling, nearest half-up)");
  it.todo("produces integer credited minutes for the fixture 09:00-12:00 and 13:00-18:00");
});

describe("formatters", () => {
  it("formats integer minutes as hh:mm", () => {
    expect(formatMinutesAsHhMm(480)).toBe("08:00");
    expect(formatMinutesAsHhMm(120)).toBe("02:00");
    expect(formatMinutesAsHhMm(65)).toBe("01:05");
    expect(formatMinutesAsHhMm(-10)).toBe("00:00");
  });
});
