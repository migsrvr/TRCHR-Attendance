import { describe, expect, it } from "vitest";

import { isOverdue, presentStatus, type Audience, type StatusKind, type StatusPresentation } from "@/lib/ui/status";

type Row = [StatusKind, Audience, Pick<StatusPresentation, "shape" | "tone" | "label">];

// Spec 2026-10-19-hr-attendance-ui-design.md, section 4.1.
const table: Row[] = [
  [{ type: "session", value: "OPEN" }, "hr", { shape: "live", tone: "pend", label: "In office" }],
  [{ type: "session", value: "OPEN" }, "intern", { shape: "live", tone: "pend", label: "In office" }],
  [{ type: "session", value: "COMPLETE" }, "hr", { shape: "dot", tone: "settled", label: "Complete" }],
  [{ type: "session", value: "COMPLETE" }, "intern", { shape: "dot", tone: "settled", label: "Complete" }],
  [{ type: "session", value: "REVIEW" }, "hr", { shape: "chip", tone: "attn", label: "Needs review" }],
  [{ type: "session", value: "REVIEW" }, "intern", { shape: "ring", tone: "pend", label: "Waiting on HR" }],
  [{ type: "session", value: "VOID" }, "hr", { shape: "ring", tone: "inactive", label: "Void" }],
  [{ type: "session", value: "VOID" }, "intern", { shape: "ring", tone: "inactive", label: "Void" }],
  [{ type: "correction", value: "PENDING", ageWorkdays: 1 }, "hr", { shape: "chip", tone: "pend", label: "Pending" }],
  [{ type: "correction", value: "PENDING", ageWorkdays: 3 }, "hr", { shape: "chip", tone: "attn", label: "Needs review" }],
  [{ type: "correction", value: "PENDING", ageWorkdays: 5 }, "intern", { shape: "ring", tone: "pend", label: "Waiting on HR" }],
  [{ type: "correction", value: "NEEDS_INFO" }, "hr", { shape: "ring", tone: "pend", label: "Waiting on intern" }],
  [{ type: "correction", value: "NEEDS_INFO" }, "intern", { shape: "chip", tone: "attn", label: "Reply needed" }],
  [{ type: "correction", value: "APPROVED" }, "hr", { shape: "dot", tone: "settled", label: "Approved" }],
  [{ type: "correction", value: "APPROVED" }, "intern", { shape: "dot", tone: "settled", label: "Approved" }],
  [{ type: "correction", value: "REJECTED" }, "hr", { shape: "dot", tone: "negative", label: "Rejected" }],
  [{ type: "correction", value: "REJECTED" }, "intern", { shape: "dot", tone: "negative", label: "Rejected" }],
  [{ type: "correction", value: "SUPERSEDED" }, "hr", { shape: "ring", tone: "inactive", label: "Superseded" }],
  [{ type: "correction", value: "SUPERSEDED" }, "intern", { shape: "ring", tone: "inactive", label: "Replaced" }],
  [{ type: "scan", value: "ACCEPTED" }, "hr", { shape: "dot", tone: "settled", label: "Accepted" }],
  [{ type: "scan", value: "REJECTED" }, "hr", { shape: "dot", tone: "negative", label: "Scan rejected" }],
  [{ type: "scan", value: "UNCERTAIN" }, "hr", { shape: "dot", tone: "negative", label: "Location uncertain" }],
  [{ type: "account", value: "PENDING" }, "hr", { shape: "ring", tone: "pend", label: "Setup pending" }],
  [{ type: "account", value: "ACTIVE" }, "hr", { shape: "dot", tone: "settled", label: "Active" }],
  [{ type: "account", value: "DISABLED" }, "hr", { shape: "ring", tone: "inactive", label: "Disabled" }],
  [{ type: "internship", value: "ACTIVE" }, "hr", { shape: "dot", tone: "settled", label: "Active" }],
  [{ type: "internship", value: "COMPLETED" }, "hr", { shape: "ring", tone: "inactive", label: "Finished" }],
  [{ type: "internship", value: "CANCELLED" }, "hr", { shape: "ring", tone: "inactive", label: "Cancelled" }],
  [{ type: "today", value: "NOT_STARTED" }, "intern", { shape: "ring", tone: "inactive", label: "No Time in yet" }],
];

describe("presentStatus", () => {
  it.each(table)("%j for %s", (kind, audience, expected) => {
    expect(presentStatus(kind, audience)).toMatchObject(expected);
  });

  it("uses chips only where someone must act", () => {
    const chips = table.filter(([kind, audience]) => presentStatus(kind, audience).shape === "chip");
    const actionable = chips.map(([kind, audience]) => `${audience}:${kind.type}:${kind.value}`);
    expect(actionable.sort()).toEqual(
      [
        "hr:correction:PENDING",
        "hr:correction:PENDING",
        "hr:session:REVIEW",
        "intern:correction:NEEDS_INFO",
      ].sort(),
    );
  });

  it("mutes inactive states", () => {
    expect(presentStatus({ type: "correction", value: "SUPERSEDED" }, "hr").muted).toBe(true);
    expect(presentStatus({ type: "session", value: "COMPLETE" }, "hr").muted).toBeFalsy();
  });
});

describe("isOverdue", () => {
  it("is true only for pending corrections past the review threshold", () => {
    expect(isOverdue({ type: "correction", value: "PENDING", ageWorkdays: 3 })).toBe(true);
    expect(isOverdue({ type: "correction", value: "PENDING", ageWorkdays: 2 })).toBe(false);
    expect(isOverdue({ type: "correction", value: "NEEDS_INFO", ageWorkdays: 9 })).toBe(false);
    expect(isOverdue({ type: "session", value: "REVIEW" })).toBe(false);
  });
});

describe("setup statuses", () => {
  it("draws drafts as waiting, active as settled and retired items muted", () => {
    expect(presentStatus({ type: "policy", value: "DRAFT" }, "hr")).toEqual({ shape: "ring", tone: "pend", label: "Draft" });
    expect(presentStatus({ type: "policy", value: "ACTIVE" }, "hr")).toEqual({ shape: "dot", tone: "settled", label: "Active" });
    expect(presentStatus({ type: "policy", value: "SUPERSEDED" }, "hr")).toMatchObject({ shape: "ring", muted: true });
    expect(presentStatus({ type: "checkpoint", value: "REVOKED" }, "hr")).toMatchObject({ label: "Revoked", muted: true });
    expect(presentStatus({ type: "department", value: "INACTIVE" }, "hr")).toMatchObject({ label: "Inactive", muted: true });
  });
});
