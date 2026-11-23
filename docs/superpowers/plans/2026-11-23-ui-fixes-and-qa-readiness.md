# Implementation Plan: UI Fixes & QA-Readiness Gaps

**Spec:** [2026-11-23-ui-fixes-and-qa-readiness-design.md](../specs/2026-11-23-ui-fixes-and-qa-readiness-design.md)  
**Date:** 2026-11-23

## Slice 1 — UI Regressions & Dev Ergonomics
1. Update `isMockModeEnabled()` in `src/lib/auth/session.ts` and delegate `src/lib/ui/queries/{auth,hr,intern}.ts` to it.
2. Add `src/components/shell/dev-mode-banner.tsx` and render in `HrShell`, `InternShell`, and `HomePage` when `mock` is active (outside `NODE_ENV=test`).
3. Update `next.config.mjs` CSP (`connect-src 'self' ws: wss:` when `!isProd`).
4. Move `src/app/(intern)/scan/test-codes/` → `src/app/(dev)/scan/test-codes/`.
5. Make `src/components/shell/sign-out-button.tsx` accept `mock?: boolean` and wire it through `HrTopbar`, `HrShell`, and `InternShell`.
6. Polish `src/components/views/hr/office-settings-form.tsx` (collapsible `<details>` for Pin latitude/longitude/timezone; clean 3-row `<dl>`).
7. Add `hasCustomRange?: boolean` to `AttendanceVM` (`src/lib/ui/view-models.ts`), set it in `src/modules/attendance/index.ts` and `src/lib/ui/queries/hr.ts`, and use it in `src/components/views/hr/attendance-view.tsx`.

## Slice 2 — QR Checkpoint Create & Permanently Revoke
1. Add `createCheckpoint` and `revokeCheckpoint` to `src/modules/offices/index.ts`.
2. Add API routes `src/app/api/v1/hr/checkpoints/route.ts` and `src/app/api/v1/hr/checkpoints/[id]/revoke/route.ts`.
3. Extend `SetupApi` (`src/lib/setup/api.ts`) with `createCheckpoint` and `revokeCheckpoint` (HTTP + mock).
4. Create `src/components/views/hr/add-checkpoint-dialog.tsx`, update `src/components/views/hr/checkpoint-actions.tsx` (Revoke confirm dialog) and `src/components/views/hr/office-setup-view.tsx`.
5. Update `tests/unit/setup-api.test.ts` and `tests/components/hr-setup.test.tsx`.

## Slice 3 — HR Team Management (`/hr/setup/team`)
1. Add `HrUserRowVM` & `HrTeamVM` to `src/lib/ui/view-models.ts`, plus `HR_TEAM_ROWS` in `src/lib/ui/fixtures/setup.ts`.
2. Add `listHrUsers`, `inviteHrUser`, `resendHrSetupLink`, `revokeHrSessions`, `setHrUserStatus` to `src/modules/accounts/index.ts` (enforcing `CANNOT_DISABLE_SELF` and `LAST_ACTIVE_HR`).
3. Add API routes:
   - `src/app/api/v1/hr/users/route.ts`
   - `src/app/api/v1/hr/users/[id]/setup-link/route.ts`
   - `src/app/api/v1/hr/users/[id]/sessions/revoke/route.ts`
   - `src/app/api/v1/hr/users/[id]/status/route.ts`
4. Add `src/lib/hr-team/api.ts` (HTTP + mock) and `getHrTeam()` in `src/lib/ui/queries/hr.ts`.
5. Add `"team"` (`HR team` → `/hr/setup/team`) to `src/components/shell/nav.ts` and `src/components/shell/hr-sidebar.tsx`.
6. Create `src/components/views/hr/hr-team-view.tsx` and `src/app/(hr)/hr/setup/team/page.tsx`.
7. Add `tests/unit/hr-team-api.test.ts` and `tests/components/hr-team.test.tsx`.

## Slice 4 — Worker Retention Cleanup Job
1. Write unit test `tests/unit/retention.test.ts` (TDD).
2. Implement `src/worker/retention.ts` (`runRetentionCleanup`).
3. Wire periodic cleanup & `--cleanup` flag into `src/worker/index.ts`.

## Slice 5 — Playwright Real-Browser E2E Suite
1. Install `@playwright/test` and Chromium browser binary.
2. Add `playwright.config.ts`, `test:e2e` script in `package.json`, and exclude `tests/e2e` from Vitest (`vitest.config.ts`) & `.gitignore` Playwright output dirs.
3. Write `tests/e2e/auth-and-navigation.spec.ts`, `tests/e2e/intern-flows.spec.ts`, and `tests/e2e/hr-flows.spec.ts` checking real browser rendering, interactions, and zero uncaught page/console errors.

## Slice 6 — Full Verification & Documentation Update
1. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npx tsx scripts/eval-jev.ts`, `python -m py_compile scripts/send_mail.py`, `npx prisma validate`, and `npm run build`.
2. Update `docs/project-status.md` to reflect all newly checked items and remaining live-environment pendings.
