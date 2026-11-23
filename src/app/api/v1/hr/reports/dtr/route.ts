import { requireApiHr } from "@/lib/auth/session";
import { AppError, errorResponse, jsonResponse } from "@/lib/http/errors";
import { getCorrelationId } from "@/lib/http/guard";
import { dtrCsv, dtrFilename } from "@/lib/ui/dtr-csv";
import { buildDtrPage } from "@/modules/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = await requireApiHr(request);
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const isCsv = params.format === "csv";

    const page = await buildDtrPage(params, {
      actorId: actor.userId,
      correlationId,
      recordExportAudit: isCsv,
    });
    if (page.rangeError) {
      throw new AppError(400, "INVALID_RANGE", page.rangeError, false);
    }

    if (isCsv) {
      return new Response(dtrCsv(page), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${dtrFilename(page)}"`,
          "Cache-Control": "private, no-store",
          "X-Correlation-Id": correlationId,
        },
      });
    }

    return jsonResponse(page, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
