import { z } from "zod";

import { requireApiUser } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { assertRateLimit, correctionRateLimiter } from "@/lib/http/rate-limit";
import { addCorrectionComment } from "@/modules/corrections";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    message: z.string().min(1).max(2000),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request);
    assertRateLimit(correctionRateLimiter, `corr-comment:${actor.userId}`);

    const { id } = await context.params;
    const body = await parseJsonBody(request, bodySchema);
    const posted = await addCorrectionComment({
      actor,
      correctionRequestId: id,
      message: body.message,
      correlationId,
    });
    return jsonResponse(posted, 201, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
