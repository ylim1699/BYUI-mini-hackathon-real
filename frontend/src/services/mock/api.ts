// Fake backend responses for `npm run dev:mock` (local development only).
const later = <T,>(v: T, ms = 400) => new Promise<T>((r) => setTimeout(() => r(v), ms));
// Kept in sessionStorage so "Connect" survives the page reload, like the real backend.
const KEY = "sp-mock-api";
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "null"); } catch { return null; } };
const state: { google: boolean; outlook: boolean; canvas: null | "token" | "feed" } = load() ?? { google: false, outlook: false, canvas: null };
const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } };

export async function mockApi(path: string, body: unknown): Promise<unknown> {
  queueMicrotask(persist);
  switch (path) {
    case "/me":
      return later({ id: "demo", email: null, canvas: state.canvas, google: state.google, outlook: state.outlook }, 80);
    case "/canvas/connect": {
      const b = body as { token?: string };
      state.canvas = b.token ? "token" : "feed";
      return later({ connected: state.canvas, name: b.token ? "Demo Student" : "" });
    }
    case "/canvas/disconnect": state.canvas = null; return later({ ok: true });
    case "/canvas/import":
      return later({ courses: 0, items: 0, source: "token" }, 700);
    case "/syllabus/parse": {
      const b = body as { course_code?: string | null };
      return later({
        course_code: b.course_code || "MATH 108", course_name: "Math for the Real World", credits: 3, weekly_hours: null,
        online: false, meetings: [{ day: 2, start: "10:15", end: "11:15" }, { day: 4, start: "10:15", end: "11:15" }],
        meeting_days_text: "Tuesday and Thursday, 10:15 to 11:15 AM", late_policy: "No late work after 3 days",
        notes: "Grade weights aren't listed.",
        source_lines: [{ text: "Class meets Tuesday and Thursday, 10:15 to 11:15 AM.", highlight: true }, { text: "Late work is accepted for 3 days.", highlight: false }],
        items: [
          { title: "W10 Problem set", type: "assignment", due_date: "2026-11-14", due_time: "23:59", confidence: 0.95, note: null, hours: 2 },
          { title: "Final exam", type: "exam", due_date: "2026-12-15", due_time: "09:00", confidence: 0.6, note: "The syllabus says 'finals week'; check the exact day.", hours: 3 },
        ],
      }, 900);
    }
    case "/summary":
      return later({
        headline: "Saturday is stacked: three things are due Nov 7, including your CSE 280 midterm.",
        bullets: [
          { text: "Start the W08 Midterm exam early; it's the biggest item this week.", item_id: "i3", priority: "high" },
          { text: "Your Tuesday CSE 325 block is set for the U04 Blazor assignment.", item_id: "i1", priority: "normal" },
          { text: "Post the W08 Teaching Truth reply by Wednesday night.", item_id: "i4", priority: "normal" },
        ],
      }, 900);
    case "/google/start": case "/outlook/start":
      if (path.startsWith("/google")) state.google = true; else state.outlook = true;
      return later({ url: `${location.origin}/sync?calendar=${path.split("/")[1]}&result=connected` });
    case "/google/disconnect": state.google = false; return later({ ok: true });
    case "/outlook/disconnect": state.outlook = false; return later({ ok: true });
    case "/google/sync": case "/outlook/sync":
      return later({ created: 12, updated: 0, removed: 0, failed: 0, calendar_name: "Syllabus Planner" }, 900);
    case "/google/remove-all": case "/outlook/remove-all":
      return later({ removed: true });
    default:
      return later({ ok: true });
  }
}
