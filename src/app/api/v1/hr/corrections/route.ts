import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { getCorrelationId } from "@/lib/http/guard";
import type { ReviewQueueVM, ReviewTab } from "@/lib/ui/view-models";
import { listForReview } from "@/modules/corrections";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    await requireApiHr(request);
    const params = new URL(request.url).searchParams;
    const data = await listForReview({
      tab: (params.get("tab") as ReviewTab | null) ?? undefined,
      query: params.get("q") ?? undefined,
      department: params.get("department") ?? undefined,
      jev: (params.get("jev") as ReviewQueueVM["jev"] | null) ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    });
    return jsonResponse(data, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
