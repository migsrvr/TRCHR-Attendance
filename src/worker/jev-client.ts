/**
 * TypeSafe Jev client adapter (Technical Design v1.0 section 9).
 *
 * Calls POST https://api.typesafe.ai/v1/systemone with pinned model jev-1.13.0,
 * 5-second timeout, and strict Zod validation of Choice + Noul outputs.
 * Automatically uses a deterministic local stub when TYPESAFE_JEV_API_KEY is
 * unset or JEV_MODE=stub so queue/fencing/UI flows run end-to-end with zero cost.
 */

import { z } from "zod";

import { JEV_MODEL_VERSION, type MinimizedJevContext } from "@/worker/context";

export const JEV_CATEGORIES = [
  "missed_clock_in",
  "missed_clock_out",
  "wrong_action",
  "technical_issue",
  "other",
] as const;

export type JevCategory = (typeof JEV_CATEGORIES)[number];

export interface JevTypedResult {
  readonly category: JevCategory;
  readonly categoryScore: number;
  readonly detailsScore: number;
}

export class JevClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly retryAfterHeader?: string | null,
  ) {
    super(message);
    this.name = "JevClientError";
  }
}

const typedResultSchema = z.object({
  category: z.enum(JEV_CATEGORIES),
  categoryScore: z.number().finite().min(0).max(1),
  detailsScore: z.number().finite().min(0).max(1),
});

export function parseJevTypedResult(raw: unknown): JevTypedResult {
  return typedResultSchema.parse(raw);
}

export function computeRetryDelayMs(attempt: number, retryAfterHeader?: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader.trim());
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(120_000, Math.max(1_000, Math.round(seconds * 1_000)));
    }
  }
  const base = Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(1_000, base * 0.25));
  return Math.min(30_000, base + jitter);
}

const CATEGORY_FROM_ENUM: Record<string, JevCategory> = {
  MISSED_CLOCK_IN: "missed_clock_in",
  MISSED_CLOCK_OUT: "missed_clock_out",
  WRONG_ACTION: "wrong_action",
  TECHNICAL_ISSUE: "technical_issue",
  OTHER: "other",
};

/** Deterministic advisory stub used when no TYPESAFE_JEV_API_KEY is set or JEV_MODE=stub. */
export function evaluateWithStubJev(context: MinimizedJevContext): JevTypedResult {
  const { explanation, comments, reasonCategory, facts } = context.inputSnapshot;
  const fullText = [explanation, ...comments.map((c) => c.message)].join(" ").toLowerCase();

  let category: JevCategory = CATEGORY_FROM_ENUM[reasonCategory] ?? "other";
  let categoryScore = 0.86;

  if (facts.hasRecordedTimeIn && !facts.hasRecordedTimeOut && facts.proposesTimeOut) {
    category = "missed_clock_out";
    categoryScore = 0.92;
  } else if (/gps|location|qr|camera|error|signal|wifi|network/.test(fullText)) {
    category = "technical_issue";
    categoryScore = 0.88;
  } else if (/wrong code|wrong qr|scanned in instead|scanned out instead/.test(fullText)) {
    category = "wrong_action";
    categoryScore = 0.89;
  }

  let details = 0.35;
  if (fullText.length >= 40) details += 0.2;
  if (fullText.length >= 85) details += 0.15;
  if (/confirm|supervisor|lead|manager|meeting|client|guard|office|desk/.test(fullText)) details += 0.18;
  if (comments.some((c) => c.role === "INTERN")) details += 0.08;

  return parseJevTypedResult({
    category,
    categoryScore: Number(Math.min(0.98, categoryScore).toFixed(2)),
    detailsScore: Number(Math.min(0.97, details).toFixed(2)),
  });
}

function extractSystemOneResults(json: unknown): JevTypedResult {
  if (typeof json !== "object" || json === null) {
    throw new JevClientError("JEV_INVALID_SCHEMA", "Non-object response from TypeSafe Jev", false);
  }
  const obj = json as Record<string, unknown>;

  // Support both direct { category, categoryScore, detailsScore } and typed outputs map/array
  if ("category" in obj && "categoryScore" in obj && "detailsScore" in obj) {
    return parseJevTypedResult(obj);
  }

  const outputs = (obj.outputs ?? obj.results ?? obj.decisions) as Record<string, unknown> | undefined;
  if (outputs && typeof outputs === "object") {
    const catOut = outputs.explanation_category as
      | { choice?: unknown; value?: unknown; confidence?: unknown; probability?: unknown }
      | undefined;
    const detOut = outputs.required_explanation_present as { value?: unknown; score?: unknown } | number | undefined;

    const category = catOut?.choice ?? catOut?.value;
    const categoryScore = catOut?.confidence ?? catOut?.probability ?? 0.5;
    const detailsScore = typeof detOut === "number" ? detOut : (detOut?.value ?? detOut?.score);

    return parseJevTypedResult({
      category,
      categoryScore: Number(categoryScore),
      detailsScore: Number(detailsScore),
    });
  }

  throw new JevClientError("JEV_INVALID_SCHEMA", "Unexpected TypeSafe Jev response structure", false);
}

export async function callTypeSafeJev(
  context: MinimizedJevContext,
  options: {
    readonly apiKey?: string;
    readonly mode?: string;
    readonly modelVersion?: string;
    readonly fetchImpl?: typeof fetch;
  } = {},
): Promise<{ readonly result: JevTypedResult; readonly modelVersion: string; readonly stubbed: boolean }> {
  const apiKey = (options.apiKey ?? process.env.TYPESAFE_JEV_API_KEY ?? "").trim();
  const mode = (options.mode ?? process.env.JEV_MODE ?? "auto").trim().toLowerCase();
  const modelVersion = options.modelVersion ?? JEV_MODEL_VERSION;

  if (mode === "stub" || (mode !== "live" && !apiKey)) {
    return {
      result: evaluateWithStubJev(context),
      modelVersion: `${modelVersion}-stub`,
      stubbed: true,
    };
  }

  if (!apiKey) {
    throw new JevClientError("JEV_KEY_MISSING", "TYPESAFE_JEV_API_KEY is not configured", false);
  }

  const fetcher = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetcher("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelVersion,
        input: context.inputSnapshot,
        criteria: {
          explanation_category: {
            type: "choice",
            options: [...JEV_CATEGORIES],
            prompt: "Classify the primary category of this intern attendance correction request.",
          },
          required_explanation_present: {
            type: "noul",
            prompt: "Score from 0 to 1 whether the explanation states what happened and who or what can corroborate it.",
          },
        },
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new JevClientError(
      isTimeout ? "JEV_TIMEOUT" : "JEV_NETWORK_ERROR",
      isTimeout ? "TypeSafe Jev request timed out after 5s" : "Failed to reach TypeSafe Jev",
      true,
    );
  }

  if (response.status === 429) {
    throw new JevClientError("JEV_RATE_LIMITED", "TypeSafe Jev rate limit exceeded", true, response.headers.get("retry-after"));
  }
  if (response.status >= 500) {
    throw new JevClientError(`JEV_HTTP_${response.status}`, "TypeSafe Jev upstream error", true);
  }
  if (!response.ok) {
    throw new JevClientError(`JEV_HTTP_${response.status}`, "TypeSafe Jev rejected the request", false);
  }

  const json: unknown = await response.json().catch(() => null);
  try {
    return {
      result: extractSystemOneResults(json),
      modelVersion,
      stubbed: false,
    };
  } catch (error) {
    if (error instanceof JevClientError) throw error;
    throw new JevClientError("JEV_INVALID_SCHEMA", "TypeSafe Jev returned invalid typed results", false);
  }
}
