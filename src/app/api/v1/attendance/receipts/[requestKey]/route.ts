import { requireApiIntern } from "@/lib/auth/session";
import { AppError, errorResponse, jsonResponse } from "@/lib/http/errors";
import { getCorrelationId } from "@/lib/http/guard";
import { getScanReceipt } from "@/modules/attendance";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ requestKey: string }> },
) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = await requireApiIntern(request);
    const { requestKey } = await context.params;
    const receipt = await getScanReceipt(actor.userId, requestKey);
    if (!receipt) {
      throw new AppError(404, "RECEIPT_NOT_FOUND", "No committed receipt exists for that key.", true);
    }
    return jsonResponse(receipt, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
