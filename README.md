# TRCHR — Top Realty Intern Attendance System

Mobile-first QR attendance tracking, geofence + dual-frame camera presence verification, deterministic OJT/internship hour calculation, and HR review workflows built with **Next.js 15 (App Router)**, **PostgreSQL 16+ (Prisma + `btree_gist`)**, and **Better Auth**.

---

## Key Features

### Intern Mobile Web App (`/scan`, `/dashboard`, `/history`, `/corrections`)
- **In-App QR Scanner + Dual-Frame Photo Verification:**
  - Scans signed `trchr1.` HS256 office QR posters (non-URL payload so native iOS/Android cameras and Google Lens cannot open them outside the app).
  - Automatically captures a rear-camera frame of the wall QR poster on decode, verifies a fresh GPS fix against the office geofence, and prompts a 1-tap watermarked front-camera selfie before saving.
  - Idempotent scan submission (`ScanReceipt`) with lost-response receipt recovery (`unconfirmed` state never double-submits).
- **Attendance Dashboard & History:** Live session timeline, credited vs. required internship hours, workday pace, and monthly breakdown.
- **Correction Requests:** Immutable correction proposals with clarification replies and atomic supersession (`?replace=`).

### HR Desktop Console (`/hr`, `/hr/interns`, `/hr/attendance`, `/hr/reviews`, `/hr/reports`, `/hr/setup`, `/hr/audit`)
- **Daily Overview & Attendance Records:** Live in-office status, daily timelines, session detail drawer with **HR-only scan photo thumbnails, SHA-256 verification badges, geofence distances, and buddy-punching / GPS anomaly warning chips**.
- **Correction Reviews & Advisory Jev Worker:** Version-fenced HR decisions (`APPROVE`, `REJECT`, `NEEDS_INFO`) with immutable `AttendanceRevision` tracking and optional advisory readings from TypeSafe Jev (or local deterministic stub).
- **Monthly Printable QR Checkpoints:** 30-day default expiry, 7-day expiring-soon callouts, single or bulk rotation (**Rotate all**), permanent revocation, single & multi-page **Print all active posters** (`/hr/setup/qr/print-all`), and SVG download.
- **Policy Versioning & DTR Reports:** Draft/publish attendance policies (schedule window, break deduction, daily cap, rounding) powered by a single canonical calculation engine (`src/domain/calculation/engine.ts`), plus `REPEATABLE READ` DTR previews and RFC 4180 CSV exports.
- **Account & HR Team Management:** Provision interns and HR users with single-use hashed password-setup links, session revocation, account disable/reactivate, and audit trail CSV export.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS 3, Lucide Icons |
| Auth | Better Auth (`prismaAdapter`, UUIDs, live DB session/status checks) |
| Database | PostgreSQL 16+ (`btree_gist` exclusion constraints) + Prisma 6 |
| QR & Camera | `@zxing/browser` (rear camera) + HTML5 Canvas JPEG/SHA-256 capture + `jose` HS256 |
| Email | Pure Node.js SMTP via `nodemailer` (console preview fallback in local dev) |
| Testing | Vitest (unit & SSR component tests) + Playwright Chromium (mobile & desktop E2E) |
| Hosting | Vercel Serverless (`cle1` / `us-east-2`, Cron worker) + Neon PostgreSQL |

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js 20+**
- **PostgreSQL 16+** with permission to enable `btree_gist` (e.g. [Neon](https://neon.tech) or local PostgreSQL)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and populate `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `QR_SIGNING_KEYS_JSON`, and `BOOTSTRAP_*` values. See [docs/environment-and-apis.md](./docs/environment-and-apis.md) for how to generate secrets and where to obtain external credentials.

> **UI Fixture Mode (No DB Required):** Leaving `DATABASE_URL` unset in local dev (or setting `USE_MOCK_APIS="1"`) automatically enables fixture mode with a dismissible developer banner so you can preview all screens immediately.

### 3. Apply Migrations & Seed Initial HR Account
```bash
npx prisma migrate deploy
npx tsx --env-file=.env prisma/seed.ts
```

### 4. Run the App (and Optional Background Worker)
```bash
# Terminal 1 — Next.js dev server
npm run dev

# Terminal 2 — Background Jev advisory & retention cleanup worker (optional locally)
npx tsx --env-file=.env src/worker/index.ts
```

Open:
- `http://localhost:3000/api/v1/health/ready` — verifies database connectivity and server config.
- `http://localhost:3000/sign-in` — sign in with your seeded `BOOTSTRAP_HR_EMAIL` and `BOOTSTRAP_HR_PASSWORD`.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js development server (`http://localhost:3000`) |
| `npm run dev:phone` | Start HTTPS dev server on `0.0.0.0` for testing camera/GPS on physical phones |
| `npm run build` | Build production Next.js bundle |
| `npm run typecheck` | Run TypeScript strict type-checking (`tsc --noEmit`) |
| `npm run lint` | Run ESLint (`next lint`) |
| `npm test` | Run all Vitest unit & SSR component tests |
| `npm run test:e2e` | Run Playwright Chromium E2E tests (auth, mobile intern, desktop HR) |
| `npm run worker` | Run the persistent Jev & retention cleanup worker |

---

## Security Highlights

- **In-App QR Protocol (`trchr1.`):** Signed HS256 JWS tokens prefixed with `trchr1.` cannot be opened by native phone cameras or Google Lens.
- **Anti-Spoofing & Presence Checks:** Validates server-side SHA-256 photo digests, non-blank camera pixel variance (`frameVariance >= 6`), post-intent GPS temporal ordering (`capturedAtUtc >= intent.issuedAtUtc`), synthetic mock-GPS rejection (`accuracyMeters <= 0.5`), zero-jitter coordinate flagging, and 12-hour `HttpOnly` device-cookie (`trchr_did`) buddy-punching detection.
- **Database Integrity:** PostgreSQL `btree_gist` exclusion constraints prevent overlapping attendance sessions; partial unique indexes enforce single active internship, single open session, and single open correction per day.
- **HTTP Hardening:** Same-origin CSRF enforcement (`assertSameOrigin`), strict Zod JSON parsing, CSP, `Permissions-Policy`, `X-Frame-Options: DENY`, and production `Strict-Transport-Security` (HSTS).

---

## Documentation

- [docs/vercel-deployment.md](./docs/vercel-deployment.md) — Vercel + Neon deployment guide, environment variables matrix, cron setup, and go-live QA checklist
- [docs/environment-and-apis.md](./docs/environment-and-apis.md) — `.env` vs `.env.local`, self-generated keys, and external service setup
- [docs/project-status.md](./docs/project-status.md) — Audited checklist of implemented features, verification baseline, and deferred items
- [docs/mobile-testing.md](./docs/mobile-testing.md) — Physical iOS Safari & Android Chrome testing guide
