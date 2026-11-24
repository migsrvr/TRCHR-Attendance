/**
 * Offices module (Technical Design v1.0 sections 5, 7, and 10).
 *
 * Owns office geofence/timezone settings (optimistically versioned), immutable
 * attendance policy versions (draft -> publish), and QR checkpoint credential
 * rotation & printable token issuance.
 */

import { cache } from "react";

import { policyRulesToAttendancePolicy, validatePolicy, type PolicyRules } from "@/lib/ui/policy";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { loadQrKeyringConfig, signQrCredential } from "@/lib/qr/signer";
import { officeDateIso } from "@/lib/ui/format";
import type { CheckpointVM, OfficeSetupVM, PoliciesVM, PolicyVersionVM } from "@/lib/ui/view-models";
import { dateToIso, policyToUiRules } from "@/modules/attendance/credit";
import { recordAuditEvent } from "@/modules/audit";

const DEFAULT_QR_EXPIRY_DAYS = 30;

export interface PublishPolicyVersionInput {
  readonly actorId: string;
  readonly officeId: string;
  readonly version: number;
  readonly correlationId: string;
}

export interface PublishPolicyVersionResult {
  readonly policyVersionId: string;
  readonly version: number;
}

export interface RotateCheckpointInput {
  readonly actorId: string;
  readonly checkpointId: string;
  readonly expiresAtUtc?: Date;
  readonly expiresInDays?: number;
  readonly correlationId: string;
}

export interface RotateCheckpointResult {
  readonly checkpointId: string;
  readonly credentialVersion: number;
  readonly codeVersion: number;
  readonly expiresAtUtc: string;
  readonly qrToken: string;
}

export interface CreateCheckpointInput {
  readonly actorId: string;
  readonly officeId?: string;
  readonly name: string;
  readonly action: "TIME_IN" | "TIME_OUT";
  readonly expiresInDays?: number;
  readonly correlationId: string;
}

export interface CreateCheckpointResult {
  readonly id: string;
  readonly name: string;
  readonly action: "IN" | "OUT";
  readonly codeVersion: number;
  readonly expiresIso: string;
}

export interface RevokeCheckpointInput {
  readonly actorId: string;
  readonly checkpointId: string;
  readonly correlationId: string;
}

export interface RevokeCheckpointResult {
  readonly id: string;
  readonly revokedIso: string;
}

export interface RotateAllCheckpointsInput {
  readonly actorId: string;
  readonly officeId?: string;
  readonly expiresInDays?: number;
  readonly correlationId: string;
}

export interface RotateAllCheckpointsResult {
  readonly rotatedCount: number;
  readonly expiresIso: string;
  readonly checkpoints: readonly {
    readonly id: string;
    readonly name: string;
    readonly action: "IN" | "OUT";
    readonly codeVersion: number;
  }[];
}

export interface UpdateOfficeSettingsInput {
  readonly actorId: string;
  readonly officeId?: string;
  readonly expectedConfigVersion?: number;
  readonly radiusM: number;
  readonly maxAccuracyM: number;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly timezone?: string;
  readonly name?: string;
  readonly correlationId: string;
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mapPolicyVersions(
  rows: readonly {
    id: string;
    version: number;
    status: "DRAFT" | "PUBLISHED";
    copiedFromVersion: number | null;
    scheduleRules: unknown;
    breakRules: unknown;
    creditRules: unknown;
    effectiveFromUtc: Date;
    _count: { sessions: number };
  }[],
  timeZone: string,
): PolicyVersionVM[] {
  const now = new Date();
  const publishedAsc = rows
    .filter((r) => r.status === "PUBLISHED")
    .sort((a, b) => a.version - b.version);

  // Latest published whose effectiveFromUtc <= now is ACTIVE; earlier ones are SUPERSEDED.
  let activeId: string | null = null;
  for (const row of publishedAsc) {
    if (row.effectiveFromUtc <= now) activeId = row.id;
  }
  if (!activeId && publishedAsc.length > 0) {
    activeId = publishedAsc.at(-1)!.id;
  }

  const nextEffectiveById = new Map<string, string | null>();
  for (let i = 0; i < publishedAsc.length; i += 1) {
    const current = publishedAsc[i]!;
    const next = publishedAsc[i + 1];
    nextEffectiveById.set(
      current.id,
      next ? addDaysIso(officeDateIso(next.effectiveFromUtc, timeZone), -1) : null,
    );
  }

  return [...rows]
    .sort((a, b) => b.version - a.version)
    .map((row): PolicyVersionVM => {
      const state: PolicyVersionVM["state"] =
        row.status === "DRAFT"
          ? "DRAFT"
          : row.id === activeId
            ? "ACTIVE"
            : "SUPERSEDED";
      return {
        version: row.version,
        state,
        fromIso: officeDateIso(row.effectiveFromUtc, timeZone),
        toIso: row.status === "DRAFT" ? null : (nextEffectiveById.get(row.id) ?? null),
        sessionsUsing: row._count.sessions,
        rules: policyToUiRules(row),
        copiedFrom: row.copiedFromVersion ?? undefined,
      };
    });
}

function mapCheckpoint(
  cp: {
    id: string;
    name: string;
    action: "TIME_IN" | "TIME_OUT";
    active: boolean;
    credentialVersion: number;
    credentialExpiresAtUtc: Date | null;
    revokedAtUtc: Date | null;
  },
  timeZone: string,
): CheckpointVM {
  return {
    id: cp.id,
    name: cp.name,
    action: cp.action === "TIME_IN" ? "IN" : "OUT",
    codeVersion: cp.credentialVersion,
    expiresIso: cp.credentialExpiresAtUtc ? officeDateIso(cp.credentialExpiresAtUtc, timeZone) : null,
    status: { type: "checkpoint", value: cp.active ? "ACTIVE" : "REVOKED" },
    revokedIso: cp.revokedAtUtc ? officeDateIso(cp.revokedAtUtc, timeZone) : undefined,
  };
}

export const getPrimaryOffice = cache(async () => {
  const office = await prisma.office.findFirst({ orderBy: { createdAt: "asc" } });
  if (!office) {
    throw new AppError(503, "OFFICE_NOT_CONFIGURED", "No office record has been seeded yet.", false);
  }
  return office;
});

export async function getOfficeSetup(): Promise<OfficeSetupVM & { readonly officeId: string }> {
  const office = await getPrimaryOffice();
  const [policyRows, checkpointRows] = await Promise.all([
    prisma.attendancePolicyVersion.findMany({
      where: { officeId: office.id },
      include: { _count: { select: { sessions: true } } },
      orderBy: { version: "desc" },
    }),
    prisma.qrCheckpoint.findMany({
      where: { officeId: office.id },
      orderBy: [{ active: "desc" }, { action: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const versions = mapPolicyVersions(policyRows, office.timezone);
  const activePolicy =
    versions.find((v) => v.state === "ACTIVE") ??
    versions[0] ?? {
      version: 1,
      state: "ACTIVE" as const,
      fromIso: dateToIso(new Date()),
      toIso: null,
      sessionsUsing: 0,
      rules: {
        workdays: [1, 2, 3, 4, 5],
        start: "08:00",
        end: "19:00",
        breakMinutes: 60,
        breakWindow: { start: "12:00", end: "14:00" },
        gapCountsTowardBreak: true,
        capMinutes: 480,
        rounding: "none" as const,
      },
    };

  const lat = Number(office.latitude).toFixed(6);
  const lng = Number(office.longitude).toFixed(6);

  return {
    officeId: office.id,
    office: {
      id: office.id,
      name: office.name,
      pinLabel: `${lat}, ${lng}`,
      latitude: Number(office.latitude),
      longitude: Number(office.longitude),
      timeZone: office.timezone,
      radiusM: office.geofenceRadiusMeters,
      maxAccuracyM: office.maxAccuracyMeters,
      settingsVersion: office.configVersion,
    },
    activePolicy,
    policies: versions.filter((v) => v.state !== "DRAFT"),
    checkpoints: checkpointRows.map((cp) => mapCheckpoint(cp, office.timezone)),
  };
}

export async function listPolicyVersions(selectedVersion?: number): Promise<PoliciesVM & { readonly officeId: string }> {
  const office = await getPrimaryOffice();
  const rows = await prisma.attendancePolicyVersion.findMany({
    where: { officeId: office.id },
    include: { _count: { select: { sessions: true } } },
    orderBy: { version: "desc" },
  });

  const versions = mapPolicyVersions(rows, office.timezone);
  const fallback = versions.find((v) => v.state === "DRAFT") ?? versions[0];
  if (!fallback) {
    throw new AppError(503, "POLICY_NOT_CONFIGURED", "No attendance policy has been seeded yet.", false);
  }
  const selected = versions.find((v) => v.version === selectedVersion) ?? fallback;
  const base = selected.copiedFrom
    ? (versions.find((v) => v.version === selected.copiedFrom) ?? null)
    : null;

  return {
    officeId: office.id,
    versions,
    selected,
    base,
    example: [
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ],
  };
}

export async function updateOfficeSettings(
  input: UpdateOfficeSettingsInput,
): Promise<{ readonly officeId: string; readonly settingsVersion: number }> {
  if (!Number.isInteger(input.radiusM) || input.radiusM < 10 || input.radiusM > 500) {
    throw new AppError(400, "INVALID_RADIUS", "Geofence radius must be an integer between 10 and 500 meters.", false);
  }
  if (!Number.isInteger(input.maxAccuracyM) || input.maxAccuracyM < 5 || input.maxAccuracyM > 100) {
    throw new AppError(400, "INVALID_ACCURACY", "Max accuracy must be an integer between 5 and 100 meters.", false);
  }
  if (input.maxAccuracyM >= input.radiusM) {
    throw new AppError(400, "ACCURACY_EXCEEDS_RADIUS", "Max accuracy must be smaller than geofence radius.", false);
  }
  if (input.latitude !== undefined && (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90)) {
    throw new AppError(400, "INVALID_COORDINATES", "Latitude must be between -90 and 90.", false);
  }
  if (input.longitude !== undefined && (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180)) {
    throw new AppError(400, "INVALID_COORDINATES", "Longitude must be between -180 and 180.", false);
  }
  if (input.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.timezone }).format(new Date());
    } catch {
      throw new AppError(400, "INVALID_TIMEZONE", "Unknown IANA time zone.", false);
    }
  }

  return prisma.$transaction(async (tx) => {
    const office = input.officeId
      ? await tx.office.findUnique({ where: { id: input.officeId } })
      : await tx.office.findFirst({ orderBy: { createdAt: "asc" } });
    if (!office) {
      throw new AppError(404, "OFFICE_NOT_FOUND", "Office not found.", false);
    }
    if (
      input.expectedConfigVersion !== undefined &&
      office.configVersion !== input.expectedConfigVersion
    ) {
      throw new AppError(409, "STALE_VERSION", "Office settings were changed by someone else. Refresh and retry.", false);
    }

    const updated = await tx.office.update({
      where: { id: office.id },
      data: {
        geofenceRadiusMeters: input.radiusM,
        maxAccuracyMeters: input.maxAccuracyM,
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.name !== undefined && input.name.trim() ? { name: input.name.trim() } : {}),
        configVersion: { increment: 1 },
      },
    });

    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "office.settings_updated",
      resourceType: "office",
      resourceId: office.id,
      beforeValues: {
        geofenceRadiusMeters: office.geofenceRadiusMeters,
        maxAccuracyMeters: office.maxAccuracyMeters,
        timezone: office.timezone,
        configVersion: office.configVersion,
      },
      afterValues: {
        geofenceRadiusMeters: updated.geofenceRadiusMeters,
        maxAccuracyMeters: updated.maxAccuracyMeters,
        timezone: updated.timezone,
        configVersion: updated.configVersion,
        summary: `Settings v${updated.configVersion}: radius ${updated.geofenceRadiusMeters}m, max accuracy ±${updated.maxAccuracyMeters}m`,
      },
      correlationId: input.correlationId,
    });

    return { officeId: updated.id, settingsVersion: updated.configVersion };
  });
}

export async function createPolicyDraft(input: {
  readonly actorId: string;
  readonly officeId?: string;
  readonly fromVersion?: number;
  readonly correlationId: string;
}): Promise<{ readonly policyVersionId: string; readonly version: number }> {
  return prisma.$transaction(async (tx) => {
    const office = input.officeId
      ? await tx.office.findUnique({ where: { id: input.officeId } })
      : await tx.office.findFirst({ orderBy: { createdAt: "asc" } });
    if (!office) throw new AppError(404, "OFFICE_NOT_FOUND", "Office not found.", false);

    const existingDraft = await tx.attendancePolicyVersion.findFirst({
      where: { officeId: office.id, status: "DRAFT" },
    });
    if (existingDraft) {
      return { policyVersionId: existingDraft.id, version: existingDraft.version };
    }

    const latest = input.fromVersion
      ? await tx.attendancePolicyVersion.findUnique({
          where: { officeId_version: { officeId: office.id, version: input.fromVersion } },
        })
      : await tx.attendancePolicyVersion.findFirst({
          where: { officeId: office.id },
          orderBy: { version: "desc" },
        });

    const maxRow = await tx.attendancePolicyVersion.findFirst({
      where: { officeId: office.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (maxRow?.version ?? 0) + 1;

    const tomorrowIso = addDaysIso(officeDateIso(new Date(), office.timezone), 1);
    const created = await tx.attendancePolicyVersion.create({
      data: {
        officeId: office.id,
        version: nextVersion,
        status: "DRAFT",
        copiedFromVersion: latest?.version ?? null,
        scheduleRules: (latest?.scheduleRules ?? {
          workdays: [1, 2, 3, 4, 5],
          windows: [{ startMinutes: 8 * 60, endMinutes: 19 * 60 }],
        }) as object,
        breakRules: (latest?.breakRules ?? [
          {
            requiredBreakMinutes: 60,
            windowStartMinutes: 12 * 60,
            windowEndMinutes: 14 * 60,
            gapCountsTowardBreak: true,
          },
        ]) as object,
        creditRules: (latest?.creditRules ?? {
          roundingMode: "NONE",
          roundingUnitMinutes: 1,
          dailyCapMinutes: 480,
        }) as object,
        effectiveFromUtc: new Date(`${tomorrowIso}T00:00:00Z`),
      },
    });

    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "policy.draft_created",
      resourceType: "attendance_policy_version",
      resourceId: created.id,
      afterValues: {
        version: created.version,
        copiedFromVersion: created.copiedFromVersion,
        summary: `Created draft policy v${created.version}`,
      },
      correlationId: input.correlationId,
    });

    return { policyVersionId: created.id, version: created.version };
  });
}

export async function savePolicyDraft(input: {
  readonly actorId: string;
  readonly officeId?: string;
  readonly version: number;
  readonly fromIso: string;
  readonly rules: PolicyRules;
  readonly correlationId: string;
}): Promise<{ readonly savedAt: string }> {
  const errors = validatePolicy(input.rules);
  if (Object.keys(errors).length > 0) {
    throw new AppError(400, "INVALID_POLICY", Object.values(errors)[0] ?? "Invalid policy rules.", false);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fromIso)) {
    throw new AppError(400, "INVALID_DATE", "Effective date must be YYYY-MM-DD.", false);
  }

  return prisma.$transaction(async (tx) => {
    const office = input.officeId
      ? await tx.office.findUnique({ where: { id: input.officeId } })
      : await tx.office.findFirst({ orderBy: { createdAt: "asc" } });
    if (!office) throw new AppError(404, "OFFICE_NOT_FOUND", "Office not found.", false);

    const todayIso = officeDateIso(new Date(), office.timezone);
    if (input.fromIso <= todayIso) {
      throw new AppError(422, "START_IN_PAST", "A new policy version must start tomorrow or later.", false);
    }

    const policy = await tx.attendancePolicyVersion.findUnique({
      where: { officeId_version: { officeId: office.id, version: input.version } },
    });
    if (!policy) {
      throw new AppError(404, "POLICY_NOT_FOUND", "Policy version not found.", false);
    }
    if (policy.status !== "DRAFT") {
      throw new AppError(409, "VERSION_LOCKED", "Published policy versions are locked and cannot be edited.", false);
    }

    const canonical = policyRulesToAttendancePolicy(input.rules, input.version);
    const savedAt = new Date();

    await tx.attendancePolicyVersion.update({
      where: { id: policy.id },
      data: {
        scheduleRules: {
          workdays: [...(canonical.workdays ?? [1, 2, 3, 4, 5])],
          windows: canonical.scheduleRules.map((w) => ({
            startMinutes: w.startMinutes,
            endMinutes: w.endMinutes,
          })),
        },
        breakRules: canonical.breakRules.map((b) => ({
          requiredBreakMinutes: b.requiredBreakMinutes,
          windowStartMinutes: b.windowStartMinutes,
          windowEndMinutes: b.windowEndMinutes,
          gapCountsTowardBreak: b.gapCountsTowardBreak ?? true,
        })),
        creditRules: {
          roundingMode: canonical.creditRules.roundingMode,
          roundingUnitMinutes: canonical.creditRules.roundingUnitMinutes,
          dailyCapMinutes: canonical.creditRules.dailyCapMinutes,
        },
        effectiveFromUtc: new Date(`${input.fromIso}T00:00:00Z`),
      },
    });

    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "policy.draft_saved",
      resourceType: "attendance_policy_version",
      resourceId: policy.id,
      afterValues: {
        version: input.version,
        effectiveFromIso: input.fromIso,
        summary: `Saved draft policy v${input.version} (effective ${input.fromIso})`,
      },
      correlationId: input.correlationId,
    });

    return { savedAt: savedAt.toISOString() };
  });
}

export async function publishPolicyVersion(
  input: PublishPolicyVersionInput,
): Promise<PublishPolicyVersionResult> {
  return prisma.$transaction(async (tx) => {
    const office = await tx.office.findUnique({ where: { id: input.officeId } });
    if (!office) throw new AppError(404, "OFFICE_NOT_FOUND", "Office not found.", false);

    const policy = await tx.attendancePolicyVersion.findUnique({
      where: { officeId_version: { officeId: office.id, version: input.version } },
    });
    if (!policy) {
      throw new AppError(404, "POLICY_NOT_FOUND", "Policy version not found.", false);
    }
    if (policy.status !== "DRAFT") {
      throw new AppError(409, "VERSION_LOCKED", "Policy version is already published.", false);
    }

    const todayIso = officeDateIso(new Date(), office.timezone);
    const effectiveIso = officeDateIso(policy.effectiveFromUtc, office.timezone);
    if (effectiveIso <= todayIso) {
      throw new AppError(422, "START_IN_PAST", "Effective date must be tomorrow or later before publishing.", false);
    }

    const published = await tx.attendancePolicyVersion.update({
      where: { id: policy.id },
      data: {
        status: "PUBLISHED",
        publishedAtUtc: new Date(),
      },
    });

    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "policy.published",
      resourceType: "attendance_policy_version",
      resourceId: published.id,
      beforeValues: { status: "DRAFT" },
      afterValues: {
        status: "PUBLISHED",
        version: published.version,
        effectiveFromIso: effectiveIso,
        summary: `Published policy v${published.version} effective ${effectiveIso}`,
      },
      correlationId: input.correlationId,
    });

    return { policyVersionId: published.id, version: published.version };
  });
}

export async function rotateCheckpointCredential(
  input: RotateCheckpointInput,
): Promise<RotateCheckpointResult> {
  const qrConfig = loadQrKeyringConfig();
  const activeSecret = qrConfig.keyring[qrConfig.activeKid]!;

  const days = input.expiresInDays ?? DEFAULT_QR_EXPIRY_DAYS;
  if (!input.expiresAtUtc && (!Number.isInteger(days) || days < 1 || days > 365)) {
    throw new AppError(400, "INVALID_EXPIRY", "QR expiry lifetime must be between 1 and 365 days.", false);
  }
  const expiresAtUtc = input.expiresAtUtc ?? new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  if (expiresAtUtc.getTime() <= Date.now()) {
    throw new AppError(400, "INVALID_EXPIRY", "QR expiry must be in the future.", false);
  }

  return prisma.$transaction(async (tx) => {
    const checkpoint = await tx.qrCheckpoint.findUnique({ where: { id: input.checkpointId } });
    if (!checkpoint) {
      throw new AppError(404, "CHECKPOINT_NOT_FOUND", "QR checkpoint not found.", false);
    }
    if (!checkpoint.active) {
      throw new AppError(409, "CHECKPOINT_REVOKED", "Cannot rotate a revoked checkpoint.", false);
    }

    const updated = await tx.qrCheckpoint.update({
      where: { id: checkpoint.id },
      data: {
        credentialVersion: { increment: 1 },
        credentialExpiresAtUtc: expiresAtUtc,
      },
    });

    const qrToken = await signQrCredential(
      {
        iss: qrConfig.issuer,
        aud: qrConfig.audience,
        kid: qrConfig.activeKid,
        checkpointId: updated.id,
        action: updated.action,
        credentialVersion: updated.credentialVersion,
        expiresAtUtc,
      },
      activeSecret,
    );

    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "checkpoint.rotated",
      resourceType: "qr_checkpoint",
      resourceId: updated.id,
      beforeValues: {
        credentialVersion: checkpoint.credentialVersion,
      },
      afterValues: {
        credentialVersion: updated.credentialVersion,
        expiresAtUtc: expiresAtUtc.toISOString(),
        summary: `Rotated ${updated.name} (${updated.action}) to v${updated.credentialVersion}`,
      },
      correlationId: input.correlationId,
    });

    return {
      checkpointId: updated.id,
      credentialVersion: updated.credentialVersion,
      codeVersion: updated.credentialVersion,
      expiresAtUtc: expiresAtUtc.toISOString(),
      qrToken,
    };
  });
}

/** Issue a signed printable QR token for an active checkpoint (HR print page). */
export async function issueCheckpointToken(
  checkpointId: string,
): Promise<{ readonly checkpoint: CheckpointVM; readonly token: string; readonly officeName: string } | null> {
  const checkpoint = await prisma.qrCheckpoint.findUnique({
    where: { id: checkpointId },
    include: { office: true },
  });
  if (!checkpoint || !checkpoint.active) return null;

  const qrConfig = loadQrKeyringConfig();
  const activeSecret = qrConfig.keyring[qrConfig.activeKid]!;
  const expiresAtUtc =
    checkpoint.credentialExpiresAtUtc && checkpoint.credentialExpiresAtUtc.getTime() > Date.now()
      ? checkpoint.credentialExpiresAtUtc
      : new Date(Date.now() + DEFAULT_QR_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const token = await signQrCredential(
    {
      iss: qrConfig.issuer,
      aud: qrConfig.audience,
      kid: qrConfig.activeKid,
      checkpointId: checkpoint.id,
      action: checkpoint.action,
      credentialVersion: checkpoint.credentialVersion,
      expiresAtUtc,
    },
    activeSecret,
  );

  return {
    checkpoint: mapCheckpoint(checkpoint, checkpoint.office.timezone),
    token,
    officeName: checkpoint.office.name,
  };
}

export async function createCheckpoint(input: CreateCheckpointInput): Promise<CreateCheckpointResult> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    throw new AppError(400, "VALIDATION_ERROR", "Checkpoint name must be between 2 and 80 characters.", false);
  }
  const days = input.expiresInDays ?? DEFAULT_QR_EXPIRY_DAYS;
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new AppError(400, "INVALID_EXPIRY", "QR expiry lifetime must be between 1 and 365 days.", false);
  }
  const expiresAtUtc = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const office = input.officeId
      ? await tx.office.findUnique({ where: { id: input.officeId } })
      : await tx.office.findFirst({ orderBy: { createdAt: "asc" } });
    if (!office) {
      throw new AppError(404, "OFFICE_NOT_FOUND", "Office not found.", false);
    }

    const created = await tx.qrCheckpoint.create({
      data: {
        officeId: office.id,
        name,
        action: input.action,
        active: true,
        credentialVersion: 1,
        credentialExpiresAtUtc: expiresAtUtc,
      },
    });

    const expiresIso = officeDateIso(expiresAtUtc, office.timezone);
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "checkpoint.created",
      resourceType: "qr_checkpoint",
      resourceId: created.id,
      afterValues: {
        name: created.name,
        action: created.action,
        credentialVersion: created.credentialVersion,
        expiresIso,
        summary: `Added ${created.name} (${created.action === "TIME_IN" ? "IN" : "OUT"}) checkpoint`,
      },
      correlationId: input.correlationId,
    });

    return {
      id: created.id,
      name: created.name,
      action: created.action === "TIME_IN" ? "IN" : "OUT",
      codeVersion: created.credentialVersion,
      expiresIso,
    };
  });
}

export async function revokeCheckpoint(input: RevokeCheckpointInput): Promise<RevokeCheckpointResult> {
  return prisma.$transaction(async (tx) => {
    const checkpoint = await tx.qrCheckpoint.findUnique({
      where: { id: input.checkpointId },
      include: { office: true },
    });
    if (!checkpoint) {
      throw new AppError(404, "CHECKPOINT_NOT_FOUND", "QR checkpoint not found.", false);
    }
    if (!checkpoint.active) {
      throw new AppError(409, "ALREADY_REVOKED", "This QR checkpoint is already revoked.", false);
    }

    const revokedAt = new Date();
    const updated = await tx.qrCheckpoint.update({
      where: { id: checkpoint.id },
      data: {
        active: false,
        revokedAtUtc: revokedAt,
        credentialVersion: { increment: 1 },
      },
    });

    const revokedIso = officeDateIso(revokedAt, checkpoint.office.timezone);
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "checkpoint.revoked",
      resourceType: "qr_checkpoint",
      resourceId: updated.id,
      beforeValues: { active: true, credentialVersion: checkpoint.credentialVersion },
      afterValues: {
        active: false,
        credentialVersion: updated.credentialVersion,
        revokedIso,
        summary: `Permanently revoked ${updated.name} (${updated.action === "TIME_IN" ? "IN" : "OUT"})`,
      },
      correlationId: input.correlationId,
    });

    return { id: updated.id, revokedIso };
  });
}

/** Rotate every active checkpoint for the office together (monthly printable swap). */
export async function rotateAllActiveCheckpoints(
  input: RotateAllCheckpointsInput,
): Promise<RotateAllCheckpointsResult> {
  const days = input.expiresInDays ?? DEFAULT_QR_EXPIRY_DAYS;
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new AppError(400, "INVALID_EXPIRY", "QR expiry lifetime must be between 1 and 365 days.", false);
  }
  const expiresAtUtc = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const office = input.officeId
      ? await tx.office.findUnique({ where: { id: input.officeId } })
      : await tx.office.findFirst({ orderBy: { createdAt: "asc" } });
    if (!office) {
      throw new AppError(404, "OFFICE_NOT_FOUND", "Office not found.", false);
    }

    const activeCheckpoints = await tx.qrCheckpoint.findMany({
      where: { officeId: office.id, active: true },
      orderBy: [{ action: "asc" }, { createdAt: "asc" }],
    });
    if (activeCheckpoints.length === 0) {
      throw new AppError(404, "NO_ACTIVE_CHECKPOINTS", "There are no active QR checkpoints to rotate.", false);
    }

    const rotated: { id: string; name: string; action: "IN" | "OUT"; codeVersion: number }[] = [];
    for (const cp of activeCheckpoints) {
      const updated = await tx.qrCheckpoint.update({
        where: { id: cp.id },
        data: {
          credentialVersion: { increment: 1 },
          credentialExpiresAtUtc: expiresAtUtc,
        },
      });
      rotated.push({
        id: updated.id,
        name: updated.name,
        action: updated.action === "TIME_IN" ? "IN" : "OUT",
        codeVersion: updated.credentialVersion,
      });
    }

    const expiresIso = officeDateIso(expiresAtUtc, office.timezone);
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "checkpoint.rotated_all",
      resourceType: "office",
      resourceId: office.id,
      afterValues: {
        rotatedCount: rotated.length,
        expiresIso,
        checkpoints: rotated.map((c) => `${c.name} ${c.action} v${c.codeVersion}`),
        summary: `Rotated all ${rotated.length} active QR checkpoints (valid until ${expiresIso})`,
      },
      correlationId: input.correlationId,
    });

    return {
      rotatedCount: rotated.length,
      expiresIso,
      checkpoints: rotated,
    };
  });
}

/** Issue signed printable QR tokens for every active checkpoint in the primary office. */
export async function issueAllActiveCheckpointTokens(officeId?: string): Promise<{
  readonly officeName: string;
  readonly items: readonly { readonly checkpoint: CheckpointVM; readonly token: string }[];
}> {
  const office = officeId
    ? await prisma.office.findUnique({ where: { id: officeId } })
    : await prisma.office.findFirst({ orderBy: { createdAt: "asc" } });
  if (!office) {
    throw new AppError(503, "OFFICE_NOT_CONFIGURED", "No office record has been seeded yet.", false);
  }

  const activeCheckpoints = await prisma.qrCheckpoint.findMany({
    where: { officeId: office.id, active: true },
    orderBy: [{ action: "asc" }, { createdAt: "asc" }],
  });

  const qrConfig = loadQrKeyringConfig();
  const activeSecret = qrConfig.keyring[qrConfig.activeKid]!;
  const items: { checkpoint: CheckpointVM; token: string }[] = [];

  for (const cp of activeCheckpoints) {
    const expiresAtUtc =
      cp.credentialExpiresAtUtc && cp.credentialExpiresAtUtc.getTime() > Date.now()
        ? cp.credentialExpiresAtUtc
        : new Date(Date.now() + DEFAULT_QR_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const token = await signQrCredential(
      {
        iss: qrConfig.issuer,
        aud: qrConfig.audience,
        kid: qrConfig.activeKid,
        checkpointId: cp.id,
        action: cp.action,
        credentialVersion: cp.credentialVersion,
        expiresAtUtc,
      },
      activeSecret,
    );
    items.push({ checkpoint: mapCheckpoint(cp, office.timezone), token });
  }

  return { officeName: office.name, items };
}
