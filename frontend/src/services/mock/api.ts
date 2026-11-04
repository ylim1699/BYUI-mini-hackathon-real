// Fake backend responses for VITE_USE_MOCKS=true, so the demo works with no keys.
const later = <T,>(v: T, ms = 500) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export async function mockApi(path: string, body: unknown): Promise<unknown> {
  switch (path) {
    case "/me":
      return later({ id: "demo", email: "demo@byui.edu", canvas: null, google: true }, 100);
    case "/canvas/connect": {
      const b = body as { token?: string };
      return later({ connected: b.token ? "token" : "feed", name: b.token ? "Demo Student" : "" });
    }
    case "/canvas/import":
      return later({ courses: 3, items: 6, source: "token" }, 900);
    case "/syllabus/parse": {
      const b = body as { course_code?: string | null };
      return later({
        course_code: b.course_code || "CSE 280",
        course_name: "Discrete Mathematics",
        credits: 3,
        online: false,
        meetings: [{ day: 1, start: "09:45", end: "10:45" }, { day: 3, start: "09:45", end: "10:45" }],
        items: [
          { title: "W10 Problem set", type: "assignment", due_date: "2026-11-14", due_time: "23:59", confidence: 0.95, note: null },
          { title: "Final exam", type: "exam", due_date: "2026-12-15", due_time: "09:00", confidence: 0.6, note: "The syllabus says 'finals week'; check the exact day." },
        ],
      }, 1200);
    }
    case "/summary":
      return later({
        headline: "Busy Saturday: three things are due Nov 7, including your CSE 280 midterm.",
        bullets: [
          { text: "Study for the W08 Midterm exam first; it's the biggest item this week.", item_id: "i3", priority: "high" },
          { text: "Your Tuesday CSE 325 block is set for the U04 Blazor assignment.", item_id: "i1", priority: "normal" },
          { text: "Post the W08 Teaching Truth reply by Wednesday night.", item_id: "i4", priority: "normal" },
        ],
      }, 1100);
    case "/google/sync":
      return later({ created: 12, updated: 0, removed: 0, failed: 0, calendar_name: "Syllabus Planner" }, 1200);
    case "/google/remove-all":
      return later({ removed: true });
    default:
      return later({ ok: true });
  }
}
