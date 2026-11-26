import { NextResponse } from "next/server";

import { requireApiHr } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/http/errors";
import { getCorrelationId } from "@/lib/http/guard";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodeDataUrl(dataUrl: string): { readonly buffer: Buffer; readonly contentType: string } | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const contentType = match[1] === "image/jpg" ? "image/jpeg" : match[1]!;
  return {
    contentType,
    buffer: Buffer.from(match[2]!, "base64"),
  };
}

/**
 * Lazy, HR-only binary photo endpoint for AttendanceScan verification frames.
 *
 * Keeps Server Component HTML payloads lightweight by serving compressed
 * selfie and wall-QR JPEG frames on demand with private immutable browser caching.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const correlationId = getCorrelationId(request);
  try {
    await requireApiHr(request);
    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      throw new AppError(400, "INVALID_SCAN_ID", "Invalid scan identifier.", false);
    }

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") === "wall" ? "wall" : "selfie";

    const scan = await prisma.attendanceScan.findUnique({
      where: { id },
      select: { locationEvidence: true },
    });
    if (!scan) {
      throw new AppError(404, "SCAN_NOT_FOUND", "Scan not found.", false);
    }

    const ev = scan.locationEvidence as {
      selfieDataUrl?: string;
      wallPosterDataUrl?: string;
    } | null;

    const rawDataUrl = kind === "wall" ? ev?.wallPosterDataUrl : ev?.selfieDataUrl;
    if (!rawDataUrl) {
      throw new AppError(404, "PHOTO_NOT_FOUND", "Requested scan photo is not available.", false);
    }

    const decoded = decodeDataUrl(rawDataUrl);
    if (!decoded) {
      throw new AppError(422, "PHOTO_CORRUPT", "Stored scan photo is malformed.", false);
    }

    return new NextResponse(new Uint8Array(decoded.buffer), {
      status: 200,
      headers: {
        "Content-Type": decoded.contentType,
        "Content-Length": String(decoded.buffer.byteLength),
        "Cache-Control": "private, max-age=3600, immutable",
        "X-Content-Type-Options": "nosniff",
        "X-Correlation-Id": correlationId,
      },
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
