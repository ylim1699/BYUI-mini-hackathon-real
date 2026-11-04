import { useState } from "react";
import { Button, ErrorNote } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { useAuth } from "../hooks/useAuth";
import { supabase, USE_MOCKS } from "../services/supabase";

export function LoginPage() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const notConfigured = !USE_MOCKS && !supabase;

  const go = async () => {
    setBusy(true); setErr(null);
    try { await signIn(); } catch (e) { setErr(e); setBusy(false); }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="anim-page w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-card">
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-xl bg-primary text-lg font-extrabold text-on-primary">SP</div>
        <h1 className="text-3xl font-extrabold tracking-tight">Syllabus Planner</h1>
        <p className="mt-2 text-text-2">
          Turn your syllabi and Canvas into one plan: due dates, study time, and reminders in the calendar you already use.
        </p>
        <ul className="my-6 space-y-2 text-sm font-semibold text-text-2">
          <li className="flex gap-2"><Icon name="alarm" className="text-[var(--c4)]" /> Reminders timed by type: exams a week out, quizzes the day before</li>
          <li className="flex gap-2"><Icon name="book" className="text-[var(--c1)]" /> Study blocks per class, with what you're studying for</li>
          <li className="flex gap-2"><Icon name="sparkle" className="text-[var(--c3)]" /> A short AI summary of your week</li>
        </ul>
        {notConfigured ? (
          <ErrorNote error="Sign-in isn't set up yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, or set VITE_USE_MOCKS=true to try the demo." />
        ) : (
          <Button variant="primary" className="w-full py-3 text-base" onClick={go} disabled={busy}>
            {USE_MOCKS ? "Try the demo" : busy ? "Opening Google…" : "Continue with Google"}
          </Button>
        )}
        <ErrorNote error={err} />
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Google will ask to let this app make its own "Syllabus Planner" calendar. It can only see and change that calendar, never your other events.
        </p>
      </div>
    </main>
  );
}
