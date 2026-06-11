# OU Roundnet Club — Project Overview

This doc explains what the project is, how the database is structured, what tools/tech are used, what's been built so far, and how data flows through the app.

---

## 1. What This Project Is

A web app for the OU Roundnet (Spikeball) club. Players sign up, get approved by an admin, play 2v2 matches, submit scores, and have their ELO rating tracked across seasons. There's a public leaderboard, player profiles, match history, badges, and now a full tournament system (admin-created tournaments, player registration, team formation, tournament-specific matches and scoring).

There is **no separate backend server** — everything lives inside a single Next.js app. Pages and API routes live side by side in the same project.

---

## 2. Tech Stack / Tools

| Layer | Tool |
|---|---|
| Framework | Next.js 15.3.3 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS |
| Auth | Clerk (`@clerk/nextjs` v7) — handles sign up, login, sessions, and roles |
| Database | Supabase (hosted PostgreSQL) |
| DB access | `@supabase/supabase-js`, server-side only, using the **service role key** (no Row-Level Security — all access control is done in API route code) |
| Animations | Framer Motion |
| Icons | lucide-react |
| Charts | Custom hand-built SVG components (`elo-line-chart.tsx`, `win-loss-donut.tsx`) — no external chart library |
| Hosting (intended) | Vercel |

---

## 3. Database Structure (Supabase / PostgreSQL)

Schema files: `database/schema.sql` (core) and `database/tournaments_schema.sql` (tournament additions, applied after the core schema).

### Core tables

- **`players`** — one row per club member. Linked to Clerk via `clerk_user_id`. Fields: name, email, age, gender, `status` (`pending` → `active` / `suspended`), `current_elo` (cached), plus `university` and `bio` (added by the tournament migration, used on profile/register pages).
- **`seasons`** — semester-based seasons (e.g. "Fall 2025"). Only one can be `is_active = true` at a time. Has a `starting_elo`.
- **`player_season_stats`** — per-player, per-season ELO, peak ELO, wins/losses, placement match count (first 10 matches use a bigger K-factor), and cached rank.
- **`matches`** — every 2v2 match. Stores both teams (4 player IDs), winning team, optional scores, and a `status` (`pending` → `approved` / `disputed` / `cancelled`). Tracks who submitted and who approved it. Now also has a nullable `tournament_id` (added by the tournament migration) — `null` means a regular-season match.
- **`elo_history`** — one row per player per approved match, recording ELO before/change/after. Powers the ELO graph on profile pages.
- **`badges`** — badge definitions (e.g. "Rookie", "On Fire", "Elite") with trigger rules (ELO threshold, win streak, match count, placement complete, or manual).
- **`player_badges`** — which players earned which badges and when.

### Tournament tables (added later)

- **`tournaments`** — created by an admin. Fields: name, description, `is_casual` (informational label), `affects_elo` (if false, matches in this tournament skip all ELO updates), `team_formation` (`random` or `self_select`), season link, start/end dates, and `status` (`upcoming` → `registration_open` → `in_progress` → `completed`, or `cancelled`).
- **`tournament_registrations`** — one row per player who registers for a tournament. Stores an optional `preferred_partner_id` (for self-select team formation) and a `team_id` once teams are formed.
- **`tournament_teams`** — 2-player teams formed for a specific tournament (created via the admin "Form Teams" action — mutual partner picks are paired first, leftovers paired randomly for self-select; fully random for `random` mode).

### Views

- **`leaderboard_active`** — fast read of the active season's leaderboard (active players only, sorted by ELO).
- **`head_to_head`** — win/loss record between any two players across all approved matches.

### Where the data physically lives

All of the above lives in a **Supabase-hosted PostgreSQL database** (cloud). User identity/auth (email, password, sessions, OTP verification, roles) lives in **Clerk**, not in Supabase — `players.clerk_user_id` is the link between the two. Admin role is set as `publicMetadata.role = "admin"` on the Clerk user object (no in-app UI for this, must be set via the Clerk dashboard).

---

## 4. What's Built So Far

### Pages (`frontend/app/`)

- `/` — Public homepage: animated landing page, live leaderboard, and a live **announcements** feed (pulled from `/api/announcements`, mixing live tournament news with general club updates).
- `/login`, `/signup` — Fully wired to Clerk (sign up creates a Clerk user + a `players` row with `status='pending'`; login authenticates via Clerk).
- `/dashboard` — Player dashboard: personalized greeting, live leaderboard with a "YOU" highlight, ELO explainer, live announcements.
- `/dashboard/profile` — Player's own profile page (stats, badges, bio/university).
- `/dashboard/history` — Match history.
- `/dashboard/analytics` — Player analytics (ELO over time, win/loss breakdown).
- `/dashboard/register` — **Register Match page**: shows the player's own info (name, school, age, gender, ELO), lists open/upcoming/in-progress tournaments with status/casual/ELO-impact/team-formation badges, lets the player register (and pick a preferred partner if `team_formation = self_select`) or unregister.
- `/dashboard/submit` — **Submit Score page**: regular-season match submission (pick partner + 2 opponents, winner, optional scores, notes), plus a tournament mode — if the player is on a formed team in a live (`in_progress`) tournament, they can submit a score for that tournament instead (partner is locked to their assigned teammate; shows a "won't affect ELO" note for casual tournaments).
- `/dashboard/admin/tournaments` — **Admin: Create/Manage Tournaments**. Admin-only (redirects non-admins). Form to create a tournament (name, description, dates, season, casual?, affects ELO?, team formation: random vs. self-select). Lists all tournaments with status control, registration list (per-player school/age/gender/ELO/preferred partner/team), and a "Form Teams" action.
- `/dashboard/admin/approvals` — **Admin: Approve Scores**. Admin-only. Shows all pending match submissions (regular season + tournament), lets the admin edit scores/winner/notes, then Approve (runs the ELO calculation and updates all stats), Dispute, or Cancel.

### API endpoints (`frontend/app/api/`)

**Players**
- `POST /api/players` — create player record after signup
- `GET /api/players/me`, `GET /api/players/[id]`, `GET /api/players` (list, supports `excludeSelf`)
- `GET /api/players/pending`, `PATCH /api/players/[id]/approve`, `PATCH /api/players/[id]/suspend` (admin)
- `GET /api/players/me/elo-history`, `GET /api/players/[id]/elo-history`, `GET /api/players/me/alltime`

**Matches**
- `POST /api/matches` — submit a match (regular or tournament, via optional `tournamentId`)
- `GET /api/matches`, `GET /api/matches/me`, `GET /api/matches/pending` (admin)
- `PATCH /api/matches/[id]` — edit a pending match's score/winner/notes (admin)
- `PATCH /api/matches/[id]/approve` — admin approves, triggers ELO recalculation (skipped if the match's tournament has `affects_elo = false`)
- `PATCH /api/matches/[id]/dispute`, `PATCH /api/matches/[id]/cancel` (admin)

**Tournaments**
- `GET /api/tournaments`, `POST /api/tournaments` (admin create)
- `GET /api/tournaments/[id]`, `PATCH /api/tournaments/[id]` (admin status update)
- `GET /api/tournaments/[id]/registrations` (admin)
- `POST /api/tournaments/[id]/form-teams` (admin)
- `POST /api/tournaments/[id]/register`, `DELETE /api/tournaments/[id]/register` (player register/unregister)
- `GET /api/tournaments/me` — current player's registrations across tournaments

**Leaderboard / Seasons / Badges / Announcements**
- `GET /api/leaderboard`, `GET /api/leaderboard/season/[id]`
- `GET /api/seasons`, `POST /api/seasons` (admin), `GET /api/seasons/active`, `PATCH /api/seasons/[id]/activate` (admin)
- `GET /api/badges`, `POST /api/badges/award` (admin)
- `GET /api/announcements` — merges live tournament status into the announcement feed

---

## 5. How Data Flows

1. **Sign up / login** — handled entirely by Clerk (`useSignUp`/`useSignIn` from `@clerk/nextjs/legacy`). On signup, the app also calls `POST /api/players` to create a matching row in Supabase's `players` table with `status='pending'`.

2. **Auth on every request** — `frontend/middleware.ts` runs Clerk's middleware on all routes except a small public allowlist (homepage, login/signup, leaderboard, seasons, etc.). Protected pages/APIs require a valid Clerk session.

3. **API routes → Supabase** — Every `app/api/**/route.ts` file:
   - Calls `requireAuth()` or `requireAdmin()` (in `lib/api-helpers.ts`), which reads the Clerk session, fetches the Clerk user, and checks `publicMetadata.role`.
   - Then talks to Supabase via the shared service-role client (`lib/supabase.ts`) — reads/writes tables directly (no ORM).

4. **Pages → API routes** — All dashboard pages are client components (`'use client'`) that `fetch()` the API routes above inside `useEffect`, then render the JSON response. No server components fetch data directly from Supabase.

5. **Match approval → ELO update** — When admin hits Approve on `/dashboard/admin/approvals`:
   - `PATCH /api/matches/[id]/approve` loads both teams' current ELOs + placement counts from `player_season_stats`.
   - Runs `calculate2v2()` (in `lib/elo.ts`) — K-factor 60 for a player's first 10 placement matches, 24 after.
   - If the match is tied to a tournament with `affects_elo = false`, ELO/stat updates are skipped entirely (match still gets marked `approved`).
   - Otherwise: writes 4 rows to `elo_history`, updates `player_season_stats` (elo, peak_elo, wins/losses, placement count, rank) and `players.current_elo` for all 4 players.

6. **Tournament lifecycle**:
   - Admin creates a tournament (`POST /api/tournaments`) → it becomes visible in `/api/announcements`, on the homepage, and on the player dashboard.
   - Players register via `/dashboard/register` (`POST /api/tournaments/[id]/register`), optionally naming a preferred partner.
   - Admin runs "Form Teams" (`POST /api/tournaments/[id]/form-teams`) → creates `tournament_teams` rows and links them via `tournament_registrations.team_id`.
   - Once a tournament is `in_progress` and a player has a formed team, `/dashboard/submit` lets them submit scores tagged with that `tournamentId`.
   - Admin approves those matches the same way as regular matches (step 5), with the `affects_elo` flag controlling ELO impact.

7. **Storage summary**:
   - **Supabase PostgreSQL** — all club data: players, seasons, stats, matches, ELO history, badges, tournaments, registrations, teams.
   - **Clerk** — user accounts, credentials, sessions, and the `admin` role flag (`publicMetadata.role`).
   - **No local/file storage** — everything is in these two hosted services. Env vars for both (Supabase URL/service key, Clerk publishable/secret keys) live in `frontend/.env.local`.

---

## 6. Status

All 11 planned tasks for the tournament feature (schema, APIs, admin UI, player register/submit pages, announcements integration) are complete and TypeScript-verified (`tsc --noEmit` passes with 0 errors). The README at the project root is outdated (still says admin pages/login aren't done) — this doc reflects the current state.
