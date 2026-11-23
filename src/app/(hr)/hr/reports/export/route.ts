import { isMockModeEnabled, requireApiHr } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { getCorrelationId } from "@/lib/http/guard";
import { dtrCsv, dtrFilename } from "@/lib/ui/dtr-csv";
import { getDtrReport } from "@/lib/ui/queries/hr";
import { buildDtrPage } from "@/modules/reports";

export const dynamic = "force-dynamic";

/**
 * CSV download of the DTR preview, from the same query and scope as the page,
 * protected by an HR session check and backed by a repeatable-read snapshot.
 */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const params = Object.fromEntries(new URL(request.url).searchParams);

  try {
    let page;
    if (isMockModeEnabled() || process.env.NODE_ENV === "test") {
      page = await getDtrReport(params);
    } else {
      const actor = await requireApiHr(request);
      page = await buildDtrPage(params, {
        actorId: actor.userId,
        correlationId,
        recordExportAudit: true,
      });
    }

    if (page.rangeError) {
      return new Response(page.rangeError, {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
      });
    }
    return new Response(dtrCsv(page), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dtrFilename(page)}"`,
        "Cache-Control": "private, no-store",
        "X-Correlation-Id": correlationId,
      },
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
