# Top Realty Attendance — UI Design Spec

- **Date:** 2026-10-19
- **Status:** Draft for review (design approved on the canvas; this document records it)
- **Scope:** HR admin panel (desktop), intern app (phone), sign-in and first run
- **Design source of truth:** Claude Design canvas "Top Realty HR Admin Panel" — https://claude.ai/artifact/ANGEk1BrvmdCaU5AJk7hKg (private; share from its Share menu)
- **Product sources:** `Top_Realty_Intern_Attendance_Master_Document_v1_0.md`, `Top_Realty_Attendance_Technical_Design_v1_0.md`
- **Visual reference:** TRC IT Ticketing System (`TRCIT_Ticketing_System/src/app/globals.css`, `src/components/layout/*`, `.agents/rules/brand-colors.md`)

---

## 1. Decisions already made

| # | Decision | Notes |
|---|---|---|
| D1 | Follow the ticketing system's **strict 4-color brand**: `#1A4175` navy, `#941D28` crimson, `#366296` mid blue, `#D6D6D6` gray, plus white surfaces, `#0B1220` ink and `#10294C` sidebar navy. | No green, amber or other hues. No gradients. No emoji. Lucide icons only. |
| D2 | **Attention-tiered status system** (Section 4). Color shows where someone must act, not the category. | Replaced an earlier "every badge is a tinted pill" draft that was rejected as noisy. |
| D3 | **Sentence-case table headers** in this product (ticketing uses uppercase). Page and section titles stay Oswald uppercase. | Deliberate departure from ticketing. |
| D4 | Fonts: **Open Sans** (UI) and **Oswald** (titles, KPI numbers), via `next/font/google`. Monospace for every time, duration and date in tables. | Same families as ticketing. |
| D5 | Shell copied from ticketing: 224 px navy sidebar with white logo pill, 64 px top bar, 1280 px max content width. | |
| D6 | No design-system artifact. Tokens live in code (`src/app/globals.css` + `tailwind.config.ts`). | An empty "Top Realty HR" design-system artifact exists (https://claude.ai/artifact/4YhkFUDkKkTiD8Vtn3gFbV); fill or delete later. |
| D7 | Light theme ships first. Dark values are defined below but not drawn on the canvas. | Dark mode is a follow-up. |

---

## 2. Tokens

Define colors as CSS variables on `:root` (light) and `[data-theme="dark"]`, exposed to Tailwind. Names mirror the ticketing variables so the two codebases read the same.

### 2.1 Color

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F8FAFC` | `#091220` | Page canvas |
| `foreground` | `#0B1220` | `#EAF0FF` | Primary text |
| `card` | `#FFFFFF` | `#0E1C33` | Cards, tables, inputs, active tab |
| `muted` | `#F1F5F9` | `#132440` | Row hover, tab rail, selected row |
| `muted-foreground` | `#5E6D82` | `#8FA0C7` | Secondary text, table headers (≥5.0:1) |
| `border` / `input` | `#D6D6D6` | `#1D3356` | Card outlines, field outlines, header rule |
| `hairline` | `#EEF0F3` | `#16294A` | Row dividers |
| `ring` | `#1A4175` | `#4A7BB5` | Focus ring, 2 px solid, 2 px offset |
| `primary` | `#1A4175` | `#366296` | Primary button, active states |
| `secondary` / `destructive` | `#941D28` | `#941D28` | Reject, disable, destructive |
| `accent` | `#366296` | `#4A7BB5` | Approve button, links in charts |
| `sidebar` | `#10294C` | `#0A1526` | Sidebar |
| `sidebar-foreground` | `#E2E8F0` | `#B9C6EA` | Sidebar text |
| `sidebar-accent` | `#1D4373` | `#172F54` | Active/hover nav item |
| `sidebar-border` | `#0C203B` | `#132440` | Sidebar dividers |
| `attn` | `#941D28` | `#F2A7AE` | "Needs review" chip text, overdue ages (≥7:1) |
| `attn-bg` | `#F6E8E9` | `#3A1A22` | "Needs review" chip, conflict banner |
| `pend` | `#1A4175` | `#A9C1E6` | "Pending" chip text, In office, waiting ring, open session |
| `pend-bg` | `#E8ECF2` | `#17294A` | "Pending" chip, open session fill, changed-value highlight, info banner |
| `settled` | `#366296` | `#6E97CC` | Settled dot, completed session, progress fill, JEV tag |
| `negative` | `#941D28` | `#E0727C` | Rejected dot |
| `inactive` | `#7E8999` | `#5B6B85` | Hollow ring for superseded/void/disabled (≥3:1 as a mark) |
| `track` | `#EEF0F3` | `#132440` | Progress and timeline track |
| `schedule-band` | `#DFE5EE` | `#1B3156` | Scheduled-hours band in a timeline |

### 2.2 Type scale

| Style | Font | Size / line | Weight | Notes |
|---|---|---|---|---|
| `kpi` | Oswald | 32 / 36 | 700 | Tabular numerals |
| `page-title` | Oswald | 22 / 28 | 700 | Uppercase, +0.01em |
| `section-title` | Oswald | 16 / 22 | 600 | Uppercase, +0.02em |
| `topbar-title` | Oswald | 16 / 22 | 700 | Sentence case |
| `card-title` | Open Sans | 14 / 20 | 600 | |
| `body` | Open Sans | 14 / 21 | 400 | Phone body: 15 / 23 |
| `table-cell` | Open Sans | 13 / 18 | 400 | |
| `nav` | Open Sans | 13 / 18 | 500 (600 active) | |
| `sub` | Open Sans | 12 / 18 | 400 | `muted-foreground` |
| `table-header` | Open Sans | 12 / 16 | 600 | Sentence case, `muted-foreground` |
| `chip` | Open Sans | 12 / 16 | 600 | The two chips only |
| `tag` | Open Sans | 11 / 16 | 600 | +0.06em, uppercase. JEV tag and sidebar group labels. Never below 11 px. |
| `time` | Mono | 13 / 18 | 500 | All clock times, durations, table dates, ages |

### 2.3 Spacing, radius, elevation, sizes

- **Spacing:** 4, 8, 12, 16, 20 (card padding), 24 (top bar side padding), 32 (desktop page padding).
- **Radius:** chip 4, nav/timeline 8, small button/tab 10, button/input/banner 12, card 16, pill/avatar 999. Phone cards 16–20.
- **Shadow:** one only, `0 1px 3px rgba(0,0,0,.08)` (dark `.35`), on cards, KPI strip, active tab and primary buttons.
- **Sizes:** sidebar 224, top bar 64, content max 1280, control 36 (desktop) / 44–48 (phone), small control 32, touch target ≥ 44 on phone.

---

## 3. Copy and formatting rules

- Sentence case everywhere except page/section titles (Oswald uppercase) and the `tag` style.
- Clock times: 24-hour, mono, `09:04`. Seconds only on confirmations and evidence (`08:57:12`).
- Durations: `8h 01m`, `312h 30m`, never decimals. Deltas: `+8h 01m` in `settled`.
- Dates in tables: `Oct 15`; with weekday in lists: `Thu, Oct 15`; full on headers: `Monday, October 19, 2026`.
- Missing values: italic `muted-foreground` text ("Not recorded", "no Time out"), never a dash alone except in numeric cells that have nothing yet (`—`).
- Placeholders for unknown facts stay in brackets: `[HR NAME]`, `[company email]`, `[LATITUDE], [LONGITUDE]`, `[SUPERVISOR NAME]`.
- Policy and geofence numbers are marked as examples until HR confirms them (a `pend-bg` info banner on Office and QR, and Policies).
- Jev is always called advisory. It never approves, rejects or changes hours, and the UI says so near the reading.

---

## 4. Status system

Three shapes, used everywhere:

| Shape | Meaning | Markup |
|---|---|---|
| **Chip** (filled 4 px-radius rectangle, 12 px semibold) | Someone **must act now**. Only two exist: `attn` chip and `pend` chip. | `bg-attn-bg text-attn` / `bg-pend-bg text-pend` |
| **Ring** (5 px hollow circle) | Live or waiting on someone else | `border-pend` or `border-inactive` |
| **Dot** (7 px filled circle) + word | Settled history | `bg-settled` or `bg-negative` |

"In office" is a dot with a 3 px `pend` halo (live). Every status carries a word; color is never the only signal.

### 4.1 Mapping to schema enums

The tier depends on **who is looking**. The HR view and the intern view of the same record can differ.

| Enum value | HR view | Intern view |
|---|---|---|
| `AttendanceSessionStatus.OPEN` | Live dot "In office" + `since 08:57` | Live dot "In office" |
| `AttendanceSessionStatus.COMPLETE` | Settled dot "Complete" | Settled dot "Complete" |
| `AttendanceSessionStatus.REVIEW` | **Attn chip "Needs review"** | Ring navy "Waiting on HR" |
| `AttendanceSessionStatus.VOID` | Ring gray "Void" (muted text) | Ring gray "Void" |
| `CorrectionRequestStatus.PENDING` | **Pend chip "Pending"** (Attn chip "Needs review" once older than the review threshold, see 4.2) | Ring navy "Waiting on HR" |
| `CorrectionRequestStatus.NEEDS_INFO` | Ring navy "Waiting on intern" | **Attn chip "Reply needed"** |
| `CorrectionRequestStatus.APPROVED` | Settled dot "Approved" | Settled dot "Approved" + `+7h 35m` |
| `CorrectionRequestStatus.REJECTED` | Negative dot "Rejected" | Negative dot "Rejected" + HR's reason |
| `CorrectionRequestStatus.SUPERSEDED` | Ring gray "Superseded" | Ring gray "Replaced" |
| `ScanValidationStatus.ACCEPTED` | Settled dot "Accepted" | (shown as the session) |
| `ScanValidationStatus.REJECTED` | Negative dot "Scan rejected" | Not-saved screen |
| `ScanValidationStatus.UNCERTAIN` | Negative dot "Location uncertain" | Not-saved screen with retry |
| `UserStatus.PENDING` | Ring navy "Setup pending" + resend | n/a |
| `UserStatus.ACTIVE` | Settled dot "Active" | n/a |
| `UserStatus.DISABLED` | Ring gray "Disabled" + "Records kept" | n/a |
| `InternshipStatus.COMPLETED` | Ring gray "Finished" | n/a |
| `JevRunStatus.SUCCEEDED` | `JEV` tag + category (+ score on detail) | Not shown |
| `JevRunStatus.PENDING` / `RUNNING` | Muted `JEV` tag + "Reading…" | Not shown |
| `JevRunStatus.FAILED` | Muted text "Manual review" | Not shown |
| `JevRunStatus.SUPERSEDED` | Muted `JEV` tag, struck-through category, "covers v2" | Not shown |

### 4.2 Open question on the review threshold

The canvas shows the oldest pending correction (4 days) as "Needs review" and newer ones as "Pending". The age threshold is not in the docs. Default proposal: **3 workdays**, configurable. Confirm with HR.

---

## 5. Components

Shared React components. Props below are the frozen contract for implementation slices.

| Component | Props (summary) | Used on |
|---|---|---|
| `StatusMark` | `{ kind: StatusKind; audience: "hr" \| "intern"; meta?: string }`, where `StatusKind` is a union over the enum values in 4.1 | Everywhere |
| `JevTag` | `{ runStatus; category?; score?; coversVersion? }` | Reviews, review detail |
| `Button` | `{ variant: "primary" \| "secondary" \| "accent" \| "outline" \| "ghost"; size: "sm" \| "md" \| "lg" \| "icon"; icon?: LucideIcon }` | Everywhere |
| `Card`, `CardHeader`, `CardBody` | `{ title; description?; section?: boolean; action? }`, `flush` body | Everywhere |
| `PageHeader` | `{ title; subtitle?; actions? }` | HR pages |
| `KpiStrip` | `{ items: { label; value; sub?; attention?: boolean }[] }` | Overview, profile, DTR |
| `DataTable` | `{ columns: { key; header; align?; width? }[]; rows; onRowHref? }` | Reviews, Interns, Attendance, Departments, Audit |
| `Tabs` | `{ items: { id; label; count?; countAttention? }[]; active }` | Reviews, Interns, profile, DTR period |
| `FilterBar`, `SearchField`, `SelectField`, `DateRangeField` | value + onChange | List pages |
| `Banner` | `{ tone: "conflict" \| "info" \| "neutral"; title; children; action? }` | Review detail (409), setup, DTR |
| `HoursProgress` | `{ creditedMinutes; requiredMinutes; variant: "full" \| "compact"; endDate? }` | Overview, Interns, profile, intern Home |
| `DayTimeline` | `{ window: [startMin, endMin]; schedule?: [startMin, endMin]; segments: { startMin; endMin \| null; state: "complete" \| "open" \| "review" }[]; nowMin?; showTicks? }` | Attendance, profile, review detail, intern Home |
| `CorrectionDiff` | `{ rows: { label; recorded; proposed; changed }[]; creditedBefore; creditedAfter }` | Review detail, intern correction detail |
| `GeofenceMark` | `{ radiusM; distanceM; accuracyM; accepted }` | Review detail, Office and QR |
| `CommentThread` | `{ items: { author; role: "intern" \| "hr"; at; body; label? }[]; variant: "list" \| "bubbles" }` | Review detail, intern correction detail |
| `HrShell` | `{ active: HrNavId; reviewCount; title; breadcrumb? }` | All HR pages |
| `InternShell` | `{ active: "home" \| "scan" \| "history" \| "corrections" }` | Intern tab pages |
| `AuthShell` | `{ variant: "desktop" \| "phone" }` | Sign-in, set password |

---

## 6. Screens

Routes extend the existing scaffold (`src/app/(hr)/hr/*`, `src/app/(intern)/*`). Canvas artboard names are in brackets.

### 6.1 HR (desktop, fluid page; sidebar stacks above content below ~800 px)

| Route | Canvas | Contents | States |
|---|---|---|---|
| `/hr` | Overview | KPI strip (in office, completed today, missing clock-out, waiting on HR), "Needs you" list, "At the office today", Hours progress (Behind pace / Finishing soon) | Empty "Needs you": "Nothing waiting on you." |
| `/hr/reviews` | Reviews queue | Status tabs (Waiting on you, Waiting on intern, Decided, All), filters (search, department, Jev reading, date), table, advisory note | Empty per tab |
| `/hr/reviews/[id]` | Review detail | Title + chip; "The change" diff + recorded vs. proposed timelines; comments; decision form (required note; Ask for more info / Reject / Approve correction); Jev reading card; scan evidence with geofence; history | **409 conflict banner** (request changed); Jev queued/failed |
| `/hr/attendance` | Attendance records | Filters, legend, table grouped by office day with `DayTimeline` per row, session detail panel (effective session, original scans HR-only, revisions, actions) | Held-for-review panel |
| `/hr/interns` | Interns | Account tabs, search, department filter, table with hours bar, row menu; **Add intern dialog** | Setup pending + resend; disabled; finished |
| `/hr/interns/[id]` | Intern profile | Header with live status; Hours card with pace; quick stats; internship + account (sign out all devices, disable); tabs (Attendance, Corrections, Assignment history) with 7-day timelines | |
| `/hr/reports` | DTR reports | Scope form (intern/department, period 1st–15th/16th–end/custom, include options); preview with totals, pending notice, daily rows (multiple sessions on separate lines), total; Export CSV | PDF layout waits on HR template |
| `/hr/setup` | Office and QR | Example-values banner; office location (radius, accuracy, pin, timezone, geofence mark); policy summary; QR checkpoints (print, rotate, revoked) | |
| `/hr/setup/policies` | Policies | Versions list (draft/active/superseded); draft editor (workdays, schedule, break + window + gap rule, cap, rounding with "changed" marker, after-midnight note); worked example; Save draft / Publish | Locked version read-only |
| `/hr/setup/departments` | Departments | Table (active, finished, status, rename/reactivate); Add department panel | No delete |
| `/hr/audit` | Audit log | Filters, read-only table (when, who incl. System, action, record link, change), expandable before/after row, Export CSV | |

### 6.2 Intern (phone, 390 × 844 base; same app, responsive)

| Route | Canvas | Contents |
|---|---|---|
| `/dashboard` | Home | Greeting; Today card (live status, timeline, **Scan OUT** CTA); internship hours; open correction card |
| `/scan` | Scan · ready / checking / Time in saved / Time out saved / Scan not saved / Save not confirmed | One route, six client states driven by the scan protocol (Section 7) |
| `/history` | History | Month switcher; month totals; day list (sessions, status, credited); "Request a correction" on empty days |
| `/corrections` | Corrections | Explanation; New request; Open and Decided groups |
| `/corrections/new` | Request a correction | Day + recorded-that-day note; reason chips (5); Time in/Time out with proposed value outlined; explanation; Send to HR |
| `/corrections/[id]` | Correction detail | Change summary; conversation bubbles; reply box; "Send a new request" (replaces this one) |

### 6.3 Sign-in and first run

| Route | Canvas | Contents |
|---|---|---|
| `/sign-in` | Sign in · desktop / phone | Same page, two layouts. Email, password (show toggle), Keep me signed in (phone), no public sign-up, forgot = ask HR. Error state. |
| `/set-password?token=` | Set password · desktop / First run 1 | Email read-only, new + repeat password, live checklist, expiry note. Expired-link state. Interns continue to first run. |
| `/welcome/camera` | First run 2 | Why the camera is needed; three promises; Allow camera / Not now |
| `/welcome/location` | First run 3 | Why location is needed; three promises; precise-location tip; Allow location / Not now |
| `/welcome/location-blocked` | Location blocked | Steps for Chrome on Android and Safari on iPhone; Check again; Request a correction instead |

---

## 7. Scan screen behavior (must match Technical Design §6 and §11)

| State | Trigger | Rules |
|---|---|---|
| Ready | Route open, camera granted | Shows signed-in identity and today's status. Hint names the expected code (IN or OUT) from the open-session state. |
| Checking | First QR decoded | Camera paused. Steps: code read → checking location → saving. Copy says **"Not saved yet"**. Navy, never success blue. |
| Time in / Time out saved | 201 or replayed receipt | Server time large, seconds small, receipt id, "Time from the office server". Time out adds today's credit and updated totals. |
| Not saved | 422 / 403 / rejected receipt | Crimson. Reason, distance vs. radius, accuracy vs. limit, "No Time in was recorded." Scan again / Request a correction. |
| Couldn't confirm | Timeout or network error before a committed response | Navy, neutral. "May already be saved." **Check again** re-queries the same receipt key; never starts a new scan. |

---

## 8. Accessibility

- Text contrast ≥ 4.5:1 on its surface in both themes (values in 2.1 were checked); marks and focus ring ≥ 3:1.
- Real `<button>`, `<a href>`, `<label>` + inputs; `aria-current="page"` on active nav; `aria-label` on icon-only buttons; `role="alert"` for errors and the 409 banner; `aria-live="polite"` on scan results.
- Phone controls ≥ 44 px (primary actions 48 px). Desktop controls 36 px.
- Timelines have a text summary under them (`08:30–12:02 · 13:01–14:32`); the bar is decorative.

---

## 9. Out of scope / open items

1. HR confirms: schedule, break, cap, rounding, radius, accuracy, review threshold (4.2), DTR PDF template.
2. Notifications (bell menu, intern alerts) are not designed.
3. Empty and loading states are described here but not drawn; use skeleton rows matching table height.
4. Dark theme is defined, not drawn.
5. Sample data on the canvas places some records on Oct 17–18 (Sat–Sun). Keep or move to weekdays when building fixtures.
6. Fill or delete the empty design-system artifact (D6).
