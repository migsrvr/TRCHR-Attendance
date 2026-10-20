import { toCsv } from "@/lib/ui/csv";
import { getAuditLog } from "@/lib/ui/queries/hr";

/** CSV of the filtered audit log, the same entries the page shows. */
export async function GET(request: Request) {
  // TODO(auth): require an HR session once Better Auth is wired (401 otherwise).
  const params = new URL(request.url).searchParams;
  const log = await getAuditLog({
    query: params.get("q") ?? undefined,
    who: params.get("who") ?? undefined,
    category: params.get("category") ?? undefined,
  });
  const rows = [
    ["When (Asia/Manila)", "Who", "Action", "Record", "Change"],
    ...log.entries.map((entry) => [entry.at, entry.actor.name, entry.action, entry.record.label, entry.change]),
  ];
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audit-log.csv"',
      "Cache-Control": "no-store",
    },
  });
}
