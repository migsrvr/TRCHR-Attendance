/**
 * Structured HTTP error envelope and private no-store JSON responses
 * (Technical Design v1.0 sections 10 and 11).
 */

import { NextResponse } from "next/server";

import { logError } from "@/lib/http/logger";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface ErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
    readonly correlationId: string;
    readonly details?: Record<string, unknown>;
  };
}

export function jsonResponse<T>(
  data: T,
  status = 200,
  extraHeaders: Record<string, string> = {},
): NextResponse<T> {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...extraHeaders,
    },
  });
}

export function errorResponse(error: unknown, correlationId: string): NextResponse<ErrorEnvelope> {
  if (error instanceof AppError) {
    const body: ErrorEnvelope = {
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        correlationId,
        ...(error.details ? { details: error.details } : {}),
      },
    };
    return NextResponse.json(body, {
      status: error.status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Correlation-Id": correlationId,
      },
    });
  }

  logError("http.unhandled_error", {
    correlationId,
    error: error instanceof Error ? error.message : String(error),
  });

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected server error occurred.",
        retryable: true,
        correlationId,
      },
    },
    {
      status: 500,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Correlation-Id": correlationId,
      },
    },
  );
}
