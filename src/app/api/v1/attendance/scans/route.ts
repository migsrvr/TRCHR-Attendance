import { z } from "zod";

import { requireApiIntern } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { assertRateLimit, scanRateLimiter } from "@/lib/http/rate-limit";
import { submitScan } from "@/modules/attendance";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    intentId: z.string().uuid(),
    requestKey: z.string().uuid(),
    location: z
      .object({
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
        accuracyMeters: z.number().finite().nonnegative(),
        capturedAtUtc: z.string().datetime(),
      })
      .strict(),
  })
  .strict();

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiIntern(request);
    assertRateLimit(scanRateLimiter, `scan-submit:${actor.userId}`);

    const body = await parseJsonBody(request, bodySchema);
    const outcome = await submitScan({
      actorId: actor.userId,
      intentId: body.intentId,
      requestKey: body.requestKey,
      location: {
        latitude: body.location.latitude,
        longitude: body.location.longitude,
        accuracyMeters: body.location.accuracyMeters,
        capturedAtUtc: new Date(body.location.capturedAtUtc),
      },
      correlationId,
    });

    return jsonResponse(outcome.body, outcome.httpStatus, {
      "X-Correlation-Id": correlationId,
      ...(outcome.replayed ? { "X-Receipt-Replayed": "true" } : {}),
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
