# Improvements — June 2026 Pass

Everything below was verified with `tsc --noEmit` (0 errors) and a full `next build` (all 13 pages + 27 API routes compile).

## Critical bug fixes

**1. Leaderboard API field mismatch (leaderboards rendered blank)**
`/api/leaderboard` returned the raw `leaderboard_active` view columns (`first_name`, `elo`, `id`) while the homepage, dashboard, and profile pages all consume `display_name`, `current_elo`, `player_id`, `total_matches`, `win_rate`. The route now normalizes the payload, so all three pages render real data. The dashboard's Men/Women filter is now properly typed too (no more `as any`).

**2. Edit Profile was fake**
The dashboard's Edit Profile modal "saved" with a `setTimeout` and never persisted anything. Added `PATCH /api/players/me` (university, bio) and wired the modal to load existing values on open and actually save, with error display.

**3. `peak_elo` could be erased**
The approve route computed `peak_elo = max(newElo, previousElo)` — it never read the stored peak, so any ELO dip overwrote a player's all-time season peak. It now selects `peak_elo` and computes `max(newElo, previousPeak)`.

**4. Missing winner guard on approval**
Approving a match with no `winning_team` set would have run the ELO math against `null`. The route now rejects with a clear "edit it before approving" error.

## New functionality

**5. Badge auto-awarding (`lib/badges.ts`)**
The schema seeds 9 badges with trigger rules (`elo_threshold`, `match_count`, `win_streak`, `placement_done`) but nothing ever evaluated them. Match approval now automatically awards earned badges (best-effort — never blocks approval), recorded with the triggering `match_id`.

**6. Season rank caching**
`player_season_stats.rank` is documented as "recomputed after each approved match" but never was. `recomputeSeasonRanks()` now runs after every ELO-affecting approval.

**7. Admin → Members page (`/dashboard/admin/members`)** — *previously impossible to approve sign-ups*
The approve/suspend APIs existed with no UI, so new players were stuck `pending` forever. The new page has:
- A pending-approvals queue with Approve / Reject cards
- The full club roster with search, status filters, suspend/reactivate
- A badge-award modal (uses the existing `POST /api/badges/award`)
- `GET /api/players` extended with `status=all|pending|suspended` (admin-only beyond the default `active` picker)

**8. Admin → Seasons page (`/dashboard/admin/seasons`)** — *previously impossible to bootstrap the app*
Match submission fails with "No active season" and there was no way to create or activate one from the app. The new page creates seasons (with date validation and starting ELO) and activates them, and shows a prominent warning banner when no season is live.

## UI / architecture

**9. Shared `DashboardShell` (`components/ui/dashboard-shell.tsx`)**
Approvals, Tournaments, Members, Seasons, Register, Submit, History, and Analytics all sat on ~50 lines of copy-pasted sidebar/header/loader boilerplate each. They now share one shell with a refreshed header (gold gradient brand accent, title/subtitle, contextual header chips like "3 pending" / "Fall 2026 is live" / your live ELO), plus reusable `SectionHeading`, `Card`, `EmptyState`, and `Chip` primitives and a branded full-screen loader. The Profile page intentionally keeps its distinct dark design; the Dashboard keeps its custom avatar-menu header.

**10. Sidebar admin section**
Admin links no longer blend into the player nav — they sit under a gold "ADMIN" divider (a rule when collapsed), with the two new pages added. Active items get a subtle gold glow.

## Approve-route performance
Player stat upserts and `current_elo` cache updates for all 4 players now run in parallel (`Promise.all`) instead of 8 sequential awaits, and `elo_history` insert failures now abort with a 500 instead of silently continuing.

## Database
No schema changes required — everything builds on the existing `schema.sql` + `tournaments_schema.sql`.
