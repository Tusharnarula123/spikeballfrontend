# 🏐 OU Roundnet Club

A web app for managing the OU Roundnet (spikeball) club — live ELO rankings, match history, player profiles, badges, and season management.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Frontend + Backend | Next.js (React + Tailwind CSS + API Routes) |
| Authentication | Clerk |
| Database | Supabase (PostgreSQL) |
| Hosting | Vercel |

> There is no separate backend server. The API lives inside Next.js as API routes under `frontend/app/api/`.

---

## What's Built So Far

### ✅ Pages

| Page | Status | Notes |
|---|---|---|
| Homepage (`/`) | Done | Animated landing page with live leaderboard |
| Sign Up (`/signup`) | Done | Creates a Clerk account + player record, requires email OTP verification |
| Log In (`/login`) | UI done, Clerk not wired | Login form exists but doesn't authenticate yet |
| Player Dashboard (`/dashboard`) | Done | Personalized greeting, live leaderboard with "YOU" badge, ELO explainer, announcements |
| Admin pages | Not started | No UI yet — endpoints exist |
| Player profiles, match history, analytics | Not started | Sidebar links go nowhere |

### ✅ API Endpoints (all live)

**Players**
- `POST /api/players` — register a new player after signup
- `GET /api/players/me` — get your own player record
- `GET /api/players/[id]` — view any active player's public profile
- `PATCH /api/players/[id]/approve` — admin: activate a pending player
- `PATCH /api/players/[id]/suspend` — admin: suspend a player
- `GET /api/players/pending` — admin: list players waiting for approval
- `GET /api/players/me/elo-history` — your ELO change history
- `GET /api/players/[id]/elo-history` — any player's ELO history

**Matches**
- `POST /api/matches` — submit a match result (you must be one of the 4 players)
- `GET /api/matches` — list matches, filterable by player, season, or status
- `PATCH /api/matches/[id]/approve` — admin: approve match, runs ELO calculation, updates all stats
- `PATCH /api/matches/[id]/cancel` — admin: cancel a match
- `PATCH /api/matches/[id]/dispute` — admin: flag a match as disputed

**Leaderboard**
- `GET /api/leaderboard` — current season leaderboard, filterable by gender
- `GET /api/leaderboard/season/[id]` — leaderboard for a past season

**Seasons**
- `GET /api/seasons` — list all seasons
- `POST /api/seasons` — admin: create a new season
- `GET /api/seasons/active` — get the current active season
- `PATCH /api/seasons/[id]/activate` — admin: switch the active season

**Badges**
- `GET /api/badges` — list all badge types
- `POST /api/badges/award` — admin: give a badge to a player

### ❌ Not Built Yet

- `PATCH /api/players/me` — save profile edits (university, bio)
- `GET/POST /api/announcements` — announcements are hardcoded mock data right now
- Admin UI (approve players, manage matches, create seasons)
- Submit Score and Register Match pages
- Player profile, Match History, Analytics pages
- Login page wired to Clerk

---

## How the ELO System Works

All matches are **2v2**. When an admin approves a match result, the system automatically recalculates ELO for all 4 players.

- **Starting ELO:** 1200
- **Placement phase (first 10 matches):** K-factor = 60 (bigger swings while you're getting ranked)
- **After 10 matches:** K-factor = 24 (smaller, more stable changes)
- ELO is calculated using the average ELO of the opposing team as the reference point
- ELO won't go below 100
- Each season has its own ELO — it resets when a new season starts

---

## Roles

| Role | What they can do |
|---|---|
| **Player** | View leaderboard, their own stats, submit match results |
| **Admin** | Everything above + approve signups, approve/cancel matches, manage seasons, award badges |

Roles are checked server-side on every admin endpoint. If you're not an admin, you get a 403.

---

## Project Structure

```
frontend/
  app/
    page.tsx                        # Homepage with live leaderboard
    login/page.tsx                  # Login page (Clerk not yet wired)
    signup/page.tsx                 # Signup page (Clerk + DB fully wired)
    dashboard/page.tsx              # Player dashboard (logged-in players)
    api/
      leaderboard/route.ts          # Live leaderboard from DB
      matches/route.ts              # Submit + list matches
      matches/[id]/                 # Approve / cancel / dispute a match
      players/route.ts              # Register new player
      players/me/route.ts           # Current player's record
      players/[id]/route.ts         # Any player's public profile
      seasons/route.ts              # List + create seasons
      badges/route.ts               # Badge types
  components/
    ui/
      modern-side-bar.tsx           # Dashboard sidebar (collapsible, mobile-friendly)
      animated-characters-signup-page.tsx
      animated-characters-login-page.tsx
  lib/
    supabase.ts                     # Supabase client
    elo.ts                          # 2v2 ELO + K-factor logic
    api-helpers.ts                  # Auth guards (requireAuth, requireAdmin)

database/
  # SQL migrations and schema files
```

---

## Setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Clerk](https://clerk.com) app (set one role called `admin` for admins; regular users need no role)

### Run Locally

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

```bash
npm run dev   # http://localhost:3000
```

### Deploy to Vercel

Set Root Directory to `frontend` in Vercel project settings, then add the same 4 env vars above.

---

## Contributing

This is a private club project. Contact an admin to get access.
git remote set-url origin https://Tusharnarula123:<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>@github.com/Tusharnarula123/spikeballfrontend.git
git push -u origin main