# Deployment Guide

Backend → **Render (free)** | Frontend → **Vercel (free)**

Both platforms are completely free — no credit card required.

---

## 1. Push to GitHub

Make sure the repo is on GitHub. Commit everything first:

```bash
cd /path/to/spikeball-ou
git add -A && git commit -m "chore: prepare for deployment"
git push
```

---

## 2. Deploy the Backend to Render

### 2a. Create a Render account

Go to [render.com](https://render.com) and sign up (free, no credit card).

### 2b. New Web Service from GitHub

1. Dashboard → **New** → **Web Service**
2. Connect your GitHub repo
3. Render will detect `render.yaml` automatically and pre-fill everything
4. Click **Create Web Service**

### 2c. Set environment variables on Render

In your Render service → **Environment**, add these variables (the ones marked `sync: false` in `render.yaml` aren't set automatically):

| Variable | Where to find it |
|---|---|
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys → Secret key |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
| `RESEND_API_KEY` | resend.com → API Keys |
| `FRONTEND_URL` | _(set after step 3 — your Vercel URL)_ |

> **Redis**: leave `REDIS_URL` unset. The app handles this gracefully — token caching is just skipped.

> **PORT**: Render injects this automatically — don't set it.

### 2d. Get your backend URL

After the first deploy finishes, Render gives you a URL like:

```
https://spikeball-ou-backend.onrender.com
```

Copy this — you'll need it in step 3.

> **Note on cold starts**: The free tier spins down after 15 min of inactivity. The first request after that takes ~30 seconds. This is fine for a college club app.

---

## 3. Deploy the Frontend to Vercel

### 3a. Import the project

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Framework preset: **Next.js** (auto-detected)

### 3b. Set environment variables on Vercel

In **Project → Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` (Clerk Dashboard → API Keys) |
| `CLERK_SECRET_KEY` | `sk_live_...` (same Clerk app) |
| `NEXT_PUBLIC_API_URL` | `https://spikeball-ou-backend.onrender.com` ← your Render URL |
| `NEXT_PUBLIC_DEFAULT_ELO` | `1000` |

> **No trailing slash** on `NEXT_PUBLIC_API_URL`.

### 3c. Deploy

Click **Deploy**. Once done, note your Vercel URL:

```
https://spikeball-ou.vercel.app
```

---

## 4. Connect Frontend ↔ Backend

### 4a. Set FRONTEND_URL on Render

Go back to Render → your backend service → **Environment** and add:

```
FRONTEND_URL=https://spikeball-ou.vercel.app
```

Click **Save Changes** — Render will redeploy automatically.

### 4b. Update Clerk authorized URLs

In **Clerk Dashboard → Domains**, add your production domain:

```
https://spikeball-ou.vercel.app
```

---

## 5. Verify

1. Open `https://spikeball-ou.vercel.app`
2. Sign in — Clerk auth should work
3. Open the leaderboard — data should load from the Render backend
4. Check Render logs if anything fails: **Render → your service → Logs**

---

## Environment Variable Cheat Sheet

### Backend (Render)
```
CLERK_SECRET_KEY=sk_live_...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...
DEFAULT_ELO=1000
FRONTEND_URL=https://spikeball-ou.vercel.app
```

### Frontend (Vercel)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_API_URL=https://spikeball-ou-backend.onrender.com
NEXT_PUBLIC_DEFAULT_ELO=1000
```
