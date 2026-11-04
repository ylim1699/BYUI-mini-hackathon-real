# Syllabus Planner

Turns syllabi and Canvas into one plan: due dates, weekly study blocks, and class times, synced into a separate "Syllabus Planner" calendar in Google with reminders timed by type. Built for the BYU-Idaho mini hackathon.

- **Frontend:** Vite + React + TypeScript + Tailwind (`frontend/`)
- **Backend:** FastAPI (`backend/`), deployed as a Vercel service at `/api`
- **Data and sign-in:** Supabase (Postgres with row-level security, Google sign-in)
- **AI:** Gemini free tier, for reading syllabi and the weekly summary
- **Design and roadmap:** `plan.html` (the prototype is the source of truth for the UI)

## Try it in 1 minute (no keys)

```bash
cd frontend
npm install
npm run dev:demo
```

Open http://localhost:5173 and click **Try the demo**. Demo mode uses sample data and fake server responses; nothing is saved or sent.

## Full setup

### 1. Supabase
1. Create a project at https://supabase.com.
2. **SQL Editor → New query**, paste `supabase/migrations/001_init.sql`, and run it.
3. **Project Settings → API**: copy the URL, the anon/publishable key, and the service role/secret key.

### 2. Google Cloud (sign-in + calendar)
1. In https://console.cloud.google.com create a project, then enable the **Google Calendar API**.
2. **OAuth consent screen**: External, Testing mode. Add yourself and your demo accounts as **test users**. Add the scope `https://www.googleapis.com/auth/calendar.app.created`.
3. **Credentials → Create OAuth client ID → Web application.** Under authorized redirect URIs, add `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
4. In Supabase: **Authentication → Providers → Google**. Paste the client ID and secret and turn it on.
5. In Supabase: **Authentication → URL Configuration**. Set the Site URL to your Vercel URL, and add `http://localhost:5173` to the redirect URLs.

The `calendar.app.created` scope only lets the app manage the calendar it creates. It can't see or change any other events.

### 3. Gemini
Get a free key at https://aistudio.google.com/apikey. Free-tier requests may be used by Google to improve its products, so the app only sends syllabus text, item titles, and dates.

### 4. Environment
```bash
cp .env.example .env
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"   # → ENCRYPTION_KEY
```
Fill in `.env`. Both the frontend and backend read this one file. Only `VITE_` values reach the browser, so never put a secret in a `VITE_` variable.

### 5. Run locally
```bash
# terminal 1: API on :8000
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn main:app --reload --port 8000

# terminal 2: web on :5173 (proxies /api to :8000)
cd frontend
npm install
npm run dev
```
API docs: http://localhost:8000/api/docs

### 6. Canvas
Choose one of these on **Add classes** in the app:
- **Access token** (recommended). In Canvas, go to Account → Settings → New access token. It imports classes, assignments, and syllabus pages.
- **Calendar feed link.** In Canvas, go to Calendar → Calendar Feed. It imports due dates only.

### 7. Deploy to Vercel
1. Push to GitHub and import the repo in Vercel. `vercel.json` already sets up both services: `frontend/` at `/` and `backend/` at `/api`.
2. Add every variable from `.env` under **Settings → Environment Variables**. Set `ALLOWED_ORIGINS` to include your Vercel URL.
3. Add the Vercel URL to Supabase's Site URL and redirect URLs (step 2.5).

## Checks
```bash
cd frontend && npm run typecheck && npm test && npm run build
cd backend && python -m pytest -q
```

## How sync works
- Everything goes into one calendar called **Syllabus Planner**. Each event has a hidden tag and its own key.
- **Sync again** updates events in place. Done items become "✅ Done: …" with no reminders. Upcoming events for things you deleted are removed. Past events are left alone.
- **Remove everything from Google** deletes that one calendar. Nothing else in the account is touched.
- Sync is one-way, from the app to Google. The Calendar API is free and doesn't use AI.

## Security for the demo
- Secrets stay on the server. Canvas tokens and Google refresh tokens are encrypted with Fernet before they're stored.
- Every API call checks the Supabase session. Row-level security keeps each user's rows private.
- Google OAuth stays in Testing mode, so only listed test users can sign in.
- AI calls are limited per user per day (`AI_DAILY_LIMIT`). Canvas HTML is sanitized.
