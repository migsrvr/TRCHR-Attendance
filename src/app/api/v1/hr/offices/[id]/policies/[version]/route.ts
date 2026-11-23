import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { AppError, errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { savePolicyDraft } from "@/modules/offices";

export const dynamic = "force-dynamic";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

const bodySchema = z
  .object({
    fromIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    rules: z
      .object({
        workdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        start: hhmm,
        end: hhmm,
        breakMinutes: z.number().int().min(0).max(120),
        breakWindow: z.object({ start: hhmm, end: hhmm }).strict(),
        gapCountsTowardBreak: z.boolean(),
        capMinutes: z.number().int().positive().max(1440),
        rounding: z.enum(["none", "down5", "down15", "nearest15"]),
      })
      .strict(),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; version: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiHr(request);
    assertRateLimit(adminRateLimiter, `policy-save:${actor.userId}`);

    const { id, version: versionStr } = await context.params;
    const version = Number(versionStr);
    if (!Number.isInteger(version) || version <= 0) {
      throw new AppError(400, "INVALID_VERSION", "Policy version must be a positive integer.", false);
    }

    const body = await parseJsonBody(request, bodySchema);
    const result = await savePolicyDraft({
      actorId: actor.userId,
      officeId: id === "default" ? undefined : id,
      version,
      fromIso: body.fromIso,
      rules: body.rules,
      correlationId,
    });
    return jsonResponse(result, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
