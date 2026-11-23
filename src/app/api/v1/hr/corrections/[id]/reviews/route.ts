import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { assertRateLimit, reviewRateLimiter } from "@/lib/http/rate-limit";
import { decideCorrection } from "@/modules/corrections";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    operationKey: z.string().uuid(),
    decision: z.enum(["APPROVE", "REJECT", "NEEDS_INFO"]),
    note: z.string().min(5).max(2000),
    expectedRequestVersion: z.number().int().positive(),
    expectedSessionVersion: z.number().int().positive().nullable().optional(),
    expectedAttendanceVersion: z.number().int().positive().optional(),
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
    assertRateLimit(reviewRateLimiter, `hr-review:${actor.userId}`);

    const { id } = await context.params;
    const body = await parseJsonBody(request, bodySchema);
    const decided = await decideCorrection({
      correctionRequestId: id,
      reviewerUserId: actor.userId,
      operationKey: body.operationKey,
      decision: body.decision,
      note: body.note,
      expectedRequestVersion: body.expectedRequestVersion,
      expectedSessionVersion: body.expectedSessionVersion,
      expectedAttendanceVersion: body.expectedAttendanceVersion,
      correlationId,
    });

    return jsonResponse(decided, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
