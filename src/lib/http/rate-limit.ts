/**
 * Lightweight in-memory sliding-window rate limiter for single-node deployments
 * (Technical Design v1.0 section 13).
 */

import { AppError } from "@/lib/http/errors";

export interface RateLimiter {
  check(key: string): { allowed: boolean; remaining: number; retryAfterSeconds: number };
}

export function createRateLimiter(options: { readonly windowMs: number; readonly max: number }): RateLimiter {
  const { windowMs, max } = options;
  const buckets = new Map<string, number[]>();

  return {
    check(key: string) {
      const now = Date.now();
      const cutoff = now - windowMs;
      const existing = (buckets.get(key) ?? []).filter((ts) => ts > cutoff);

      if (existing.length >= max) {
        const oldest = existing[0] ?? now;
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        buckets.set(key, existing);
        return { allowed: false, remaining: 0, retryAfterSeconds };
      }

      existing.push(now);
      buckets.set(key, existing);

      // Periodic opportunistic pruning to keep memory bounded
      if (buckets.size > 5_000) {
        for (const [bucketKey, timestamps] of buckets) {
          const fresh = timestamps.filter((ts) => ts > cutoff);
          if (fresh.length === 0) buckets.delete(bucketKey);
          else buckets.set(bucketKey, fresh);
        }
      }

      return { allowed: true, remaining: Math.max(0, max - existing.length), retryAfterSeconds: 0 };
    },
  };
}

export function assertRateLimit(limiter: RateLimiter, key: string): void {
  const verdict = limiter.check(key);
  if (!verdict.allowed) {
    throw new AppError(429, "RATE_LIMITED", "Too many requests. Wait a moment and try again.", true, {
      retryAfterSeconds: verdict.retryAfterSeconds,
    });
  }
}

export const authRateLimiter = createRateLimiter({ windowMs: 60_000, max: 15 });
export const scanRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });
export const correctionRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
export const reviewRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
export const adminRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
