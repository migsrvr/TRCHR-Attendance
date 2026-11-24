/**
 * Idempotent database bootstrap seed.
 *
 * Supplies the first HR account, initial office, departments, active policy
 * version, and Time In / Time Out QR checkpoints strictly from environment
 * variables — never hardcodes production coordinates or credentials.
 *
 * Run with: npm run prisma:generate && npx tsx prisma/seed.ts
 */

import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required seed environment variable: ${name}`);
  }
  return value;
}

function parseFiniteNumber(name: string, min: number, max: number): number {
  const raw = requireEnv(name);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: expected number between ${min} and ${max}`);
  }
  return value;
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name}: expected positive integer`);
  }
  return value;
}

async function main(): Promise<void> {
  const hrEmail = requireEnv("BOOTSTRAP_HR_EMAIL").toLowerCase();
  const hrPassword = requireEnv("BOOTSTRAP_HR_PASSWORD");
  if (hrPassword.length < 10) {
    throw new Error("BOOTSTRAP_HR_PASSWORD must be at least 10 characters");
  }
  const hrName = process.env.BOOTSTRAP_HR_NAME?.trim() || "Top Realty HR Admin";

  const officeName = process.env.BOOTSTRAP_OFFICE_NAME?.trim() || "Top Realty Main Office";
  const latitude = parseFiniteNumber("BOOTSTRAP_OFFICE_LAT", -90, 90);
  const longitude = parseFiniteNumber("BOOTSTRAP_OFFICE_LNG", -180, 180);
  const timezone = requireEnv("BOOTSTRAP_OFFICE_TZ");
  // Validate IANA timezone before writing
  new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());

  const geofenceRadiusMeters = parsePositiveInt("BOOTSTRAP_OFFICE_RADIUS_METERS", 60);
  const maxAccuracyMeters = parsePositiveInt("BOOTSTRAP_OFFICE_MAX_ACCURACY_METERS", 25);
  if (maxAccuracyMeters >= geofenceRadiusMeters) {
    throw new Error("BOOTSTRAP_OFFICE_MAX_ACCURACY_METERS must be smaller than BOOTSTRAP_OFFICE_RADIUS_METERS");
  }

  const departmentNames = (process.env.BOOTSTRAP_DEPARTMENTS ?? "Marketing,Sales,Operations,Finance")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const correlationId = randomUUID();
  const passwordHash = await hashPassword(hrPassword);

  await prisma.$transaction(async (tx) => {
    // 1. Bootstrap HR user + Better Auth credential account
    let hrUser = await tx.user.findUnique({ where: { email: hrEmail } });
    if (!hrUser) {
      hrUser = await tx.user.create({
        data: {
          email: hrEmail,
          name: hrName,
          emailVerified: true,
          role: "HR",
          status: "ACTIVE",
        },
      });
    } else if (hrUser.role !== "HR") {
      throw new Error(`User ${hrEmail} already exists with role ${hrUser.role}`);
    }

    const existingCredential = await tx.account.findFirst({
      where: { userId: hrUser.id, providerId: "credential" },
    });
    if (!existingCredential) {
      await tx.account.create({
        data: {
          accountId: hrUser.id,
          providerId: "credential",
          userId: hrUser.id,
          password: passwordHash,
        },
      });
    }

    // 2. Office
    let office = await tx.office.findFirst({ orderBy: { createdAt: "asc" } });
    if (!office) {
      office = await tx.office.create({
        data: {
          name: officeName,
          latitude,
          longitude,
          geofenceRadiusMeters,
          maxAccuracyMeters,
          timezone,
          configVersion: 1,
        },
      });
    }

    // 3. Initial published policy version (configurable later via /hr/setup/policies)
    const existingPolicy = await tx.attendancePolicyVersion.findFirst({
      where: { officeId: office.id, status: "PUBLISHED" },
    });
    if (!existingPolicy) {
      const now = new Date();
      await tx.attendancePolicyVersion.create({
        data: {
          officeId: office.id,
          version: 1,
          status: "PUBLISHED",
          scheduleRules: {
            workdays: [1, 2, 3, 4, 5],
            windows: [{ startMinutes: 8 * 60, endMinutes: 19 * 60 }],
          },
          breakRules: [
            {
              requiredBreakMinutes: 60,
              windowStartMinutes: 12 * 60,
              windowEndMinutes: 14 * 60,
              gapCountsTowardBreak: true,
            },
          ],
          creditRules: {
            roundingMode: "FLOOR",
            roundingUnitMinutes: 5,
            dailyCapMinutes: 8 * 60,
          },
          effectiveFromUtc: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
          publishedAtUtc: now,
        },
      });
    }

    // 4. Default active IN and OUT checkpoints (30-day monthly printable window)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    for (const action of ["TIME_IN", "TIME_OUT"] as const) {
      const existing = await tx.qrCheckpoint.findFirst({
        where: { officeId: office.id, action, active: true },
      });
      if (!existing) {
        await tx.qrCheckpoint.create({
          data: {
            officeId: office.id,
            name: "Main entrance",
            action,
            active: true,
            credentialVersion: 1,
            credentialExpiresAtUtc: expiresAt,
          },
        });
      }
    }

    // 5. Departments
    for (const name of departmentNames) {
      await tx.department.upsert({
        where: { name },
        update: {},
        create: { name, active: true },
      });
    }

    // 6. Audit record
    await tx.auditEvent.create({
      data: {
        actorId: hrUser.id,
        action: "system.bootstrap",
        resourceType: "office",
        resourceId: office.id,
        afterValues: {
          officeName: office.name,
          timezone: office.timezone,
          departmentsCount: departmentNames.length,
        },
        correlationId,
      },
    });

    console.log(
      JSON.stringify({
        event: "seed.complete",
        hrEmail: hrUser.email,
        officeId: office.id,
        officeName: office.name,
        departments: departmentNames,
      }),
    );
  }, { timeout: 30_000, maxWait: 10_000 });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
