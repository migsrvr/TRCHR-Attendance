/**
 * Review worker entry point.
 *
 * SKELETON: claims ready review_job rows with FOR UPDATE SKIP LOCKED, calls the
 * Jev adapter outside the transaction, then completes by matching leaseToken,
 * inputFingerprint, requestVersion, model and criteria version. It has no
 * attendance/revision write access. See Technical Design v1.0 section 9.
 */

const POLL_INTERVAL_MS = 2_000;

export interface WorkerHandle {
  stop(): Promise<void>;
}

export async function runWorker(): Promise<void> {
  throw new Error("runWorker is not implemented yet");
}

export function startWorker(): WorkerHandle {
  let stopped = false;

  const loop = async (): Promise<void> => {
    while (!stopped) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  };

  void loop();

  return {
    async stop(): Promise<void> {
      stopped = true;
    },
  };
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isDirectRun) {
  void startWorker();
}
