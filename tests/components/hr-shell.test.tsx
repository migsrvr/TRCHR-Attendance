import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HrShell } from "@/components/shell/hr-shell";
import { HR_NAV } from "@/components/shell/nav";
import { getHrShell } from "@/lib/ui/queries/hr";

async function render(active: Parameters<typeof HrShell>[0]["active"]) {
  const shell = await getHrShell();
  return renderToStaticMarkup(
    <HrShell shell={shell} active={active} title="Overview">
      <p>content</p>
    </HrShell>,
  );
}

describe("HrShell", () => {
  it("links every HR page and marks only the active one", async () => {
    const html = await render("overview");
    for (const item of HR_NAV) expect(html).toContain(`href="${item.href}"`);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*class="[^"]*bg-sidebar-accent/);
  });

  it("shows the Reviews count, and inverts it when Reviews is open", async () => {
    const overview = await render("overview");
    expect(overview).toMatch(/Reviews<span[^>]*bg-accent[^>]*>4<\/span>/);
    const reviews = await render("reviews");
    expect(reviews).toMatch(/Reviews<span[^>]*bg-border[^>]*text-primary[^>]*>4<\/span>/);
  });

  it("has the page title, an intern search and HR's name", async () => {
    const html = await render("overview");
    expect(html).toContain("<h1");
    const form = html.match(/<form[^>]*>/)?.[0] ?? "";
    expect(form).toContain('role="search"');
    expect(form).toContain('action="/hr/interns"');
    expect(html).toContain('name="q"');
    expect(html).toContain("[HR NAME]");
    expect(html).toContain("Top Realty office · Asia/Manila");
    expect(html).toContain("<main");
  });
});
