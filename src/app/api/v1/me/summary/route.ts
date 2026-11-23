import { requireApiIntern } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { getCorrelationId } from "@/lib/http/guard";
import { getMeSummary } from "@/modules/attendance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = await requireApiIntern(request);
    const summary = await getMeSummary(actor);
    return jsonResponse(summary, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
