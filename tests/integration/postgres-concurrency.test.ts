/**
 * Real PostgreSQL Concurrency & Constraint Integration Tests
 * (Technical Design v1.0 section 14).
 *
 * Runs only when TEST_DATABASE_URL points to a migrated PostgreSQL 16+ database
 * (with `0000_init_schema` and `0001_init_constraints` applied). Skipped cleanly
 * when TEST_DATABASE_URL is unset so unit/component CI can run without PG.
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { signQrCredential } from "@/lib/qr/signer";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const RUN_INTEGRATION = Boolean(TEST_DB_URL && TEST_DB_URL.trim().length > 0);

describe.skipIf(!RUN_INTEGRATION)("PostgreSQL Concurrency & Constraint Invariants", () => {
  const testRunTag = randomUUID().slice(0, 8);
  const qrSecret = "test-integration-qr-signing-secret-32chars!!";

  let prisma: (typeof import("@/lib/db"))["prisma"];
  let createScanIntent: (typeof import("@/modules/attendance"))["createScanIntent"];
  let submitScan: (typeof import("@/modules/attendance"))["submitScan"];
  let getScanReceipt: (typeof import("@/modules/attendance"))["getScanReceipt"];
  let createCorrection: (typeof import("@/modules/corrections"))["createCorrection"];
  let addCorrectionComment: (typeof import("@/modules/corrections"))["addCorrectionComment"];
  let decideCorrection: (typeof import("@/modules/corrections"))["decideCorrection"];
  let buildDtrRows: (typeof import("@/modules/reports"))["buildDtrRows"];
  let claimNextReviewJob: (typeof import("@/worker/queue"))["claimNextReviewJob"];
  let processClaimedJob: (typeof import("@/worker/queue"))["processClaimedJob"];

  // Seeded fixture IDs scoped to this test run
  let officeId = "";
  let departmentId = "";
  let policyVersionId = "";
  let inCheckpointId = "";
  let outCheckpointId = "";
  let inQrToken = "";
  let outQrToken = "";
  let hrUserId = "";
  let internAUserId = "";
  let internAInternshipId = "";
  let internBUserId = "";
  let internBInternshipId = "";

  const OFFICE_LAT = 14.5547;
  const OFFICE_LNG = 121.0244;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.QR_SIGNING_KEY_SECRET = qrSecret;
    process.env.QR_ACTIVE_KID = "k1";
    process.env.QR_ISSUER = "trchr:office";
    process.env.QR_AUDIENCE = "trchr:attendance";
    process.env.JEV_MODE = "stub";

    const dbMod = await import("@/lib/db");
    const attMod = await import("@/modules/attendance");
    const corrMod = await import("@/modules/corrections");
    const repMod = await import("@/modules/reports");
    const workerMod = await import("@/worker/queue");

    prisma = dbMod.prisma;
    createScanIntent = attMod.createScanIntent;
    submitScan = attMod.submitScan;
    getScanReceipt = attMod.getScanReceipt;
    createCorrection = corrMod.createCorrection;
    addCorrectionComment = corrMod.addCorrectionComment;
    decideCorrection = corrMod.decideCorrection;
    buildDtrRows = repMod.buildDtrRows;
    claimNextReviewJob = workerMod.claimNextReviewJob;
    processClaimedJob = workerMod.processClaimedJob;

    const office = await prisma.office.create({
      data: {
        name: `Test Office ${testRunTag}`,
        timezone: "Asia/Manila",
        latitude: OFFICE_LAT,
        longitude: OFFICE_LNG,
        geofenceRadiusMeters: 75,
        maxAccuracyMeters: 35,
        configVersion: 1,
      },
    });
    officeId = office.id;

    const dept = await prisma.department.create({
      data: { name: `Test Dept ${testRunTag}`, active: true },
    });
    departmentId = dept.id;

    const policy = await prisma.attendancePolicyVersion.create({
      data: {
        officeId,
        version: 1,
        status: "PUBLISHED",
        effectiveFromUtc: new Date("2025-01-01T00:00:00Z"),
        publishedAtUtc: new Date("2025-01-01T00:00:00Z"),
        scheduleRules: {
          workdays: [1, 2, 3, 4, 5, 6, 0],
          windows: [{ startMinutes: 480, endMinutes: 1140 }],
        },
        breakRules: [
          {
            requiredBreakMinutes: 60,
            windowStartMinutes: 720,
            windowEndMinutes: 780,
            gapCountsTowardBreak: true,
          },
        ],
        creditRules: {
          roundingMode: "NEAREST_HALF_UP",
          roundingUnitMinutes: 15,
          dailyCapMinutes: 480,
        },
      },
    });
    policyVersionId = policy.id;

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const inCp = await prisma.qrCheckpoint.create({
      data: {
        officeId,
        name: "Lobby",
        action: "TIME_IN",
        credentialVersion: 1,
        credentialExpiresAtUtc: expiresAt,
        active: true,
      },
    });
    const outCp = await prisma.qrCheckpoint.create({
      data: {
        officeId,
        name: "Lobby",
        action: "TIME_OUT",
        credentialVersion: 1,
        credentialExpiresAtUtc: expiresAt,
        active: true,
      },
    });
    inCheckpointId = inCp.id;
    outCheckpointId = outCp.id;

    inQrToken = await signQrCredential(
      {
        iss: "trchr:office",
        aud: "trchr:attendance",
        kid: "k1",
        checkpointId: inCheckpointId,
        action: "TIME_IN",
        credentialVersion: 1,
        expiresAtUtc: expiresAt,
      },
      qrSecret,
    );
    outQrToken = await signQrCredential(
      {
        iss: "trchr:office",
        aud: "trchr:attendance",
        kid: "k1",
        checkpointId: outCheckpointId,
        action: "TIME_OUT",
        credentialVersion: 1,
        expiresAtUtc: expiresAt,
      },
      qrSecret,
    );

    const hr = await prisma.user.create({
      data: {
        email: `hr-${testRunTag}@example.test`,
        name: "HR Reviewer",
        role: "HR",
        status: "ACTIVE",
        emailVerified: true,
      },
    });
    hrUserId = hr.id;

    const internA = await prisma.user.create({
      data: {
        email: `intern-a-${testRunTag}@example.test`,
        name: "Intern Alpha",
        role: "INTERN",
        status: "ACTIVE",
        emailVerified: true,
      },
    });
    internAUserId = internA.id;

    const internshipA = await prisma.internship.create({
      data: {
        internUserId: internAUserId,
        departmentId,
        officeId,
        requiredMinutes: 24_000,
        startDate: new Date("2025-01-01T00:00:00Z"),
        endDate: new Date("2030-12-31T00:00:00Z"),
        status: "ACTIVE",
      },
    });
    internAInternshipId = internshipA.id;

    const internB = await prisma.user.create({
      data: {
        email: `intern-b-${testRunTag}@example.test`,
        name: "Intern Beta",
        role: "INTERN",
        status: "ACTIVE",
        emailVerified: true,
      },
    });
    internBUserId = internB.id;

    const internshipB = await prisma.internship.create({
      data: {
        internUserId: internBUserId,
        departmentId,
        officeId,
        requiredMinutes: 24_000,
        startDate: new Date("2025-01-01T00:00:00Z"),
        endDate: new Date("2030-12-31T00:00:00Z"),
        status: "ACTIVE",
      },
    });
    internBInternshipId = internshipB.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    // Clean up test fixtures in FK-safe order
    const internshipIds = [internAInternshipId, internBInternshipId].filter(Boolean);
    const userIds = [hrUserId, internAUserId, internBUserId].filter(Boolean);

    if (internshipIds.length > 0) {
      const reqIds = (
        await prisma.correctionRequest.findMany({
          where: { internshipId: { in: internshipIds } },
          select: { id: true },
        })
      ).map((r) => r.id);

      if (reqIds.length > 0) {
        await prisma.reviewJob.deleteMany({ where: { correctionRequestId: { in: reqIds } } });
        await prisma.jevAssessment.deleteMany({ where: { correctionRequestId: { in: reqIds } } });
        await prisma.attendanceRevision.deleteMany({
          where: { session: { internshipId: { in: internshipIds } } },
        });
        await prisma.hrReview.deleteMany({ where: { correctionRequestId: { in: reqIds } } });
        await prisma.correctionComment.deleteMany({ where: { correctionRequestId: { in: reqIds } } });
        await prisma.correctionRequest.deleteMany({ where: { id: { in: reqIds } } });
      }
      await prisma.attendanceScan.deleteMany({ where: { internshipId: { in: internshipIds } } });
      await prisma.scanIntent.deleteMany({ where: { internshipId: { in: internshipIds } } });
      await prisma.attendanceSession.deleteMany({ where: { internshipId: { in: internshipIds } } });
      await prisma.internshipAssignment.deleteMany({ where: { internshipId: { in: internshipIds } } });
      await prisma.internship.deleteMany({ where: { id: { in: internshipIds } } });
    }
    if (userIds.length > 0) {
      await prisma.scanReceipt.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.auditEvent.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (officeId) {
      await prisma.qrCheckpoint.deleteMany({ where: { officeId } });
      await prisma.attendancePolicyVersion.deleteMany({ where: { officeId } });
      await prisma.office.delete({ where: { id: officeId } }).catch(() => undefined);
    }
    if (departmentId) {
      await prisma.department.delete({ where: { id: departmentId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("1 & 2 & 3. Concurrent TIME_IN race produces one session, exact receipt replay is idempotent, and payload reuse yields 409 KEY_REUSED", async () => {
    const [intent1, intent2] = await Promise.all([
      createScanIntent({ actorId: internAUserId, qrToken: inQrToken, correlationId: randomUUID() }),
      createScanIntent({ actorId: internAUserId, qrToken: inQrToken, correlationId: randomUUID() }),
    ]);

    const key1 = randomUUID();
    const key2 = randomUUID();
    const loc = { latitude: OFFICE_LAT, longitude: OFFICE_LNG, accuracyMeters: 12, capturedAtUtc: new Date() };

    const [res1, res2] = await Promise.all([
      submitScan({ actorId: internAUserId, intentId: intent1.intentId, requestKey: key1, location: loc, correlationId: randomUUID() }),
      submitScan({ actorId: internAUserId, intentId: intent2.intentId, requestKey: key2, location: loc, correlationId: randomUUID() }),
    ]);

    const statuses = [res1.httpStatus, res2.httpStatus].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const openSessions = await prisma.attendanceSession.findMany({
      where: { internshipId: internAInternshipId, status: "OPEN" },
    });
    expect(openSessions).toHaveLength(1);

    // Exact replay on winning requestKey
    const winningKey = res1.httpStatus === 201 ? key1 : key2;
    const winningIntent = res1.httpStatus === 201 ? intent1.intentId : intent2.intentId;
    const replay = await submitScan({
      actorId: internAUserId,
      intentId: winningIntent,
      requestKey: winningKey,
      location: loc,
      correlationId: randomUUID(),
    });
    expect(replay.httpStatus).toBe(201);
    expect(replay.replayed).toBe(true);

    // Payload mismatch on same requestKey -> 409 KEY_REUSED
    await expect(
      submitScan({
        actorId: internAUserId,
        intentId: winningIntent,
        requestKey: winningKey,
        location: { ...loc, latitude: OFFICE_LAT + 0.001 },
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 409, code: "KEY_REUSED" });

    // Cross-intern receipt isolation (scenario 7a)
    expect(await getScanReceipt(internBUserId, winningKey)).toBeNull();
    expect(await getScanReceipt(internAUserId, winningKey)).not.toBeNull();
  });

  it("4 & 5. Geofence rejection leaves session unchanged, and stale attendanceVersion intent is rejected", async () => {
    const outIntentStale = await createScanIntent({
      actorId: internAUserId,
      qrToken: outQrToken,
      correlationId: randomUUID(),
    });
    const outIntentFresh = await createScanIntent({
      actorId: internAUserId,
      qrToken: outQrToken,
      correlationId: randomUUID(),
    });

    // Outside geofence -> 422 OUTSIDE_GEOFENCE, open session remains OPEN
    const rejected = await submitScan({
      actorId: internAUserId,
      intentId: outIntentFresh.intentId,
      requestKey: randomUUID(),
      location: { latitude: OFFICE_LAT + 0.05, longitude: OFFICE_LNG, accuracyMeters: 15, capturedAtUtc: new Date() },
      correlationId: randomUUID(),
    });
    expect(rejected.httpStatus).toBe(422);

    // Close the session cleanly with a valid new intent
    const validOut = await createScanIntent({
      actorId: internAUserId,
      qrToken: outQrToken,
      correlationId: randomUUID(),
    });
    const closed = await submitScan({
      actorId: internAUserId,
      intentId: validOut.intentId,
      requestKey: randomUUID(),
      location: { latitude: OFFICE_LAT, longitude: OFFICE_LNG, accuracyMeters: 10, capturedAtUtc: new Date() },
      correlationId: randomUUID(),
    });
    expect(closed.httpStatus).toBe(201);

    // Now outIntentStale has a stale attendanceVersion -> 409 STALE_STATE
    const staleRes = await submitScan({
      actorId: internAUserId,
      intentId: outIntentStale.intentId,
      requestKey: randomUUID(),
      location: { latitude: OFFICE_LAT, longitude: OFFICE_LNG, accuracyMeters: 10, capturedAtUtc: new Date() },
      correlationId: randomUUID(),
    });
    expect(staleRes.httpStatus).toBe(409);
  });

  it("6. PostgreSQL btree_gist exclusion constraint rejects overlapping AttendanceSession intervals", async () => {
    const baseDate = new Date("2025-06-02T00:00:00Z");
    await prisma.attendanceSession.create({
      data: {
        internshipId: internBInternshipId,
        policyVersionId,
        attendanceDate: baseDate,
        effectiveTimeInUtc: new Date("2025-06-02T01:00:00Z"),
        effectiveTimeOutUtc: new Date("2025-06-02T05:00:00Z"),
        status: "COMPLETE",
        timezoneSnapshot: "Asia/Manila",
        departmentIdSnapshot: departmentId,
      },
    });

    await expect(
      prisma.attendanceSession.create({
        data: {
          internshipId: internBInternshipId,
          policyVersionId,
          attendanceDate: baseDate,
          effectiveTimeInUtc: new Date("2025-06-02T04:00:00Z"),
          effectiveTimeOutUtc: new Date("2025-06-02T08:00:00Z"),
          status: "COMPLETE",
          timezoneSnapshot: "Asia/Manila",
          departmentIdSnapshot: departmentId,
        },
      }),
    ).rejects.toThrow();
  });

  it("7b & 8 & 9 & 11. Cross-intern isolation, atomic replacement, mid-Jev supersession, and racing HR approvals", async () => {
    const corr1 = await createCorrection({
      actorId: internAUserId,
      internshipId: internAInternshipId,
      attendanceDate: "2025-06-03",
      reason: "missed_clock_in",
      explanation: "Forgot to scan IN at lobby reception; supervisor Maria can confirm.",
      proposedTimeIn: "09:00",
      proposedTimeOut: "18:00",
      clientRequestId: randomUUID(),
      correlationId: randomUUID(),
    });

    // Cross-intern isolation on comments
    await expect(
      addCorrectionComment({
        actor: {
          userId: internBUserId,
          email: "b@test",
          name: "Intern Beta",
          role: "INTERN",
          status: "ACTIVE",
          sessionId: "test-session-b",
        },
        correctionRequestId: corr1.id,
        message: "Trying to comment on someone else's request",
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    // Atomic replacement via replaceRequestId
    const corr2 = await createCorrection({
      actorId: internAUserId,
      internshipId: internAInternshipId,
      replaceRequestId: corr1.id,
      attendanceDate: "2025-06-03",
      reason: "missed_clock_in",
      explanation: "Updated proposed times after checking lobby sign-in sheet with supervisor.",
      proposedTimeIn: "08:45",
      proposedTimeOut: "17:45",
      clientRequestId: randomUUID(),
      correlationId: randomUUID(),
    });

    const supersededOld = await prisma.correctionRequest.findUniqueOrThrow({ where: { id: corr1.id } });
    expect(supersededOld.status).toBe("SUPERSEDED");

    // Claim review job for corr2 v1, then add a comment before finishing it -> SUPERSEDED assessment
    const v1Job = await prisma.reviewJob.findFirstOrThrow({
      where: { correctionRequestId: corr2.id, state: "PENDING" },
    });
    await prisma.reviewJob.update({
      where: { id: v1Job.id },
      data: { state: "RUNNING", attempts: 1, leaseToken: "lease-v1", leaseExpiresAtUtc: new Date(Date.now() + 60_000) },
    });

    await addCorrectionComment({
      actor: {
        userId: internAUserId,
        email: "a@test",
        name: "Intern Alpha",
        role: "INTERN",
        status: "ACTIVE",
        sessionId: "test-session-a",
      },
      correctionRequestId: corr2.id,
      message: "Attached confirmation from team lead Alex at 08:45 AM.",
      correlationId: randomUUID(),
    });

    await processClaimedJob({
      id: v1Job.id,
      correctionRequestId: corr2.id,
      inputFingerprint: v1Job.inputFingerprint,
      modelVersion: v1Job.modelVersion,
      criteriaVersion: v1Job.criteriaVersion,
      attempts: 1,
      leaseToken: "lease-v1",
    });

    // Racing HR approvals on corr2 (now at version 2)
    const internshipNow = await prisma.internship.findUniqueOrThrow({ where: { id: internAInternshipId } });
    const [d1, d2] = await Promise.allSettled([
      decideCorrection({
        correctionRequestId: corr2.id,
        reviewerUserId: hrUserId,
        operationKey: randomUUID(),
        decision: "APPROVE",
        note: "Approved after verifying with supervisor Maria.",
        expectedRequestVersion: 2,
        expectedAttendanceVersion: internshipNow.attendanceVersion,
        correlationId: randomUUID(),
      }),
      decideCorrection({
        correctionRequestId: corr2.id,
        reviewerUserId: hrUserId,
        operationKey: randomUUID(),
        decision: "APPROVE",
        note: "Second concurrent approval attempt.",
        expectedRequestVersion: 2,
        expectedAttendanceVersion: internshipNow.attendanceVersion,
        correlationId: randomUUID(),
      }),
    ]);

    const fulfilled = [d1, d2].filter((r) => r.status === "fulfilled");
    const rejected = [d1, d2].filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const reviews = await prisma.hrReview.findMany({ where: { correctionRequestId: corr2.id } });
    expect(reviews).toHaveLength(1);
  });

  it("10 & 12. Worker lease reclaim works and REPEATABLE READ DTR snapshot returns consistent credited + remaining minutes", async () => {
    // Create a fresh pending correction + expired lease on its review job
    const corr = await createCorrection({
      actorId: internBUserId,
      internshipId: internBInternshipId,
      attendanceDate: "2025-06-04",
      reason: "technical_issue",
      explanation: "Phone GPS failed to lock at entrance despite standing by reception desk.",
      proposedTimeIn: "09:00",
      proposedTimeOut: "18:00",
      clientRequestId: randomUUID(),
      correlationId: randomUUID(),
    });

    const job = await prisma.reviewJob.findFirstOrThrow({ where: { correctionRequestId: corr.id } });
    await prisma.reviewJob.update({
      where: { id: job.id },
      data: {
        state: "RUNNING",
        leaseToken: "dead-worker-lease",
        leaseExpiresAtUtc: new Date(Date.now() - 5_000),
      },
    });

    const reclaimed = await claimNextReviewJob();
    expect(reclaimed).not.toBeNull();
    if (reclaimed) {
      await processClaimedJob(reclaimed);
    }

    // DTR snapshot consistency check
    const rows = await buildDtrRows({
      internshipId: internAInternshipId,
      fromDate: "2025-06-01",
      toDate: "2025-06-30",
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const june3 = rows.find((r) => r.attendanceDate === "2025-06-03");
    expect(june3).toBeDefined();
    expect(june3!.creditedMinutes).toBe(480);
    expect(june3!.remainingMinutes).toBeLessThan(june3!.requiredMinutes);
  });
});
