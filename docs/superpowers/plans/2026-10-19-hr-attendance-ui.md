# Top Realty Attendance UI — Implementation Plan

> **For the implementing agent:** work task by task, in order, unless the slice table (Section 3) says a task can run in parallel. Each task is test-first: write the failing test, run it and watch it fail, implement, run it green, then commit. Don't start a page task until the components it uses exist.

- **Goal:** Build the HR admin panel, intern app, sign-in and first-run screens exactly as designed on the canvas, on top of the existing Next.js scaffold, using fixture data behind typed query functions so the real modules can be wired in later without touching the UI.
- **Spec:** `docs/superpowers/specs/2026-10-19-hr-attendance-ui-design.md` (tokens, status system, components, routes)
- **Visual source:** Claude Design canvas — https://claude.ai/artifact/ANGEk1BrvmdCaU5AJk7hKg (one artboard per screen; artboard names appear in each task)
- **Stack already in the repo:** Next.js 15.5 (App Router), React 19, TypeScript strict, Tailwind CSS 3.4, Vitest 2 (node env, `tests/**/*.test.ts`), Prisma 6 (client generated), `lucide-react`, `clsx`, `tailwind-merge`.
- **Not in the repo yet:** ESLint (the `lint` script has no config), a `typecheck` script, component tests.

---

## 1. Architecture

```
src/app/                      routes (server components): fetch view models, render a *View
src/components/ui/            primitives (Button, Card, StatusMark, ...)
src/components/attendance/    domain visuals (DayTimeline, HoursProgress, CorrectionDiff, GeofenceMark, CommentThread)
src/components/shell/         HrShell, InternShell, AuthShell + nav config
src/components/views/hr/      one *View per HR screen (pure: props in, markup out)
src/components/views/intern/  one *View per intern screen
src/components/views/auth/    sign-in, set password, welcome views
src/lib/ui/                   pure helpers: format, status, timeline, hours, password, scan-state
src/lib/ui/queries/           typed view-model queries; return fixtures until modules are implemented
src/lib/ui/fixtures.ts        the canvas sample data, typed
tests/unit/ui-*.test.ts       helper tests
tests/components/*.test.tsx   render tests with react-dom/server (no jsdom needed)
```

Rules:

- **Views are pure.** A route (`page.tsx`) calls a query, then renders `<XxxView data={...} />`. Tests render views with fixtures via `renderToStaticMarkup`.
- **No component reads fixtures directly.** Only `src/lib/ui/queries/*` may import `fixtures.ts`. When a module (`src/modules/*`) is implemented, swap the query body; views don't change.
- **Colors only through tokens** (Tailwind classes backed by CSS variables). No raw hex in components except the white logo pill.
- **Status rendering only through `StatusMark`.** No ad-hoc badges.

---

## 2. Frozen contracts (write these first; slices depend on them)

These files are created in Phase 1 and must not change signature without updating every caller:

- `src/lib/ui/format.ts` — `formatDuration`, `formatDelta`, `formatClock`, `formatShortDate`, `formatLongDate`
- `src/lib/ui/status.ts` — `StatusKind`, `Audience`, `StatusPresentation`, `presentStatus`
- `src/lib/ui/timeline.ts` — `TimelineSegmentInput`, `TimelineSegmentBox`, `layoutTimeline`, `clockToMinutes`
- `src/lib/ui/hours.ts` — `hoursProgress`
- `src/lib/ui/view-models.ts` — every `*ViewModel` type the views accept (Task 9)
- `src/components/shell/nav.ts` — `HR_NAV`, `HrNavId`, `INTERN_TABS`

---

## 3. Slices and file ownership

| Slice | Tasks | Owns | Can start after |
|---|---|---|---|
| **A. Foundation** | 0–5 | configs, `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/lib/ui/*.ts` (not queries) | — |
| **B. Components** | 6–9 | `src/components/ui/*`, `src/components/attendance/*`, `src/components/shell/*`, `src/lib/ui/view-models.ts`, `src/lib/ui/fixtures.ts`, `src/lib/ui/queries/*` | A |
| **C. HR screens** | 10–20 | `src/components/views/hr/*`, `src/app/(hr)/**` | B |
| **D. Intern screens** | 21–26 | `src/components/views/intern/*`, `src/app/(intern)/**`, `src/lib/ui/scan-state.ts` | B |
| **E. Auth and first run** | 27–29 | `src/components/views/auth/*`, `src/app/(auth)/**`, `src/app/(intern)/welcome/**`, `src/lib/ui/password.ts` | B |
| **F. Verify** | 30–31 | none (fixes go back to the owning slice) | C, D, E |

C, D and E touch disjoint files and can run in parallel. If a page needs a new primitive, add it in slice B first; don't create one inside a view folder.

---

## Phase 0 — Tooling

### Task 0: Lint, typecheck and component-test setup

**Files:** `package.json`, `.eslintrc.json` (new), `vitest.config.ts`

1. Install dev dependencies:
   ```bash
   npm install -D eslint@8.57.1 eslint-config-next@<installed next version>
   ```
   (Use the exact `version` from `node_modules/next/package.json` so the lint rules match the framework.)
2. Create `.eslintrc.json`:
   ```json
   { "extends": ["next/core-web-vitals", "next/typescript"] }
   ```
3. Add to `package.json` scripts: `"typecheck": "tsc --noEmit"`.
4. In `vitest.config.ts`, change `include` to `["tests/**/*.test.ts", "tests/**/*.test.tsx"]` and add `esbuild: { jsx: "automatic" }` so `.tsx` tests compile.
5. Run `npm run typecheck`, `npm run lint`, `npm test`. Expect the three existing unit tests to pass. Fix only config errors here.
6. Commit: `chore: add eslint, typecheck script, tsx tests`.

---

## Phase 1 — Foundation (slice A)

### Task 1: Tokens, Tailwind theme and fonts

**Files:** `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx`

1. Replace `src/app/globals.css` with the token layer. Store colors as RGB channels so Tailwind opacity modifiers work:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

   :root {
     --background: 248 250 252;   /* #F8FAFC */
     --foreground: 11 18 32;      /* #0B1220 */
     --card: 255 255 255;
     --muted: 241 245 249;
     --muted-foreground: 94 109 130;
     --border: 214 214 214;       /* #D6D6D6 */
     --hairline: 238 240 243;
     --ring: 26 65 117;
     --primary: 26 65 117;        /* #1A4175 */
     --primary-foreground: 255 255 255;
     --secondary: 148 29 40;      /* #941D28 */
     --secondary-foreground: 255 255 255;
     --accent: 54 98 150;         /* #366296 */
     --accent-foreground: 255 255 255;
     --sidebar: 16 41 76;         /* #10294C */
     --sidebar-foreground: 226 232 240;
     --sidebar-accent: 29 67 115;
     --sidebar-border: 12 32 59;
     --attn: 148 29 40;
     --attn-bg: 246 232 233;
     --pend: 26 65 117;
     --pend-bg: 232 236 242;
     --settled: 54 98 150;
     --negative: 148 29 40;
     --inactive: 126 137 153;
     --track: 238 240 243;
     --schedule-band: 223 229 238;
   }

   [data-theme="dark"] {
     --background: 9 18 32;
     --foreground: 234 240 255;
     --card: 14 28 51;
     --muted: 19 36 64;
     --muted-foreground: 143 160 199;
     --border: 29 51 86;
     --hairline: 22 41 74;
     --ring: 74 123 181;
     --primary: 54 98 150;
     --accent: 74 123 181;
     --sidebar: 10 21 38;
     --sidebar-foreground: 185 198 234;
     --sidebar-accent: 23 47 84;
     --sidebar-border: 19 36 64;
     --attn: 242 167 174;
     --attn-bg: 58 26 34;
     --pend: 169 193 230;
     --pend-bg: 23 41 74;
     --settled: 110 151 204;
     --negative: 224 114 124;
     --inactive: 91 107 133;
     --track: 19 36 64;
     --schedule-band: 27 49 86;
   }

   html, body { height: 100%; }
   body { @apply bg-background text-foreground font-sans antialiased; }
   :focus-visible { outline: 2px solid rgb(var(--ring)); outline-offset: 2px; }
   ```
2. Replace `tailwind.config.ts` `theme.extend`:
   ```ts
   const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
   // colors: background, foreground, card, muted, "muted-foreground", border, hairline, ring,
   //   primary{DEFAULT,foreground}, secondary{...}, accent{...},
   //   sidebar{DEFAULT,foreground,accent,border}, attn{DEFAULT,bg}, pend{DEFAULT,bg},
   //   settled, negative, inactive, track, "schedule-band"  -> each via token(...)
   // fontFamily: sans: ["var(--font-sans)", "Open Sans", "system-ui", "sans-serif"],
   //   heading: ["var(--font-heading)", "Oswald", "sans-serif"],
   //   mono: ["ui-monospace", "SF Mono", "Cascadia Code", "Menlo", "Consolas", "monospace"]
   // borderRadius: chip "4px", nav "8px", btnsm "10px", btn "12px", card "16px"
   // boxShadow: card "0 1px 3px 0 rgba(0,0,0,0.08)"
   // maxWidth: content "1280px"; width: sidebar "224px"; height: topbar "64px"
   ```
   Remove the old `brand` blue scale. Also add `"./src/lib/**/*.{ts,tsx}"` to `content` (status helpers return class names).
3. In `src/app/layout.tsx`, load fonts and set metadata:
   ```tsx
   import { Open_Sans, Oswald } from "next/font/google";
   const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
   const oswald = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading", display: "swap" });
   // <html lang="en" className={`${openSans.variable} ${oswald.variable}`}>
   // metadata.title: "Top Realty Attendance"; viewport themeColor "#1A4175"
   ```
4. Update `src/app/page.tsx` so it no longer uses `text-brand-*` (redirect target comes in Task 27; for now link to `/sign-in`, `/hr`, `/dashboard` with token classes).
5. Run `npm run build`. Expect success.
6. Commit: `feat(ui): brand tokens, tailwind theme, fonts`.

### Task 2: Formatting helpers

**Files:** `src/lib/ui/format.ts`, `tests/unit/ui-format.test.ts`

1. Write the failing test:
   ```ts
   import { describe, expect, it } from "vitest";
   import { formatClock, formatDelta, formatDuration, formatShortDate } from "@/lib/ui/format";

   describe("formatDuration", () => {
     it("formats minutes as h and zero-padded m", () => {
       expect(formatDuration(481)).toBe("8h 01m");
       expect(formatDuration(18750)).toBe("312h 30m");
       expect(formatDuration(0)).toBe("0h 00m");
     });
     it("never goes negative", () => expect(formatDuration(-5)).toBe("0h 00m"));
   });

   describe("formatDelta", () => {
     it("signs the value", () => {
       expect(formatDelta(481)).toBe("+8h 01m");
       expect(formatDelta(-360)).toBe("−6h 00m");
     });
   });

   describe("formatClock", () => {
     const t = new Date("2026-10-19T00:57:12Z"); // 08:57:12 in Manila
     it("uses the office time zone, 24-hour", () => {
       expect(formatClock(t, "Asia/Manila")).toBe("08:57");
       expect(formatClock(t, "Asia/Manila", { seconds: true })).toBe("08:57:12");
     });
   });

   describe("formatShortDate", () => {
     it("formats office-local dates", () => {
       expect(formatShortDate("2026-10-15")).toBe("Oct 15");
       expect(formatShortDate("2026-10-15", { weekday: true })).toBe("Thu, Oct 15");
     });
   });
   ```
2. Run `npx vitest run tests/unit/ui-format.test.ts`. Expect failure (module missing).
3. Implement:
   ```ts
   export function formatDuration(minutes: number): string {
     const m = Math.max(0, Math.trunc(minutes));
     return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
   }

   export function formatDelta(minutes: number): string {
     const sign = minutes < 0 ? "−" : "+";
     return `${sign}${formatDuration(Math.abs(minutes))}`;
   }

   export function formatClock(date: Date, timeZone: string, opts: { seconds?: boolean } = {}): string {
     return new Intl.DateTimeFormat("en-GB", {
       hour: "2-digit", minute: "2-digit", ...(opts.seconds ? { second: "2-digit" } : {}),
       hourCycle: "h23", timeZone,
     }).format(date);
   }

   /** `isoDate` is an office-local YYYY-MM-DD; format it without shifting time zones. */
   export function formatShortDate(isoDate: string, opts: { weekday?: boolean } = {}): string {
     const d = new Date(`${isoDate}T12:00:00Z`);
     return new Intl.DateTimeFormat("en-US", {
       month: "short", day: "numeric", ...(opts.weekday ? { weekday: "short" } : {}), timeZone: "UTC",
     }).format(d);
   }

   export function formatLongDate(isoDate: string): string {
     const d = new Date(`${isoDate}T12:00:00Z`);
     return new Intl.DateTimeFormat("en-US", {
       weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
     }).format(d);
   }
   ```
4. Run the test. Expect pass.
5. Commit: `feat(ui): duration, clock and date formatters`.

### Task 3: Status presentation

**Files:** `src/lib/ui/status.ts`, `tests/unit/ui-status.test.ts`

1. Write the failing test. Cover the full mapping table in spec §4.1, plus these invariants:
   ```ts
   import { describe, expect, it } from "vitest";
   import { presentStatus } from "@/lib/ui/status";

   it("only action-required states are chips", () => {
     expect(presentStatus({ type: "session", value: "REVIEW" }, "hr").shape).toBe("chip");
     expect(presentStatus({ type: "correction", value: "PENDING", ageWorkdays: 1 }, "hr")).toMatchObject({ shape: "chip", tone: "pend", label: "Pending" });
     expect(presentStatus({ type: "session", value: "COMPLETE" }, "hr").shape).toBe("dot");
   });

   it("escalates old pending corrections for HR", () => {
     expect(presentStatus({ type: "correction", value: "PENDING", ageWorkdays: 3 }, "hr")).toMatchObject({ shape: "chip", tone: "attn", label: "Needs review" });
   });

   it("tiers NEEDS_INFO by audience", () => {
     expect(presentStatus({ type: "correction", value: "NEEDS_INFO" }, "hr")).toMatchObject({ shape: "ring", tone: "pend", label: "Waiting on intern" });
     expect(presentStatus({ type: "correction", value: "NEEDS_INFO" }, "intern")).toMatchObject({ shape: "chip", tone: "attn", label: "Reply needed" });
   });

   it("open sessions are live", () => {
     expect(presentStatus({ type: "session", value: "OPEN" }, "hr")).toMatchObject({ shape: "live", label: "In office" });
   });
   ```
   Add one `it.each` row per enum value in spec §4.1 for both audiences.
2. Run it; expect failure.
3. Implement:
   ```ts
   import type {
     AttendanceSessionStatus, CorrectionRequestStatus, InternshipStatus, ScanValidationStatus, UserStatus,
   } from "@prisma/client";

   export const REVIEW_THRESHOLD_WORKDAYS = 3; // spec §4.2, confirm with HR

   export type Audience = "hr" | "intern";
   export type StatusKind =
     | { type: "session"; value: AttendanceSessionStatus }
     | { type: "correction"; value: CorrectionRequestStatus; ageWorkdays?: number }
     | { type: "scan"; value: ScanValidationStatus }
     | { type: "account"; value: UserStatus }
     | { type: "internship"; value: InternshipStatus };

   export interface StatusPresentation {
     shape: "chip" | "ring" | "dot" | "live";
     tone: "attn" | "pend" | "settled" | "negative" | "inactive";
     label: string;
     muted?: boolean;
   }

   export function presentStatus(kind: StatusKind, audience: Audience): StatusPresentation {
     // switch on kind.type, then kind.value; implement exactly the table in spec §4.1.
     // Use an exhaustive `never` check in each switch so a new enum value breaks the build.
   }
   ```
4. Run; expect pass. Run `npm run typecheck`.
5. Commit: `feat(ui): attention-tiered status presentation`.

### Task 4: Day timeline geometry

**Files:** `src/lib/ui/timeline.ts`, `tests/unit/ui-timeline.test.ts`

1. Failing test using canvas numbers (window 08:00–20:00):
   ```ts
   import { clockToMinutes, layoutTimeline } from "@/lib/ui/timeline";

   const win = { startMin: clockToMinutes("08:00"), endMin: clockToMinutes("20:00") };

   it("positions a complete session", () => {
     const [box] = layoutTimeline(win, [{ startMin: clockToMinutes("09:04"), endMin: clockToMinutes("18:05"), state: "complete" }]);
     expect(box!.leftPct).toBeCloseTo(8.89, 2);
     expect(box!.widthPct).toBeCloseTo(75.14, 2);
     expect(box!.openRight).toBe(false);
   });

   it("extends an open session to now", () => {
     const [box] = layoutTimeline(win, [{ startMin: 537, endMin: null, state: "open" }], 881);
     expect(box!.widthPct).toBeCloseTo((881 - 537) / 720 * 100, 2);
   });

   it("runs an unbounded session to the edge and flags it", () => {
     const [box] = layoutTimeline(win, [{ startMin: 544, endMin: null, state: "open" }]);
     expect(box!.leftPct + box!.widthPct).toBeCloseTo(100, 5);
     expect(box!.openRight).toBe(true);
   });

   it("clamps sessions outside the window", () => {
     const [box] = layoutTimeline(win, [{ startMin: 970, endMin: 1480, state: "review" }]); // 16:10 -> 00:40 next day
     expect(box!.leftPct + box!.widthPct).toBeCloseTo(100, 5);
     expect(box!.openRight).toBe(true);
   });
   ```
2. Implement `clockToMinutes("HH:MM")` and `layoutTimeline(window, segments, nowMin?)`: clamp start/end into the window; `end = endMin ?? nowMin ?? window.endMin`; `openRight = end > window.endMin || (endMin === null && nowMin === undefined)`; percentages relative to window length. Also export `scheduleBand(window, schedule)` returning `{ leftPct, widthPct }`.
3. Run; pass. Commit: `feat(ui): day timeline geometry`.

### Task 5: Hours progress

**Files:** `src/lib/ui/hours.ts`, `tests/unit/ui-hours.test.ts`

1. Failing test:
   ```ts
   import { hoursProgress } from "@/lib/ui/hours";

   it("matches Ana's numbers on the canvas", () => {
     const p = hoursProgress({ creditedMinutes: 18750, requiredMinutes: 29160, workdaysLeft: 29 });
     expect(p.percent).toBe(64);
     expect(p.remainingMinutes).toBe(10410);
     expect(p.pacePerWorkdayMinutes).toBe(360); // rounded up to 5 min, shown as "about 6h 00m"
   });

   it("caps at 100 and zero remaining", () => {
     expect(hoursProgress({ creditedMinutes: 30000, requiredMinutes: 29160 })).toMatchObject({ percent: 100, remainingMinutes: 0 });
   });
   ```
2. Implement: `percent = min(100, floor(credited / required * 100))`; `remainingMinutes = max(required - credited, 0)`; `pacePerWorkdayMinutes = workdaysLeft ? ceil(remaining / workdaysLeft / 5) * 5 : undefined`.
3. Run; pass. Commit: `feat(ui): hours progress helper`.

---

## Phase 2 — Components (slice B)

Each component task: write a render test in `tests/components/<name>.test.tsx` using `renderToStaticMarkup`, watch it fail, implement, pass, commit. Match the canvas artboards for sizes and spacing (spec §2).

### Task 6: Primitives

**Files:** `src/lib/utils.ts` (`cn = (...c) => twMerge(clsx(c))`), `src/components/ui/{button,card,page-header,kpi-strip,data-table,tabs,banner,fields,status-mark,jev-tag,empty-state}.tsx`, `tests/components/primitives.test.tsx`

Tests to write first:
- `StatusMark` renders the label text, uses `bg-attn-bg text-attn` for an attn chip, renders a hollow ring element for `NEEDS_INFO` with audience `hr`, renders the `meta` in a mono span.
- `JevTag` renders `JEV` + category when `SUCCEEDED`; renders "Manual review" and no `JEV` text when `FAILED`; struck-through category with "covers v2" when `SUPERSEDED`.
- `Button` renders `<button type="button">` by default and an `<a>` when given `href`; icon-only requires `aria-label` (TypeScript-level: make `aria-label` required when `size="icon"`).
- `Tabs` marks the active tab with `aria-selected="true"`; `countAttention` renders the count in `text-attn`.
- `Banner` with `tone="conflict"` has `role="alert"`.

Implementation notes (from the canvas):
- Button: `h-9 px-4 rounded-btn text-sm font-medium`; `sm` = `h-8 px-3 rounded-btnsm text-xs`; phone call sites pass `size="lg"` (`h-12 text-[15px] font-semibold`). Variants: primary (`bg-primary`), secondary (`bg-secondary`), accent (`bg-accent font-semibold`), outline (`bg-card border-border shadow-card`), ghost.
- Card: `bg-card border border-border rounded-card shadow-card`; header `p-5`; `section` titles use `font-heading uppercase text-base font-semibold tracking-[0.02em]`.
- KpiStrip: grid with `gap-px bg-border` dividers; value `font-heading text-[32px] leading-9 font-bold tabular-nums`.
- DataTable: header `text-xs font-semibold text-muted-foreground border-b border-border`; rows `border-b border-hairline`; first/last cell `px-5`; wrap in `overflow-x-auto`.

Commit: `feat(ui): primitives`.

### Task 7: Attendance visuals

**Files:** `src/components/attendance/{day-timeline,hours-progress,correction-diff,geofence-mark,comment-thread}.tsx`, `tests/components/attendance.test.tsx`

Tests first:
- `DayTimeline` renders one segment element per input with inline `left`/`width` percentages from `layoutTimeline`; `review` segments use a dashed `border-attn`; an open-right segment has no right border; the text summary under the bar is present when `summary` is given; the bar is `aria-hidden`.
- `HoursProgress` `full` shows `312h 30m`, `of 486h`, `173h 30m left`; `compact` shows the bar plus `312h 30m / 486h`.
- `CorrectionDiff` highlights only `changed` cells with `bg-pend-bg text-pend`, shows "Not recorded" in italic for empty recorded values, and renders `+8h 01m` from the credited delta.
- `GeofenceMark` has `role="img"` and an `aria-label` that states distance, radius and whether it was accepted.

Commit: `feat(ui): attendance visuals`.

### Task 8: Shells and navigation

**Files:** `src/components/shell/{nav.ts,hr-shell.tsx,hr-sidebar.tsx,hr-topbar.tsx,intern-shell.tsx,intern-tabbar.tsx,auth-shell.tsx}`, `public/brand/top-realty-mark.png`, `public/brand/top-realty-logo.png`, `public/brand/top-realty-logo-white.png`, `tests/components/shell.test.tsx`

1. Copy the three logo files from `TRCIT_Ticketing_System/public/images/` (`top-realty-mark-hd.png`, `top-realty-logo.png`, `top-realty-logo-white.png`) into `public/brand/` with the names above.
2. `nav.ts`:
   ```ts
   export type HrNavId = "overview" | "interns" | "attendance" | "reviews" | "reports" | "office" | "policies" | "departments" | "audit";
   export const HR_NAV = [
     { id: "overview", label: "Overview", href: "/hr", icon: "LayoutDashboard" },
     { id: "interns", label: "Interns", href: "/hr/interns", icon: "Users" },
     { id: "attendance", label: "Attendance", href: "/hr/attendance", icon: "Clock" },
     { id: "reviews", label: "Reviews", href: "/hr/reviews", icon: "ClipboardCheck", countKey: "reviews" },
     { id: "reports", label: "DTR reports", href: "/hr/reports", icon: "FileText" },
     { group: "Setup" },
     { id: "office", label: "Office and QR", href: "/hr/setup", icon: "QrCode" },
     { id: "policies", label: "Policies", href: "/hr/setup/policies", icon: "Scale" },
     { id: "departments", label: "Departments", href: "/hr/setup/departments", icon: "Building2" },
     { id: "audit", label: "Audit log", href: "/hr/audit", icon: "History" },
   ] as const;
   export const INTERN_TABS = [
     { id: "home", label: "Home", href: "/dashboard" },
     { id: "scan", label: "Scan", href: "/scan" },
     { id: "history", label: "History", href: "/history" },
     { id: "corrections", label: "Corrections", href: "/corrections" },
   ] as const;
   ```
3. Tests first: the active HR link has `aria-current="page"` and `bg-sidebar-accent`; the Reviews count pill swaps to `bg-[#D6D6D6] text-primary` when active (ticketing behavior); `InternTabBar` marks one tab current; `HrTopbar` renders a breadcrumb when given one.
4. Layout from the canvas: sidebar `flex: 1 1 224px` in a wrapping row so it stacks on narrow screens; content `flex: 999 1 560px; min-width: 0`; top bar 64 px; main `p-8`, inner `max-w-content mx-auto flex flex-col gap-5`. Intern shell: 56 px header, 72 px tab bar, content `p-4`.
5. Commit: `feat(ui): HR, intern and auth shells`.

### Task 9: View models, fixtures and queries

**Files:** `src/lib/ui/view-models.ts`, `src/lib/ui/fixtures.ts`, `src/lib/ui/queries/{hr.ts,intern.ts,auth.ts}`, `tests/unit/ui-fixtures.test.ts`

1. Define one view-model type per screen (e.g. `HrOverviewVM`, `ReviewQueueVM`, `ReviewDetailVM`, `AttendanceDayVM`, `InternListVM`, `InternProfileVM`, `DtrPreviewVM`, `OfficeSetupVM`, `PolicyVersionsVM`, `DepartmentsVM`, `AuditLogVM`, `InternHomeVM`, `InternHistoryVM`, `InternCorrectionsVM`, `InternCorrectionDetailVM`). Times are office-local `"HH:MM"` strings and minutes are integers; views never do time-zone math.
2. `fixtures.ts`: transcribe the canvas sample data (Ana Reyes, Paolo Cruz, Bea Santos, Nina Garcia, Marco Dela Cruz, Jessa Lim, Carlo Bautista, Luis Ramos, Rina Mendoza, Miguel Torres, Joel Navarro; the Oct 15 correction thread; the Oct 1–15 DTR rows; policy v1–v3; QR checkpoints; audit entries). Decide on spec §9 item 5 (weekend dates) here and keep it consistent everywhere.
3. Test the fixtures for internal consistency so screens agree with each other:
   - Department active counts sum to the Interns screen's active total (24) and finished to 9.
   - Ana's credited minutes equal the sum of her credited days used on the profile and DTR fixtures.
   - The DTR total for Oct 1–15 equals the sum of its rows (4121 minutes, `68h 41m`).
4. Queries: `async function getHrOverview(): Promise<HrOverviewVM>` etc., each returning fixtures with a `// TODO(module): replace with src/modules/... call` comment naming the module function from the technical design (e.g. `listCorrections`, `getInternshipSummary`).
5. Commit: `feat(ui): view models, canvas fixtures, query stubs`.

---

## Phase 3 — HR screens (slice C)

Each task follows the same pattern:

1. **Test first** in `tests/components/hr-<screen>.test.tsx`: render the view with its fixture and assert the listed checks.
2. **Build the view** in `src/components/views/hr/<screen>-view.tsx` from existing components only.
3. **Wire the route** in the listed `page.tsx`: `const data = await getXxx(); return <HrShell active=... title=...><XxxView data={data} /></HrShell>`.
4. Compare side by side with the canvas artboard at 1440 px and at 390 px width.
5. Commit: `feat(hr): <screen>`.

| Task | Route file | View | Canvas artboard | Test checks |
|---|---|---|---|---|
| 10 | `src/app/(hr)/hr/page.tsx` | `overview-view.tsx` | Overview | 4 KPIs, "Waiting on HR" value uses `text-attn`; "Needs you" rows link to `/hr/reviews/[id]`; oldest row shows `4d` in `text-attn`; hours table sorted furthest behind first |
| 11 | `src/app/(hr)/hr/reviews/page.tsx` | `reviews-view.tsx` | Reviews queue | Tabs with counts (Waiting on you count in `text-attn`); exactly one "Needs review" chip in the fixture; "Waiting on intern" rows render rings; advisory note text present |
| 12 | `src/app/(hr)/hr/reviews/[id]/page.tsx` (new) | `review-detail-view.tsx` | Review detail | Diff highlights Time out only; two timelines; three comments in order; decision note `<textarea>` has a `<label>` and is required; three decision buttons; Jev card says "Advisory only" and the covered version; evidence `GeofenceMark`; `conflict` prop renders the 409 banner with `role="alert"` |
| 13 | `src/app/(hr)/hr/attendance/page.tsx` | `attendance-view.tsx` | Attendance records | Rows grouped under day headers; each row has a `DayTimeline` with a text summary; open sessions show `—` credited; detail panel shows original scans under an "HR only" label |
| 14 | `src/app/(hr)/hr/interns/page.tsx` + `add-intern-dialog.tsx` | `interns-view.tsx` | Interns | Tabs with counts; setup-pending row has a Resend button; disabled row text is muted; dialog fields have labels; "Passwords are never sent by email" copy present |
| 15 | `src/app/(hr)/hr/interns/[id]/page.tsx` (new) | `intern-profile-view.tsx` | Intern profile | Hours card numbers from `hoursProgress`; pace sentence; Disable account button uses the crimson outline style; 7-day list renders the Oct 15 row with a "Needs review" chip |
| 16 | `src/app/(hr)/hr/reports/page.tsx` | `reports-view.tsx` | DTR reports | Multi-session days render one line per session; pending row shows the "Pending" chip; total equals `68h 41m`; pending notice present; Export CSV button |
| 17 | `src/app/(hr)/hr/setup/page.tsx` (new) | `office-setup-view.tsx` | Office and QR setup | Example-values banner; radius/accuracy inputs; QR table with a revoked row rendered muted; rotate warning copy |
| 18 | `src/app/(hr)/hr/setup/policies/page.tsx` (new) | `policies-view.tsx` | Policies | Versions list with Draft/Active/Superseded marks; changed rounding field outlined with "Changed · was …"; worked example shows `7h 55m`; Publish button |
| 19 | `src/app/(hr)/hr/setup/departments/page.tsx` (new) | `departments-view.tsx` | Departments | No delete action anywhere; inactive row has Reactivate; Add department form with label |
| 20 | `src/app/(hr)/hr/audit/page.tsx` (new) | `audit-log-view.tsx` | Audit log | System actor rendered italic muted; expanded row shows Before/After grid; footnote about excluded evidence |

Wire the Reviews count in `HrShell` from `getHrOverview().waitingOnHr` (Task 10) so every page shows the same number.

---

## Phase 4 — Intern screens (slice D)

### Task 21: Scan state machine

**Files:** `src/lib/ui/scan-state.ts`, `tests/unit/ui-scan-state.test.ts`

1. Failing tests (reducer, no React):
   ```ts
   import { initialScanState, scanReducer } from "@/lib/ui/scan-state";

   it("goes ready -> checking on decode and keeps one request key", () => {
     const s1 = scanReducer(initialScanState("TIME_IN"), { type: "decoded", checkpoint: "Main entrance · IN", requestKey: "k1" });
     expect(s1).toMatchObject({ status: "checking", requestKey: "k1" });
   });

   it("ignores a second decode while checking", () => {
     const s1 = scanReducer(initialScanState("TIME_IN"), { type: "decoded", checkpoint: "x", requestKey: "k1" });
     expect(scanReducer(s1, { type: "decoded", checkpoint: "y", requestKey: "k2" })).toBe(s1);
   });

   it("lands on unconfirmed after a timeout and re-checks the same key", () => {
     let s = scanReducer(initialScanState("TIME_OUT"), { type: "decoded", checkpoint: "x", requestKey: "k1" });
     s = scanReducer(s, { type: "timeout" });
     expect(s.status).toBe("unconfirmed");
     s = scanReducer(s, { type: "recheck" });
     expect(s).toMatchObject({ status: "checking", requestKey: "k1" });
   });

   it("never shows saved without a committed receipt", () => {
     const s = scanReducer(initialScanState("TIME_IN"), { type: "saved", receipt: { id: "r", action: "TIME_IN", receivedAtUtc: "2026-10-19T00:57:12Z" } });
     expect(s.status).toBe("ready"); // saved is only accepted from checking
   });
   ```
2. Implement the reducer with states `ready | checking | saved | failed | unconfirmed` and events `decoded | saved | failed | timeout | recheck | reset`. `reset` from `saved`/`failed` returns to `ready` with a new expected action.
3. Pass; commit: `feat(intern): scan state machine`.

### Tasks 22–26: Intern views

Same pattern as Phase 3 (test → view in `src/components/views/intern/` → route → compare at 390 × 844 → commit).

| Task | Route file | View(s) | Canvas artboards | Test checks |
|---|---|---|---|---|
| 22 | `src/app/(intern)/scan/page.tsx` (+ `scan-client.tsx`, `"use client"`) | `scan-ready-view.tsx`, `scan-checking-view.tsx`, `scan-saved-view.tsx`, `scan-failed-view.tsx`, `scan-unconfirmed-view.tsx` | Scan · ready, checking, Time in saved, Time out saved, Scan not saved, Save not confirmed | Checking says "Not saved yet" and has no `settled` color; saved shows server time with seconds and receipt; Time out saved shows `+8h 00m` and totals; failed shows distance/accuracy vs. limits and "No Time in was recorded"; unconfirmed's primary button is "Check again" and there is no "Scan again" button. Camera integration (`@zxing/browser`) stays behind an interface `ScanCamera` and is mocked in tests. |
| 23 | `src/app/(intern)/dashboard/page.tsx` | `home-view.tsx` | Home | Live "In office" mark; timeline; "Scan OUT" links to `/scan`; hours card; open correction card links to `/corrections/[id]` |
| 24 | `src/app/(intern)/history/page.tsx` | `history-view.tsx` | History | Month totals; one row per day; empty day links to `/corrections/new?date=…` |
| 25 | `src/app/(intern)/corrections/page.tsx`, `.../corrections/new/page.tsx` (new) | `corrections-view.tsx`, `new-correction-view.tsx` | Corrections, Request a correction | Open/Decided groups; rejected shows HR's reason; form: five reason options as `aria-pressed` toggle buttons, Time out outlined as proposed, explanation has a label, submit says "Send to HR" |
| 26 | `src/app/(intern)/corrections/[id]/page.tsx` (new) | `correction-detail-view.tsx` | Correction detail | Change summary with `+8h 01m`; bubbles in order with HR's "asked for more info" label; reply textarea labelled; "Send a new request" link copy says it replaces this one |

---

## Phase 5 — Auth and first run (slice E)

### Task 27: Password rules helper

**Files:** `src/lib/ui/password.ts`, `tests/unit/ui-password.test.ts`

1. Failing test: `checkPassword({ password, repeat, email })` returns `{ minLength, notEmail, matches }`; `"leasing2026"` with matching repeat and email `rina.mendoza@school.edu.ph` passes all three; `"short"` fails `minLength`; the email itself (or its local part) fails `notEmail`.
2. Implement (min 8 per Better Auth default; keep the number in one constant).
3. Commit: `feat(auth): password checklist helper`.

### Task 28: Sign-in and set password

**Files:** `src/app/(auth)/layout.tsx`, `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/set-password/page.tsx`, `src/components/views/auth/{sign-in-view,set-password-view}.tsx`, `tests/components/auth.test.tsx`

Test checks: inputs have labels and `autocomplete` (`username`, `current-password`, `new-password`); no sign-up link exists; the error state uses `role="alert"`; set-password shows the live checklist from `checkPassword` and the expired state replaces the form. Desktop layout = navy brand panel + form (`AuthShell variant="desktop"`); below 768 px it switches to the phone layout. Wire submit to Better Auth (`src/lib/auth.ts`) only when the auth module is ready; until then the form posts to a stub route that returns the canvas error state.

Commit: `feat(auth): sign-in and set password`.

### Task 29: First run

**Files:** `src/app/(intern)/welcome/{camera,location,location-blocked}/page.tsx`, `src/components/views/auth/{welcome-camera,welcome-location,location-blocked}-view.tsx`, `tests/components/welcome.test.tsx`

Test checks: progress bar has `role="progressbar"` with the right `aria-valuenow`; each screen lists its three promises; "Allow" buttons call `navigator.mediaDevices.getUserMedia` / `navigator.geolocation.getCurrentPosition` through an injectable `permissions` prop (mocked in tests); a denied location routes to `/welcome/location-blocked`; the blocked screen has steps for Chrome on Android and Safari on iPhone.

Commit: `feat(intern): first-run permission screens`.

---

## Phase 6 — Verification (slice F)

### Task 30: Responsive and accessibility pass

1. Run `npm run dev` and open every route at 1440, 1024, 768 and 390 px. HR sidebar must stack (not overflow) below ~800 px; wide tables must scroll inside their card; no horizontal page scroll.
2. Keyboard-only pass: every control reachable, visible 2 px `ring` focus, dialogs trap focus and close on Escape.
3. Check contrast on any color pair not listed in spec §2.1.
4. File fixes against the owning slice's files; commit per fix.

### Task 31: Full verification gate

Run, in order, and record the output in the PR description:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

All four must pass. Then compare each route against its canvas artboard one last time and list any intentional differences.

---

## 7. Done means

- Every route in spec §6 renders from fixtures with the shells, tokens and status system in spec §2 and §4.
- All helper and view tests pass; typecheck, lint and build are clean.
- No raw hex colors in components (except the white logo pill), no emoji, no ad-hoc badges.
- Queries are the only importers of `fixtures.ts`, each with a TODO naming the module function that replaces it.
- Open items in spec §9 are still listed (not silently decided), except weekend dates, which Task 9 settles.
