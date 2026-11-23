import { z } from "zod";

import { requireApiIntern } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { assertRateLimit, scanRateLimiter } from "@/lib/http/rate-limit";
import { createScanIntent } from "@/modules/attendance";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    qrToken: z.string().min(1).max(4096),
  })
  .strict();

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiIntern(request);
    assertRateLimit(scanRateLimiter, `scan-intent:${actor.userId}`);

    const body = await parseJsonBody(request, bodySchema);
    const intent = await createScanIntent({
      actorId: actor.userId,
      qrToken: body.qrToken,
      correlationId,
    });
    return jsonResponse(intent, 201, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
