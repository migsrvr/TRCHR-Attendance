import { loadActiveInternActor, requireApiUser } from "@/lib/auth/session";
import { AppError, errorResponse, jsonResponse } from "@/lib/http/errors";
import { getCorrelationId } from "@/lib/http/guard";
import { getCorrectionDetailForIntern, getCorrectionForReview } from "@/modules/corrections";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = await requireApiUser(request);
    const { id } = await context.params;

    const detail =
      actor.role === "HR"
        ? await getCorrectionForReview(id)
        : await getCorrectionDetailForIntern(await loadActiveInternActor(actor), id);

    if (!detail) {
      throw new AppError(404, "CORRECTION_NOT_FOUND", "Correction request not found.", false);
    }
    return jsonResponse(detail, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
