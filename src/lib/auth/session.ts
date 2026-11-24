/**
 * Server-side authentication & authorization guards (Technical Design v1.0 section 2).
 *
 * Never trusts cookie presence alone: resolves the Better Auth database session
 * and reloads live User.role, User.status, and active Internship from PostgreSQL.
 */

import type { InternshipStatus, UserRole, UserStatus } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/http/errors";

export interface AuthenticatedActor {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly sessionId: string;
}

export interface ActiveInternActor extends AuthenticatedActor {
  readonly role: "INTERN";
  readonly internship: {
    readonly id: string;
    readonly departmentId: string;
    readonly departmentName: string;
    readonly officeId: string;
    readonly officeName: string;
    readonly timeZone: string;
    readonly requiredMinutes: number;
    readonly startDate: Date;
    readonly endDate: Date | null;
    readonly status: InternshipStatus;
    readonly attendanceVersion: number;
  };
}

export function isMockModeEnabled(): boolean {
  if (process.env.USE_MOCK_APIS === "1") return true;
  if (process.env.NODE_ENV === "test") return true;
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL?.trim()) return true;
  return false;
}

export function getMockModeReason(): "explicit" | "no-database" | null {
  if (process.env.NODE_ENV === "test") return null;
  if (process.env.USE_MOCK_APIS === "1") return "explicit";
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL?.trim()) return "no-database";
  return null;
}

async function resolveActorFromHeaders(hdrs: Headers): Promise<AuthenticatedActor | null> {
  const session = await auth.api
    .getSession({
      headers: hdrs,
      query: { disableCookieCache: true },
    })
    .catch(() => null);

  if (!session?.user?.id || !session.session?.id) return null;

  const freshUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });

  if (!freshUser) return null;

  return {
    userId: freshUser.id,
    email: freshUser.email,
    name: freshUser.name,
    role: freshUser.role,
    status: freshUser.status,
    sessionId: session.session.id,
  };
}

/** Per-request cached actor lookup for Server Components & layouts (eliminates duplicate Neon DB queries). */
const getCachedPageActor = cache(async (): Promise<AuthenticatedActor | null> => {
  const hdrs = await headers();
  return resolveActorFromHeaders(hdrs);
});

export async function getServerActor(reqHeaders?: Headers): Promise<AuthenticatedActor | null> {
  if (reqHeaders) {
    return resolveActorFromHeaders(reqHeaders);
  }
  return getCachedPageActor();
}

export async function requireApiUser(request: Request): Promise<AuthenticatedActor> {
  const actor = await getServerActor(request.headers);
  if (!actor) {
    throw new AppError(401, "UNAUTHENTICATED", "Sign in required.", false);
  }
  if (actor.status === "DISABLED") {
    throw new AppError(403, "ACCOUNT_DISABLED", "This account is disabled.", false);
  }
  if (actor.status !== "ACTIVE") {
    throw new AppError(403, "ACCOUNT_INACTIVE", "This account is not active.", false);
  }
  return actor;
}

export async function requireApiHr(request: Request): Promise<AuthenticatedActor> {
  const actor = await requireApiUser(request);
  if (actor.role !== "HR") {
    throw new AppError(403, "FORBIDDEN", "Only HR accounts can access this resource.", false);
  }
  return actor;
}

const loadCachedInternByUserId = cache(async (userId: string) => {
  return prisma.internship.findFirst({
    where: { internUserId: userId, status: "ACTIVE" },
    include: {
      department: { select: { name: true } },
      office: { select: { name: true, timezone: true } },
    },
  });
});

export async function loadActiveInternActor(actor: AuthenticatedActor): Promise<ActiveInternActor> {
  if (actor.role !== "INTERN") {
    throw new AppError(403, "FORBIDDEN", "Only intern accounts can perform this action.", false);
  }

  const internship = await loadCachedInternByUserId(actor.userId);

  if (!internship) {
    throw new AppError(403, "NO_ACTIVE_INTERNSHIP", "No active internship assignment found for this account.", false);
  }

  return {
    ...actor,
    role: "INTERN",
    internship: {
      id: internship.id,
      departmentId: internship.departmentId,
      departmentName: internship.department.name,
      officeId: internship.officeId,
      officeName: internship.office.name,
      timeZone: internship.office.timezone,
      requiredMinutes: internship.requiredMinutes,
      startDate: internship.startDate,
      endDate: internship.endDate,
      status: internship.status,
      attendanceVersion: internship.attendanceVersion,
    },
  };
}

export async function requireApiIntern(request: Request): Promise<ActiveInternActor> {
  const actor = await requireApiUser(request);
  return loadActiveInternActor(actor);
}

/** Page guard for (hr) layouts and pages. Redirects unauthenticated or wrong-role users. */
export async function requirePageHr(currentPath = "/hr"): Promise<AuthenticatedActor | null> {
  if (isMockModeEnabled()) return null;
  const actor = await getServerActor();
  if (!actor || actor.status !== "ACTIVE") {
    redirect(`/sign-in?next=${encodeURIComponent(currentPath)}`);
  }
  if (actor.role !== "HR") {
    redirect("/dashboard");
  }
  return actor;
}

/** Page guard for (intern) layouts and pages. Redirects unauthenticated or wrong-role users. */
export async function requirePageIntern(currentPath = "/dashboard"): Promise<ActiveInternActor | null> {
  if (isMockModeEnabled()) return null;
  const actor = await getServerActor();
  if (!actor || actor.status !== "ACTIVE") {
    redirect(`/sign-in?next=${encodeURIComponent(currentPath)}`);
  }
  if (actor.role !== "INTERN") {
    redirect("/hr");
  }
  try {
    return await loadActiveInternActor(actor);
  } catch {
    redirect("/sign-in");
  }
}
