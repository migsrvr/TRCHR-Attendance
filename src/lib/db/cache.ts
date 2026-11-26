/**
 * Tier 1 Cross-Request Metadata Cache (Office config, active policy, departments).
 *
 * Uses Next.js `unstable_cache` with short TTL (60s) and explicit tag
 * revalidation on HR mutations so navigation across HR pages does not repeat
 * identical `office` and `department` round-trips to remote Neon PostgreSQL.
 *
 * Automatically bypasses Next.js incremental cache inside Vitest (`NODE_ENV=test`)
 * where Next's request/cache context is not active.
 */

import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";

import { prisma } from "@/lib/db";

export const OFFICE_CACHE_TAG = "trchr-office-metadata";
export const DEPARTMENTS_CACHE_TAG = "trchr-departments";

export interface CachedOfficeMetadata {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly geofenceRadiusMeters: number;
  readonly maxAccuracyMeters: number;
  readonly latestPolicyVersion: number | null;
  readonly latestPolicySchedule: { readonly start: string; readonly end: string };
}

export interface CachedDepartment {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

async function fetchOfficeMetadata(): Promise<CachedOfficeMetadata | null> {
  const office = await prisma.office.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      timezone: true,
      geofenceRadiusMeters: true,
      maxAccuracyMeters: true,
      policyVersions: {
        where: { status: "PUBLISHED" },
        orderBy: { version: "desc" },
        take: 1,
        select: {
          version: true,
          scheduleRules: true,
        },
      },
    },
  });

  if (!office) return null;
  const latest = office.policyVersions[0];
  const schedule = (latest?.scheduleRules as { workStart?: string; workEnd?: string } | null) ?? null;

  return {
    id: office.id,
    name: office.name,
    timezone: office.timezone,
    geofenceRadiusMeters: office.geofenceRadiusMeters,
    maxAccuracyMeters: office.maxAccuracyMeters,
    latestPolicyVersion: latest?.version ?? null,
    latestPolicySchedule: {
      start: typeof schedule?.workStart === "string" ? schedule.workStart : "08:00",
      end: typeof schedule?.workEnd === "string" ? schedule.workEnd : "19:00",
    },
  };
}

async function fetchDepartments(): Promise<readonly CachedDepartment[]> {
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true },
  });
}

const cachedOfficeAcrossRequests = unstable_cache(fetchOfficeMetadata, [OFFICE_CACHE_TAG], {
  revalidate: 60,
  tags: [OFFICE_CACHE_TAG],
});

const cachedDepartmentsAcrossRequests = unstable_cache(fetchDepartments, [DEPARTMENTS_CACHE_TAG], {
  revalidate: 60,
  tags: [DEPARTMENTS_CACHE_TAG],
});

/** Per-request + cross-request cached office metadata. */
export const getCachedOfficeMetadata = cache(async (): Promise<CachedOfficeMetadata | null> => {
  if (process.env.NODE_ENV === "test") {
    return fetchOfficeMetadata();
  }
  try {
    return await cachedOfficeAcrossRequests();
  } catch {
    return fetchOfficeMetadata();
  }
});

/** Per-request + cross-request cached departments list. */
export const getCachedDepartments = cache(async (): Promise<readonly CachedDepartment[]> => {
  if (process.env.NODE_ENV === "test") {
    return fetchDepartments();
  }
  try {
    return await cachedDepartmentsAcrossRequests();
  } catch {
    return fetchDepartments();
  }
});

export function invalidateOfficeCache(): void {
  if (process.env.NODE_ENV === "test") return;
  try {
    revalidateTag(OFFICE_CACHE_TAG);
  } catch {
    // Safe no-op outside Next.js request/action context (e.g. CLI scripts)
  }
}

export function invalidateDepartmentsCache(): void {
  if (process.env.NODE_ENV === "test") return;
  try {
    revalidateTag(DEPARTMENTS_CACHE_TAG);
  } catch {
    // Safe no-op outside Next.js request/action context
  }
}
