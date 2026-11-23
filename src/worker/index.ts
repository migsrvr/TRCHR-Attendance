/**
 * Review worker entry point (Technical Design v1.0 section 9).
 *
 * Claims ready review_job rows with PostgreSQL FOR UPDATE SKIP LOCKED,
 * evaluates minimized correction context via TypeSafe Jev (or dev stub),
 * and writes back lease-fenced & version-fenced advisory assessments.
 * It has zero attendance/revision write access.
 *
 * Run with: npm run worker
 */

import { pathToFileURL } from "node:url";

import { prisma } from "@/lib/db";
import { logError, logInfo } from "@/lib/http/logger";
import { runWorkerOnce } from "@/worker/queue";

const POLL_INTERVAL_MS = 2_000;

export interface WorkerHandle {
  stop(): Promise<void>;
}

export async function runWorker(): Promise<boolean> {
  return runWorkerOnce();
}

export function startWorker(pollIntervalMs = POLL_INTERVAL_MS): WorkerHandle {
  let stopped = false;
  let activePromise: Promise<void> | null = null;

  const loop = async (): Promise<void> => {
    logInfo("worker.started", { pollIntervalMs });
    while (!stopped) {
      try {
        const didWork = await runWorkerOnce();
        if (didWork && !stopped) {
          continue;
        }
      } catch (error) {
        logError("worker.poll_error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (!stopped) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
    logInfo("worker.stopped", {});
  };

  activePromise = loop();

  return {
    async stop(): Promise<void> {
      stopped = true;
      if (activePromise) await activePromise;
    },
  };
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const handle = startWorker();

  const shutdown = async (signal: string) => {
    logInfo("worker.shutdown_signal", { signal });
    await handle.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
