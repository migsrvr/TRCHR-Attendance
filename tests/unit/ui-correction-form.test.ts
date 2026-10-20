import { describe, expect, it } from "vitest";

import { CORRECTION_REASONS, suggestReason, validateCorrection, type CorrectionDraft } from "@/lib/ui/correction-form";

const today = "2026-10-19";

const draft = (overrides: Partial<CorrectionDraft> = {}): CorrectionDraft => ({
  dateIso: "2026-10-15",
  reason: "missed_clock_out",
  timeIn: "09:04",
  timeOut: "18:05",
  explanation: "The client meeting ran late and I left at 6:05 PM.",
  recorded: { timeIn: "09:04", timeOut: null },
  ...overrides,
});

describe("validateCorrection", () => {
  it("accepts a missed clock-out and proposes only the changed time", () => {
    const result = validateCorrection(draft(), today);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.proposal).toEqual({ timeOut: "18:05" });
  });

  it("requires a reason", () => {
    const result = validateCorrection(draft({ reason: null }), today);
    expect(result).toMatchObject({ ok: false, errors: { reason: "Choose what happened." } });
  });

  it("refuses future days", () => {
    const result = validateCorrection(draft({ dateIso: "2026-10-20" }), today);
    expect(result).toMatchObject({ ok: false, errors: { dateIso: "Pick today or an earlier day." } });
  });

  it("requires at least one changed time", () => {
    const result = validateCorrection(draft({ timeOut: "" }), today);
    expect(result).toMatchObject({ ok: false, errors: { timeOut: "Change at least one time." } });
  });

  it("requires Time out to be later than Time in", () => {
    const result = validateCorrection(draft({ timeOut: "08:30" }), today);
    expect(result).toMatchObject({ ok: false, errors: { timeOut: "Time out must be later than Time in." } });
  });

  it("checks order against the recorded time when only one time changes", () => {
    const result = validateCorrection(
      draft({ recorded: { timeIn: "09:04", timeOut: "12:00" }, timeIn: "12:30", timeOut: "12:00", reason: "missed_clock_in" }),
      today,
    );
    expect(result).toMatchObject({ ok: false, errors: { timeOut: "Time out must be later than Time in." } });
  });

  it("needs both times for a day with no scans", () => {
    const result = validateCorrection(draft({ recorded: null, timeIn: "09:00", timeOut: "", reason: "other" }), today);
    expect(result).toMatchObject({ ok: false, errors: { timeOut: "Add the time you left." } });
    const missingIn = validateCorrection(draft({ recorded: null, timeIn: "", timeOut: "18:00", reason: "other" }), today);
    expect(missingIn).toMatchObject({ ok: false, errors: { timeIn: "Add the time you arrived." } });
  });

  it("proposes both times for a day with no scans", () => {
    const result = validateCorrection(draft({ recorded: null, timeIn: "09:00", timeOut: "18:00", reason: "technical_issue" }), today);
    expect(result).toMatchObject({ ok: true, proposal: { timeIn: "09:00", timeOut: "18:00" } });
  });

  it("asks for a real explanation", () => {
    const result = validateCorrection(draft({ explanation: "  forgot " }), today);
    expect(result).toMatchObject({
      ok: false,
      errors: { explanation: "Say what happened in a sentence, and who can confirm it." },
    });
  });

  it("reports every problem at once", () => {
    const result = validateCorrection(draft({ reason: null, explanation: "" }), today);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["explanation", "reason"]);
  });
});

describe("suggestReason", () => {
  it("suggests the obvious reason from what was recorded", () => {
    expect(suggestReason({ timeIn: "09:04", timeOut: null })).toBe("missed_clock_out");
    expect(suggestReason({ timeIn: null, timeOut: "18:00" })).toBe("missed_clock_in");
    expect(suggestReason(null)).toBeNull();
    expect(suggestReason({ timeIn: "09:00", timeOut: "18:00" })).toBeNull();
  });
});

describe("CORRECTION_REASONS", () => {
  it("offers the five reasons from the design, matching Jev categories", () => {
    expect(CORRECTION_REASONS.map((r) => r.value)).toEqual([
      "missed_clock_out",
      "missed_clock_in",
      "technical_issue",
      "wrong_action",
      "other",
    ]);
  });
});
