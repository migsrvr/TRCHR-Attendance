import { requireApiUser } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http/errors";
import { getCorrelationId } from "@/lib/http/guard";
import { getMe } from "@/modules/accounts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  try {
    const actor = await requireApiUser(request);
    const data = await getMe(actor);
    return jsonResponse(data, 200, { "X-Correlation-Id": correlationId });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
