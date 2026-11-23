import { z } from "zod";

import { requireApiIntern } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { assertRateLimit, correctionRateLimiter } from "@/lib/http/rate-limit";
import { createCorrection, listMyCorrections } from "@/modules/corrections";

export const dynamic = "force-dynamic";

const hhmmSchema = z.string().regex(/^\d{2}:\d{2}$/);

const createSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.enum(["missed_clock_out", "missed_clock_in", "technical_issue", "wrong_action", "other"]),
    explanation: z.string().min(15).max(2000),
    proposedTimeIn: hhmmSchema.optional(),
    proposedTimeOut: hhmmSchema.optional(),
    sessionId: z.string().uuid().optional(),
    replaceRequestId: z.string().uuid().optional(),
  })
  .strict();

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = await requireApiIntern(request);
    const data = await listMyCorrections(actor);
    return jsonResponse(data, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiIntern(request);
    assertRateLimit(correctionRateLimiter, `corr-create:${actor.userId}`);

    const body = await parseJsonBody(request, createSchema);
    const created = await createCorrection({
      actorId: actor.userId,
      internshipId: actor.internship.id,
      sessionId: body.sessionId,
      replaceRequestId: body.replaceRequestId,
      attendanceDate: body.attendanceDate,
      reason: body.reason,
      explanation: body.explanation,
      proposedTimeIn: body.proposedTimeIn,
      proposedTimeOut: body.proposedTimeOut,
      clientRequestId: body.clientRequestId,
      correlationId,
    });
    return jsonResponse(created, 201, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
