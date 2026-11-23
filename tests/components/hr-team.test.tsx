import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HrTeamView } from "@/components/views/hr/hr-team-view";
import { getHrTeam } from "@/lib/ui/queries/hr";

describe("HrTeamView", () => {
  it("lists HR accounts with invite action, setup-link resend, and self-disable protection", async () => {
    const html = renderToStaticMarkup(<HrTeamView data={await getHrTeam()} mock />);
    expect(html).toContain("HR team");
    expect(html).toContain("Add HR user");
    expect(html).toContain("hr@toprealty.ph");
    expect(html).toContain("Clarisse Villanueva");
    expect(html).toContain("Resend link");
    expect(html).toContain("Reactivate");
    expect(html).toContain("You cannot disable your own account");
  });
});
