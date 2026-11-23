import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { assertRateLimit, authRateLimiter } from "@/lib/http/rate-limit";
import { redeemSetupToken } from "@/modules/accounts";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    token: z.string().min(8).max(512),
    newPassword: z.string().min(10).max(128),
  })
  .strict();

export async function POST(request: Request): Promise<NextResponse> {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    assertRateLimit(authRateLimiter, `setup-password:${ip}`);

    const body = await parseJsonBody(request, bodySchema);
    const redeemed = await redeemSetupToken({
      token: body.token,
      newPassword: body.newPassword,
      correlationId,
    });

    // Establish an authenticated Better Auth session immediately so first-run redirects work
    const signInResponse = await auth.api.signInEmail({
      body: {
        email: redeemed.email,
        password: body.newPassword,
        rememberMe: redeemed.role === "INTERN",
      },
      headers: request.headers,
      asResponse: true,
    });

    const response = jsonResponse(
      { ok: true, role: redeemed.role, redirectTo: redeemed.role === "HR" ? "/hr" : "/welcome/camera" },
      200,
      { "X-Correlation-Id": correlationId },
    );

    const setCookies =
      typeof signInResponse.headers.getSetCookie === "function"
        ? signInResponse.headers.getSetCookie()
        : [signInResponse.headers.get("set-cookie")].filter((c): c is string => Boolean(c));
    for (const cookie of setCookies) {
      response.headers.append("set-cookie", cookie);
    }

    return response;
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
