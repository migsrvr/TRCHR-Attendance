import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { updateOfficeSettings } from "@/modules/offices";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    expectedConfigVersion: z.number().int().positive().optional(),
    radiusM: z.number().int().min(10).max(500),
    maxAccuracyM: z.number().int().min(5).max(100),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    timezone: z.string().min(3).max(80).optional(),
    name: z.string().min(2).max(120).optional(),
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
    assertRateLimit(adminRateLimiter, `office-update:${actor.userId}`);

    const { id } = await context.params;
    const body = await parseJsonBody(request, bodySchema);
    const result = await updateOfficeSettings({
      actorId: actor.userId,
      officeId: id === "default" ? undefined : id,
      expectedConfigVersion: body.expectedConfigVersion,
      radiusM: body.radiusM,
      maxAccuracyM: body.maxAccuracyM,
      latitude: body.latitude,
      longitude: body.longitude,
      timezone: body.timezone,
      name: body.name,
      correlationId,
    });
    return jsonResponse(result, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
