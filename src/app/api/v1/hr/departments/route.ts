import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { createDepartment, listDepartments } from "@/modules/accounts";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    name: z.string().min(2).max(60),
  })
  .strict();

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    await requireApiHr(request);
    const rows = await listDepartments();
    return jsonResponse({ departments: rows }, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiHr(request);
    assertRateLimit(adminRateLimiter, `dept-add:${actor.userId}`);

    const body = await parseJsonBody(request, bodySchema);
    const created = await createDepartment({
      actorId: actor.userId,
      name: body.name,
      correlationId,
    });
    return jsonResponse(created, 201, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
