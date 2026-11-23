import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { setHrUserStatus } from "@/modules/accounts";

export const dynamic = "force-dynamic";

const statusSchema = z
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
    assertRateLimit(adminRateLimiter, `hr-user-status:${actor.userId}`);

    const { id } = await context.params;
    const body = await parseJsonBody(request, statusSchema);
    const result = await setHrUserStatus({
      actorId: actor.userId,
      targetUserId: id,
      status: body.status,
      correlationId,
    });
    return jsonResponse(result, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
