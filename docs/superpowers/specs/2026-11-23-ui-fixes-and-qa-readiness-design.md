# Design Specification: UI Fixes & QA-Readiness Gaps

**Date:** 2026-11-23  
**Status:** Approved  
**Project:** Top Realty Intern Attendance System (`TRCHR`)

---

## 1. Purpose & Scope

Resolve all confirmed UI/developer-ergonomics regressions from the live-wiring pass (Section 2A of `docs/project-status.md`) and implement the four QA-essential functional gaps (Section 2B):

1. **UI & Dev Ergonomics Fixes:**
   - Auto-enable fixture mode in non-production when `DATABASE_URL` is unset (with a visible dev banner), keeping `NODE_ENV=production` strictly live.
   - Allow `ws:` / `wss:` in `connect-src` CSP during development so Next.js HMR / Fast Refresh works cleanly.
   - Move `/scan/test-codes` outside `(intern)/layout.tsx` into `(dev)/scan/test-codes` so laptop test-code viewing is not blocked by intern session auth.
   - Make `SignOutButton` mock-aware when rendered in fixture mode.
   - Polish `OfficeSettingsForm` by placing editable coordinates & timezone inside a `<details>` disclosure while preserving the clean 3-row `<dl>` and card symmetry.
   - Fix `AttendanceView` so default 14-day windows do not falsely trigger `filtered = true`.
2. **QR Checkpoint Create & Permanently Revoke:**
   - Allow HR to create new `TIME_IN` / `TIME_OUT` checkpoints and permanently revoke existing checkpoints (incrementing `credentialVersion`, setting `active = false`, `revokedAtUtc = NOW()`, and recording audit events).
3. **HR Team Management (`/hr/setup/team`):**
   - Allow HR to list HR accounts, invite new HR users (emailed single-use setup link), resend setup links, sign out an HR user everywhere, and disable/reactivate HR users while enforcing two strict invariants: cannot disable self (`409 CANNOT_DISABLE_SELF`) and cannot disable the last active HR user (`409 LAST_ACTIVE_HR`).
4. **Worker Retention Cleanup Job:**
   - Add `src/worker/retention.ts` to prune expired `ScanIntent` rows (`>24h`), aged `ScanReceipt` rows (`>90d`, preserving `AttendanceScan` via `onDelete: SetNull`), and terminal `ReviewJob` rows (`SUCCEEDED`/`FAILED` `>90d`, preserving `JevAssessment`), wired into `src/worker/index.ts` periodically and via `--cleanup`.
5. **Playwright Real-Browser E2E Suite:**
   - Add `@playwright/test` with Chromium E2E specs verifying auth, intern, and HR journeys, interactive modals/forms, and zero uncaught page/console errors across all screens.

No Prisma schema changes or SQL migrations are required; every entity and column already exists in `prisma/schema.prisma`.

---

## 2. Detailed Contracts & Invariants

### 2.1 Fixture Mode Resolution
`isMockModeEnabled()` in `src/lib/auth/session.ts` returns `true` iff:
- `process.env.USE_MOCK_APIS === "1"`, OR
- `process.env.NODE_ENV === "test"`, OR
- `process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL?.trim()`.

In `NODE_ENV === "production"`, only an explicit `USE_MOCK_APIS=1` (never unset `DATABASE_URL`) could match, and live production deployments always leave `USE_MOCK_APIS` unset. All query modules (`src/lib/ui/queries/{auth,hr,intern}.ts`) delegate to `isMockModeEnabled()`.

A lightweight `DevModeBanner` component renders inside `HrShell`, `InternShell`, and `HomePage` when `mock === true` and `NODE_ENV !== "test"` so developers clearly see whether fixture data is active.

### 2.2 QR Checkpoints API & Module
- `POST /api/v1/hr/checkpoints`
  - Body (strict Zod): `{ officeId?: string, name: string (2..80), action: "TIME_IN" | "TIME_OUT", expiresInDays?: number (1..365, default 90) }`
  - Returns `201`: `{ id, name, action: "IN" | "OUT", codeVersion: 1, expiresIso }`
  - Audit event: `checkpoint.created`
- `POST /api/v1/hr/checkpoints/[id]/revoke`
  - Body: `{}`
  - Returns `200`: `{ id, revokedIso }`
  - Rejects already-revoked checkpoints with `409 ALREADY_REVOKED`.
  - Atomically sets `active: false`, `revokedAtUtc: now`, `credentialVersion: { increment: 1 }`, and records `checkpoint.revoked`.

### 2.3 HR Team Management API & Module
- `GET /api/v1/hr/users` → `200 { users: HrUserRowVM[] }`
- `POST /api/v1/hr/users`
  - Body (strict Zod): `{ clientRequestId: string, name: string (2..100), email: email }`
  - Creates `User(role: "HR", status: "PENDING")`, creates hashed 7-day setup token (`setup:${userId}`), sends setup email via `scripts/send_mail.py`, writes `hr_user.invited` audit event.
  - Returns `201 { id, name, email, status: "PENDING", setupLinkSentIso }`.
  - Duplicate email returns `409 EMAIL_TAKEN`.
- `POST /api/v1/hr/users/[id]/setup-link` → re-issues hashed setup link, emails user, writes `hr_user.setup_link_resent`, returns `200 { sentAtUtc }`.
- `POST /api/v1/hr/users/[id]/sessions/revoke` → deletes all `Session` rows for target HR user, writes `hr_user.sessions_revoked`, returns `200 { sessionsEnded }`.
- `POST /api/v1/hr/users/[id]/status`
  - Body (strict Zod): `{ status: "ACTIVE" | "DISABLED" }`
  - Invariants enforced inside a `prisma.$transaction`:
    1. Target must exist and have `role === "HR"` (`404 HR_USER_NOT_FOUND`).
    2. If `targetUserId === actorId && status === "DISABLED"` → `409 CANNOT_DISABLE_SELF`.
    3. If `status === "DISABLED"`, count `User` where `role = 'HR' AND status = 'ACTIVE' AND id != targetUserId`; if `0`, throw `409 LAST_ACTIVE_HR`.
    4. If `status === "DISABLED"`, delete all `Session` rows for `targetUserId`.
    5. Write `hr_user.status_changed` audit event.

### 2.4 Worker Retention Cleanup (`src/worker/retention.ts`)
- `runRetentionCleanup(options?)`:
  - `intentCutoff = now - intentRetentionHours (default 24h)` → `prisma.scanIntent.deleteMany({ where: { expiresAtUtc: { lt: intentCutoff } } })`
  - `receiptCutoff = now - receiptRetentionDays (default 90d)` → `prisma.scanReceipt.deleteMany({ where: { receivedAtUtc: { lt: receiptCutoff } } })`
  - `jobCutoff = now - completedJobRetentionDays (default 90d)` → `prisma.reviewJob.deleteMany({ where: { state: { in: ["SUCCEEDED", "FAILED"] }, updatedAt: { lt: jobCutoff } } })`
- Never deletes `AttendanceSession`, `AttendanceScan`, `AttendanceRevision`, `CorrectionRequest`, `HrReview`, `JevAssessment`, or `AuditEvent`.

### 2.5 Verification & Documentation
- Unit tests (`tests/unit/retention.test.ts`, `tests/unit/setup-api.test.ts`, `tests/unit/hr-team-api.test.ts`), SSR component tests (`tests/components/hr-setup.test.tsx`, `tests/components/hr-team.test.tsx`), and Playwright browser E2E tests (`tests/e2e/*.spec.ts`).
- Full verification pass: `typecheck`, `lint`, `test`, `test:e2e`, `eval-jev`, `py_compile`, `prisma validate`, `build`.
- Update `docs/project-status.md` with verified outcomes.
