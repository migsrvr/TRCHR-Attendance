import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { AppError, errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import { getInternProfile, updateIntern } from "@/modules/accounts";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    expectedAttendanceVersion: z.number().int().positive().optional(),
    departmentId: z.string().uuid().optional(),
    requiredMinutes: z.number().int().positive().max(200_000).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  })
  .strict();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    await requireApiHr(request);
    const { id } = await context.params;
    const profile = await getInternProfile(id);
    if (!profile) {
      throw new AppError(404, "INTERN_NOT_FOUND", "Intern not found.", false);
    }
    return jsonResponse(profile, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiHr(request);
    assertRateLimit(adminRateLimiter, `update-intern:${actor.userId}`);

    const { id } = await context.params;
    const body = await parseJsonBody(request, patchSchema);
    const updated = await updateIntern({
      actorId: actor.userId,
      targetUserId: id,
      expectedAttendanceVersion: body.expectedAttendanceVersion,
      departmentId: body.departmentId,
      requiredMinutes: body.requiredMinutes,
      endDate: body.endDate,
      status: body.status,
      correlationId,
    });
    return jsonResponse(updated, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
