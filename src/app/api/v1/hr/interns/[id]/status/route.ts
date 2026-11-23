import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { setUserDisabled } from "@/modules/accounts";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    status: z.enum(["ACTIVE", "DISABLED"]),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiHr(request);
    assertRateLimit(adminRateLimiter, `status:${actor.userId}`);

    const { id } = await context.params;
    const body = await parseJsonBody(request, bodySchema);
    const result = await setUserDisabled({
      actorId: actor.userId,
      targetUserId: id,
      disabled: body.status === "DISABLED",
      correlationId,
    });
    return jsonResponse(result, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
