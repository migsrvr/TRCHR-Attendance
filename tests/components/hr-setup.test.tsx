import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuditLogView } from "@/components/views/hr/audit-log-view";
import { DepartmentsView } from "@/components/views/hr/departments-view";
import { OfficeSetupView } from "@/components/views/hr/office-setup-view";
import { PoliciesView } from "@/components/views/hr/policies-view";
import { getAuditLog, getDepartments, getOfficeSetup, getPolicies } from "@/lib/ui/queries/hr";

describe("OfficeSetupView", () => {
  it("marks example values and has labelled radius and accuracy inputs", async () => {
    const html = renderToStaticMarkup(<OfficeSetupView data={await getOfficeSetup()} mock />);
    expect(html).toContain("Office and QR codes");
    expect(html).toContain("Example values.");
    expect(html).toContain('for="office-radius"');
    expect(html).toContain('for="office-accuracy"');
    expect(html).toMatch(/id="office-radius"[^>]*value="60"|value="60"[^>]*id="office-radius"/);
    expect(html).toContain("[LATITUDE], [LONGITUDE]");
    expect(html).toContain("whole accuracy circle sits inside the radius");
  });

  it("summarises the active policy with a link to manage versions", async () => {
    const html = renderToStaticMarkup(<OfficeSetupView data={await getOfficeSetup()} mock />);
    expect(html).toContain("09:00–18:00");
    expect(html).toContain("Mon–Fri");
    expect(html).toContain("Held for review, no credit");
    expect(html).toContain('href="/hr/setup/policies"');
  });

  it("lists QR checkpoints with print and rotate, revoked rows muted", async () => {
    const html = renderToStaticMarkup(<OfficeSetupView data={await getOfficeSetup()} mock />);
    expect(html).toContain('href="/hr/setup/qr/chk-main-in-v2/print"');
    expect(html.match(/Rotate code/g)).toHaveLength(2);
    expect(html).toContain("Revoked Sep 1");
    expect(html).toMatch(/data-revoked="true"[^>]*text-muted-foreground/);
    expect(html).toContain("Rotating revokes every printed copy of the old code immediately");
  });
});

describe("PoliciesView", () => {
  it("lists versions with Draft, Active and Superseded marks", async () => {
    const html = renderToStaticMarkup(<PoliciesView data={await getPolicies()} mock />);
    for (const label of ["Draft", "Active", "Superseded"]) expect(html).toContain(label);
    expect(html).toContain('href="/hr/setup/policies?version=2"');
    expect(html).toContain("1,214 sessions");
  });

  it("edits the draft, marks the changed rounding and works the example", async () => {
    const html = renderToStaticMarkup(<PoliciesView data={await getPolicies()} mock />);
    expect(html).toContain("Version 3 · draft");
    expect(html).toMatch(/aria-pressed="true"[^>]*>Mon</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Sun</);
    expect(html).toContain("Changed · was “None, whole minutes”");
    expect(html).toContain("7h 57m");
    expect(html).toContain("7h 55m");
    expect(html).toContain("Publish version 3");
  });

  it("shows a locked version read-only", async () => {
    const html = renderToStaticMarkup(<PoliciesView data={await getPolicies(2)} mock />);
    expect(html).toContain("Version 2 · active");
    expect(html).toContain("locked");
    expect(html).not.toContain("Publish version");
    expect(html).not.toMatch(/<input[^>]*type="time"/);
  });
});

describe("DepartmentsView", () => {
  it("has no delete action, offers rename and reactivate, and a labelled add form", async () => {
    const html = renderToStaticMarkup(<DepartmentsView rows={await getDepartments()} mock />);
    expect(html).not.toMatch(/>\s*Delete\s*</i);
    expect(html.match(/>Rename</g)).toHaveLength(5);
    expect(html).toContain("Reactivate");
    expect(html).toContain("Inactive since Aug 1");
    expect(html).toContain("+1 setting up");
    expect(html).toContain('for="department-name"');
    expect(html).toContain("Departments can&#x27;t be deleted");
  });
});

describe("AuditLogView", () => {
  it("renders System in italic muted text and links records", async () => {
    const html = renderToStaticMarkup(<AuditLogView data={await getAuditLog({})} />);
    expect(html).toContain("Audit log");
    expect(html).toMatch(/italic[^"]*text-muted-foreground[^>]*>System</);
    expect(html).toContain('href="/hr/attendance?session=sess-luis-oct16"');
    expect(html).toContain("Showing 13 of 186 entries");
    expect(html).toMatch(/href="\/hr\/audit\/export"[^>]*download=""/);
  });

  it("expands a revision into a before and after grid", async () => {
    const html = renderToStaticMarkup(<AuditLogView data={await getAuditLog({})} />);
    expect(html).toMatch(/aria-expanded="false"[^>]*>Session revised/);
    expect(html).toContain("Before");
    expect(html).toContain("After");
    expect(html).toContain("c-7f3a-21e9");
    expect(html).toContain("Original scans, location coordinates and correction text aren");
  });
});
