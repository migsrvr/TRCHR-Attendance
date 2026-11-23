import { requireApiHr } from "@/lib/auth/session";
import { AppError, errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { getPrimaryOffice, publishPolicyVersion } from "@/modules/offices";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; version: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiHr(request);
    assertRateLimit(adminRateLimiter, `policy-publish:${actor.userId}`);

    const { id, version: versionStr } = await context.params;
    const version = Number(versionStr);
    if (!Number.isInteger(version) || version <= 0) {
      throw new AppError(400, "INVALID_VERSION", "Policy version must be a positive integer.", false);
    }

    const officeId = id === "default" ? (await getPrimaryOffice()).id : id;
    const result = await publishPolicyVersion({
      actorId: actor.userId,
      officeId,
      version,
      correlationId,
    });
    return jsonResponse(result, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
