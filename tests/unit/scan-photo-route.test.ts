import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireApiHr: vi.fn().mockResolvedValue({ userId: "hr-1", role: "HR", status: "ACTIVE" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    attendanceScan: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/v1/hr/scans/[id]/photo/route";
import { prisma } from "@/lib/db";

const VALID_ID = "11111111-1111-4111-8111-111111111111";

describe("GET /api/v1/hr/scans/[id]/photo", () => {
  it("rejects non-UUID scan ids with 400", async () => {
    const res = await GET(new Request("http://localhost:3000/api/v1/hr/scans/not-a-uuid/photo"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
  });

  it("streams decoded JPEG bytes with private immutable cache headers", async () => {
    vi.mocked(prisma.attendanceScan.findUnique).mockResolvedValueOnce({
      locationEvidence: {
        selfieDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        wallPosterDataUrl: "data:image/jpeg;base64,/9j/2wBDAA==",
      },
    } as never);

    const res = await GET(
      new Request(`http://localhost:3000/api/v1/hr/scans/${VALID_ID}/photo?kind=selfie`),
      { params: Promise.resolve({ id: VALID_ID }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("cache-control")).toContain("immutable");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("returns 404 when the requested photo frame is absent", async () => {
    vi.mocked(prisma.attendanceScan.findUnique).mockResolvedValueOnce({
      locationEvidence: {},
    } as never);

    const res = await GET(
      new Request(`http://localhost:3000/api/v1/hr/scans/${VALID_ID}/photo?kind=wall`),
      { params: Promise.resolve({ id: VALID_ID }) },
    );
    expect(res.status).toBe(404);
  });
});
