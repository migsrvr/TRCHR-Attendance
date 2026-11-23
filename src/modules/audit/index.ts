/**
 * Append-only Audit module (Technical Design v1.0 sections 3, 10, 12, 13).
 *
 * Strips sensitive values (coordinates, passwords, tokens, raw correction prose)
 * before storing audit before/after snapshots. Never modifies or deletes rows.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db";
import { formatClock, officeDateIso } from "@/lib/ui/format";
import type { AuditCategory, AuditEntryVM, AuditLogVM } from "@/lib/ui/view-models";

export type DbClient = PrismaClient | Prisma.TransactionClient;

const AUDIT_STRIP_KEY =
  /password|secret|token|cookie|authorization|latitude|longitude|coords|coordinates|locationevidence|explanation|reason|apikey|api_key/i;

export function redactAuditValues(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (depth > 6) return "[DEPTH_LIMIT]";
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === null ? null : redactAuditValues(item, depth + 1)))
      .filter((item): item is Prisma.InputJsonValue | null => item !== undefined);
  }
  if (typeof value === "object") {
    const out: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (AUDIT_STRIP_KEY.test(key)) continue;
      if (entry === null) {
        out[key] = null;
        continue;
      }
      const cleaned = redactAuditValues(entry, depth + 1);
      if (cleaned !== undefined) {
        out[key] = cleaned;
      }
    }
    return out;
  }
  return String(value);
}

export interface RecordAuditEventInput {
  readonly actorId?: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string | null;
  readonly beforeValues?: unknown;
  readonly afterValues?: unknown;
  readonly correlationId: string;
}

export async function recordAuditEvent(db: DbClient, input: RecordAuditEventInput): Promise<void> {
  const beforeValues = redactAuditValues(input.beforeValues);
  const afterValues = redactAuditValues(input.afterValues);
  await db.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      ...(beforeValues !== undefined ? { beforeValues } : {}),
      ...(afterValues !== undefined ? { afterValues } : {}),
      correlationId: input.correlationId,
    },
  });
}

const VALID_CATEGORIES: readonly AuditCategory[] = [
  "office",
  "qr",
  "policy",
  "accounts",
  "corrections",
  "attendance",
];

function categoryForResource(resourceType: string, action: string): AuditCategory {
  if (resourceType === "office" || action.startsWith("office.")) return "office";
  if (resourceType === "qr_checkpoint" || action.startsWith("checkpoint.")) return "qr";
  if (resourceType === "policy" || resourceType === "attendance_policy_version" || action.startsWith("policy.")) {
    return "policy";
  }
  if (
    resourceType === "correction_request" ||
    resourceType === "hr_review" ||
    action.startsWith("correction.") ||
    action.startsWith("review.")
  ) {
    return "corrections";
  }
  if (
    resourceType === "attendance_session" ||
    resourceType === "attendance_scan" ||
    resourceType === "report" ||
    action.startsWith("attendance.") ||
    action.startsWith("dtr.")
  ) {
    return "attendance";
  }
  return "accounts";
}

function recordHref(resourceType: string, resourceId: string | null): string | undefined {
  if (!resourceId) return undefined;
  switch (resourceType) {
    case "user":
    case "internship":
      return `/hr/interns/${resourceId}`;
    case "correction_request":
      return `/hr/reviews/${resourceId}`;
    case "attendance_session":
      return `/hr/attendance?session=${encodeURIComponent(resourceId)}`;
    case "office":
    case "qr_checkpoint":
      return "/hr/setup";
    case "attendance_policy_version":
    case "policy":
      return "/hr/setup/policies";
    case "department":
      return "/hr/setup/departments";
    default:
      return undefined;
  }
}

function summarizeChange(beforeValues: unknown, afterValues: unknown, action: string): string {
  const after = typeof afterValues === "object" && afterValues !== null ? (afterValues as Record<string, unknown>) : null;
  if (after && typeof after.summary === "string") return after.summary;
  if (after) {
    const pairs = Object.entries(after)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${String(v)}`);
    if (pairs.length > 0) return pairs.join(" · ");
  }
  const before = typeof beforeValues === "object" && beforeValues !== null ? (beforeValues as Record<string, unknown>) : null;
  if (before) {
    return `Updated from ${Object.keys(before).slice(0, 3).join(", ")}`;
  }
  return action;
}

function buildDetail(
  beforeValues: unknown,
  afterValues: unknown,
  correlationId: string,
): AuditEntryVM["detail"] | undefined {
  const before = typeof beforeValues === "object" && beforeValues !== null ? (beforeValues as Record<string, unknown>) : null;
  const after = typeof afterValues === "object" && afterValues !== null ? (afterValues as Record<string, unknown>) : null;
  if (!before && !after) return undefined;
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  const rows = keys
    .filter((key) => key !== "summary")
    .map((key) => ({
      label: key,
      before: before && key in before ? String(before[key] ?? "—") : "—",
      after: after && key in after ? String(after[key] ?? "—") : "—",
    }))
    .filter((row) => row.before !== row.after);

  if (rows.length === 0) return undefined;
  return {
    rows,
    facts: [{ label: "Correlation ID", value: correlationId }],
  };
}

export async function listAuditEntries(filters: {
  readonly query?: string;
  readonly who?: string;
  readonly category?: string;
  readonly from?: string;
  readonly to?: string;
  readonly cursor?: string;
  readonly limit?: number;
}): Promise<AuditLogVM & { readonly nextCursor: string | null; readonly timeZone: string }> {
  const office = await prisma.office.findFirst({ select: { timezone: true } });
  const timeZone = office?.timezone ?? "Asia/Manila";

  const query = (filters.query ?? "").trim();
  const who = filters.who === "hr" || filters.who === "system" ? filters.who : "anyone";
  const category: AuditCategory | "all" = VALID_CATEGORIES.includes(filters.category as AuditCategory)
    ? (filters.category as AuditCategory)
    : "all";
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);

  const where: Prisma.AuditEventWhereInput = {};
  if (who === "system") where.actorId = null;
  if (who === "hr") where.actor = { role: "HR" };
  if (filters.from || filters.to) {
    where.occurredAtUtc = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00Z`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
    };
  }

  const [total, rawRows] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      include: { actor: { select: { name: true, role: true } } },
      orderBy: [{ occurredAtUtc: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    }),
  ]);

  const hasMore = rawRows.length > limit;
  const pageRows = hasMore ? rawRows.slice(0, limit) : rawRows;
  const nextCursor = hasMore ? (pageRows.at(-1)?.id ?? null) : null;

  const needle = query.toLowerCase();
  const entries: AuditEntryVM[] = pageRows
    .map((row): AuditEntryVM => {
      const cat = categoryForResource(row.resourceType, row.action);
      const datePart = officeDateIso(row.occurredAtUtc, timeZone);
      const timePart = formatClock(row.occurredAtUtc, timeZone);
      const label = row.resourceId ? `${row.resourceType} · ${row.resourceId.slice(0, 8)}` : row.resourceType;
      return {
        id: row.id,
        at: `${datePart} ${timePart}`,
        actor: row.actor
          ? { kind: "hr", name: row.actor.name }
          : { kind: "system", name: "System" },
        action: row.action,
        category: cat,
        record: { label, href: recordHref(row.resourceType, row.resourceId) },
        change: summarizeChange(row.beforeValues, row.afterValues, row.action),
        detail: buildDetail(row.beforeValues, row.afterValues, row.correlationId),
      };
    })
    .filter((entry) => {
      if (category !== "all" && entry.category !== category) return false;
      if (!needle) return true;
      return `${entry.record.label} ${entry.action} ${entry.change} ${entry.actor.name}`
        .toLowerCase()
        .includes(needle);
    });

  const search = new URLSearchParams();
  if (query) search.set("q", query);
  if (who !== "anyone") search.set("who", who);
  if (category !== "all") search.set("category", category);
  if (filters.from) search.set("from", filters.from);
  if (filters.to) search.set("to", filters.to);

  return {
    query,
    who,
    category,
    entries,
    total: query || category !== "all" ? entries.length : total,
    exportHref: `/hr/audit/export${search.size ? `?${search}` : ""}`,
    nextCursor,
    timeZone,
  };
}
