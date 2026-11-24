# Environment Variables & External APIs Guide

This guide documents every environment variable in `.env` / `.env.local`, **which values you generate yourself** vs **where to obtain external service credentials**, and how `.env` and `.env.local` work on localhost and in production.

---

## 1. `.env` vs `.env.local` (Where to Put Them)

Both files live in the **repository root** (`c:\Users\Miggy\Documents\TRCHR\`) and are gitignored in `.gitignore`.

| File | Loaded by Next.js (`dev`, `build`, `start`) | Loaded by Prisma CLI (`migrate deploy`, `studio`) | Recommended Use |
| --- | --- | --- | --- |
| `.env` | Yes | **Yes** | **Primary file** for `DATABASE_URL`, secrets, SMTP, Jev, and seed vars |
| `.env.local` | Yes (overrides `.env`) | **No** | Optional localhost-only overrides (e.g. `USE_MOCK_APIS="1"`), never rely on it alone for `DATABASE_URL` |

> **Note for `prisma/seed.ts` and `npm run worker`:**  
> Pass `--env-file=.env` when running standalone Node scripts with `.env` (for example: `npx tsx --env-file=.env prisma/seed.ts` and `node --env-file=.env` / `npx tsx --env-file=.env src/worker/index.ts`).

---

## 2. Keys You Generate Yourself (Already Populated in `.env`)

These secrets do **not** come from any external provider — they are generated locally with a cryptographically secure random generator (`secrets.token_urlsafe(32)` or `crypto.randomBytes(32).toString("base64url")`):

| Variable | Purpose | Requirement |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Signs and verifies Better Auth session cookies and tokens | At least 32 random characters; never commit or reuse across environments |
| `QR_SIGNING_KEYS_JSON` | HS256 keyring mapping key ID (`kid`, e.g. `"k1"`) to signing secret for printed office QR posters | Valid JSON object; every secret must be ≥ 16 chars (32+ recommended). To rotate signing keys without breaking current posters immediately, add `"k2"` and set `QR_ACTIVE_KID="k2"`, then remove `"k1"` after rotating posters. |
| `QR_ACTIVE_KID` | Active key ID from `QR_SIGNING_KEYS_JSON` used when signing new/rotated QR posters | Must match a key in `QR_SIGNING_KEYS_JSON` (default `"k1"`) |
| `QR_ISSUER` / `QR_AUDIENCE` | Claims embedded in printed QR JWTs | Keep `"trchr:office"` and `"trchr:attendance"` |
| `BOOTSTRAP_HR_PASSWORD` | Password created for the first HR admin account during `prisma/seed.ts` | At least 10 characters; you can change it before seeding or change it after signing in |

To regenerate fresh keys anytime:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 3. External Services & Where to Get Them

### A. PostgreSQL 16+ Database (`DATABASE_URL`, `TEST_DATABASE_URL`) — **Required for Live Mode**
The database must run **PostgreSQL 16+** and allow `CREATE EXTENSION IF NOT EXISTS "btree_gist";` (used by `prisma/migrations/0001_init_constraints/migration.sql` to prevent overlapping attendance sessions).

Where to get one:
1. **Neon (Free tier, fast setup):** <https://neon.tech> → Create Project (Postgres 16+) → Copy the **Connection String** (use the pooled/direct URL with `?sslmode=require`).
2. **Supabase (Free tier):** <https://supabase.com> → New Project → **Settings → Database → Connection string (URI)** (port `5432` direct connection is best for `prisma migrate deploy`).
3. **Render / Railway:** <https://render.com> or <https://railway.app> → Add PostgreSQL → Copy the external/internal `DATABASE_URL`.
4. **Local Windows PostgreSQL:** Install via `winget install PostgreSQL.PostgreSQL.16` or <https://www.postgresql.org/download/windows/>, create database `trchr_dev` (and `trchr_test` for integration tests), and set:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/trchr_dev?schema=public"
   TEST_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/trchr_test?schema=public"
   ```

---

### B. Python Stdlib SMTP Email (`SMTP_*`) — **Optional in Localhost Dev**
This project sends invite/setup links and HR correction requests using `scripts/send_mail.py` (built-in Python 3 `smtplib`). **No third-party email SDK is required.**

- **For localhost testing without an email server:** Leave `SMTP_HOST=""`. Emails automatically print in your `npm run dev` terminal (including the full `/set-password?token=...` link so you can copy and test onboarding directly).
- **For real email delivery (QA / Production):**
  - **Gmail (free personal/workspace testing):** Enable 2-Step Verification on Google Account → **Security → App passwords** → generate a 16-char App Password → set:
    - `SMTP_HOST="smtp.gmail.com"`
    - `SMTP_PORT="587"`
    - `SMTP_SECURITY="starttls"`
    - `SMTP_USER="your.address@gmail.com"`
    - `SMTP_PASS="your-16-char-app-password"`
    - `SMTP_FROM="Top Realty Attendance <your.address@gmail.com>"`
  - **Mailtrap (safe QA sandbox inbox):** <https://mailtrap.io> → Email Testing → SMTP Settings (`sandbox.smtp.mailtrap.io`, port `2525` or `587`).
  - **Brevo / Zoho / Company Mail:** Use your provider's SMTP host, port (`587` `starttls` or `465` `ssl`), username, and SMTP key/password.

---

### C. TypeSafe Jev API (`TYPESAFE_JEV_API_KEY`) — **Optional**
Used only by the background worker (`src/worker/index.ts`) to provide advisory classification and completeness scores on intern correction requests. Jev **never** approves, rejects, or modifies attendance records.

- **Localhost / QA without a Jev key:** Leave `TYPESAFE_JEV_API_KEY=""` and `JEV_MODE="auto"` (or `"stub"`). The worker automatically uses its deterministic local stub evaluator (`jev-1.13.0-stub`) with zero external API calls.
- **Live Jev API:** Obtain an API key from your TypeSafe account (<https://api.typesafe.ai>) and set `TYPESAFE_JEV_API_KEY="your-key"` with `JEV_MODE="auto"`.

---

### D. Office Coordinates & Bootstrap HR (`BOOTSTRAP_*`)
Used **only once** by `prisma/seed.ts` (later editable in the HR UI at `/hr/setup`):
- **`BOOTSTRAP_OFFICE_LAT` / `BOOTSTRAP_OFFICE_LNG`:** Open Google Maps, right-click your Top Realty office entrance, and click the coordinates (e.g. `14.554729, 121.024445`) to copy them.
- **`BOOTSTRAP_OFFICE_TZ`:** IANA timezone name (default `"Asia/Manila"`).
- **`BOOTSTRAP_OFFICE_RADIUS_METERS` / `BOOTSTRAP_OFFICE_MAX_ACCURACY_METERS`:** Keep `maxAccuracy < radius` (default `60` m radius, `25` m max GPS accuracy).
- **`BOOTSTRAP_HR_EMAIL` / `BOOTSTRAP_HR_NAME` / `BOOTSTRAP_HR_PASSWORD`:** Initial HR admin login created by the seed script.

---

## 4. Quick Localhost Startup Checklist (Once `DATABASE_URL` Is Set)

```powershell
# 1. Apply PostgreSQL migrations (schema + btree_gist constraints)
npx prisma migrate deploy

# 2. Seed initial HR admin, office, policy v1, departments, and monthly IN/OUT QR checkpoints
npx tsx --env-file=.env prisma/seed.ts

# 3. Start web app (Terminal 1) and background Jev worker (Terminal 2)
npm run dev
npx tsx --env-file=.env src/worker/index.ts
```

Then open:
- `http://localhost:3000/api/v1/health/ready` → should return `"status": "ready"` with `"database": true`.
- `http://localhost:3000` → redirects to `/sign-in` where you can sign in with `BOOTSTRAP_HR_EMAIL` and `BOOTSTRAP_HR_PASSWORD`.
