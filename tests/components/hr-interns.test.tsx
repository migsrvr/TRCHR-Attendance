import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AddInternDialog } from "@/components/views/hr/add-intern-dialog";
import { InternProfileView } from "@/components/views/hr/intern-profile-view";
import { InternsView } from "@/components/views/hr/interns-view";
import { getInternList, getInternProfile } from "@/lib/ui/queries/hr";

describe("InternsView", () => {
  it("shows account tabs as links with counts, the current one marked", async () => {
    const html = renderToStaticMarkup(<InternsView data={await getInternList({})} mock />);
    expect(html).toContain("Intern directory");
    expect(html).toMatch(/aria-current="page"[^>]*>All<span[^>]*>37<\/span>/);
    expect(html).toContain('href="/hr/interns?tab=pending"');
    expect(html).toMatch(/Setup pending<span[^>]*>3<\/span>/);
  });

  it("gives pending rows a Resend button and mutes disabled rows", async () => {
    const html = renderToStaticMarkup(<InternsView data={await getInternList({})} mock />);
    expect(html).toContain("Link sent Oct 18");
    expect(html).toMatch(/<button[^>]*>Resend<\/button>/);
    expect(html).toContain("Records kept");
    expect(html).toMatch(/text-muted-foreground[^>]*>Joel Navarro</);
    expect(html).toContain('href="/hr/interns/ana-reyes"');
    expect(html).not.toContain('href="/hr/interns/rina-mendoza"');
    expect(html).toContain("312h 30m / 486h");
    expect(html).toContain("Starts Oct 26 · 486h required");
    expect(html).toContain('aria-label="More actions for Ana Reyes"');
  });

  it("has labelled search and department filters and an Add intern button", async () => {
    const html = renderToStaticMarkup(<InternsView data={await getInternList({ query: "ana" })} mock />);
    expect(html).toMatch(/<form[^>]*role="search"/);
    expect(html).toContain('value="ana"');
    expect(html).toContain("Search name or email");
    expect(html).toMatch(/<select[^>]*name="department"/);
    expect(html).toContain("Add intern");
  });

  it("explains an empty result", async () => {
    const html = renderToStaticMarkup(<InternsView data={await getInternList({ query: "zzz" })} mock />);
    expect(html).toContain("No interns match");
  });
});

describe("AddInternDialog", () => {
  it("labels every field and never promises a password by email", async () => {
    const data = await getInternList({});
    const html = renderToStaticMarkup(
      <AddInternDialog departments={data.departments} officeLabel={data.officeLabel} defaultRequiredMinutes={29160} mock />,
    );
    for (const id of ["intern-name", "intern-email", "intern-department", "intern-hours", "intern-start", "intern-end"]) {
      expect(html).toContain(`for="${id}"`);
    }
    expect(html).toContain('value="486"');
    expect(html).toContain("Passwords are never sent by email");
    expect(html).toContain("Create and send link");
    expect(html).toContain("<dialog");
  });
});

describe("InternProfileView", () => {
  it("shows live status, hours and pace from the shared helpers", async () => {
    const html = renderToStaticMarkup(<InternProfileView data={(await getInternProfile("ana-reyes"))!} mock />);
    expect(html).toContain("Ana Reyes");
    expect(html).toContain("since 08:57");
    expect(html).toContain("312h 30m");
    expect(html).toContain("173h 30m");
    expect(html).toMatch(/About <span[^>]*>6h 00m<\/span> a workday/);
    expect(html).toContain("1 pending correction could add 8h 01m once decided.");
  });

  it("lists the last 7 days with the held Oct 15 marked", async () => {
    const html = renderToStaticMarkup(<InternProfileView data={(await getInternProfile("ana-reyes"))!} mock />);
    expect(html).toContain("Thu, Oct 15");
    expect(html).toContain("Needs review");
    expect(html).toContain('href="/hr/reviews/corr-oct15"');
    expect(html).toContain("23h 32m");
    expect(html).toContain("approved correction");
  });

  it("puts destructive account actions in crimson outline", async () => {
    const html = renderToStaticMarkup(<InternProfileView data={(await getInternProfile("ana-reyes"))!} mock />);
    expect(html).toMatch(/<button[^>]*border-secondary[^>]*text-secondary[^>]*>Disable account<\/button>/);
    expect(html).toContain("Sign out all devices");
    expect(html).toContain("Attendance and review history are kept.");
  });

  it("works for an intern without detailed records", async () => {
    const html = renderToStaticMarkup(<InternProfileView data={(await getInternProfile("bea-santos"))!} mock />);
    expect(html).toContain("Bea Santos");
    expect(html).toContain("No attendance in the last 7 days");
  });
});
