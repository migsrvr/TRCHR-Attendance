import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId } from "@/lib/http/guard";
import { assertRateLimit, reviewRateLimiter } from "@/lib/http/rate-limit";
import { retryReviewJob } from "@/modules/corrections";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiHr(request);
    assertRateLimit(reviewRateLimiter, `jev-retry:${actor.userId}`);

    const { id } = await context.params;
    const result = await retryReviewJob({
      actorId: actor.userId,
      correctionRequestId: id,
      correlationId,
    });
    return jsonResponse(result, 202, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
