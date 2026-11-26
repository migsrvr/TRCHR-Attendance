/**
 * Reports module (Technical Design v1.0 section 12).
 *
 * Builds DTR previews and CSV exports inside a short REPEATABLE READ snapshot
 * transaction, reusing the canonical deterministic calculation engine, enforcing
 * the 10,000-row cap, and recording export audit events with a SHA-256 content hash.
 */

import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCachedDepartments, getCachedOfficeMetadata } from "@/lib/db/cache";
import { AppError } from "@/lib/http/errors";
import { hrReasonLabel } from "@/lib/ui/correction-form";
import { toCsv as toRfc4180Csv } from "@/lib/ui/csv";
import { datesBetween, defaultPeriod, dtrSearch, formatRange, isWeekend, parseDtrScope, workdaysBetween } from "@/lib/ui/dtr";
import { dtrCsv } from "@/lib/ui/dtr-csv";
import { formatClock, officeDateIso } from "@/lib/ui/format";
import { clockToMinutes } from "@/lib/ui/timeline";
import type {
  DtrDayVM,
  DtrDepartmentReportVM,
  DtrInternReportVM,
  DtrPageVM,
} from "@/lib/ui/view-models";
import { aggregateDayCredits, dateToIso } from "@/modules/attendance/credit";
import { recordAuditEvent } from "@/modules/audit";

export const MAX_DTR_EXPORT_ROWS = 10_000;

export interface DtrFilter {
  readonly internshipId?: string;
  readonly departmentId?: string;
  readonly fromDate: string;
  readonly toDate: string;
}

export interface DtrRow {
  readonly internshipId: string;
  readonly attendanceDate: string;
  readonly creditedMinutes: number;
  readonly requiredMinutes: number;
  readonly remainingMinutes: number;
  readonly timezone: string;
  readonly policyVersion: number;
}

export async function buildDtrRows(filter: DtrFilter): Promise<readonly DtrRow[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filter.fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(filter.toDate)) {
    throw new AppError(400, "INVALID_RANGE", "fromDate and toDate must be YYYY-MM-DD.", false);
  }

  return prisma.$transaction(
    async (tx) => {
      const internships = await tx.internship.findMany({
        where: {
          ...(filter.internshipId ? { id: filter.internshipId } : {}),
          ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
        },
        include: {
          office: { select: { timezone: true } },
          sessions: {
            include: { policyVersion: true },
            orderBy: [{ attendanceDate: "asc" }, { effectiveTimeInUtc: "asc" }],
          },
        },
      });

      const rows: DtrRow[] = [];
      for (const internship of internships) {
        const allCredits = aggregateDayCredits(
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

        const inRangeDates = Array.from(
          new Set(
            internship.sessions
              .map((s) => dateToIso(s.attendanceDate))
              .filter((d) => d >= filter.fromDate && d <= filter.toDate),
          ),
        ).sort();

        for (const dateIso of inRangeDates) {
          const daySession = internship.sessions.find((s) => dateToIso(s.attendanceDate) === dateIso);
          rows.push({
            internshipId: internship.id,
            attendanceDate: dateIso,
            creditedMinutes: allCredits.byDate.get(dateIso)?.creditedMinutes ?? 0,
            requiredMinutes: internship.requiredMinutes,
            remainingMinutes: allCredits.remainingMinutes,
            timezone: daySession?.timezoneSnapshot ?? internship.office.timezone,
            policyVersion: daySession?.policyVersion.version ?? 1,
          });
          if (rows.length > MAX_DTR_EXPORT_ROWS) {
            throw new AppError(
              422,
              "EXPORT_TOO_LARGE",
              `Export exceeds the ${MAX_DTR_EXPORT_ROWS}-row cap. Narrow the date range or department filter.`,
              false,
            );
          }
        }
      }

      return rows;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export function toCsv(rows: readonly DtrRow[]): string {
  return toRfc4180Csv([
    [
      "Internship ID",
      "Attendance Date",
      "Credited Minutes",
      "Required Minutes",
      "Remaining Minutes",
      "Timezone",
      "Policy Version",
    ],
    ...rows.map((r) => [
      r.internshipId,
      r.attendanceDate,
      String(r.creditedMinutes),
      String(r.requiredMinutes),
      String(r.remainingMinutes),
      r.timezone,
      String(r.policyVersion),
    ]),
  ]);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export async function buildDtrPage(
  params: Record<string, string | undefined>,
  options: { readonly actorId?: string; readonly correlationId?: string; readonly recordExportAudit?: boolean } = {},
): Promise<DtrPageVM> {
  // Normalize legacy ?intern=<id> query param to subject=<id>
  const normalizedParams: Record<string, string | undefined> = {
    ...params,
    subject: params.subject ?? params.intern,
  };

  const page = await prisma.$transaction(
    async (tx): Promise<DtrPageVM> => {
      // Phase 1 (Lightweight Subject Picker): fetch only intern names & departments,
      // NOT every intern's lifetime sessions and correction requests.
      const [office, departments, subjectRows] = await Promise.all([
        getCachedOfficeMetadata(),
        getCachedDepartments(),
        tx.internship.findMany({
          where: { intern: { status: { not: "PENDING" } } },
          select: {
            id: true,
            intern: { select: { id: true, name: true } },
            department: { select: { name: true } },
          },
          orderBy: { intern: { name: "asc" } },
        }),
      ]);

      const timeZone = office?.timezone ?? "Asia/Manila";
      const now = new Date();
      const todayIso = officeDateIso(now, timeZone);
      const nowClock = formatClock(now, timeZone);
      const policyLabel = office?.latestPolicyVersion ? `Policy v${office.latestPolicyVersion}` : "No active policy";
      const deptNames = departments.map((d) => d.name);

      const defaultInternId = subjectRows[0]?.intern.id ?? "";
      const parsed = parseDtrScope(normalizedParams, { todayIso, defaultInternId });
      const subject = parsed.scope.subject;
      const known =
        subject.kind === "intern"
          ? subjectRows.some((i) => i.intern.id === subject.id)
          : deptNames.includes(subject.name);

      const scope =
        known || !defaultInternId
          ? parsed.scope
          : { ...parsed.scope, subject: { kind: "intern" as const, id: defaultInternId } };

      const range = parsed.error ? defaultPeriod(todayIso) : { from: scope.from, to: scope.to };
      const workdays = workdaysBetween(range.from, range.to);
      const subtitleTail = `${policyLabel} · ${timeZone} · generated ${todayIso} ${nowClock}`;

      // Phase 2 (Scoped Hydration): fetch sessions & corrections ONLY for the selected intern or department.
      const internships =
        subjectRows.length === 0
          ? []
          : await tx.internship.findMany({
              where:
                scope.subject.kind === "intern"
                  ? { internUserId: scope.subject.id }
                  : { intern: { status: { not: "PENDING" } }, department: { name: scope.subject.name } },
              include: {
                intern: { select: { id: true, name: true } },
                department: { select: { name: true } },
                sessions: { include: { policyVersion: true }, orderBy: [{ attendanceDate: "asc" }, { effectiveTimeInUtc: "asc" }] },
                correctionRequests: { where: { status: { not: "SUPERSEDED" } }, orderBy: { submittedAtUtc: "desc" } },
              },
              orderBy: { intern: { name: "asc" } },
            });

      const buildInternDays = (internship: (typeof internships)[number]): { days: DtrDayVM[]; remainingMinutes: number } => {
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

        const endCap = range.to > todayIso ? todayIso : range.to;
        const allDates = range.from <= endCap ? datesBetween(range.from, endCap) : [];
        const days: DtrDayVM[] = [];

        for (const dateIso of allDates) {
          const daySessions = internship.sessions.filter((s) => dateToIso(s.attendanceDate) === dateIso);
          const corr = internship.correctionRequests.find((c) => dateToIso(c.attendanceDate) === dateIso);

          if (daySessions.length === 0 && !corr) {
            if (!isWeekend(dateIso)) {
              days.push({ dateIso, sessions: [], state: "none", creditedMinutes: 0, rawMinutes: null });
            }
            continue;
          }

          const hasOpen = daySessions.some((s) => s.status === "OPEN");
          const hasReview = daySessions.some((s) => s.status === "REVIEW");
          const hasComplete = daySessions.some((s) => s.status === "COMPLETE");
          const hasOpenCorr = corr && (corr.status === "PENDING" || corr.status === "NEEDS_INFO");

          const sessionsVm = daySessions
            .filter((s) => s.effectiveTimeInUtc)
            .map((s) => ({
              start: formatClock(s.effectiveTimeInUtc!, s.timezoneSnapshot),
              end: s.effectiveTimeOutUtc ? formatClock(s.effectiveTimeOutUtc, s.timezoneSnapshot) : null,
            }));

          const closed = sessionsVm.every((s) => s.end);
          const rawMinutes =
            closed && sessionsVm.length
              ? sessionsVm.reduce((sum, s) => sum + clockToMinutes(s.end!) - clockToMinutes(s.start), 0)
              : null;

          const dayCredit = credits.byDate.get(dateIso);
          const state: DtrDayVM["state"] = hasOpen
            ? "open"
            : hasReview || (!hasComplete && hasOpenCorr)
              ? "pending"
              : hasComplete
                ? "credited"
                : "none";

          days.push({
            dateIso,
            sessions: sessionsVm,
            state,
            creditedMinutes: state === "credited" ? (dayCredit?.creditedMinutes ?? 0) : 0,
            rawMinutes,
            note: dayCredit?.capped ? "Daily cap applied" : dayCredit?.clipped ? "Clipped to schedule" : undefined,
            correction: corr
              ? {
                  status: { type: "correction", value: corr.status },
                  href: `/hr/reviews/${corr.id}`,
                  label: corr.status === "APPROVED" ? "Approved correction" : "Correction open",
                }
              : undefined,
          });
        }

        return { days, remainingMinutes: credits.remainingMinutes };
      };

      let report: DtrInternReportVM | DtrDepartmentReportVM;
      let title: string;
      let subtitle: string;
      let estimatedRowCount = 0;

      if (scope.subject.kind === "intern") {
        const subjectInternId = scope.subject.id;
        const target = internships.find((i) => i.intern.id === subjectInternId);
        if (!target) {
          report = {
            kind: "intern",
            intern: { id: "", name: "No active interns", department: "—" },
            days: [],
            creditedMinutes: 0,
            daysCredited: 0,
            workdays,
            pending: [],
            remainingMinutes: 0,
          };
          title = `DTR · ${formatRange(range.from, range.to)}`;
          subtitle = subtitleTail;
        } else {
          const { days: allDays, remainingMinutes } = buildInternDays(target);
          estimatedRowCount = allDays.length;
          const pendingDays = allDays.filter((d) => d.state === "pending");

          report = {
            kind: "intern",
            intern: { id: target.intern.id, name: target.intern.name, department: target.department.name },
            days: scope.includePending ? allDays : allDays.filter((d) => d.state === "credited" || d.state === "none"),
            creditedMinutes: allDays.reduce((sum, d) => sum + d.creditedMinutes, 0),
            daysCredited: allDays.filter((d) => d.state === "credited" && d.creditedMinutes > 0).length,
            workdays,
            pending: pendingDays.map((d) => {
              const corr = target.correctionRequests.find(
                (c) => dateToIso(c.attendanceDate) === d.dateIso && (c.status === "PENDING" || c.status === "NEEDS_INFO"),
              );
              return {
                dateIso: d.dateIso,
                reason: corr ? hrReasonLabel(corr.reasonCategory.toLowerCase() as never).toLowerCase() : "held session",
                href: d.correction?.href ?? `/hr/attendance?intern=${encodeURIComponent(target.intern.id)}`,
              };
            }),
            remainingMinutes,
          };
          title = `${target.intern.name} · ${formatRange(range.from, range.to)}`;
          subtitle = `${target.department.name} · ${subtitleTail}`;
        }
      } else {
        const deptName = scope.subject.name;
        const deptInternships = internships.filter((i) => i.department.name === deptName);
        const rows = deptInternships.map((internship) => {
          const { days } = buildInternDays(internship);
          estimatedRowCount += days.length;
          return {
            id: internship.intern.id,
            name: internship.intern.name,
            creditedMinutes: days.reduce((sum, d) => sum + d.creditedMinutes, 0),
            daysCredited: days.filter((d) => d.state === "credited" && d.creditedMinutes > 0).length,
            pendingCount: days.filter((d) => d.state === "pending").length,
          };
        });

        report = {
          kind: "department",
          department: deptName,
          interns: rows,
          creditedMinutes: rows.reduce((sum, r) => sum + r.creditedMinutes, 0),
          workdays,
          pendingCount: rows.reduce((sum, r) => sum + r.pendingCount, 0),
        };
        title = `${deptName} · ${formatRange(range.from, range.to)}`;
        subtitle = `${plural(rows.length, "intern")} · ${subtitleTail}`;
      }

      if (estimatedRowCount > MAX_DTR_EXPORT_ROWS) {
        throw new AppError(
          422,
          "EXPORT_TOO_LARGE",
          `DTR exceeds the ${MAX_DTR_EXPORT_ROWS}-row limit. Narrow the period or filter.`,
          false,
        );
      }

      return {
        scope,
        rangeError: parsed.error,
        subjects: [
          ...subjectRows.map((i) => ({ value: i.intern.id, label: `${i.intern.name} · ${i.department.name}` })),
          ...deptNames.map((name) => ({ value: `department:${name}`, label: `All interns in ${name}` })),
        ],
        title,
        subtitle,
        report,
        exportHref: `/hr/reports/export?${dtrSearch(parsed.error ? { ...scope, ...range } : scope)}`,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  // Record export audit log after the repeatable-read snapshot closes
  if (options.recordExportAudit && options.correlationId && !page.rangeError) {
    const csvText = dtrCsv(page);
    const contentHash = createHash("sha256").update(csvText).digest("hex");
    await recordAuditEvent(prisma, {
      actorId: options.actorId ?? null,
      action: "dtr.exported",
      resourceType: "report",
      afterValues: {
        subject: page.scope.subject.kind === "intern" ? page.scope.subject.id : `department:${page.scope.subject.name}`,
        from: page.scope.from,
        to: page.scope.to,
        contentHash,
        summary: `Exported DTR CSV (${page.title})`,
      },
      correlationId: options.correlationId,
    }).catch(() => undefined);
  }

  return page;
}
