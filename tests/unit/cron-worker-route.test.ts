import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/v1/cron/worker/route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe("GET /api/v1/cron/worker", () => {
  it("returns 503 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(new Request("http://localhost:3000/api/v1/cron/worker"));
    expect(res.status).toBe(503);
  });

  it("returns 401 when authorization header is missing or invalid", async () => {
    process.env.CRON_SECRET = "test-cron-secret-at-least-32-chars-long";
    const missing = await GET(new Request("http://localhost:3000/api/v1/cron/worker"));
    expect(missing.status).toBe(401);

    const wrong = await GET(
      new Request("http://localhost:3000/api/v1/cron/worker", {
        headers: { Authorization: "Bearer wrong-secret" },
      }),
    );
    expect(wrong.status).toBe(401);
  });
});
