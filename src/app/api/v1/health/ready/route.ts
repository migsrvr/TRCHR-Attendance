import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Readiness check: verifies database connectivity and essential server configuration. */
export async function GET(): Promise<NextResponse> {
  const checks = {
    database: false,
    authSecret: Boolean(process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 16),
    qrKeys: Boolean(process.env.QR_SIGNING_KEYS_JSON || process.env.QR_SIGNING_KEY_SECRET),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  const ready = checks.database && checks.authSecret && checks.qrKeys;
  return NextResponse.json(
    {
      status: ready ? "ready" : "degraded",
      checks,
      time: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
