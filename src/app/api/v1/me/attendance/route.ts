import { requireApiIntern } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { getCorrelationId } from "@/lib/http/guard";
import { getMeAttendance } from "@/modules/attendance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = await requireApiIntern(request);
    const params = new URL(request.url).searchParams;
    const data = await getMeAttendance(actor, {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      cursor: params.get("cursor") ?? undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    });
    return jsonResponse(data, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
