import { randomUUID } from "node:crypto";

import { z } from "zod";

import { requireApiIntern } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { assertSameOrigin, getCorrelationId, parseJsonBody } from "@/lib/http/guard";
import { assertRateLimit, scanRateLimiter } from "@/lib/http/rate-limit";
import { submitScan } from "@/modules/attendance";

export const dynamic = "force-dynamic";

const MAX_SCAN_BODY_BYTES = 160 * 1024;
const DEVICE_COOKIE_NAME = "trchr_did";

const photoFrameSchema = z
  .object({
    dataUrl: z.string().min(32).max(96_000),
    sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
    capturedAtUtc: z.string().datetime(),
    facingMode: z.enum(["environment", "user"]),
    width: z.number().int().positive().max(1920),
    height: z.number().int().positive().max(1920),
    frameVariance: z.number().finite().nonnegative(),
  })
  .strict();

const bodySchema = z
  .object({
    intentId: z.string().uuid(),
    requestKey: z.string().uuid(),
    location: z
      .object({
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
        accuracyMeters: z.number().finite().nonnegative(),
        capturedAtUtc: z.string().datetime(),
      })
      .strict(),
    photoEvidence: z
      .object({
        wallPoster: photoFrameSchema.optional(),
        selfie: photoFrameSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

function readDeviceCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === DEVICE_COOKIE_NAME && v && /^[a-zA-Z0-9_-]{12,64}$/.test(v)) {
      return v;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    assertSameOrigin(request);
    const actor = await requireApiIntern(request);
    assertRateLimit(scanRateLimiter, `scan-submit:${actor.userId}`);

    const existingDeviceId = readDeviceCookie(request.headers.get("cookie"));
    const deviceId = existingDeviceId ?? randomUUID();
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

    const body = await parseJsonBody(request, bodySchema, MAX_SCAN_BODY_BYTES);
    const outcome = await submitScan({
      actorId: actor.userId,
      intentId: body.intentId,
      requestKey: body.requestKey,
      location: {
        latitude: body.location.latitude,
        longitude: body.location.longitude,
        accuracyMeters: body.location.accuracyMeters,
        capturedAtUtc: new Date(body.location.capturedAtUtc),
      },
      photoEvidence: body.photoEvidence,
      deviceId,
      clientIp,
      correlationId,
    });

    const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return jsonResponse(outcome.body, outcome.httpStatus, {
      "X-Correlation-Id": correlationId,
      ...(outcome.replayed ? { "X-Receipt-Replayed": "true" } : {}),
      ...(!existingDeviceId
        ? {
            "Set-Cookie": `${DEVICE_COOKIE_NAME}=${deviceId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secureFlag}`,
          }
        : {}),
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
