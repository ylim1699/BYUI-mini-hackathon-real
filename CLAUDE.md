# Syllabus Planner — notes for Claude

BYU-Idaho mini hackathon app (owner: Yujin). Turns syllabi + Canvas into a plan (due dates, weekly
study blocks, class times) and syncs it one-way into a separate "Syllabus Planner" calendar in
Google Calendar or Outlook.

## Source of truth
- **UI/behavior:** the approved prototype (design canvas): https://claude.ai/artifact/V1hEB7CacyMWRt6x9cm5wC
  The real screens reuse the prototype's CSS strings via `sx("...")` (src/lib/sx.ts). Keep it that way.
  When the prototype and `plan.html` disagree, the prototype wins and plan.html is updated to match.
- **Architecture/roadmap:** `plan.html`. **Setup:** `README.md`.

## No sign-in
- Start screen: Canvas token (or calendar feed link) → import → Review; or **Try the demo** → empty → Add classes.
- Each browser gets a Supabase **anonymous** session (`signInAnonymously`); RLS works as usual. "Start over" signs out.
- Google Calendar / Outlook are connected later on Reminders and sync (OAuth start → callback on the backend).

## Stack and commands
- `frontend/`: Vite + React 18 + TS strict, React Router (data router), TanStack Query, Zustand, zod, date-fns, Vitest, pdfjs-dist.
  - `npm run dev` (needs .env + backend) · `npm run dev:mock` (sample data + fake server, dev only)
  - `npm run typecheck` · `npm test` (run with TZ=America/Denver) · `npm run build`
- `backend/`: FastAPI (`main:app`). `uvicorn main:app --reload --port 8000` · `python -m pytest -q`
- `supabase/migrations/`: 001_init.sql, 002_no_login_outlook_review.sql, 003_delete_classes.sql.
- Deploy: Vercel Services (`vercel.json`): frontend at `/`, backend at `/api`.
- One `.env` in the project root for both sides. Only `VITE_` vars reach the browser.

## Layout
- Screens: `frontend/src/pages/*Page.tsx` (Start, AddClasses, Review, Study, Calendar, Sync, Trash).
- Calendar parts: `src/components/calendar/` (shared styles, Dialogs = item detail + study block, Side = AI summary + Overview).
- Data: pages use hooks in `src/hooks/useData.ts` → `src/services/db.ts` (Supabase, or in-memory mocks) and `src/services/api.ts`.
- Pure logic with tests: `src/lib/plan.ts` (times, items per day, study slots, overlap columns), `src/lib/syncPayload.ts`.
- Backend: `app/events.py` builds provider-neutral events; `google_cal.py` / `outlook.py` format and sync;
  `routes/calendars.py` makes the same routes for both; `oauth.py` signs the OAuth state.

## Decisions to keep
- Google scope only `calendar.app.created`; Outlook delegated `Calendars.ReadWrite offline_access`.
- Events go in the app's own calendar with a hidden key (Google: private extended property; Outlook: single-value
  extended property). Resync updates by key, removes upcoming events for deleted items, leaves past ones.
  Done items sync as "✅ Done: …" with no reminders. Remove-all deletes the app calendar. Outlook gets one reminder (the earliest).
- Study block key: `YYYY-MM-DD|HH:MM|<courseId>` (links "studying for" items to one block occurrence).
- Class meeting times appear on the calendar/sync only after the class is confirmed in Review.
- Confirms: Review "Confirm CSE 280?" and Study "Confirm CSE 325 study time?" both stay on the same page.
  Every delete asks first, then Recently deleted for 1 day; "Delete now" waits for the Undo window.
- Syllabus PDFs are read in the browser (pdfjs); only text goes to Gemini. Re-adding never duplicates items (title match).
- Canvas re-import keeps the student's edits (`items.edited`) and marks items already submitted on Canvas as done.
- AI: per-browser and site-wide daily limits; summaries cached per day in localStorage.
- User-facing copy: plain, short, sentence case.

## Status
Done: all screens ported from the prototype, backend complete and tested.
Not done: testing against real Supabase/Google/Microsoft/Gemini keys; scheduled AI summaries (prototype's
"Daily summary / Week ahead" selects need a scheduler); PWA; two-way sync.
