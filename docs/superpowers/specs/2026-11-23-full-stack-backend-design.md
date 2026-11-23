# Top Realty Intern Attendance System — Full-Stack Backend & Live Wiring Design Spec

- **Date:** 2026-11-23
- **Status:** Approved via `implementation_plan.md`
- **Sources:** `Top_Realty_Intern_Attendance_Master_Document_v1_0.md`, `Top_Realty_Attendance_Technical_Design_v1_0.md`, `docs/superpowers/specs/2026-10-19-hr-attendance-ui-design.md`

---

## 1. Architecture & Operational Choices

1. **Runtime & Database (No Docker):** Next.js 15 App Router (Node runtime) + persistent Node worker (`npm run worker` via `tsx src/worker/index.ts`), connecting to PostgreSQL 16+ (with `btree_gist` extension) via `DATABASE_URL` (and `TEST_DATABASE_URL` for PostgreSQL concurrency tests).
2. **Email (Python stdlib SMTP):** `scripts/send_mail.py` uses Python 3 stdlib `smtplib` and `email.message.EmailMessage` (`STARTTLS`, `SSL`, or plain) with JSON payload passed over `stdin`. `src/lib/mail/index.ts` invokes it via `execFile` with a 10-second timeout and falls back to structured dev console logging when `SMTP_HOST` is unset. Zero third-party mail SaaS SDKs.
3. **Background Jev Worker:** Durable PostgreSQL `FOR UPDATE SKIP LOCKED` queue with 60-second leases, lease expiry reclamation, PII-minimized context snapshots, deterministic SHA-256 `inputFingerprint`, live `POST https://api.typesafe.ai/v1/systemone` (`jev-1.13.0`, 5s timeout, strict Choice/Noul Zod parsing, 3x exponential backoff + `Retry-After`), and an automatic deterministic stub adapter when `TYPESAFE_JEV_API_KEY` is unset or `JEV_MODE=stub`.
4. **Account Onboarding Lifecycle:** HR creates `User(status = PENDING)` + `Internship(status = ACTIVE)` + initial `InternshipAssignment` + single-use expiring `Verification` setup token (48h). Redeeming `/set-password` validates the token, hashes the password via `better-auth/crypto`, marks `User.status = ACTIVE`, creates a live session cookie, and writes an audit event. `PENDING` and `DISABLED` accounts cannot sign in or scan.
5. **Strict Server Authorization:** Every protected route, server component, and API handler verifies the Better Auth session and reloads live `role` and `status` from PostgreSQL (`session.cookieCache.enabled: false`). All mutating `/api/v1/*` routes enforce `Origin`/`Host` CSRF validation, strict Zod `.strict()` DTOs, payload size caps, rate limits, and `Cache-Control: private, no-store`.

---

## 2. Schema Extensions & SQL Migrations

Extensions to `prisma/schema.prisma`:
- Enum `PolicyVersionStatus { DRAFT PUBLISHED }`
- Enum `CorrectionReasonCategory { MISSED_CLOCK_IN MISSED_CLOCK_OUT WRONG_ACTION TECHNICAL_ISSUE OTHER }`
- `User`: add `setupLinkSentAtUtc DateTime?`, `lastSignInAtUtc DateTime?`
- `Department`: add `deactivatedAtUtc DateTime?`
- `Internship`: add `provisionKey String? @unique`, relation `assignments InternshipAssignment[]`
- New model `InternshipAssignment`: `id`, `internshipId`, `departmentId`, `officeId`, `effectiveFromDate Date`, `effectiveToDate Date?`, `createdAt`
- `AttendancePolicyVersion`: add `status PolicyVersionStatus @default(PUBLISHED)`, `copiedFromVersion Int?`, `publishedAtUtc DateTime?`
- `QrCheckpoint`: add `credentialExpiresAtUtc DateTime?`, `revokedAtUtc DateTime?`
- `AttendanceSession`: add `correctionRequestedAtUtc DateTime?`
- `CorrectionRequest`: add `reasonCategory CorrectionReasonCategory @default(OTHER)`, `clientRequestId String`, `@@unique([internshipId, clientRequestId])`
- `HrReview`: add `payloadHash String`

Migrations:
- `prisma/migrations/0000_init_schema/migration.sql` — full PostgreSQL DDL generated from `prisma/schema.prisma`.
- `prisma/migrations/0001_init_constraints/migration.sql` — `btree_gist`, partial unique indexes (including `attendance_policy_one_draft_per_office`), exclusion constraint `attendance_session_no_overlap`, and CHECK constraints (including `office_accuracy_within_radius`).

---

## 3. Unified Calculation Engine & QR Crypto

- **Policy JSONB (`src/domain/policy/schemas.ts`)**:
  - `scheduleRules`: `{ workdays: number[], windows: { startMinutes, endMinutes }[] }` (also accepts legacy array of windows on read for compatibility).
  - `breakRules`: `{ requiredBreakMinutes, windowStartMinutes, windowEndMinutes, gapCountsTowardBreak }[]`.
  - `creditRules`: `{ roundingMode: "NONE" | "FLOOR" | "CEIL" | "NEAREST_HALF_UP", roundingUnitMinutes, dailyCapMinutes }` with refinement `dailyCapMinutes % roundingUnitMinutes === 0`.
- **Calculation (`src/domain/calculation/engine.ts`)**:
  - Pure integer-second calculation: validate ordering & non-overlap -> convert UTC instants to office-local seconds on `attendanceDate` (DST-safe via `Intl.DateTimeFormat`) -> clip to schedule windows -> sum seconds -> compute qualifying recorded gaps inside break windows (`gapCountsTowardBreak`) -> deduct `max(0, requiredBreakSec - qualifyingGapSec)` once per day (only when worked > 0) -> clamp >= 0 -> cap at `dailyCapMinutes * 60` -> round once per day -> output integer `creditedMinutes`, `recordedMinutes`, `appliedBreakDeductionMinutes`, `capped`, `clipped`.
  - `src/lib/ui/policy.ts` `creditDay` delegates directly to `calculateDailyCredit`.
- **QR Signing & Verification (`src/lib/qr/signer.ts`, `src/lib/qr/verifier.ts`)**:
  - `jose` `SignJWT` / `jwtVerify` with explicit `algorithms: ["HS256"]` allowlist, protected header `kid` resolved strictly against server keyring (`QR_SIGNING_KEYS_JSON`), rejecting `jku`/`jwk`/`x5u` headers, validating `iss`, `aud`, `nbf`, `exp`, `checkpointId`, `action`, `credentialVersion`.

---

## 4. Harmonized `/api/v1` Contract Catalog

All responses include `Cache-Control: private, no-store`. Errors use `{ error: { code, message, retryable, correlationId, details? } }`.

| Endpoint | Method | Actor | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/v1/health` | GET | Public | Liveness check |
| `/api/v1/health/ready` | GET | Public | Readiness check (DB `SELECT 1` + required config) |
| `/api/v1/auth/setup-password` | POST | Setup token | Redeem setup token, set password, activate account, issue session cookie |
| `/api/v1/me` | GET | Authenticated | Own account, active internship, capabilities |
| `/api/v1/me/attendance` | GET | Active Intern | Own sessions with date filter & cursor pagination |
| `/api/v1/me/summary` | GET | Active Intern | Own today + overall credited/remaining minutes |
| `/api/v1/scan-intents` | POST | Active Intern | Verify QR, lock internship, issue expiring `ScanIntent` |
| `/api/v1/attendance/scans` | POST | Active Intern | Atomic idempotent scan protocol + `ScanReceipt` |
| `/api/v1/attendance/receipts/[requestKey]` | GET | Active Intern | Owner-only receipt recovery (`{ httpStatus, result }`) |
| `/api/v1/corrections` | GET, POST | Active Intern | List own corrections; create immutable/replacement correction |
| `/api/v1/corrections/[id]` | GET | Owner or HR | Correction detail with actor-scoped evidence |
| `/api/v1/corrections/[id]/comments` | POST | Owner or HR | Append comment, bump `requestVersion`, enqueue `ReviewJob` |
| `/api/v1/hr/attendance` | GET | HR | Filtered attendance sessions |
| `/api/v1/hr/sessions/[id]/correction-request` | POST | HR | Mark held session & email intern correction notice |
| `/api/v1/hr/corrections` | GET | HR | Review queue (tabs, filters, held sessions) |
| `/api/v1/hr/corrections/[id]/reviews` | POST | HR | Version-checked `APPROVE` / `REJECT` / `NEEDS_INFO` with `operationKey` |
| `/api/v1/hr/corrections/[id]/jev-retry` | POST | HR | Re-enqueue `MANUAL_REVIEW`/`FAILED` Jev job |
| `/api/v1/hr/interns` | GET, POST | HR | Directory list; idempotent intern provisioning |
| `/api/v1/hr/interns/[id]` | GET, PATCH | HR | Profile; edit department/hours/dates/status |
| `/api/v1/hr/interns/[id]/setup-link` | POST | HR | Resend setup link |
| `/api/v1/hr/interns/[id]/sessions/revoke` | POST | HR | Revoke all Better Auth sessions for intern |
| `/api/v1/hr/interns/[id]/status` | POST | HR | Disable or re-enable intern account |
| `/api/v1/hr/departments` | GET, POST | HR | List / create department |
| `/api/v1/hr/departments/[id]` | PATCH | HR | Rename department |
| `/api/v1/hr/departments/[id]/status` | POST | HR | Deactivate or reactivate department |
| `/api/v1/hr/offices/[id]` | PATCH | HR | Optimistically versioned office settings update |
| `/api/v1/hr/offices/[id]/policies` | GET, POST | HR | List versions; create new draft policy |
| `/api/v1/hr/offices/[id]/policies/[version]` | PATCH | HR | Update draft policy |
| `/api/v1/hr/offices/[id]/policies/[version]/publish` | POST | HR | Publish & lock draft policy |
| `/api/v1/hr/checkpoints/[id]/rotate` | POST | HR | Rotate checkpoint credential version & expiry |
| `/api/v1/hr/reports/dtr` | GET | HR | JSON preview or CSV DTR from repeatable-read snapshot |

---

## 5. UI Wiring & Closing the 12 UI Gaps

1. Live DB queries replace fixtures in `src/lib/ui/queries/{auth,hr,intern}.ts`; fixture mode remains opt-in via `USE_MOCK_APIS=1`.
2. Root `/`, `(hr)/layout.tsx`, `(intern)/layout.tsx`, and export routes enforce live server-side auth/RBAC.
3. Add Sign Out controls to `HrTopbar` and `InternShell`.
4. Add Edit Internship / Department Transfer modal on `InternProfileView`.
5. Add New Draft Policy button on `PoliciesView`.
6. Add Deactivate Department action (with confirmation) on `DepartmentsView`.
7. Add Office Pin (latitude/longitude) + Timezone editing in `OfficeSettingsForm` and QR expiry lifetime selection in `CheckpointActions`.
8. Update `DecisionForm` + `src/lib/reviews/api.ts` to send `operationKey`, `expectedRequestVersion`, `expectedSessionVersion`, `expectedAttendanceVersion`, and `NEEDS_INFO`.
9. Extend `JevTag` + `JevCard` to display `PENDING`/`RUNNING`, `SUPERSEDED`, and `FAILED`/`MANUAL_REVIEW` + HR Retry button.
10. Pass `replaceRequestId` and `sessionId` in correction replacement flow (`CorrectionDetailView` -> `NewCorrectionForm`).
11. Fix broken query links (`?intern=` in `/hr/attendance` and `?subject=` in `/hr/reports` links) and add date-range filters (`from`/`to`) + pagination controls.
12. Add `next.config.mjs` (CSP + camera/geo `Permissions-Policy`), `loading.tsx`, `error.tsx`, and styled `not-found.tsx`.
