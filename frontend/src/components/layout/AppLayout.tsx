import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAll } from "../../hooks/useData";
import { sx } from "../../lib/sx";
import { USE_MOCKS } from "../../services/supabase";
import { useUi, type Bg } from "../../store/ui";
import { Toaster } from "../ui";

const RAIL = [
  { to: "/add", label: "Add classes", d: "M4 7.5A2.5 2.5 0 016.5 5H10l2 2h5.5A2.5 2.5 0 0120 9.5v8a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5zM12 11v5M9.5 13.5h5" },
  { to: "/review", label: "Review items", d: "M10 6h10M10 12h10M10 18h10M3.5 6l1.3 1.3L7.3 4.8M3.5 12l1.3 1.3 2.5-2.5M3.5 18l1.3 1.3 2.5-2.5" },
  { to: "/study", label: "Study time", d: "M12 20.5a8.5 8.5 0 100-17 8.5 8.5 0 000 17zM12 7.5V12l3 2" },
  { to: "/calendar", label: "Calendar", d: "M6.5 4.5h11a3 3 0 013 3v10a3 3 0 01-3 3h-11a3 3 0 01-3-3v-10a3 3 0 013-3zM3.5 11h17M12 11v9.5" },
  { to: "/sync", label: "Reminders and sync", d: "M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20.5a2 2 0 004 0" },
  { to: "/trash", label: "Recently deleted", d: "M4.5 7h15M9.5 7V5a1.5 1.5 0 011.5-1.5h2A1.5 1.5 0 0114.5 5v2M6.5 7l1 12a2 2 0 002 1.8h5a2 2 0 002-1.8l1-12M10 11v6M14 11v6" },
];

const railBtn = (on: boolean) =>
  "position: relative; width: 52px; height: 52px; border: 0; border-radius: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; " +
  (on ? "background: var(--surface-3); color: var(--text);" : "background: transparent; color: var(--muted);");

const BGS: { k: Bg; label: string; sub: string; swatch: string }[] = [
  { k: "original", label: "Original", sub: "Dark gray with a blue undertone", swatch: "#13161B" },
  { k: "day", label: "Sky clouds", sub: "Blue sky with clouds", swatch: "radial-gradient(ellipse at 45% 60%,#FFFFFF 0%,#E2ECF8 30%,#86AADC 68%,#3F74C2 100%)" },
];

/** Things to check: unsure items not yet edited, plus classes with no class times. */
function useFlagCount(): number {
  const { courses, items } = useAll();
  const live = new Set(courses.map((c) => c.id));
  return items.filter((i) => live.has(i.course_id) && !i.deleted_at && i.confidence < 0.7 && !i.edited).length
    + courses.filter((c) => c.online === null).length;
}

export function AppLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { bg, set } = useUi();
  const [bgMenu, setBgMenu] = useState(false);
  const flags = useFlagCount();

  // Keep hover labels next to the rail button (they're position: fixed so the rail never clips them).
  useEffect(() => {
    const tip = (e: Event) => {
      const b = (e.target as HTMLElement | null)?.closest?.(".rail-btn");
      const t = b?.querySelector<HTMLElement>(".rail-tip");
      if (!b || !t) return;
      const r = b.getBoundingClientRect();
      t.style.top = r.top + r.height / 2 + "px";
      t.style.left = r.right + 12 + "px";
    };
    document.addEventListener("mouseover", tip);
    document.addEventListener("focusin", tip);
    return () => { document.removeEventListener("mouseover", tip); document.removeEventListener("focusin", tip); };
  }, []);

  return (
    <div className="app" data-bg={bg} style={sx("position: relative; min-height: 100vh; background: var(--bg); color: var(--text); display: flex; flex-wrap: wrap; align-items: stretch;")}>
      {bg === "day" && <SkyClouds />}
      {bg !== "original" && <div aria-hidden="true" style={sx("position: fixed; inset: 0; z-index: 0; pointer-events: none; background: linear-gradient(180deg, rgba(8,14,24,0.26) 0%, rgba(8,14,24,0.14) 45%, rgba(8,14,24,0.3) 100%);")} />}

      <nav className="rail" aria-label="Main">
        <div style={sx("width: 48px; height: 48px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: var(--text);")}>
          <svg role="img" aria-label="Syllabus Planner" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4" /></svg>
        </div>
        {RAIL.map((r) => {
          const on = loc.pathname.startsWith(r.to);
          return (
            <button key={r.to} type="button" className="rail-btn" onClick={() => nav(r.to)} aria-label={r.label} aria-current={on ? "page" : undefined} style={sx(railBtn(on))}>
              <span className="rail-tip" aria-hidden="true">{r.label}</span>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={r.d} /></svg>
              {r.to === "/review" && flags > 0 && (
                <span style={sx("position: absolute; top: 5px; right: 5px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px; background: var(--weekend); color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center;")}>{flags}</span>
              )}
            </button>
          );
        })}
        <div className="rail-spacer" />
        <div style={sx("position: relative;")}>
          <button type="button" className="rail-btn" onClick={() => setBgMenu(!bgMenu)} aria-label="Change background" aria-expanded={bgMenu} style={sx(railBtn(bgMenu))}>
            <span className="rail-tip" aria-hidden="true">Change background</span>
            <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M7 15.5a3 3 0 012.6-4.4 4 4 0 017.4 1.2 2.4 2.4 0 01-.4 4.7H8.5A2.5 2.5 0 017 15.5z" /></svg>
          </button>
          {bgMenu && (
            <>
              <div aria-hidden="true" onClick={() => setBgMenu(false)} style={sx("position: fixed; inset: 0; z-index: 59;")} />
              <div role="menu" aria-label="Background" className="anim-menu" style={sx("position: absolute; left: calc(100% + 12px); bottom: 0; z-index: 60; width: 236px; box-sizing: border-box; padding: 10px; display: flex; flex-direction: column; gap: 6px; border-radius: 14px; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: var(--shadow); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);")}>
                <span style={sx("padding: 2px 6px 4px; font-size: 12px; font-weight: 800; color: var(--muted);")}>Background</span>
                {BGS.map((o) => (
                  <button key={o.k} type="button" role="menuitemradio" aria-checked={bg === o.k} onClick={() => { set({ bg: o.k }); setBgMenu(false); }}
                    style={sx("display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 8px; box-sizing: border-box; border-radius: 10px; color: var(--text); cursor: pointer; " + (bg === o.k ? "background: var(--surface-3); border: 1px solid var(--line-strong);" : "background: transparent; border: 1px solid transparent;"))}>
                    <span aria-hidden="true" style={sx("width: 44px; height: 32px; flex-shrink: 0; border-radius: 8px; border: 1px solid var(--line-strong); background: " + o.swatch + ";")} />
                    <span style={sx("flex: 1 1 auto; display: flex; flex-direction: column; text-align: left;")}>
                      <span style={sx("font-size: 13px; font-weight: 700;")}>{o.label}</span>
                      <span style={sx("font-size: 11px; color: var(--muted);")}>{o.sub}</span>
                    </span>
                    {bg === o.k && <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </nav>

      <main style={sx("position: relative; z-index: 1; flex: 999 1 600px; min-width: 0; box-sizing: border-box; padding: 18px 22px 28px; display: flex; flex-direction: column; gap: 16px;")}>
        {USE_MOCKS && <p style={sx("margin: 0; font-size: 12px; font-weight: 700; color: var(--muted);")}>Development mode: sample data, nothing is saved.</p>}
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}

function SkyClouds() {
  return (
    <svg aria-hidden="true" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" style={sx("position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none;")}>
      <defs>
        <linearGradient id="dsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3F74C2" /><stop offset="0.55" stopColor="#7EA6DC" /><stop offset="1" stopColor="#B9D1F0" /></linearGradient>
        <linearGradient id="dband" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.25" /><stop offset="0.35" stopColor="#FFFFFF" stopOpacity="1" /><stop offset="0.8" stopColor="#FFFFFF" stopOpacity="0.9" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0.4" /></linearGradient>
        <mask id="dmask"><rect width="1600" height="1000" fill="url(#dband)" /></mask>
        <filter id="dshade" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0028 0.0062" numOctaves={6} seed={21} result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.0 0 0 0 -1.05" result="a" /><feComposite in="SourceGraphic" in2="a" operator="in" /></filter>
        <filter id="dlit" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0028 0.0062" numOctaves={7} seed={21} result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.6 0 0 0 -1.4" result="a" /><feComposite in="SourceGraphic" in2="a" operator="in" /></filter>
      </defs>
      <rect width="1600" height="1000" fill="url(#dsky)" />
      <g mask="url(#dmask)">
        <rect width="1600" height="1000" fill="#C2D0E2" filter="url(#dshade)" transform="translate(6 14)" />
        <rect width="1600" height="1000" fill="#FFFFFF" filter="url(#dlit)" />
      </g>
    </svg>
  );
}
