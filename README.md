# spikeball-ou
# 🏐 Roundnet Club

A full-stack web application for managing a roundnet (spikeball) club — featuring live ELO rankings, match history, player profiles, badges, seasons, and a competitive session team generator.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + React + Tailwind CSS |
| Backend | NestJS |
| Authentication | Clerk (with role-based access) |
| Database | Supabase (PostgreSQL) |
| Frontend Hosting | Vercel |
| Backend Hosting | Railway |

---

## Features

### 🏆 ELO & Rankings
- Season ELO and All-Time ELO tracked separately — leaderboard shows season ELO
- Each semester is a new season
- **Placement matches:** first 5 matches use K-factor of 60; after 10 matches K-factor drops to 24
- Players receive their rank after completing 5 placement matches

### 📊 Leaderboard
- Displays: Rank, Name, ELO, Record (W-L), Gender, Win/Loss Ratio
- Filterable and sortable by any column

### 👤 Player Profiles
- Profile picture, name, gender
- Current ELO + rank, Best ELO + best rank ever achieved
- Win/Loss ratio, # of tournaments played, # of seasons played
- All-time record vs every individual opponent
- ELO history graph (toggle on/off)
- All earned badges displayed

### 🎖️ Badges
| Badge | Condition |
|---|---|
| Season Champion | Finished #1 at end of a season |
| Rank 1 | Currently ranked #1 |
| Most Improved | Largest ELO gain in a season |
| Most Matches | Most matches played in a season |
| Win Streak | Active or best win streak |
| Biggest Upset | Beat an opponent with significantly higher ELO |

### 🔐 Authentication & Access Control
- Players sign up with email; an admin must approve the account before it's activated
- Two roles: **Player** (view only) and **Admin** (full management)
- Roles enforced via Clerk JWT guards on the NestJS backend

### 🎯 Competitive Session Generator
- Admin inputs the list of players who want to play in a session
- System auto-generates team pairings per round so each player faces a different partner each round (best effort — RNG may repeat)

### ❓ How It Works
- Dedicated page/modal explaining the ELO system, K-factor, placement matches, seasons, and badge criteria

---

## Roles

| Role | Permissions |
|---|---|
| **Player** | View leaderboard, profiles, match history, graphs |
| **Admin** | All player permissions + record matches, manage players, approve signups, run session generator |

---

## Project Structure

```
frontend/
  app/
    page.jsx                      # Homepage
    players/page.jsx              # All players
    players/[id]/page.jsx         # Player profile (elo graph, badges, h2h record)
    matches/page.jsx              # Match history
    matches/[id]/page.jsx         # Match detail
    rankings/page.jsx             # ELO leaderboard (filterable)
    session/page.jsx              # Competitive session team generator
    how-it-works/page.jsx         # ELO explainer
    admin/                        # Admin-only pages
      approve-players/page.jsx
      add-match/page.jsx
      manage-players/page.jsx
      session-generator/page.jsx
  components/
    Navbar.jsx
    Footer.jsx
    PlayerCard.jsx
    MatchCard.jsx
    Leaderboard.jsx
    StatsBar.jsx
    EloChart.jsx
    BadgeDisplay.jsx
    SessionGenerator.jsx
    HowItWorksModal.jsx
  lib/
    supabase.js
    elo.js                        # ELO + K-factor logic
    badges.js                     # Badge award logic
    sessionGenerator.js           # Round-robin pairing logic
  .env.local

backend/
  src/
    players/
    matches/
    seasons/
    badges/
    sessions/                     # Competitive session generator
    auth/                         # Clerk JWT guard + approval flow
    app.module.ts
    main.ts
```

---

## ELO System

- Starting ELO: **1000**
- **Placement matches (first 5):** K-factor = 60
- **After 10 matches:** K-factor = 24
- Rank is only displayed after 5 placement matches are complete
- Season ELO resets each semester; All-Time ELO is cumulative
- ELO change is recorded after every match for the history graph

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Clerk](https://clerk.com) application with two roles: `player` and `admin`

### Frontend Setup

```bash
cd frontend
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

```bash
npm run dev     # http://localhost:3000
```

### Backend Setup

```bash
cd backend
npm install
```

Create `.env`:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CLERK_SECRET_KEY=your_clerk_secret_key
FRONTEND_URL=http://localhost:3000
PORT=3001
```

```bash
npm run start:dev   # http://localhost:3001
```

### CORS

The backend whitelists `FRONTEND_URL`. In development, `localhost:3000` is allowed by default.

---

## Deployment

| Service | Env Vars to Set |
|---|---|
| **Vercel** (frontend) | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_API_URL` |
| **Railway** (backend) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `FRONTEND_URL` |

---

## Contributing

This is a private club project. Contact an admin to request access.
