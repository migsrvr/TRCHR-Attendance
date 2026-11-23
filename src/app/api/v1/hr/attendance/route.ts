import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { getCorrelationId } from "@/lib/http/guard";
import type { AttendanceStatusFilter } from "@/lib/ui/view-models";
import { listSessionsByDay } from "@/modules/attendance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    await requireApiHr(request);
    const params = new URL(request.url).searchParams;
    const data = await listSessionsByDay({
      query: params.get("q") ?? undefined,
      internId: params.get("intern") ?? undefined,
      department: params.get("department") ?? undefined,
      status: (params.get("status") as AttendanceStatusFilter | null) ?? undefined,
      session: params.get("session") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    });
    return jsonResponse(data, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
