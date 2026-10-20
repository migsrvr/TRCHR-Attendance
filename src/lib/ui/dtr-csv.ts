/**
 * The DTR as CSV rows, matching the preview: one line per session (or per
 * day), pending rows marked and left out of the total, a total line last.
 */

import { toCsv } from "@/lib/ui/csv";
import type { DtrScope } from "@/lib/ui/dtr";
import { formatDuration } from "@/lib/ui/format";
import type { DtrPageVM } from "@/lib/ui/view-models";

const weekday = (isoDate: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));

const STATE_LABEL = { credited: "Credited", none: "No attendance", pending: "Pending, not in total", open: "Open, not in total" } as const;

export function dtrCsvRows(page: DtrPageVM): string[][] {
  const { report, scope } = page;
  if (report.kind === "department") {
    return [
      ["Intern", "Days credited", "Workdays", "Credited", "Credited minutes", "Pending items"],
      ...report.interns.map((intern) => [
        intern.name,
        String(intern.daysCredited),
        String(report.workdays),
        formatDuration(intern.creditedMinutes),
        String(intern.creditedMinutes),
        String(intern.pendingCount),
      ]),
      ["Total", "", "", formatDuration(report.creditedMinutes), String(report.creditedMinutes), String(report.pendingCount)],
    ];
  }

  const header = ["Date", "Day", "Time in", "Time out", "Credited", "Credited minutes", "Status", "Notes"];
  if (scope.includeRaw) header.push("Raw elapsed (not credited)");
  const rows: string[][] = [header];

  for (const day of report.days) {
    const notes = [day.correction?.label, day.note].filter(Boolean).join("; ");
    const lines = day.sessions.length
      ? scope.eachSession
        ? day.sessions.map((session) => [session.start, session.end ?? ""])
        : [[day.sessions[0]!.start, day.sessions.at(-1)!.end ?? ""]]
      : [["", ""]];
    lines.forEach(([timeIn, timeOut], index) => {
      const first = index === 0;
      const line = [
        day.dateIso,
        weekday(day.dateIso),
        timeIn!,
        timeOut!,
        first && day.state === "credited" ? formatDuration(day.creditedMinutes) : "",
        first && day.state === "credited" ? String(day.creditedMinutes) : "",
        first ? STATE_LABEL[day.state] : "",
        first ? notes : "",
      ];
      if (scope.includeRaw) line.push(first && day.rawMinutes !== null ? formatDuration(day.rawMinutes) : "");
      rows.push(line);
    });
  }

  const total = ["Total credited", "", "", "", formatDuration(report.creditedMinutes), String(report.creditedMinutes), "", report.pending.length ? "Pending rows add nothing until decided" : ""];
  if (scope.includeRaw) total.push("");
  rows.push(total);
  return rows;
}

export function dtrCsv(page: DtrPageVM): string {
  return toCsv(dtrCsvRows(page));
}

/** e.g. "dtr-ana-reyes-2026-10-01-to-2026-10-15.csv". */
export function dtrFilename(page: DtrPageVM, scope: DtrScope = page.scope): string {
  const who = page.report.kind === "intern" ? page.report.intern.name : page.report.department;
  const slug = who.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `dtr-${slug}-${scope.from}-to-${scope.to}.csv`;
}

