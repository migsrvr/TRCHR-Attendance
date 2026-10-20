import { describe, expect, it } from "vitest";

import { dtrCsv, dtrCsvRows, dtrFilename } from "@/lib/ui/dtr-csv";
import { getDtrReport } from "@/lib/ui/queries/hr";

describe("DTR CSV", () => {
  it("has one line per session, marks pending, and ends with the total", async () => {
    const rows = dtrCsvRows(await getDtrReport({}));
    expect(rows[0]).toEqual(["Date", "Day", "Time in", "Time out", "Credited", "Credited minutes", "Status", "Notes"]);
    const oct6 = rows.filter((row) => row[0] === "2026-10-06");
    expect(oct6.map((row) => [row[2], row[3], row[4]])).toEqual([
      ["08:58", "12:01", "7h 30m"],
      ["13:00", "17:30", ""],
    ]);
    expect(rows.find((row) => row[0] === "2026-10-15")?.[6]).toBe("Pending, not in total");
    expect(rows.at(-1)?.slice(0, 6)).toEqual(["Total credited", "", "", "", "68h 41m", "4121"]);
  });

  it("puts a day on one line when asked, and adds raw elapsed when asked", async () => {
    const rows = dtrCsvRows(await getDtrReport({ options: "1", pending: "1", raw: "1" }));
    const oct6 = rows.filter((row) => row[0] === "2026-10-06");
    expect(oct6).toHaveLength(1);
    expect(oct6[0]!.slice(2, 4)).toEqual(["08:58", "17:30"]);
    expect(rows[0]!.at(-1)).toBe("Raw elapsed (not credited)");
    expect(oct6[0]!.at(-1)).toBe("7h 33m");
  });

  it("exports a department summary and names the file", async () => {
    const page = await getDtrReport({ subject: "department:Marketing" });
    expect(dtrCsvRows(page)[0]![0]).toBe("Intern");
    expect(dtrFilename(page)).toBe("dtr-marketing-2026-10-01-to-2026-10-15.csv");
    expect(dtrCsv(page).endsWith("\r\n")).toBe(true);
  });
});
