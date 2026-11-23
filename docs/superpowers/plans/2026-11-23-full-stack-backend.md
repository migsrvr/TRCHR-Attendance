# TRCHR Full-Stack Backend & Live Wiring Implementation Plan

> **For agentic workers:** Execute slices in dependency order with strict TDD (Red -> Green -> Refactor) and PM diff/test gating between slices.

**Goal:** Implement the complete PostgreSQL backend, Better Auth session & RBAC layer, Python stdlib SMTP mailer, deterministic calculation engine, HS256 QR crypto, 6 transactional domain modules, versioned `/api/v1/*` routes, durable TypeSafe Jev review worker, live UI wiring, and 12 UI gap fixes.

**Architecture:** One Next.js 15 App Router Node application plus a persistent Node review worker (`src/worker/index.ts`), sharing Prisma 6 + PostgreSQL 16 (`btree_gist`, row locks, partial unique indexes), Better Auth 1.7.11 database sessions, and a zero-dependency Python 3 SMTP helper (`scripts/send_mail.py`).

**Tech Stack:** Next.js 15.5, React 19, TypeScript 5.6 strict, Prisma 6.19, PostgreSQL 16+, Better Auth 1.7.11, `jose` 5.10, Zod 3.25, Python 3.14 (`smtplib`), Vitest 2.1.

**Spec:** `docs/superpowers/specs/2026-11-23-full-stack-backend-design.md`

## Global Constraints

- No Docker (`Dockerfile` or `docker-compose.yml`).
- Email uses Python stdlib SMTP (`scripts/send_mail.py`); zero paid mail SaaS SDKs.
- Jev worker supports live `jev-1.13.0` (`POST https://api.typesafe.ai/v1/systemone`) with automatic deterministic stub fallback when `TYPESAFE_JEV_API_KEY` is unset or `JEV_MODE=stub`.
- Strict TypeScript (`noUncheckedIndexedAccess: true`), `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` must all pass green before completion.
- Keep `USE_MOCK_APIS=1` opt-in support so all 334 existing UI/unit tests stay green or are intentionally updated with harmonized contracts.
- Never log passwords, cookies, GPS coordinates, QR tokens, Jev API keys, or correction free text.

---

## Task Slices & File Ownership

### Task 1: Prisma Schema Extensions, SQL Migrations & Bootstrap Seed
**Files:**
- Modify: `prisma/schema.prisma`, `prisma/seed.ts`, `.env.example`
- Create: `prisma/migrations/0000_init_schema/migration.sql`, `prisma/migrations/0001_init_constraints/migration.sql`
- Delete: `prisma/migrations/0_init_constraints/migration.sql` (replaced by ordered `0001_init_constraints`)
- Verify: `npx prisma validate && npx prisma generate`

### Task 2: Python SMTP Mailer & Shared HTTP/Security/Logger Layer
**Files:**
- Create: `scripts/send_mail.py`, `src/lib/mail/index.ts`, `src/lib/http/errors.ts`, `src/lib/http/guard.ts`, `src/lib/http/rate-limit.ts`, `src/lib/http/logger.ts`, `next.config.mjs`
- Test: `tests/unit/mail.test.ts`, `tests/unit/http-guard.test.ts`

### Task 3: Better Auth Hardening, Server Session Guards & Audit Module
**Files:**
- Modify: `src/lib/auth.ts`, `src/app/api/v1/health/route.ts`
- Create: `src/lib/auth/session.ts`, `src/modules/audit/index.ts`, `src/app/api/v1/health/ready/route.ts`
- Test: `tests/unit/audit-redaction.test.ts`

### Task 4: Deterministic Calculation Engine & Unified Policy Schemas
**Files:**
- Modify: `src/domain/calculation/types.ts`, `src/domain/policy/schemas.ts`, `src/domain/calculation/engine.ts`, `src/lib/ui/policy.ts`
- Test: `tests/unit/calculation.test.ts`, `tests/unit/ui-policy.test.ts`

### Task 5: HS256 QR Credential Signer & Verifier
**Files:**
- Modify: `src/lib/qr/signer.ts`, `src/lib/qr/verifier.ts`
- Test: `tests/unit/qr.test.ts`

### Task 6: Accounts & Departments Module (`src/modules/accounts/index.ts`)
**Files:**
- Modify: `src/modules/accounts/index.ts`
- Test: `tests/unit/accounts-module.test.ts`

### Task 7: Offices, Policies & Checkpoints Module (`src/modules/offices/index.ts`)
**Files:**
- Modify: `src/modules/offices/index.ts`
- Test: `tests/unit/offices-module.test.ts`

### Task 8: Atomic Attendance Scan Protocol & Queries (`src/modules/attendance/index.ts`)
**Files:**
- Modify: `src/modules/attendance/index.ts`
- Test: `tests/unit/attendance-module.test.ts`

### Task 9: Corrections, Reviews & DTR Reports Modules (`src/modules/corrections/index.ts`, `src/modules/reports/index.ts`)
**Files:**
- Modify: `src/modules/corrections/index.ts`, `src/modules/reports/index.ts`
- Test: `tests/unit/corrections-module.test.ts`, `tests/unit/reports-module.test.ts`

### Task 10: Durable Background Worker & TypeSafe Jev Adapter (`src/worker/`)
**Files:**
- Create: `src/worker/context.ts`, `src/worker/jev-client.ts`, `src/worker/queue.ts`, `scripts/eval-jev.ts`
- Modify: `src/worker/index.ts`
- Test: `tests/unit/jev-worker.test.ts`

### Task 11: All `/api/v1/*` Route Handlers & Harmonized Client APIs
**Files:**
- Create: all `/api/v1/**` route handlers (auth setup-password, me, me/attendance, me/summary, scan-intents, attendance/scans, attendance/receipts/[requestKey], corrections, corrections/[id], corrections/[id]/comments, hr/attendance, hr/sessions/[id]/correction-request, hr/corrections, hr/corrections/[id]/reviews, hr/corrections/[id]/jev-retry, hr/interns, hr/interns/[id], hr/interns/[id]/setup-link, hr/interns/[id]/sessions/revoke, hr/interns/[id]/status, hr/departments, hr/departments/[id], hr/departments/[id]/status, hr/offices/[id], hr/offices/[id]/policies, hr/offices/[id]/policies/[version], hr/offices/[id]/policies/[version]/publish, hr/checkpoints/[id]/rotate, hr/reports/dtr)
- Modify: `src/lib/{accounts,attendance,auth,corrections,reviews,setup}/api.ts`, `src/app/(hr)/hr/reports/export/route.ts`, `src/app/(hr)/hr/audit/export/route.ts`
- Test: update `tests/unit/*-api.test.ts` and export route tests

### Task 12: Live UI Queries, Route Guards & Closing All 12 UI Gaps
**Files:**
- Modify: `src/lib/ui/queries/{auth,hr,intern}.ts`, `src/lib/ui/view-models.ts`, `src/app/page.tsx`, `src/app/(hr)/layout.tsx`, `src/app/(intern)/layout.tsx`, all `src/app/**/page.tsx`, `src/components/shell/{hr-topbar,intern-shell}.tsx`, `src/components/ui/jev-tag.tsx`, `src/components/views/hr/{intern-profile-view,policies-view,departments-view,office-settings-form,checkpoint-actions,decision-form,review-detail-view,interns-view,attendance-view,reviews-view,audit-log-view}.tsx`, `src/components/views/intern/{correction-detail-view,new-correction-form}.tsx`
- Create: `src/components/shell/sign-out-button.tsx`, `src/components/views/hr/edit-intern-dialog.tsx`, `src/app/loading.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`
- Test: update affected `tests/components/*.test.tsx` & `tests/unit/ui-*.test.ts`

### Task 13: Real PostgreSQL Integration & Concurrency Test Suite
**Files:**
- Create: `tests/integration/postgres-concurrency.test.ts` (auto-skips with clear message when `TEST_DATABASE_URL` is unset; runs all 12 Technical Design §14 scenarios against real PostgreSQL when set)

### Task 14: Full Verification Gate & Walkthrough
**Verify:**
- `npm run typecheck && npm run lint && npm test && npm run build`
- Create walkthrough artifact summarizing everything built, tested, and verified.
