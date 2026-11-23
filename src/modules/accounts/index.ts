/**
 * Accounts & Departments module (Technical Design v1.0 sections 2 and 10).
 *
 * Owns HR-driven intern provisioning (idempotent via provisionKey), single-use
 * setup token issuance/redemption (PENDING -> ACTIVE), session revocation,
 * account disable/enable, intern profile & department transfer updates, and
 * department lifecycle management.
 */

import { createHash, randomBytes } from "node:crypto";

import type { CorrectionReasonCategory, InternshipStatus, UserStatus } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

import type { AuthenticatedActor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { sendSetupLinkEmail } from "@/lib/mail";
import type { CorrectionReason } from "@/lib/ui/correction-form";
import { workdaysBetween } from "@/lib/ui/dtr";
import { formatClock, formatShortDate, officeDateIso } from "@/lib/ui/format";
import { DEFAULT_REQUIRED_HOURS } from "@/lib/ui/intern-form";
import { checkPassword } from "@/lib/ui/password";
import type { StatusKind } from "@/lib/ui/status";
import type {
  DepartmentRowVM,
  HistoryDayVM,
  HrTeamVM,
  HrUserRowVM,
  InternAccountTab,
  InternListRowVM,
  InternListVM,
  InternProfileVM,
  SetupLinkVM,
} from "@/lib/ui/view-models";
import { aggregateDayCredits, dateToIso, policyToUiRules } from "@/modules/attendance/credit";
import { recordAuditEvent } from "@/modules/audit";

const SETUP_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
const PAGE_SIZE = 25;

export interface ProvisionInternInput {
  readonly actorId: string;
  readonly clientRequestId: string;
  readonly email: string;
  readonly name: string;
  readonly departmentId?: string;
  readonly department?: string;
  readonly officeId?: string;
  readonly requiredMinutes: number;
  readonly startDate: string;
  readonly endDate?: string | null;
  readonly correlationId: string;
}

export interface ProvisionInternResult {
  readonly id: string;
  readonly userId: string;
  readonly internshipId: string;
  readonly status: "PENDING" | "ACTIVE";
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function createRawSetupToken(): string {
  return randomBytes(32).toString("base64url");
}

function setupIdentifier(userId: string): string {
  return `setup:${userId}`;
}

function buildAppUrl(path: string): string {
  const base = (process.env.APP_ORIGIN || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

function formatExpiryLabel(expiresAt: Date, timeZone: string): string {
  const datePart = formatShortDate(officeDateIso(expiresAt, timeZone));
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(expiresAt);
  return `${datePart} at ${timePart}`;
}

function mapReasonCategory(category: CorrectionReasonCategory): CorrectionReason {
  switch (category) {
    case "MISSED_CLOCK_IN":
      return "missed_clock_in";
    case "MISSED_CLOCK_OUT":
      return "missed_clock_out";
    case "WRONG_ACTION":
      return "wrong_action";
    case "TECHNICAL_ISSUE":
      return "technical_issue";
    default:
      return "other";
  }
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

export async function provisionIntern(input: ProvisionInternInput): Promise<ProvisionInternResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const trimmedName = input.name.trim();
  if (!trimmedName || !normalizedEmail.includes("@")) {
    throw new AppError(400, "VALIDATION_ERROR", "Valid name and email are required.", false);
  }
  if (!Number.isInteger(input.requiredMinutes) || input.requiredMinutes <= 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Required minutes must be a positive integer.", false);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    throw new AppError(400, "VALIDATION_ERROR", "Start date must be YYYY-MM-DD.", false);
  }
  if (input.endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate) || input.endDate < input.startDate)) {
    throw new AppError(400, "VALIDATION_ERROR", "End date must be on or after start date.", false);
  }

  // Idempotent replay check before creating new rows
  const existingByKey = await prisma.internship.findUnique({
    where: { provisionKey: input.clientRequestId },
    include: { intern: { select: { id: true, status: true } } },
  });
  if (existingByKey) {
    return {
      id: existingByKey.intern.id,
      userId: existingByKey.intern.id,
      internshipId: existingByKey.id,
      status: existingByKey.intern.status === "ACTIVE" ? "ACTIVE" : "PENDING",
    };
  }

  const rawToken = createRawSetupToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS);

  const txResult = await prisma.$transaction(async (tx) => {
    const department = input.departmentId
      ? await tx.department.findUnique({ where: { id: input.departmentId } })
      : input.department
        ? await tx.department.findFirst({
            where: { name: { equals: input.department.trim(), mode: "insensitive" } },
          })
        : null;

    if (!department) {
      throw new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found.", false);
    }
    if (!department.active) {
      throw new AppError(400, "DEPARTMENT_INACTIVE", "Department is inactive.", false);
    }

    const office = input.officeId
      ? await tx.office.findUnique({ where: { id: input.officeId } })
      : await tx.office.findFirst({ orderBy: { createdAt: "asc" } });
    if (!office) {
      throw new AppError(503, "OFFICE_NOT_CONFIGURED", "Office is not configured.", false);
    }

    const existingUser = await tx.user.findUnique({
      where: { email: normalizedEmail },
      include: { internships: { where: { status: "ACTIVE" } } },
    });

    let userId: string;
    if (existingUser) {
      if (existingUser.status !== "PENDING" || existingUser.internships.length > 0) {
        throw new AppError(409, "EMAIL_TAKEN", "That email already has an account.", false);
      }
      const updatedUser = await tx.user.update({
        where: { id: existingUser.id },
        data: { name: trimmedName, setupLinkSentAtUtc: new Date() },
      });
      userId = updatedUser.id;
    } else {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: trimmedName,
          role: "INTERN",
          status: "PENDING",
          emailVerified: false,
          setupLinkSentAtUtc: new Date(),
        },
      });
      userId = createdUser.id;
    }

    const startDate = new Date(`${input.startDate}T00:00:00Z`);
    const endDate = input.endDate ? new Date(`${input.endDate}T00:00:00Z`) : null;

    const internship = await tx.internship.create({
      data: {
        internUserId: userId,
        departmentId: department.id,
        officeId: office.id,
        requiredMinutes: input.requiredMinutes,
        startDate,
        endDate,
        status: "ACTIVE",
        provisionKey: input.clientRequestId,
      },
    });

    await tx.internshipAssignment.create({
      data: {
        internshipId: internship.id,
        departmentId: department.id,
        officeId: office.id,
        effectiveFromDate: startDate,
      },
    });

    await tx.verification.deleteMany({ where: { identifier: setupIdentifier(userId) } });
    await tx.verification.create({
      data: {
        identifier: setupIdentifier(userId),
        value: tokenHash,
        expiresAt,
      },
    });

    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "account.intern_provisioned",
      resourceType: "user",
      resourceId: userId,
      afterValues: {
        internshipId: internship.id,
        departmentId: department.id,
        departmentName: department.name,
        requiredMinutes: internship.requiredMinutes,
        startDate: input.startDate,
        status: "PENDING",
        summary: `Added intern ${trimmedName} (${department.name})`,
      },
      correlationId: input.correlationId,
    });

    return {
      userId,
      internshipId: internship.id,
      timeZone: office.timezone,
    };
  });

  // Deliver email outside database transaction so SMTP latency never holds DB locks
  const setupUrl = buildAppUrl(`/set-password?token=${encodeURIComponent(rawToken)}`);
  await sendSetupLinkEmail({
    to: normalizedEmail,
    firstName: trimmedName.split(/\s+/)[0] || trimmedName,
    role: "INTERN",
    setupUrl,
    expiresLabel: formatExpiryLabel(expiresAt, txResult.timeZone),
  }).catch(() => undefined);

  return {
    id: txResult.userId,
    userId: txResult.userId,
    internshipId: txResult.internshipId,
    status: "PENDING",
  };
}

export async function getSetupLinkByToken(rawToken: string | undefined): Promise<SetupLinkVM | null> {
  if (!rawToken || rawToken.trim().length < 16) return null;
  const verification = await prisma.verification.findFirst({
    where: {
      value: hashToken(rawToken.trim()),
      identifier: { startsWith: "setup:" },
      expiresAt: { gt: new Date() },
    },
  });
  if (!verification) return null;

  const userId = verification.identifier.slice("setup:".length);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      internships: {
        where: { status: "ACTIVE" },
        include: {
          department: { select: { name: true } },
          office: { select: { timezone: true } },
        },
        take: 1,
      },
    },
  });
  if (!user || user.status === "DISABLED") return null;

  const activeInternship = user.internships[0];
  const timeZone = activeInternship?.office.timezone ?? "Asia/Manila";

  return {
    email: user.email,
    firstName: user.name.split(/\s+/)[0] || user.name,
    role: user.role,
    department: activeInternship?.department.name,
    startDateIso: activeInternship ? dateToIso(activeInternship.startDate) : undefined,
    expiresLabel: formatExpiryLabel(verification.expiresAt, timeZone),
  };
}

export async function redeemSetupToken(input: {
  readonly token: string;
  readonly newPassword: string;
  readonly correlationId: string;
}): Promise<{ readonly userId: string; readonly email: string; readonly role: "INTERN" | "HR" }> {
  const tokenHash = hashToken(input.token.trim());
  const verification = await prisma.verification.findFirst({
    where: {
      value: tokenHash,
      identifier: { startsWith: "setup:" },
      expiresAt: { gt: new Date() },
    },
  });
  if (!verification) {
    throw new AppError(400, "TOKEN_EXPIRED", "This setup link has expired or was already used.", false);
  }

  const userId = verification.identifier.slice("setup:".length);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === "DISABLED") {
    throw new AppError(400, "TOKEN_EXPIRED", "This setup link is no longer valid.", false);
  }

  const check = checkPassword({ password: input.newPassword, repeat: input.newPassword, email: user.email });
  if (!check.allMet) {
    throw new AppError(400, "PASSWORD_TOO_SHORT", "Password does not meet security requirements.", false);
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.verification.deleteMany({
      where: { id: verification.id },
    });
    if (deleted.count === 0) {
      throw new AppError(400, "TOKEN_EXPIRED", "This setup link has already been redeemed.", false);
    }

    const existingCredential = await tx.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    if (existingCredential) {
      await tx.account.update({
        where: { id: existingCredential.id },
        data: { password: passwordHash },
      });
    } else {
      await tx.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        status: "ACTIVE",
        emailVerified: true,
      },
    });

    await recordAuditEvent(tx, {
      actorId: user.id,
      action: "account.activated",
      resourceType: "user",
      resourceId: user.id,
      beforeValues: { status: user.status },
      afterValues: { status: "ACTIVE", summary: `${user.name} completed password setup` },
      correlationId: input.correlationId,
    });
  });

  return { userId: user.id, email: user.email, role: user.role };
}

export async function resendSetupLink(input: {
  readonly actorId: string;
  readonly internUserId: string;
  readonly correlationId: string;
}): Promise<{ readonly sentAtUtc: string }> {
  const user = await prisma.user.findUnique({
    where: { id: input.internUserId },
    include: {
      internships: {
        include: { office: { select: { timezone: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!user || user.role !== "INTERN") {
    throw new AppError(404, "INTERN_NOT_FOUND", "Intern account not found.", false);
  }
  if (user.status === "DISABLED") {
    throw new AppError(409, "ACCOUNT_DISABLED", "Enable the account before sending a setup link.", false);
  }

  const rawToken = createRawSetupToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SETUP_TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.verification.deleteMany({ where: { identifier: setupIdentifier(user.id) } });
    await tx.verification.create({
      data: {
        identifier: setupIdentifier(user.id),
        value: tokenHash,
        expiresAt,
      },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { setupLinkSentAtUtc: now },
    });
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "account.setup_link_resent",
      resourceType: "user",
      resourceId: user.id,
      afterValues: { summary: `Resent setup link to ${user.name}` },
      correlationId: input.correlationId,
    });
  });

  const timeZone = user.internships[0]?.office.timezone ?? "Asia/Manila";
  await sendSetupLinkEmail({
    to: user.email,
    firstName: user.name.split(/\s+/)[0] || user.name,
    role: "INTERN",
    setupUrl: buildAppUrl(`/set-password?token=${encodeURIComponent(rawToken)}`),
    expiresLabel: formatExpiryLabel(expiresAt, timeZone),
  });

  return { sentAtUtc: now.toISOString() };
}

export async function revokeUserSessions(input: {
  readonly actorId: string;
  readonly targetUserId: string;
  readonly correlationId: string;
}): Promise<{ readonly sessionsEnded: number }> {
  const user = await prisma.user.findUnique({ where: { id: input.targetUserId } });
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.", false);

  const deleted = await prisma.$transaction(async (tx) => {
    const res = await tx.session.deleteMany({ where: { userId: user.id } });
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "account.sessions_revoked",
      resourceType: "user",
      resourceId: user.id,
      afterValues: {
        sessionsEnded: res.count,
        summary: `Signed out ${user.name} from ${res.count} device(s)`,
      },
      correlationId: input.correlationId,
    });
    return res.count;
  });

  return { sessionsEnded: deleted };
}

export async function setUserDisabled(input: {
  readonly actorId: string;
  readonly targetUserId: string;
  readonly disabled: boolean;
  readonly correlationId: string;
}): Promise<{ readonly status: "ACTIVE" | "DISABLED" }> {
  const user = await prisma.user.findUnique({ where: { id: input.targetUserId } });
  if (!user || user.role !== "INTERN") {
    throw new AppError(404, "INTERN_NOT_FOUND", "Intern account not found.", false);
  }

  const nextStatus: "ACTIVE" | "DISABLED" = input.disabled ? "DISABLED" : "ACTIVE";
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { status: nextStatus },
    });
    if (input.disabled) {
      await tx.session.deleteMany({ where: { userId: user.id } });
    }
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: input.disabled ? "account.disabled" : "account.enabled",
      resourceType: "user",
      resourceId: user.id,
      beforeValues: { status: user.status },
      afterValues: {
        status: nextStatus,
        summary: `${input.disabled ? "Disabled" : "Re-enabled"} ${user.name}'s account`,
      },
      correlationId: input.correlationId,
    });
  });

  return { status: nextStatus };
}

export async function updateIntern(input: {
  readonly actorId: string;
  readonly targetUserId: string;
  readonly expectedAttendanceVersion?: number;
  readonly departmentId?: string;
  readonly requiredMinutes?: number;
  readonly endDate?: string | null;
  readonly status?: InternshipStatus;
  readonly correlationId: string;
}): Promise<{ readonly internshipId: string; readonly attendanceVersion: number }> {
  return prisma.$transaction(async (tx) => {
    const internship = await tx.internship.findFirst({
      where: { internUserId: input.targetUserId },
      include: {
        intern: { select: { name: true } },
        department: { select: { name: true } },
        office: { select: { timezone: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    if (!internship) {
      throw new AppError(404, "INTERNSHIP_NOT_FOUND", "Internship not found.", false);
    }

    await tx.$queryRaw`SELECT id FROM "internship" WHERE id = ${internship.id}::uuid FOR UPDATE`;

    if (
      input.expectedAttendanceVersion !== undefined &&
      internship.attendanceVersion !== input.expectedAttendanceVersion
    ) {
      throw new AppError(409, "STALE_VERSION", "Intern record changed. Refresh before saving.", false);
    }

    let nextDeptName = internship.department.name;
    if (input.departmentId && input.departmentId !== internship.departmentId) {
      const dept = await tx.department.findUnique({ where: { id: input.departmentId } });
      if (!dept) throw new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found.", false);
      if (!dept.active) throw new AppError(400, "DEPARTMENT_INACTIVE", "Target department is inactive.", false);
      nextDeptName = dept.name;

      const todayIso = officeDateIso(new Date(), internship.office.timezone);
      const todayDate = new Date(`${todayIso}T00:00:00Z`);

      await tx.internshipAssignment.updateMany({
        where: { internshipId: internship.id, effectiveToDate: null },
        data: { effectiveToDate: todayDate },
      });
      await tx.internshipAssignment.create({
        data: {
          internshipId: internship.id,
          departmentId: dept.id,
          officeId: internship.officeId,
          effectiveFromDate: todayDate,
        },
      });
    }

    const nextEndDate =
      input.endDate === undefined
        ? internship.endDate
        : input.endDate === null
          ? null
          : new Date(`${input.endDate}T00:00:00Z`);

    if (nextEndDate && nextEndDate < internship.startDate) {
      throw new AppError(400, "VALIDATION_ERROR", "End date cannot be before start date.", false);
    }

    const updated = await tx.internship.update({
      where: { id: internship.id },
      data: {
        ...(input.departmentId ? { departmentId: input.departmentId } : {}),
        ...(input.requiredMinutes !== undefined ? { requiredMinutes: input.requiredMinutes } : {}),
        ...(input.endDate !== undefined ? { endDate: nextEndDate } : {}),
        ...(input.status ? { status: input.status } : {}),
        attendanceVersion: { increment: 1 },
      },
    });

    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "internship.updated",
      resourceType: "internship",
      resourceId: updated.id,
      beforeValues: {
        departmentId: internship.departmentId,
        requiredMinutes: internship.requiredMinutes,
        status: internship.status,
      },
      afterValues: {
        departmentId: updated.departmentId,
        departmentName: nextDeptName,
        requiredMinutes: updated.requiredMinutes,
        status: updated.status,
        summary: `Updated internship for ${internship.intern.name}`,
      },
      correlationId: input.correlationId,
    });

    return { internshipId: updated.id, attendanceVersion: updated.attendanceVersion };
  });
}

export async function getMe(actor: AuthenticatedActor) {
  const activeInternship =
    actor.role === "INTERN"
      ? await prisma.internship.findFirst({
          where: { internUserId: actor.userId, status: "ACTIVE" },
          include: {
            department: { select: { id: true, name: true } },
            office: { select: { id: true, name: true, timezone: true } },
          },
        })
      : null;

  return {
    user: {
      id: actor.userId,
      name: actor.name,
      email: actor.email,
      role: actor.role,
      status: actor.status,
    },
    internship: activeInternship
      ? {
          id: activeInternship.id,
          departmentId: activeInternship.departmentId,
          departmentName: activeInternship.department.name,
          officeId: activeInternship.officeId,
          officeName: activeInternship.office.name,
          timeZone: activeInternship.office.timezone,
          requiredMinutes: activeInternship.requiredMinutes,
          startDateIso: dateToIso(activeInternship.startDate),
          endDateIso: activeInternship.endDate ? dateToIso(activeInternship.endDate) : null,
          status: activeInternship.status,
          attendanceVersion: activeInternship.attendanceVersion,
        }
      : null,
    capabilities: {
      canScan: actor.role === "INTERN" && actor.status === "ACTIVE" && Boolean(activeInternship),
      canReview: actor.role === "HR" && actor.status === "ACTIVE",
    },
  };
}

export async function listInterns(filters: {
  readonly tab?: InternAccountTab;
  readonly query?: string;
  readonly department?: string | null;
  readonly page?: number;
}): Promise<InternListVM> {
  const [office, departments, users] = await Promise.all([
    prisma.office.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: "INTERN" },
      include: {
        internships: {
          include: {
            department: { select: { name: true } },
            sessions: {
              where: { status: "COMPLETE" },
              include: { policyVersion: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeDepartmentNames = departments.filter((d) => d.active).map((d) => d.name);
  const allDepartmentNames = departments.map((d) => d.name);

  const allRows: InternListRowVM[] = users.flatMap((user) => {
    const internship = user.internships[0];
    if (!internship) return [];

    const credits = aggregateDayCredits(
      internship.sessions.map((s) => ({
        attendanceDateIso: dateToIso(s.attendanceDate),
        status: s.status,
        effectiveTimeInUtc: s.effectiveTimeInUtc,
        effectiveTimeOutUtc: s.effectiveTimeOutUtc,
        timezoneSnapshot: s.timezoneSnapshot,
        policyVersion: s.policyVersion,
      })),
      internship.requiredMinutes,
    );

    let tab: Exclude<InternAccountTab, "all">;
    let status: StatusKind;
    if (user.status === "DISABLED") {
      tab = "disabled";
      status = { type: "account", value: "DISABLED" };
    } else if (user.status === "PENDING") {
      tab = "pending";
      status = { type: "account", value: "PENDING" };
    } else if (internship.status === "COMPLETED") {
      tab = "finished";
      status = { type: "internship", value: "COMPLETED" };
    } else {
      tab = "active";
      status = { type: "account", value: "ACTIVE" };
    }

    return [
      {
        id: user.id,
        name: user.name,
        email: user.email,
        department: internship.department.name,
        creditedMinutes: credits.totalCreditedMinutes,
        requiredMinutes: internship.requiredMinutes,
        startDateIso: dateToIso(internship.startDate),
        endDateIso: internship.endDate ? dateToIso(internship.endDate) : null,
        tab,
        status,
        setupLinkSentIso:
          tab === "pending" && user.setupLinkSentAtUtc
            ? officeDateIso(user.setupLinkSentAtUtc, office?.timezone ?? "Asia/Manila")
            : undefined,
      },
    ];
  });

  const counts: Record<InternAccountTab, number> = {
    all: allRows.length,
    active: allRows.filter((r) => r.tab === "active").length,
    pending: allRows.filter((r) => r.tab === "pending").length,
    finished: allRows.filter((r) => r.tab === "finished").length,
    disabled: allRows.filter((r) => r.tab === "disabled").length,
  };

  const validTabs: InternAccountTab[] = ["all", "active", "pending", "finished", "disabled"];
  const tab = filters.tab && validTabs.includes(filters.tab) ? filters.tab : "all";
  const query = (filters.query ?? "").trim();
  const department = filters.department && allDepartmentNames.includes(filters.department) ? filters.department : null;
  const needle = query.toLowerCase();

  const filteredRows = allRows.filter(
    (row) =>
      (tab === "all" || row.tab === tab) &&
      (!department || row.department === department) &&
      (!needle || row.name.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle)),
  );

  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const paged = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    tab,
    query,
    department,
    counts,
    rows: paged,
    total: filteredRows.length,
    hasNextPage: filteredRows.length > page * PAGE_SIZE,
    page,
    departments: activeDepartmentNames,
    departmentOptions: departments.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name })),
    officeLabel: office ? `${office.name} · ${office.timezone}` : "Office not configured",
    defaultRequiredMinutes: DEFAULT_REQUIRED_HOURS * 60,
  };
}

export async function getInternProfile(id: string): Promise<InternProfileVM | null> {
  const user = await prisma.user.findFirst({
    where: {
      role: "INTERN",
      OR: [{ id }, { internships: { some: { id } } }],
    },
    include: {
      internships: {
        include: {
          department: true,
          office: {
            include: {
              policyVersions: {
                where: { status: "PUBLISHED" },
                orderBy: { version: "desc" },
                take: 1,
              },
            },
          },
          assignments: {
            include: { department: { select: { name: true } } },
            orderBy: { effectiveFromDate: "desc" },
          },
          sessions: {
            include: { policyVersion: true, corrections: { orderBy: { submittedAtUtc: "desc" }, take: 1 } },
            orderBy: [{ attendanceDate: "desc" }, { effectiveTimeInUtc: "asc" }],
          },
          scans: {
            where: { validationStatus: { in: ["REJECTED", "UNCERTAIN"] } },
            orderBy: { receivedAtUtc: "desc" },
          },
          correctionRequests: {
            orderBy: { submittedAtUtc: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!user) return null;
  const internship = user.internships[0];
  if (!internship) return null;

  const timeZone = internship.office.timezone;
  const now = new Date();
  const todayIso = officeDateIso(now, timeZone);
  const nowClock = formatClock(now, timeZone);

  const credits = aggregateDayCredits(
    internship.sessions.map((s) => ({
      attendanceDateIso: dateToIso(s.attendanceDate),
      status: s.status,
      effectiveTimeInUtc: s.effectiveTimeInUtc,
      effectiveTimeOutUtc: s.effectiveTimeOutUtc,
      timezoneSnapshot: s.timezoneSnapshot,
      policyVersion: s.policyVersion,
    })),
    internship.requiredMinutes,
  );

  const latestPolicy = internship.office.policyVersions[0];
  const uiRules = latestPolicy ? policyToUiRules(latestPolicy) : null;

  // Build last-7-days timeline entries
  const cutoffDate = new Date(`${todayIso}T12:00:00Z`);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 6);
  const cutoffIso = cutoffDate.toISOString().slice(0, 10);

  const sessionsByDate = new Map<string, typeof internship.sessions>();
  for (const s of internship.sessions) {
    const iso = dateToIso(s.attendanceDate);
    if (iso < cutoffIso) continue;
    const arr = sessionsByDate.get(iso);
    if (arr) arr.push(s);
    else sessionsByDate.set(iso, [s]);
  }

  const recentDays: HistoryDayVM[] = Array.from(sessionsByDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([iso, daySessions]) => {
      const hasOpen = daySessions.some((s) => s.status === "OPEN");
      const hasReview = daySessions.some((s) => s.status === "REVIEW");
      const hasComplete = daySessions.some((s) => s.status === "COMPLETE");
      const dayCredit = credits.byDate.get(iso);
      const latestCorr = daySessions.flatMap((s) => s.corrections)[0];
      return {
        dateIso: iso,
        sessions: daySessions
          .filter((s) => s.effectiveTimeInUtc)
          .map((s) => ({
            start: formatClock(s.effectiveTimeInUtc!, s.timezoneSnapshot),
            end: s.effectiveTimeOutUtc ? formatClock(s.effectiveTimeOutUtc, s.timezoneSnapshot) : null,
          })),
        creditedMinutes: hasOpen ? null : (dayCredit?.creditedMinutes ?? 0),
        kind: hasOpen ? "open" : hasReview ? "incomplete" : hasComplete ? "complete" : "none",
        correction: latestCorr ? { id: latestCorr.id, status: latestCorr.status } : undefined,
      };
    });

  const todaySessions = internship.sessions.filter((s) => dateToIso(s.attendanceDate) === todayIso);
  const openToday = todaySessions.find((s) => s.status === "OPEN");
  const completeToday = todaySessions.find((s) => s.status === "COMPLETE");

  const activeDepartments = await prisma.department.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const openCorrections = internship.correctionRequests.filter(
    (c) => c.status === "PENDING" || c.status === "NEEDS_INFO",
  );
  const approvedCount = internship.correctionRequests.filter((c) => c.status === "APPROVED").length;
  const rejectedCount = internship.correctionRequests.filter((c) => c.status === "REJECTED").length;
  const lastRejected = internship.scans[0];

  const assignments =
    internship.assignments.length > 0
      ? internship.assignments.map((a) => ({
          department: a.department.name,
          fromIso: dateToIso(a.effectiveFromDate),
          toIso: a.effectiveToDate ? dateToIso(a.effectiveToDate) : null,
        }))
      : [
          {
            department: internship.department.name,
            fromIso: dateToIso(internship.startDate),
            toIso: internship.status === "COMPLETED" && internship.endDate ? dateToIso(internship.endDate) : null,
          },
        ];

  return {
    id: user.id,
    internshipId: internship.id,
    departmentId: internship.departmentId,
    attendanceVersion: internship.attendanceVersion,
    internshipStatus: internship.status,
    availableDepartments: activeDepartments,
    name: user.name,
    initials: initialsOf(user.name),
    email: user.email,
    department: internship.department.name,
    departmentSinceIso: assignments[0]?.fromIso ?? dateToIso(internship.startDate),
    startDateIso: dateToIso(internship.startDate),
    endDateIso: internship.endDate ? dateToIso(internship.endDate) : null,
    officeName: internship.office.name,
    todayIso,
    nowClock,
    today: openToday?.effectiveTimeInUtc
      ? { status: { type: "session", value: "OPEN" }, time: formatClock(openToday.effectiveTimeInUtc, timeZone) }
      : completeToday?.effectiveTimeOutUtc
        ? { status: { type: "session", value: "COMPLETE" }, time: formatClock(completeToday.effectiveTimeOutUtc, timeZone) }
        : null,
    hours: {
      creditedMinutes: credits.totalCreditedMinutes,
      requiredMinutes: internship.requiredMinutes,
      workdaysLeft:
        internship.endDate && dateToIso(internship.endDate) >= todayIso
          ? workdaysBetween(todayIso, dateToIso(internship.endDate))
          : undefined,
      pendingCorrections: openCorrections.length,
      pendingCreditMinutes: 0,
    },
    stats:
      internship.sessions.length > 0 || internship.correctionRequests.length > 0
        ? {
            daysAttended: credits.byDate.size,
            corrections: {
              total: internship.correctionRequests.length,
              approved: approvedCount,
              rejected: rejectedCount,
              open: openCorrections.length,
            },
            rejectedScans: internship.scans.length,
            lastRejectedScan: lastRejected
              ? {
                  dateIso: officeDateIso(lastRejected.receivedAtUtc, timeZone),
                  reason: lastRejected.validationStatus === "UNCERTAIN" ? "Location uncertain" : "Outside office area",
                }
              : undefined,
          }
        : undefined,
    policyLabel: latestPolicy ? `Policy v${latestPolicy.version}` : "No active policy",
    schedule: uiRules ? { start: uiRules.start, end: uiRules.end } : { start: "08:00", end: "19:00" },
    account: {
      status: user.status as UserStatus,
      lastSignInLabel: user.lastSignInAtUtc
        ? `${formatShortDate(officeDateIso(user.lastSignInAtUtc, timeZone))}, ${formatClock(user.lastSignInAtUtc, timeZone)}`
        : undefined,
    },
    recentDays,
    corrections: internship.correctionRequests.map((c) => ({
      id: c.id,
      dateIso: dateToIso(c.attendanceDate),
      reason: mapReasonCategory(c.reasonCategory),
      status: { type: "correction", value: c.status },
    })),
    assignments,
  };
}

export async function listDepartments(): Promise<DepartmentRowVM[]> {
  const [office, departments] = await Promise.all([
    prisma.office.findFirst({ select: { timezone: true } }),
    prisma.department.findMany({
      include: {
        internships: {
          include: { intern: { select: { status: true } } },
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);
  const timeZone = office?.timezone ?? "Asia/Manila";

  return departments.map((dept) => {
    let activeInterns = 0;
    let settingUp = 0;
    let finished = 0;
    for (const internship of dept.internships) {
      if (internship.status === "COMPLETED") finished += 1;
      else if (internship.status === "ACTIVE") {
        if (internship.intern.status === "PENDING") settingUp += 1;
        else if (internship.intern.status === "ACTIVE") activeInterns += 1;
      }
    }
    return {
      id: dept.id,
      name: dept.name,
      activeInterns,
      settingUp,
      finished,
      status: { type: "department", value: dept.active ? "ACTIVE" : "INACTIVE" },
      inactiveSinceIso:
        !dept.active && dept.deactivatedAtUtc ? officeDateIso(dept.deactivatedAtUtc, timeZone) : undefined,
    };
  });
}

export async function createDepartment(input: {
  readonly actorId: string;
  readonly name: string;
  readonly correlationId: string;
}): Promise<{ readonly id: string; readonly name: string }> {
  const trimmed = input.name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    throw new AppError(400, "VALIDATION_ERROR", "Department name must be between 2 and 60 characters.", false);
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.department.findFirst({
      where: { name: { equals: trimmed, mode: "insensitive" } },
    });
    if (existing) {
      throw new AppError(409, "NAME_TAKEN", "A department already has that name.", false);
    }

    const created = await tx.department.create({
      data: { name: trimmed, active: true },
    });
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "department.created",
      resourceType: "department",
      resourceId: created.id,
      afterValues: { name: created.name, active: true, summary: `Added department ${created.name}` },
      correlationId: input.correlationId,
    });
    return { id: created.id, name: created.name };
  });
}

export async function renameDepartment(input: {
  readonly actorId: string;
  readonly id: string;
  readonly name: string;
  readonly correlationId: string;
}): Promise<{ readonly id: string; readonly name: string }> {
  const trimmed = input.name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    throw new AppError(400, "VALIDATION_ERROR", "Department name must be between 2 and 60 characters.", false);
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.department.findUnique({ where: { id: input.id } });
    if (!current) throw new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found.", false);

    const duplicate = await tx.department.findFirst({
      where: {
        id: { not: current.id },
        name: { equals: trimmed, mode: "insensitive" },
      },
    });
    if (duplicate) {
      throw new AppError(409, "NAME_TAKEN", "A department already has that name.", false);
    }

    const updated = await tx.department.update({
      where: { id: current.id },
      data: { name: trimmed },
    });
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "department.renamed",
      resourceType: "department",
      resourceId: updated.id,
      beforeValues: { name: current.name },
      afterValues: { name: updated.name, summary: `Renamed department "${current.name}" to "${updated.name}"` },
      correlationId: input.correlationId,
    });
    return { id: updated.id, name: updated.name };
  });
}

export async function setDepartmentActive(input: {
  readonly actorId: string;
  readonly id: string;
  readonly active: boolean;
  readonly correlationId: string;
}): Promise<{ readonly active: boolean }> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.department.findUnique({ where: { id: input.id } });
    if (!current) throw new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found.", false);

    const updated = await tx.department.update({
      where: { id: current.id },
      data: {
        active: input.active,
        deactivatedAtUtc: input.active ? null : new Date(),
      },
    });
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: input.active ? "department.reactivated" : "department.deactivated",
      resourceType: "department",
      resourceId: updated.id,
      beforeValues: { active: current.active },
      afterValues: {
        active: updated.active,
        summary: `${input.active ? "Reactivated" : "Deactivated"} department ${updated.name}`,
      },
      correlationId: input.correlationId,
    });
    return { active: updated.active };
  });
}

// ---------------------------------------------------------------------------
// HR team management
// ---------------------------------------------------------------------------

export async function listHrUsers(currentActorId?: string): Promise<HrTeamVM> {
  const [office, users] = await Promise.all([
    prisma.office.findFirst({ select: { timezone: true }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      where: { role: "HR" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        setupLinkSentAtUtc: true,
        lastSignInAtUtc: true,
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
  ]);
  const timeZone = office?.timezone ?? "Asia/Manila";
  const todayIso = officeDateIso(new Date(), timeZone);

  const rows: HrUserRowVM[] = users.map((u) => {
    let lastSignInLabel: string | undefined;
    if (u.lastSignInAtUtc) {
      const signInIso = officeDateIso(u.lastSignInAtUtc, timeZone);
      const clock = formatClock(u.lastSignInAtUtc, timeZone);
      lastSignInLabel = signInIso === todayIso ? `Today, ${clock}` : `${formatShortDate(signInIso)}, ${clock}`;
    }
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      isCurrentUser: u.id === currentActorId,
      setupLinkSentIso: u.setupLinkSentAtUtc ? officeDateIso(u.setupLinkSentAtUtc, timeZone) : undefined,
      lastSignInLabel,
    };
  });

  return { users: rows };
}

export async function inviteHrUser(input: {
  readonly actorId: string;
  readonly name: string;
  readonly email: string;
  readonly correlationId: string;
}): Promise<{
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly status: "PENDING";
  readonly setupLinkSentIso: string;
}> {
  const trimmedName = input.name.trim();
  const normalizedEmail = input.email.trim().toLowerCase();
  if (trimmedName.length < 2 || trimmedName.length > 100 || !normalizedEmail.includes("@")) {
    throw new AppError(400, "VALIDATION_ERROR", "Valid name and email are required.", false);
  }

  const rawToken = createRawSetupToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS);

  const txResult = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new AppError(409, "EMAIL_TAKEN", "That email already has an account.", false);
    }

    const office = await tx.office.findFirst({ select: { timezone: true }, orderBy: { createdAt: "asc" } });
    const timeZone = office?.timezone ?? "Asia/Manila";
    const now = new Date();

    const created = await tx.user.create({
      data: {
        email: normalizedEmail,
        name: trimmedName,
        role: "HR",
        status: "PENDING",
        emailVerified: false,
        setupLinkSentAtUtc: now,
      },
    });

    await tx.verification.create({
      data: {
        identifier: setupIdentifier(created.id),
        value: tokenHash,
        expiresAt,
      },
    });

    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "hr_user.invited",
      resourceType: "user",
      resourceId: created.id,
      afterValues: {
        role: "HR",
        status: "PENDING",
        summary: `Invited HR user ${created.name}`,
      },
      correlationId: input.correlationId,
    });

    return {
      id: created.id,
      name: created.name,
      email: created.email,
      timeZone,
      setupLinkSentIso: officeDateIso(now, timeZone),
    };
  });

  const setupUrl = buildAppUrl(`/set-password?token=${encodeURIComponent(rawToken)}`);
  await sendSetupLinkEmail({
    to: txResult.email,
    firstName: txResult.name.split(/\s+/)[0] || txResult.name,
    role: "HR",
    setupUrl,
    expiresLabel: formatExpiryLabel(expiresAt, txResult.timeZone),
  }).catch(() => undefined);

  return {
    id: txResult.id,
    name: txResult.name,
    email: txResult.email,
    status: "PENDING",
    setupLinkSentIso: txResult.setupLinkSentIso,
  };
}

export async function resendHrSetupLink(input: {
  readonly actorId: string;
  readonly targetUserId: string;
  readonly correlationId: string;
}): Promise<{ readonly sentAtUtc: string }> {
  const rawToken = createRawSetupToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS);

  const txResult = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.targetUserId } });
    if (!user || user.role !== "HR") {
      throw new AppError(404, "HR_USER_NOT_FOUND", "HR user not found.", false);
    }
    if (user.status === "DISABLED") {
      throw new AppError(409, "ACCOUNT_DISABLED", "Reactivate this HR account before sending a setup link.", false);
    }

    const office = await tx.office.findFirst({ select: { timezone: true }, orderBy: { createdAt: "asc" } });
    const timeZone = office?.timezone ?? "Asia/Manila";
    const now = new Date();

    await tx.user.update({
      where: { id: user.id },
      data: { setupLinkSentAtUtc: now },
    });
    await tx.verification.deleteMany({ where: { identifier: setupIdentifier(user.id) } });
    await tx.verification.create({
      data: {
        identifier: setupIdentifier(user.id),
        value: tokenHash,
        expiresAt,
      },
    });

    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "hr_user.setup_link_resent",
      resourceType: "user",
      resourceId: user.id,
      afterValues: { summary: `Resent setup link to HR user ${user.name}` },
      correlationId: input.correlationId,
    });

    return { email: user.email, name: user.name, timeZone, sentAtUtc: now.toISOString() };
  });

  const setupUrl = buildAppUrl(`/set-password?token=${encodeURIComponent(rawToken)}`);
  await sendSetupLinkEmail({
    to: txResult.email,
    firstName: txResult.name.split(/\s+/)[0] || txResult.name,
    role: "HR",
    setupUrl,
    expiresLabel: formatExpiryLabel(expiresAt, txResult.timeZone),
  }).catch(() => undefined);

  return { sentAtUtc: txResult.sentAtUtc };
}

export async function revokeHrSessions(input: {
  readonly actorId: string;
  readonly targetUserId: string;
  readonly correlationId: string;
}): Promise<{ readonly sessionsEnded: number }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.targetUserId } });
    if (!user || user.role !== "HR") {
      throw new AppError(404, "HR_USER_NOT_FOUND", "HR user not found.", false);
    }

    const deleted = await tx.session.deleteMany({ where: { userId: user.id } });
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "hr_user.sessions_revoked",
      resourceType: "user",
      resourceId: user.id,
      afterValues: {
        sessionsEnded: deleted.count,
        summary: `Signed HR user ${user.name} out of ${deleted.count} session(s)`,
      },
      correlationId: input.correlationId,
    });

    return { sessionsEnded: deleted.count };
  });
}

export async function setHrUserStatus(input: {
  readonly actorId: string;
  readonly targetUserId: string;
  readonly status: "ACTIVE" | "DISABLED";
  readonly correlationId: string;
}): Promise<{ readonly status: "ACTIVE" | "DISABLED" }> {
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: input.targetUserId } });
    if (!target || target.role !== "HR") {
      throw new AppError(404, "HR_USER_NOT_FOUND", "HR user not found.", false);
    }

    if (input.status === "DISABLED") {
      if (target.id === input.actorId) {
        throw new AppError(409, "CANNOT_DISABLE_SELF", "You cannot disable your own HR account.", false);
      }
      const otherActiveCount = await tx.user.count({
        where: { role: "HR", status: "ACTIVE", id: { not: target.id } },
      });
      if (otherActiveCount === 0) {
        throw new AppError(409, "LAST_ACTIVE_HR", "At least one active HR account must remain.", false);
      }
    }

    const updated = await tx.user.update({
      where: { id: target.id },
      data: { status: input.status },
    });

    if (input.status === "DISABLED") {
      await tx.session.deleteMany({ where: { userId: target.id } });
    }

    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "hr_user.status_changed",
      resourceType: "user",
      resourceId: target.id,
      beforeValues: { status: target.status },
      afterValues: {
        status: updated.status,
        summary: `${input.status === "DISABLED" ? "Disabled" : "Reactivated"} HR account ${target.name}`,
      },
      correlationId: input.correlationId,
    });

    return { status: input.status };
  });
}
