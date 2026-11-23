import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { inviteHrUser, listHrUsers } from "@/modules/accounts";

export const dynamic = "force-dynamic";

const inviteSchema = z
  .object({
    clientRequestId: z.string().min(4).max(128).optional(),
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(200),
  })
  .strict();

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = await requireApiHr(request);
    const data = await listHrUsers(actor.userId);
    return jsonResponse(data, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiHr(request);
    assertRateLimit(adminRateLimiter, `hr-user-invite:${actor.userId}`);

    const body = await parseJsonBody(request, inviteSchema);
    const created = await inviteHrUser({
      actorId: actor.userId,
      name: body.name,
      email: body.email,
      correlationId,
    });
    return jsonResponse(created, 201, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
