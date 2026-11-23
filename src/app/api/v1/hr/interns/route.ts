import { z } from "zod";

import { requireApiHr } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { adminRateLimiter, assertRateLimit } from "@/lib/http/rate-limit";
import type { InternAccountTab } from "@/lib/ui/view-models";
import { listInterns, provisionIntern } from "@/modules/accounts";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    name: z.string().min(2).max(120),
    email: z.string().email().max(254),
    departmentId: z.string().uuid().optional(),
    department: z.string().min(2).max(80).optional(),
    officeId: z.string().uuid().optional(),
    requiredMinutes: z.number().int().positive().max(200_000),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })
  .strict()
  .refine((v) => Boolean(v.departmentId || v.department), {
    message: "Either departmentId or department name is required",
  });

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    await requireApiHr(request);
    const params = new URL(request.url).searchParams;
    const data = await listInterns({
      tab: (params.get("tab") as InternAccountTab | null) ?? undefined,
      query: params.get("q") ?? undefined,
      department: params.get("department") ?? undefined,
      page: params.get("page") ? Number(params.get("page")) : undefined,
    });
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
    assertRateLimit(adminRateLimiter, `provision:${actor.userId}`);

    const body = await parseJsonBody(request, createSchema);
    const created = await provisionIntern({
      actorId: actor.userId,
      clientRequestId: body.clientRequestId,
      name: body.name,
      email: body.email,
      departmentId: body.departmentId,
      department: body.department,
      officeId: body.officeId,
      requiredMinutes: body.requiredMinutes,
      startDate: body.startDate,
      endDate: body.endDate,
      correlationId,
    });
    return jsonResponse(created, 201, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
