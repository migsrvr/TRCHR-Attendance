import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError, errorResponse } from "@/lib/http/errors";
import { assertSameOrigin, canonicalPayloadHash, parseJsonBody } from "@/lib/http/guard";
import { redactSensitive } from "@/lib/http/logger";
import { assertRateLimit, createRateLimiter } from "@/lib/http/rate-limit";

describe("HTTP guards, errors, rate limiting, and canonical hashing", () => {
  it("produces stable canonical hashes regardless of object key order", () => {
    const a = canonicalPayloadHash({ z: 1, nested: { b: true, a: "x" }, arr: [3, { k: 1, j: 2 }] });
    const b = canonicalPayloadHash({ arr: [3, { j: 2, k: 1 }], nested: { a: "x", b: true }, z: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("allows same-origin POST requests and rejects cross-origin POST requests", () => {
    const okReq = new Request("https://app.toprealty.test/api/v1/scan-intents", {
      method: "POST",
      headers: { origin: "https://app.toprealty.test" },
    });
    expect(() => assertSameOrigin(okReq, "https://app.toprealty.test")).not.toThrow();

    const badReq = new Request("https://app.toprealty.test/api/v1/scan-intents", {
      method: "POST",
      headers: { origin: "https://evil.example.com" },
    });
    expect(() => assertSameOrigin(badReq, "https://app.toprealty.test")).toThrowError(AppError);
  });

  it("rejects unexpected fields and oversized payloads in parseJsonBody", async () => {
    const schema = z.object({ name: z.string() }).strict();

    const extraFieldReq = new Request("https://app.toprealty.test/api/v1/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ana", role: "HR" }),
    });
    await expect(parseJsonBody(extraFieldReq, schema)).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });

    const bigReq = new Request("https://app.toprealty.test/api/v1/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(500) }),
    });
    await expect(parseJsonBody(bigReq, schema, 100)).rejects.toMatchObject({ status: 413, code: "PAYLOAD_TOO_LARGE" });
  });

  it("enforces sliding-window rate limits", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    expect(() => assertRateLimit(limiter, "user-1")).not.toThrow();
    expect(() => assertRateLimit(limiter, "user-1")).not.toThrow();
    expect(() => assertRateLimit(limiter, "user-1")).toThrowError(AppError);
    expect(() => assertRateLimit(limiter, "user-2")).not.toThrow();
  });

  it("formats standard error envelope with private no-store cache headers", async () => {
    const res = errorResponse(new AppError(409, "REQUEST_CHANGED", "Stale version", false), "corr-123");
    expect(res.status).toBe(409);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-correlation-id")).toBe("corr-123");
    const json = await res.json();
    expect(json).toEqual({
      error: {
        code: "REQUEST_CHANGED",
        message: "Stale version",
        retryable: false,
        correlationId: "corr-123",
      },
    });
  });

  it("redacts sensitive fields recursively for safe logging", () => {
    const safe = redactSensitive({
      actorId: "u-1",
      password: "secret",
      qrToken: "eyJ...",
      location: { latitude: 14.55, longitude: 121.02, accuracyMeters: 12 },
      nested: { cookie: "sid=123", explanation: "private note" },
    }) as Record<string, unknown>;

    expect(safe.actorId).toBe("u-1");
    expect(safe.password).toBe("[REDACTED]");
    expect(safe.qrToken).toBe("[REDACTED]");
    expect((safe.location as Record<string, unknown>).latitude).toBe("[REDACTED]");
    expect((safe.location as Record<string, unknown>).longitude).toBe("[REDACTED]");
    expect((safe.location as Record<string, unknown>).accuracyMeters).toBe(12);
    expect((safe.nested as Record<string, unknown>).cookie).toBe("[REDACTED]");
    expect((safe.nested as Record<string, unknown>).explanation).toBe("[REDACTED]");
  });
});
