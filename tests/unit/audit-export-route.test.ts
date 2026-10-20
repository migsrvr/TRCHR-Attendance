import { describe, expect, it } from "vitest";

import { GET } from "@/app/(hr)/hr/audit/export/route";

describe("audit CSV export route", () => {
  it("exports the filtered entries", async () => {
    const response = await GET(new Request("http://localhost/hr/audit/export?who=system"));
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="audit-log.csv"');
    const lines = (await response.text()).trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("2026-10-17 00:41,System,Held session for review,Luis Ramos · Oct 16,Time out landed after midnight");
  });
});
