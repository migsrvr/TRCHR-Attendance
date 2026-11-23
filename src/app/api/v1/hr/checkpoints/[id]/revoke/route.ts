import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { revokeCheckpoint } from "@/modules/offices";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiHr(request);
    assertRateLimit(adminRateLimiter, `checkpoint-revoke:${actor.userId}`);

    const { id } = await context.params;
    const result = await revokeCheckpoint({
      actorId: actor.userId,
      checkpointId: id,
      correlationId,
    });
    return jsonResponse(result, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
