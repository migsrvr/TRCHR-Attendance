import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { logError, logInfo } from "@/lib/http/logger";
import { runWorkerOnce } from "@/worker/queue";
import { runRetentionCleanup } from "@/worker/retention";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_JOBS_PER_INVOCATION = 20;
const TIME_BUDGET_MS = 45_000;

function isAuthorizedCronRequest(request: Request, expectedSecret: string | undefined): boolean {
  if (!expectedSecret || expectedSecret.length < 16) return false;
  const authHeader = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) return false;

  const provided = authHeader.slice(prefix.length);
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expectedSecret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Serverless Cron entry point for Vercel (replaces the persistent `npm run worker` loop).
 *
 * Protected by `Authorization: Bearer <CRON_SECRET>` (automatically sent by Vercel Cron).
 * Drains ready `review_job` rows up to a bounded count/time budget and executes retention cleanup.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const expectedSecret = process.env.CRON_SECRET?.trim();
  if (!expectedSecret || expectedSecret.length < 16) {
    return NextResponse.json(
      { error: { code: "CRON_NOT_CONFIGURED", message: "CRON_SECRET is not configured." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!isAuthorizedCronRequest(request, expectedSecret)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron authorization." } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const startedAt = Date.now();
  let jobsProcessed = 0;

  try {
    while (jobsProcessed < MAX_JOBS_PER_INVOCATION && Date.now() - startedAt < TIME_BUDGET_MS) {
      const didWork = await runWorkerOnce();
      if (!didWork) break;
      jobsProcessed += 1;
    }

    const retention = await runRetentionCleanup();

    logInfo("cron.worker_completed", {
      jobsProcessed,
      durationMs: Date.now() - startedAt,
      retention,
    });

    return NextResponse.json(
      {
        ok: true,
        jobsProcessed,
        retention,
        durationMs: Date.now() - startedAt,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError("cron.worker_failed", {
      jobsProcessed,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: { code: "CRON_WORKER_FAILED", message: "Worker cron execution failed." } },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
