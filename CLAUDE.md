# Syllabus Planner — notes for Claude

BYU-Idaho mini hackathon app (owner: Yujin). Turns syllabi + Canvas into a plan (due dates, weekly
study blocks, class times) and syncs it one-way into a separate "Syllabus Planner" Google calendar.

## Source of truth
- **UI/behavior:** the approved prototype (design canvas): https://claude.ai/artifact/V1hEB7CacyMWRt6x9cm5wC
  When the prototype and `plan.html` disagree, the prototype wins and plan.html is updated to match.
- **Architecture/roadmap:** `plan.html` (stack, data model, API, security, phases).

## Stack and commands
- `frontend/`: Vite + React 18 + TS strict + Tailwind 3 (colors are CSS vars in `src/styles/tokens.css`),
  React Router (data router, `createBrowserRouter`), TanStack Query, Zustand, zod, date-fns, Vitest, pdfjs-dist.
  - `npm run dev:demo` (sample data, no keys) · `npm run dev` · `npm run typecheck` · `npm test` · `npm run build`
  - Tests that touch dates: run with TZ=America/Denver.
- `backend/`: FastAPI (`main:app`), httpx, pydantic-settings, Fernet, icalendar, google-genai, nh3. `python -m pytest -q`
  - Local: `uvicorn main:app --reload --port 8000` (Vite proxies /api to it).
- `supabase/migrations/001_init.sql`: tables with RLS "own rows" policies; `connections` is backend-only.
- Deploy: Vercel Services (`vercel.json`): frontend at `/`, backend at `/api` (backend sees full `/api/...` paths).
- One `.env` in the project root is read by both sides. Only `VITE_` vars reach the browser — never secrets.

## Layout
- Pages: `frontend/src/pages/*Page.tsx` (Add classes, Review, Study, Calendar, Sync, Trash, Login).
- Data: pages use hooks in `src/hooks/useData.ts`; hooks call `src/services/db.ts` (Supabase or in-memory mocks)
  and `src/services/api.ts` (backend, or `services/mock/api.ts` in demo mode).
- Pure logic with tests: `src/lib/syncPayload.ts`, `src/lib/calendar.ts`.
- Shared UI: `src/components/ui` (Button, Card, Dialog, Confirm, Toaster, Switch, Icon).
- Types mirror backend: `src/types/domain.ts` <-> `backend/app/schemas.py`.

## Decisions to keep
- Google scope is only `calendar.app.created`; events go in the app's own calendar, tagged
  `extendedProperties.private.syllabusPlanner="1"` + `spKey`. Resync updates by key, removes upcoming events
  for deleted items, leaves past events. Done items sync as "✅ Done: …" with no reminders. Remove-all deletes the calendar.
- Refresh token: sign in with `access_type=offline`, `prompt=consent`; `session.provider_refresh_token` is POSTed
  to `/api/google/link` and stored Fernet-encrypted.
- Study block key: `YYYY-MM-DD|HH:MM|<courseId>` (links "studying for" items to one block occurrence).
- Class meeting times appear on the calendar/sync only after the class is confirmed in Review.
- Confirms: Review "Confirm CSE 280?" -> go to Study time for that class. Study "Confirm CSE 325 study time?" stays on page.
  Deletes ask first and go to Recently deleted for 1 day.
- Gemini free tier (`gemini-2.5-flash`): send only titles/dates/syllabus text; per-user daily limit `AI_DAILY_LIMIT`.
- Supabase new keys: `sb_secret_...` goes only in the `apikey` header (backend/app/db.py handles both formats).
- User-facing copy: plain, short, sentence case; every destructive action asks first and offers Undo.

## Status
Built: all screens as a first working pass, backend complete and tested, demo mode.
Not yet ported from the prototype (next work, roughly Phases 2–6 in plan.html):
- Calendar: Month and Day views, hour grid, Show menu (dropdown filter), key/legend (Due/Study/Class chips),
  richer item card, "Studying for" line in Day view, overdue chip styling.
- Sidebar background picker (Original, Sky clouds) and backgrounds.
- Review drafts/flag styling details, sync preview polish, mobile pass, PWA, Outlook (Microsoft Graph).
Always compare against the prototype before calling a screen done.
