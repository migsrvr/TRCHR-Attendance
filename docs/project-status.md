# Project Status: Checked, Missing & Pending

**Project:** Top Realty Intern Attendance System (`TRCHR`)  
**Last Audited:** 2026-11-23  
**Scope:** Full-stack audit across Prisma/PostgreSQL, Better Auth, domain modules, API routes, durable Jev worker, Python SMTP mailer, and Next.js App Router UI.

---

## 1. Checked (Implemented & Verified)

### Verification Baseline (All Exiting `0` on Current Tree)
- **TypeScript (`npm run typecheck`):** Pass — `0` errors.
- **ESLint (`npm run lint`):** Pass — `0` warnings, `0` errors.
- **Unit & SSR Component Tests (`npm test`):** Pass — `44` test files / `365` tests passed (`1` PostgreSQL integration file / `5` tests skipped because `TEST_DATABASE_URL` is unset).
- **Jev Evaluation Harness (`npx tsx scripts/eval-jev.ts`):** Pass — `3/3` cases (`categoryAccuracy: 1.0`, `p95LatencyMs: 1`, stub mode).
- **Python SMTP Syntax (`python -m py_compile scripts/send_mail.py`):** Pass.
- **Prisma Schema Validation (`npx prisma validate`):** Pass.
- **Production Build (`npm run build`):** Pass — all `29` `/api/v1/*` routes, Better Auth `/api/auth/[...all]`, CSV exports, and `25` App Router pages compiled cleanly.

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
- [x] Security headers (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) configured in [next.config.mjs](../next.config.mjs) *(see UI Breakage #2 below for dev HMR fix needed)*.

### Core Domain Engine & QR Crypto
- [x] Canonical deterministic calculation engine in [src/domain/calculation/engine.ts](../src/domain/calculation/engine.ts), [types.ts](../src/domain/calculation/types.ts), and [schemas.ts](../src/domain/policy/schemas.ts) (UTC-to-office-local projection, schedule intersection, single break deduction, daily cap, rounding, remaining minutes).
- [x] Unified UI policy previews ([src/lib/ui/policy.ts](../src/lib/ui/policy.ts)) delegating directly to `calculateDailyCredit`.
- [x] HS256 JWS QR credential signer & keyring verifier ([src/lib/qr/signer.ts](../src/lib/qr/signer.ts), [src/lib/qr/verifier.ts](../src/lib/qr/verifier.ts)) with unit tests replacing all prior `it.todo` placeholders.

### Domain Modules & Durable Jev Worker
- [x] [src/modules/accounts/index.ts](../src/modules/accounts/index.ts): intern provisioning, hashed single-use setup links (`PENDING` → `ACTIVE`), intern/internship edits with `InternshipAssignment` history, session revocation, account disable/reactivate, departments CRUD.
- [x] [src/modules/offices/index.ts](../src/modules/offices/index.ts): version-fenced office geofence/pin/timezone updates, checkpoint rotation & printable token issuance, draft/publish attendance policy versioning.
- [x] [src/modules/attendance/index.ts](../src/modules/attendance/index.ts) + [credit.ts](../src/modules/attendance/credit.ts): scan intents, atomic scan submission (`ScanReceipt` reservation, replay, `409 KEY_REUSED`, parent `Internship` `FOR UPDATE` lock, Haversine geofence check, overnight `REVIEW` flagging), HR "ask for correction" emails, and live intern/HR read models.
- [x] [src/modules/corrections/index.ts](../src/modules/corrections/index.ts): immutable proposals, atomic `replaceRequestId` supersession, comments incrementing `requestVersion` (`NEEDS_INFO` → `PENDING`), version-fenced HR decisions (`APPROVE` / `REJECT` / `NEEDS_INFO`) with `AttendanceRevision` tracking, and manual Jev retry queueing.
- [x] [src/modules/reports/index.ts](../src/modules/reports/index.ts): `REPEATABLE READ` DTR preview & RFC 4180 CSV export with 10,000-row cap and SHA-256 export audit events.
- [x] Durable Jev worker: [context.ts](../src/worker/context.ts) (PII-minimized snapshot + SHA-256 fingerprint), [jev-client.ts](../src/worker/jev-client.ts) (`POST https://api.typesafe.ai/v1/systemone` + local stub fallback), [queue.ts](../src/worker/queue.ts) (`FOR UPDATE SKIP LOCKED`, lease-fenced write-back, supersession, `MANUAL_REVIEW`), and [src/worker/index.ts](../src/worker/index.ts).

### API Routes & Live UI Wiring
- [x] All `29` `/api/v1/*` route handlers (`health`, `health/ready`, `auth/setup-password`, `me`, `me/attendance`, `me/summary`, `scan-intents`, `attendance/scans`, `attendance/receipts/[requestKey]`, `corrections/*`, and `/api/v1/hr/*`) plus role-protected CSV export routes ([reports/export/route.ts](../src/app/(hr)/hr/reports/export/route.ts), [audit/export/route.ts](../src/app/(hr)/hr/audit/export/route.ts)).
- [x] Harmonized browser API clients (`src/lib/*/api.ts`) and live server queries ([auth.ts](../src/lib/ui/queries/auth.ts), [hr.ts](../src/lib/ui/queries/hr.ts), [intern.ts](../src/lib/ui/queries/intern.ts)).
- [x] Added global error/loading/not-found boundaries ([loading.tsx](../src/app/loading.tsx), [error.tsx](../src/app/error.tsx), [not-found.tsx](../src/app/not-found.tsx)) and UI controls for Sign Out, Edit Intern, New Policy Draft, Deactivate Department, Office pin/timezone & QR expiry, optimistic concurrency versions on HR decisions, 4-state Jev card + Retry, `?replace=` correction supersession, and Attendance `from`/`to` filters.
- [x] Written real-PostgreSQL concurrency & constraint integration test suite in [tests/integration/postgres-concurrency.test.ts](../tests/integration/postgres-concurrency.test.ts).

---

## 2. Missing & Known Issues (Including UI Breakages Found)

### A. Confirmed UI Breakages / Regressions (From Live-Wiring Pass)
1. **Default `npm run dev` UI preview is blocked when `.env` / PostgreSQL is not configured (High):**
   - Previously, running `npm run dev` with no `.env` showed the root navigation screen and fixture UI automatically (`NODE_ENV !== "production"`).
   - Now `isMockModeEnabled()` in [src/lib/auth/session.ts](../src/lib/auth/session.ts) strictly requires `USE_MOCK_APIS=1`. Without `.env` / `DATABASE_URL`:
     - `/` redirects directly to `/sign-in` (hiding links to `/hr`, `/dashboard`, `/scan`).
     - `/hr/*`, `/dashboard`, `/scan`, `/history`, `/corrections/*`, and `/welcome/*` redirect immediately to `/sign-in?next=...`.
     - `/sign-in` fails to authenticate because Better Auth has no database connection.
     - `/set-password?token=...` hits Prisma without `DATABASE_URL` and falls into [src/app/error.tsx](../src/app/error.tsx) ("Something went wrong").
   - *Immediate workaround to preview UI right now:* run `$env:USE_MOCK_APIS="1"; npm run dev`.
2. **CSP in [next.config.mjs](../next.config.mjs) blocks Dev HMR WebSockets (High):**
   - `connect-src 'self'` omits `ws:` and `wss:` in development (`!isProd`), which can break Next.js Hot Module Replacement / Fast Refresh in local dev and over LAN HTTPS (`npm run dev:phone`).
3. **`/scan/test-codes` is trapped behind the intern auth guard (Medium):**
   - [src/app/(intern)/scan/test-codes/page.tsx](../src/app/(intern)/scan/test-codes/page.tsx) lives inside [src/app/(intern)/layout.tsx](../src/app/(intern)/layout.tsx), which enforces `requirePageIntern()`. Opening `/scan/test-codes` on a laptop (signed out or signed in as HR) to scan from a phone redirects away unless `USE_MOCK_APIS=1` is active.
4. **`SignOutButton` ignores mock mode (Low):**
   - [src/components/shell/sign-out-button.tsx](../src/components/shell/sign-out-button.tsx) always sends `POST /api/auth/sign-out` via `createHttpAuthApi()` even in fixture mode (`USE_MOCK_APIS=1`).
5. **`OfficeSettingsForm` visual clutter / card balance (Low):**
   - [src/components/views/hr/office-settings-form.tsx](../src/components/views/hr/office-settings-form.tsx) now renders both an editable 3-column `Pin latitude` / `Pin longitude` / `Time zone` input row (blank by default in fixtures) and a second read-only `Pin` row below it, increasing card height relative to the adjacent Setup card.
6. **`AttendanceView` "Clear filters" flag always true in live mode (Low):**
   - [src/components/views/hr/attendance-view.tsx](../src/components/views/hr/attendance-view.tsx) treats any truthy `data.from || data.to` as filtered, but live `listSessionsByDay()` always populates the default 14-day `from`/`to` range, causing the empty state to display "Clear filters" even when no user filter is applied.
7. **Unverified visual/hydration check in a real browser:**
   - Automated tests only ran SSR `renderToStaticMarkup` (`vitest`), not a live browser rendering check against `npm run dev` / `npm run start`. Any client-only hydration warnings, CSS layout overflow, or interactive dialog glitches have not been visually inspected in Chrome yet.

### B. Missing Features / Functional Gaps vs Full Production Readiness
- [ ] **In-app notifications center & dropdown:** Deferred in the original UI spec (§9.2); the HR topbar bell icon currently links straight to `/hr/reviews`.
- [ ] **HR account management UI:** `seed.ts` creates the initial HR admin and setup links support `HR` accounts, but there is no HR UI screen to invite, disable, or manage additional HR users.
- [ ] **Add / permanently revoke QR checkpoints UI:** HR can print and rotate existing checkpoints, but cannot create a new checkpoint (e.g., a second office entrance) or permanently retire one from the UI.
- [ ] **Multi-office switcher UI:** Schema and `src/modules/offices` support multiple offices, but HR setup/policies/attendance pages currently target only the primary (`"default"`) office.
- [ ] **Browser E2E test suite (Playwright):** No automated real-browser tests covering client hydration, `<dialog>` focus/submit flows, sign-in cookies, camera/geolocation prompts, or responsive mobile/desktop layout regressions.
- [ ] **Distributed rate limiting:** [src/lib/http/rate-limit.ts](../src/lib/http/rate-limit.ts) uses an in-memory sliding window (sufficient for a single Node server; needs PostgreSQL or Redis backing if horizontally scaled across replicas).
- [ ] **Scheduled retention / cleanup jobs:** No cron/worker task yet to prune expired `ScanIntent` rows or archive old `ScanReceipt` / `ReviewJob` entries.
- [ ] **Production worker process supervision:** `npm run worker` runs as a standalone Node process and needs a supervisor configuration (e.g., `systemd`, PM2, Windows Service, or managed worker process) for auto-restart on crash.

---

## 3. Pendings (Blocked on Environment, Credentials, or Decisions)

- [ ] **Fix the UI regressions listed in Section 2A** (decide whether local dev without `DATABASE_URL` should show a clear setup banner / auto-fallback or stay strict behind `USE_MOCK_APIS=1`, fix `next.config.mjs` dev CSP `ws:`/`wss:`, move/exempt `/scan/test-codes`, polish `OfficeSettingsForm`, `AttendanceView`, and `SignOutButton`, and inspect every screen in a live browser).
- [ ] **Provision PostgreSQL 16+ & create `.env`:** Copy [.env.example](../.env.example) to `.env` and populate `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_ORIGIN`, `QR_SIGNING_KEY_SECRET`, and `SEED_HR_*`.
- [ ] **Apply migrations & run seed on live PostgreSQL:**
  ```powershell
  npx prisma migrate deploy
  npx tsx prisma/seed.ts
  ```
- [ ] **Run the real-PostgreSQL concurrency & constraint test suite:**
  ```powershell
  $env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trchr_test?schema=public"
  npx prisma migrate deploy
  npx vitest run tests/integration/postgres-concurrency.test.ts
  ```
- [ ] **Configure & verify live Python SMTP email delivery:** Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in `.env` and send a live test invite/correction email.
- [ ] **Configure live TypeSafe Jev API key (optional):** Supply `TYPESAFE_JEV_API_KEY` (or keep `JEV_MODE=stub`) and re-run `npx tsx scripts/eval-jev.ts` against the live `jev-1.13.0` endpoint to verify accuracy and latency.
- [ ] **Confirm real HR office configuration:** Replace placeholder office coordinates, geofence radius, timezone, and attendance policy rules (schedule, break, daily cap, rounding) once HR confirms real values, then remove `ExampleValuesBanner` if desired.
- [ ] **Physical mobile device verification (iOS Safari & Android Chrome over HTTPS):** Run the manual checklist in [docs/mobile-testing.md](./mobile-testing.md) for camera QR decoding, fresh GPS fix, geofence rejection, and timeout receipt recovery.
- [ ] **Git commit & branch cleanup:** Review and commit the current working-tree changes on `master` once UI regressions are fixed and verified.
