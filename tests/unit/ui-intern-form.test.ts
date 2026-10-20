import { describe, expect, it } from "vitest";

import { DEFAULT_REQUIRED_HOURS, validateNewIntern, type NewInternDraft } from "@/lib/ui/intern-form";

const DEPARTMENTS = ["Leasing", "Marketing"];
const valid: NewInternDraft = {
  name: "Rina Mendoza",
  email: "rina.mendoza@school.edu.ph",
  department: "Leasing",
  requiredHours: String(DEFAULT_REQUIRED_HOURS),
  startDate: "2026-10-26",
  endDate: "",
};

describe("validateNewIntern", () => {
  it("accepts a complete draft with no end date", () => {
    expect(validateNewIntern(valid, DEPARTMENTS)).toEqual({});
  });

  it("explains each missing or wrong field", () => {
    const errors = validateNewIntern(
      { name: " ", email: "rina@", department: "", requiredHours: "4.5", startDate: "", endDate: "" },
      DEPARTMENTS,
    );
    expect(Object.keys(errors).sort()).toEqual(["department", "email", "name", "requiredHours", "startDate"]);
    expect(errors.requiredHours).toMatch(/whole hours/);
  });

  it("rejects an unknown department and out-of-range hours", () => {
    expect(validateNewIntern({ ...valid, department: "Legal" }, DEPARTMENTS).department).toBeDefined();
    expect(validateNewIntern({ ...valid, requiredHours: "0" }, DEPARTMENTS).requiredHours).toBeDefined();
    expect(validateNewIntern({ ...valid, requiredHours: "2001" }, DEPARTMENTS).requiredHours).toBeDefined();
  });

  it("needs the end date on or after the start date", () => {
    expect(validateNewIntern({ ...valid, endDate: "2026-10-25" }, DEPARTMENTS).endDate).toMatch(/on or after/);
    expect(validateNewIntern({ ...valid, endDate: "2026-10-26" }, DEPARTMENTS)).toEqual({});
  });
});
