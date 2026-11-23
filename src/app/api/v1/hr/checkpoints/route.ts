import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { createCheckpoint } from "@/modules/offices";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    officeId: z.string().min(1).max(64).optional(),
    name: z.string().trim().min(2).max(80),
    action: z.enum(["TIME_IN", "TIME_OUT"]),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiHr(request);
    assertRateLimit(adminRateLimiter, `checkpoint-create:${actor.userId}`);

    const body = await parseJsonBody(request, bodySchema);
    const created = await createCheckpoint({
      actorId: actor.userId,
      officeId: body.officeId === "default" ? undefined : body.officeId,
      name: body.name,
      action: body.action,
      expiresInDays: body.expiresInDays,
      correlationId,
    });
    return jsonResponse(created, 201, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
