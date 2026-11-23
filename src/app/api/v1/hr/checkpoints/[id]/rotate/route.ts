import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { rotateCheckpointCredential } from "@/modules/offices";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    expiresInDays: z.number().int().min(1).max(365).optional(),
    expiresAtUtc: z.string().datetime().optional(),
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
    assertRateLimit(adminRateLimiter, `qr-rotate:${actor.userId}`);

    const { id } = await context.params;
    const body = await parseJsonBody(request, bodySchema);
    const result = await rotateCheckpointCredential({
      actorId: actor.userId,
      checkpointId: id,
      expiresInDays: body.expiresInDays,
      expiresAtUtc: body.expiresAtUtc ? new Date(body.expiresAtUtc) : undefined,
      correlationId,
    });
    return jsonResponse(result, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
