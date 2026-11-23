# Project Status: Checked, Missing & Pending

**Project:** Top Realty Intern Attendance System (`TRCHR`)  
**Last Audited:** 2026-11-23  
**QA Readiness:** Ready for QA (all UI regressions fixed, QA-essential gaps implemented, and real-browser Playwright E2E passing)

---

## 1. Checked (Implemented & Verified)

### Verification Baseline (All Exiting `0` on Current Tree)
- **TypeScript (`npm run typecheck`):** Pass — `0` errors.
- **ESLint (`npm run lint`):** Pass — `0` warnings, `0` errors.
- **Unit & SSR Component Tests (`npm test`):** Pass — `47` test files / `371` tests passed (`1` PostgreSQL integration file / `5` tests skipped because `TEST_DATABASE_URL` is unset).
- **Playwright Real-Browser E2E (`npm run test:e2e`):** Pass — `8/8` Chromium tests passing across auth, mobile intern (`390×844`), and desktop HR (`1280×800`) flows with verified Tailwind styling, zero uncaught `pageerror`, and zero console errors.
- **Jev Evaluation Harness (`npx tsx scripts/eval-jev.ts`):** Pass — `3/3` cases (`categoryAccuracy: 1.0`, `p95LatencyMs: 1`, stub mode).
- **Python SMTP Syntax (`python -m py_compile scripts/send_mail.py`):** Pass.
- **Prisma Schema Validation (`npx prisma validate`):** Pass.
- **Production Build (`npm run build`):** Pass — all `35` `/api/v1/*` routes, Better Auth `/api/auth/[...all]`, CSV exports, and `26` App Router pages (including `/hr/setup/team` and `/scan/test-codes`) compiled cleanly.

### Database Schema, Migrations & Seeding
- [x] Extended [prisma/schema.prisma](../prisma/schema.prisma) with `PolicyVersionStatus`, `CorrectionReasonCategory`, `InternshipAssignment`, setup-link/sign-in timestamps, department deactivation metadata, `Internship.provisionKey`, policy draft/publish status, QR expiry/revocation fields, correction idempotency (`clientRequestId`), and `HrReview.payloadHash`.
- [x] Generated ordered Prisma migrations:
  - [prisma/migrations/0000_init_schema/migration.sql](../prisma/migrations/0000_init_schema/migration.sql)
  - [prisma/migrations/0001_init_constraints/migration.sql](../prisma/migrations/0001_init_constraints/migration.sql) (`btree_gist` non-overlapping session exclusion constraint + partial unique indexes for active internships, open sessions, open corrections, and single draft policy per office)
  - [prisma/migrations/migration_lock.toml](../prisma/migrations/migration_lock.toml)
- [x] Implemented idempotent env-driven bootstrap seed in [prisma/seed.ts](../prisma/seed.ts) (default office, published policy v1, IN/OUT QR checkpoints, initial departments, first HR admin account using `better-auth/crypto` password hashing).
- [x] Updated [.env.example](../.env.example) for native/managed PostgreSQL (no Docker), Python SMTP, QR keyring, and optional TypeSafe Jev configuration.

### Security, Auth, Mailer & Observability
- [x] Hardened Better Auth in [src/lib/auth.ts](../src/lib/auth.ts) (UUID IDs, disabled signup, disabled cookie cache for instant revocation, `databaseHooks` blocking `PENDING`/`DISABLED` sign-in and recording `lastSignInAtUtc`).
- [x] Server-side session & live DB role/status guards in [src/lib/auth/session.ts](../src/lib/auth/session.ts) (`getServerActor`, `requireApiUser`, `requireApiHr`, `requireApiIntern`, `requirePageHr`, `requirePageIntern`).
- [x] HTTP security & reliability layer: [errors.ts](../src/lib/http/errors.ts), [guard.ts](../src/lib/http/guard.ts) (same-origin CSRF checks, canonical payload hashing, transient `40001`/`40P01` retry), [rate-limit.ts](../src/lib/http/rate-limit.ts), [logger.ts](../src/lib/http/logger.ts), and [src/modules/audit/index.ts](../src/modules/audit/index.ts) (sensitive-key redaction).
- [x] Zero-dependency Python 3 stdlib SMTP mailer ([scripts/send_mail.py](../scripts/send_mail.py)) and Node bridge ([src/lib/mail/index.ts](../src/lib/mail/index.ts)) with console fallback when `SMTP_HOST` is unset.
- [x] Security headers (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) in [next.config.mjs](../next.config.mjs) with `ws:`/`wss:` enabled in dev `connect-src` for Next.js HMR and strict `connect-src 'self'` in production.

### Core Domain Engine & QR Crypto
- [x] Canonical deterministic calculation engine in [src/domain/calculation/engine.ts](../src/domain/calculation/engine.ts), [types.ts](../src/domain/calculation/types.ts), and [schemas.ts](../src/domain/policy/schemas.ts) (UTC-to-office-local projection, schedule intersection, single break deduction, daily cap, rounding, remaining minutes).
- [x] Unified UI policy previews ([src/lib/ui/policy.ts](../src/lib/ui/policy.ts)) delegating directly to `calculateDailyCredit`.
- [x] HS256 JWS QR credential signer & keyring verifier ([src/lib/qr/signer.ts](../src/lib/qr/signer.ts), [src/lib/qr/verifier.ts](../src/lib/qr/verifier.ts)).

### Domain Modules & Durable Jev Worker
- [x] [src/modules/accounts/index.ts](../src/modules/accounts/index.ts): intern provisioning, hashed single-use setup links (`PENDING` → `ACTIVE`), intern/internship edits with `InternshipAssignment` history, session revocation, account disable/reactivate, departments CRUD, and **HR team management** (`listHrUsers`, `inviteHrUser`, `resendHrSetupLink`, `revokeHrSessions`, `setHrUserStatus` with `CANNOT_DISABLE_SELF` and `LAST_ACTIVE_HR` guards).
- [x] [src/modules/offices/index.ts](../src/modules/offices/index.ts): version-fenced office geofence/pin/timezone updates, checkpoint **creation** (`createCheckpoint`), rotation (`rotateCheckpointCredential`), **permanent revocation** (`revokeCheckpoint`), printable token issuance, and draft/publish attendance policy versioning.
- [x] [src/modules/attendance/index.ts](../src/modules/attendance/index.ts) + [credit.ts](../src/modules/attendance/credit.ts): scan intents, atomic scan submission (`ScanReceipt` reservation, replay, `409 KEY_REUSED`, parent `Internship` `FOR UPDATE` lock, Haversine geofence check, overnight `REVIEW` flagging), HR "ask for correction" emails, and live intern/HR read models.
- [x] [src/modules/corrections/index.ts](../src/modules/corrections/index.ts): immutable proposals, atomic `replaceRequestId` supersession, comments incrementing `requestVersion` (`NEEDS_INFO` → `PENDING`), version-fenced HR decisions (`APPROVE` / `REJECT` / `NEEDS_INFO`) with `AttendanceRevision` tracking, and manual Jev retry queueing.
- [x] [src/modules/reports/index.ts](../src/modules/reports/index.ts): `REPEATABLE READ` DTR preview & RFC 4180 CSV export with 10,000-row cap and SHA-256 export audit events.
- [x] Durable Jev worker & retention cleanup:
  - [context.ts](../src/worker/context.ts) (PII-minimized snapshot + SHA-256 fingerprint)
  - [jev-client.ts](../src/worker/jev-client.ts) (`POST https://api.typesafe.ai/v1/systemone` + local stub fallback)
  - [queue.ts](../src/worker/queue.ts) (`FOR UPDATE SKIP LOCKED`, lease-fenced write-back, supersession, `MANUAL_REVIEW`)
  - [retention.ts](../src/worker/retention.ts) (prunes expired `ScanIntent` >24h, aged `ScanReceipt` >90d, and terminal `SUCCEEDED`/`FAILED` `ReviewJob` >90d without touching immutable attendance or audit tables)
  - [src/worker/index.ts](../src/worker/index.ts) (periodic retention cleanup every 6h + `--cleanup` CLI mode)

### API Routes, Live UI Wiring & Resolved UI Regressions
- [x] All `35` `/api/v1/*` route handlers (`health`, `health/ready`, `auth/setup-password`, `me/*`, `scan-intents`, `attendance/*`, `corrections/*`, `/api/v1/hr/checkpoints` create/rotate/revoke, `/api/v1/hr/users` list/invite/setup-link/status/sessions-revoke, and all `/api/v1/hr/*` endpoints) plus role-protected CSV export routes.
- [x] **Dev auto-fixture fallback & banner:** `isMockModeEnabled()` in [src/lib/auth/session.ts](../src/lib/auth/session.ts) auto-enables UI fixture mode in non-production when `DATABASE_URL` is unset (while keeping `NODE_ENV=production` strictly live), displaying a dismissible [dev-mode-banner.tsx](../src/components/shell/dev-mode-banner.tsx) across `HomePage`, `HrLayout`, and `InternShell`.
- [x] **Moved `/scan/test-codes` outside intern auth guard:** Now located at [src/app/(dev)/scan/test-codes/page.tsx](../src/app/(dev)/scan/test-codes/page.tsx) (still disabled in production via `notFound()`).
- [x] **Mock-aware `SignOutButton`:** [sign-out-button.tsx](../src/components/shell/sign-out-button.tsx) reads `MockModeProvider` context so fixture sign-out never hits live `/api/auth/sign-out`.
- [x] **Polished `OfficeSettingsForm`:** [office-settings-form.tsx](../src/components/views/hr/office-settings-form.tsx) keeps a balanced 3-row `<dl>` and tucks pin coordinates/timezone inputs inside a collapsible `<details>` disclosure.
- [x] **Fixed `AttendanceView` custom-range filter flag:** [attendance-view.tsx](../src/components/views/hr/attendance-view.tsx) checks `data.hasCustomRange` instead of treating the default 14-day window as an active filter.
- [x] **New QR checkpoint controls:** [add-checkpoint-dialog.tsx](../src/components/views/hr/add-checkpoint-dialog.tsx) and permanent revoke modal in [checkpoint-actions.tsx](../src/components/views/hr/checkpoint-actions.tsx) wired into `/hr/setup`.
- [x] **New HR team page (`/hr/setup/team`):** [hr-team-view.tsx](../src/components/views/hr/hr-team-view.tsx) and [src/app/(hr)/hr/setup/team/page.tsx](../src/app/(hr)/hr/setup/team/page.tsx) added to the Setup sidebar navigation.
- [x] **Automated test suites:** Unit tests (`tests/unit/*`), SSR component tests (`tests/components/*`), PostgreSQL concurrency/constraint suite ([tests/integration/postgres-concurrency.test.ts](../tests/integration/postgres-concurrency.test.ts)), and Playwright Chromium E2E suite ([tests/e2e/auth-and-navigation.spec.ts](../tests/e2e/auth-and-navigation.spec.ts), [tests/e2e/intern-flows.spec.ts](../tests/e2e/intern-flows.spec.ts), [tests/e2e/hr-flows.spec.ts](../tests/e2e/hr-flows.spec.ts)).

---

## 2. Missing (Deferred Post-QA / Non-Blocking Enhancements)

These items were intentionally kept out of the pre-QA scope and do not block single-office QA or initial deployment:

- [ ] **In-app notifications center & dropdown:** Deferred in the original UI spec (§9.2); the HR topbar bell icon currently links straight to `/hr/reviews`.
- [ ] **Multi-office switcher UI:** Schema and `src/modules/offices` already support multiple `Office` records, but HR setup/policies/attendance screens currently target the primary (`"default"`) office.
- [ ] **Distributed rate limiting:** [src/lib/http/rate-limit.ts](../src/lib/http/rate-limit.ts) uses an in-memory sliding window (sufficient for a single Node instance; upgrade to PostgreSQL or Redis backing before multi-replica horizontal scaling).
- [ ] **Production worker process supervisor config:** `npm run worker` runs as a standalone Node process and will need host-specific supervision (`systemd`, PM2, Windows Service, or managed worker dyno) for production auto-restart.

---

## 3. Pendings (QA & Live-Environment Rollout)

- [ ] **Provision PostgreSQL 16+ & create `.env`:** Copy [.env.example](../.env.example) to `.env` and populate `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_ORIGIN`, `QR_SIGNING_KEY_SECRET`, and `SEED_HR_*`.
- [ ] **Apply migrations & seed live PostgreSQL:**
  ```powershell
  npx prisma migrate deploy
  npx tsx prisma/seed.ts
  ```
- [ ] **Run the real-PostgreSQL concurrency & `btree_gist` constraint suite:**
  ```powershell
  $env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trchr_test?schema=public"
  npx prisma migrate deploy
  npx vitest run tests/integration/postgres-concurrency.test.ts
  ```
- [ ] **Run Playwright E2E against a live seeded instance (optional QA pass):** Point `E2E_BASE_URL` at a running server or run `npm run test:e2e` against fixtures before every PR.
- [ ] **Configure & verify live Python SMTP email delivery:** Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in `.env` and verify live delivery for intern/HR invites and correction prompts.
- [ ] **Configure live TypeSafe Jev API key (optional):** Supply `TYPESAFE_JEV_API_KEY` (or keep `JEV_MODE=stub`) and re-run `npx tsx scripts/eval-jev.ts` against the live `jev-1.13.0` endpoint to verify accuracy and latency.
- [ ] **Confirm real HR office configuration:** Replace placeholder office coordinates, geofence radius, timezone, and attendance policy rules once HR confirms real values, then remove `ExampleValuesBanner` if desired.
- [ ] **Physical mobile device QA (iOS Safari & Android Chrome over HTTPS):** Run the manual checklist in [docs/mobile-testing.md](./mobile-testing.md) for camera QR decoding, fresh GPS fix, geofence rejection, and timeout receipt recovery.
- [ ] **Git commit & branch cleanup:** Review and commit working-tree changes on `master` before tagging the QA build.
