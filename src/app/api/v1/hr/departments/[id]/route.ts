import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { renameDepartment } from "@/modules/accounts";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    name: z.string().min(2).max(60),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiHr(request);
    assertRateLimit(adminRateLimiter, `dept-rename:${actor.userId}`);

    const { id } = await context.params;
    const body = await parseJsonBody(request, bodySchema);
    const updated = await renameDepartment({
      actorId: actor.userId,
      id,
      name: body.name,
      correlationId,
    });
    return jsonResponse(updated, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
