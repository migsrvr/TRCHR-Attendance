import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { createPolicyDraft, listPolicyVersions } from "@/modules/offices";

export const dynamic = "force-dynamic";

const createDraftSchema = z
  .object({
    fromVersion: z.number().int().positive().optional(),
  })
  .strict();

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    await requireApiHr(request);
    const versionParam = new URL(request.url).searchParams.get("version");
    const data = await listPolicyVersions(versionParam ? Number(versionParam) : undefined);
    return jsonResponse(data, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiHr(request);
    assertRateLimit(adminRateLimiter, `policy-create:${actor.userId}`);

    const { id } = await context.params;
    const body = await parseJsonBody(request, createDraftSchema);
    const created = await createPolicyDraft({
      actorId: actor.userId,
      officeId: id === "default" ? undefined : id,
      fromVersion: body.fromVersion,
      correlationId,
    });
    return jsonResponse(created, 201, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
