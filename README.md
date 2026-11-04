# Syllabus Planner

Turns syllabi and Canvas into one plan: due dates, weekly study time per class, and class times. Syncs it into a separate "Syllabus Planner" calendar in Google Calendar or Outlook, with reminders timed by type. Built for the BYU-Idaho mini hackathon.

- **No account.** Start with a Canvas token, or tap **Try the demo** and add your own syllabus PDF. Each browser gets its own private space (Supabase anonymous sign-in). The demo starts empty.
- **Frontend:** Vite + React + TypeScript (`frontend/`). The UI is ported from the approved prototype.
- **Backend:** FastAPI (`backend/`), deployed as a Vercel service at `/api`.
- **Data:** Supabase Postgres with row-level security.
- **AI:** Gemini free tier, for reading syllabi and the weekly summary.
- **Design and roadmap:** `plan.html`. The prototype is the source of truth for the UI.

## 1. Supabase (database)
1. Create a free project at https://supabase.com.
2. **SQL Editor → New query.** Paste `supabase/migrations/001_init.sql` and run it. Then do the same with `002_no_login_outlook_review.sql`.
3. **Authentication → Sign In / Providers.** Turn on **Allow anonymous sign-ins** and save.
4. Optional but recommended: **Authentication → Attack Protection.** Turn on CAPTCHA, or keep the default rate limit (anonymous sign-ins are limited per IP).
5. **Project Settings → API Keys.** Copy:
   - the Project URL
   - the **publishable** key (`sb_publishable_…`, called "anon" on older projects)
   - the **secret** key (`sb_secret_…`, called "service_role" on older projects)

## 2. Google Calendar (optional)
1. In https://console.cloud.google.com, create a project and enable the **Google Calendar API**.
2. **OAuth consent screen:** External, Testing mode. Add the people who will demo it as **test users**. Add the scope `https://www.googleapis.com/auth/calendar.app.created`.
3. **Credentials → Create OAuth client ID → Web application.** Under authorized redirect URIs, add both:
   - `http://localhost:5173/api/google/callback`
   - `https://YOUR-APP.vercel.app/api/google/callback`
4. Put the client ID and secret in `.env`.

That scope only lets the app manage the calendar it creates. It can't see or change any other events.

## 3. Outlook (optional)
1. In https://entra.microsoft.com, go to **App registrations → New registration**.
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
   - Redirect URI: **Web**, `http://localhost:5173/api/outlook/callback`. After creating, add `https://YOUR-APP.vercel.app/api/outlook/callback` under **Authentication**.
2. **API permissions → Add → Microsoft Graph → Delegated:** `Calendars.ReadWrite` and `offline_access`.
3. **Certificates & secrets → New client secret.** Copy the **Value**, not the ID.
4. Put the Application (client) ID and the secret value in `.env`.

Some schools block students from approving new apps. If a BYU-I account says it needs admin approval, use a personal Outlook.com account for the demo.

## 4. Gemini and the encryption key
- Get a free key at https://aistudio.google.com/apikey. The app only sends syllabus text, item titles, and dates.
- Generate the encryption key:
  ```bash
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```

## 5. Run locally
```bash
cp .env.example .env      # then fill it in
# terminal 1: API on :8000
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn main:app --reload --port 8000

# terminal 2: web on :5173 (forwards /api to :8000)
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. API docs: http://localhost:8000/api/docs. Health check: http://localhost:8000/api/health.

To work on the UI without any keys, run `npm run dev:mock`. It uses sample data and a fake server, and is for development only.

## 6. Deploy to Vercel
1. Push to GitHub and import the repo in Vercel. `vercel.json` already sets up both services: `frontend/` at `/` and `backend/` at `/api`.
2. Add every variable from `.env` under **Settings → Environment Variables**. Set `APP_URL` to your Vercel URL and include it in `ALLOWED_ORIGINS`.
3. Add the Vercel redirect URIs to Google and Microsoft (steps 2 and 3).

## Checks
```bash
cd frontend && npm run typecheck && npm test && npm run build
cd backend && python -m pytest -q
```

## How sync works
- Everything goes into one calendar called **Syllabus Planner**. Each event has a hidden tag and its own key.
- **Send again** updates events in place. Done items become "✅ Done: …" with no reminders. Upcoming events for things you deleted are removed. Past events are left alone.
- **Remove everything this app added** deletes that one calendar. Nothing else in the account is touched.
- Sync is one-way, from the app to your calendar. The calendar APIs are free and don't use AI.
- Outlook allows one reminder per event, so it gets the earliest one.

## Security for the demo
- Secrets stay on the server. Canvas tokens and calendar refresh tokens are encrypted with Fernet before they're stored, and only the backend can read them.
- Every API call checks the Supabase session. Row-level security keeps each browser's rows private.
- Calendar connections use a signed, 10-minute `state`, so a connection always lands on the session that started it.
- AI calls are limited per browser and for the whole site per day. Canvas HTML is sanitized.
- Google OAuth stays in Testing mode, so only listed test users can connect Google Calendar.
