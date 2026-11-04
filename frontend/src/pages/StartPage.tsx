import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorNote, Ico, P, S } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { sx } from "../lib/sx";
import { api } from "../services/api";
import { supabase, USE_MOCKS } from "../services/supabase";
import { connectResultSchema, importResultSchema } from "../types/domain";

/** First screen. No account: paste a Canvas token, or try it with your own syllabus. */
export function StartPage() {
  const { start, setHolding, user } = useAuth();
  const hasPlan = !!user;
  const nav = useNavigate();
  const [token, setToken] = useState("");
  const [feed, setFeed] = useState("");
  const [showFeed, setShowFeed] = useState(false);
  const [busy, setBusy] = useState<"" | "canvas" | "demo">("");
  const [step, setStep] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const notConfigured = !USE_MOCKS && !supabase;

  const withCanvas = async () => {
    setBusy("canvas"); setErr(null); setHolding(true);
    try {
      setStep("Starting…");
      await start();
      setStep("Connecting to Canvas…");
      await api("/canvas/connect", connectResultSchema, token.trim() ? { token: token.trim() } : { feed_url: feed.trim() });
      setStep("Importing your classes…");
      const r = await api("/canvas/import", importResultSchema, {});
      setHolding(false);
      nav(r.items ? "/review" : "/add");
    } catch (e) {
      setErr(e); setBusy(""); setStep(""); setHolding(false);
    }
  };

  const demo = async () => {
    setBusy("demo"); setErr(null);
    try { await start(); nav("/add"); } catch (e) { setErr(e); setBusy(""); }
  };

  const canGo = (token.trim().length >= 20 || /^https:\/\/.+/.test(feed.trim())) && !busy && !notConfigured;

  return (
    <div className="app" style={sx("min-height: 100vh; background: var(--bg); color: var(--text); display: flex; align-items: center; justify-content: center; padding: 24px 16px; box-sizing: border-box;")}>
      <main className="anim-page" style={sx("width: 100%; max-width: 460px; display: flex; flex-direction: column; gap: 18px;")}>
        {hasPlan && (
          <button type="button" onClick={() => nav("/calendar")} style={sx("align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px 0 10px; border-radius: 18px; border: 1px solid var(--line-strong); background: transparent; color: var(--text); font-size: 13px; font-weight: 700; cursor: pointer;")}>
            <Ico d={P.left} size={15} />Back to your plan
          </button>
        )}
        <div style={sx("display: flex; align-items: center; gap: 12px;")}>
          <svg role="img" aria-label="" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4" /></svg>
          <h1 style={sx("margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em;")}>Syllabus Planner</h1>
        </div>
        <p style={sx(S.lead)}>Turn your syllabi and Canvas into one plan: due dates, study time for each class, and reminders in Google Calendar or Outlook.</p>

        <section style={sx(S.card + " padding: 20px; display: flex; flex-direction: column; gap: 14px;")}>
          <h2 style={sx("margin: 0; font-size: 18px; font-weight: 800;")}>Start with Canvas</h2>
          <form style={sx("display: flex; flex-direction: column; gap: 14px;")} onSubmit={(e) => { e.preventDefault(); if (canGo) void withCanvas(); }}>
            <div style={sx("display: flex; flex-direction: column; gap: 6px;")}>
              <label htmlFor="start-token" style={sx("font-size: 13px; font-weight: 800;")}>Canvas access token</label>
              <input id="start-token" className="hi-input" type="password" autoComplete="off" placeholder="Paste your token" value={token}
                onChange={(e) => setToken(e.target.value)} style={sx(S.field)} />
              <span style={sx("font-size: 12px; line-height: 1.45; font-weight: 700;")}>In Canvas: Account, then Settings, then New access token.</span>
            </div>
            {showFeed ? (
              <div className="anim-fade" style={sx("display: flex; flex-direction: column; gap: 6px;")}>
                <label htmlFor="start-feed" style={sx("font-size: 13px; font-weight: 800;")}>Or calendar feed link</label>
                <input id="start-feed" className="hi-input" type="url" placeholder="https://byui.instructure.com/feeds/…" value={feed}
                  onChange={(e) => setFeed(e.target.value)} style={sx(S.field)} />
                <span style={sx("font-size: 12px; line-height: 1.45; font-weight: 700;")}>In Canvas: Calendar, then Calendar feed. Use this if tokens are turned off.</span>
              </div>
            ) : (
              <button type="button" onClick={() => setShowFeed(true)} style={sx("align-self: flex-start; padding: 0; border: 0; background: transparent; color: var(--text-2); font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: underline;")}>
                Can't make a token? Use your calendar feed link
              </button>
            )}
            <button type="submit" disabled={!canGo} style={sx(S.primary + (canGo ? "" : " opacity: 0.5; cursor: not-allowed;"))}>
              {busy === "canvas" ? step : "Import my classes"}
            </button>
            <p style={sx("margin: 0; font-size: 12px; line-height: 1.5; font-weight: 700;")}>Your token is stored encrypted and is only used to read your classes.</p>
          </form>
        </section>

        <div style={sx("display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 800; color: var(--muted);")}>
          <span style={sx("flex: 1; height: 1px; background: var(--line);")} />or<span style={sx("flex: 1; height: 1px; background: var(--line);")} />
        </div>

        <button type="button" onClick={demo} disabled={!!busy || notConfigured}
          style={sx("display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px 16px; box-sizing: border-box; border-radius: 18px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--text); text-align: left; cursor: pointer;" + (busy || notConfigured ? " opacity: 0.6; cursor: not-allowed;" : ""))}>
          <span aria-hidden="true" style={sx("width: 40px; height: 40px; flex-shrink: 0; border-radius: 14px; background: var(--surface-3); display: flex; align-items: center; justify-content: center;")}><Ico d={P.file} size={18} sw={1.8} /></span>
          <span style={sx("flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px;")}>
            <span style={sx("font-size: 15px; font-weight: 800;")}>{busy === "demo" ? "Starting…" : hasPlan ? "Add a syllabus PDF" : "Try the demo"}</span>
            <span style={sx("font-size: 13px; color: var(--text-2);")}>{hasPlan ? "Upload your syllabus and check what we find. Your plan stays." : "Start empty and add your own syllabus PDF. No Canvas needed."}</span>
          </span>
          <Ico d={P.right} size={16} />
        </button>

        {notConfigured && <ErrorNote error="The app isn't set up yet. Add the Supabase keys to .env (see README)." />}
        <ErrorNote error={err} />
        <p style={sx("margin: 0; font-size: 12px; line-height: 1.5; color: var(--muted);")}>
          {hasPlan ? "Importing again adds to your plan. Nothing you already have is duplicated." : "No account needed. Your plan is saved for this browser. Connect Google Calendar or Outlook later in Reminders and sync."}
        </p>
      </main>
    </div>
  );
}
