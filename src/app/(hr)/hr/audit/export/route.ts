import { isMockModeEnabled, requireApiHr } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { getCorrelationId } from "@/lib/http/guard";
import { toCsv } from "@/lib/ui/csv";
import { getAuditLog } from "@/lib/ui/queries/hr";
import { listAuditEntries } from "@/modules/audit";

export const dynamic = "force-dynamic";

/** CSV of the filtered audit log, protected by an HR session check. */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const params = new URL(request.url).searchParams;
  const filters = {
    query: params.get("q") ?? undefined,
    who: params.get("who") ?? undefined,
    category: params.get("category") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  };

  try {
    let entries;
    let timeZone = "Asia/Manila";
    if (isMockModeEnabled() || process.env.NODE_ENV === "test") {
      const log = await getAuditLog(filters);
      entries = log.entries;
    } else {
      await requireApiHr(request);
      const log = await listAuditEntries({ ...filters, limit: 500 });
      entries = log.entries;
      timeZone = log.timeZone;
    }

    const rows = [
      [`When (${timeZone})`, "Who", "Action", "Record", "Change"],
      ...entries.map((entry) => [entry.at, entry.actor.name, entry.action, entry.record.label, entry.change]),
    ];
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="audit-log.csv"',
        "Cache-Control": "private, no-store",
        "X-Correlation-Id": correlationId,
      },
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
