import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useState } from "react";
import { dayKey } from "../../lib/dates";
import { budget, col, fmtDay, r1, seg, slotsOn, type PlanItem } from "../../lib/plan";
import { sx } from "../../lib/sx";
import { api, errorText } from "../../services/api";
import { summarySchema, type Course, type StudyTime, type Summary } from "../../types/domain";
import { Ico, P } from "../ui";
import { cardOf } from "./shared";

const bodyStyle = (open: boolean) => "box-sizing: border-box; overflow: hidden; min-width: 0; " + (open
  ? "max-height: calc(100vh - 260px); opacity: 1; visibility: visible; transition: max-height .42s cubic-bezier(.2,.8,.2,1), opacity .28s ease, visibility 0s;"
  : "max-height: 0; opacity: 0; visibility: hidden; transition: max-height .42s cubic-bezier(.2,.8,.2,1), opacity .2s ease, visibility 0s linear .42s;");
const toggleBtn = "width: 32px; height: 32px; flex-shrink: 0; padding: 0; border-radius: 16px; border: 1px solid var(--line); background: var(--surface-2); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center;";
const shell = "box-sizing: border-box; min-width: 0; padding: 12px 12px 12px 14px; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: 18px;";

const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

// ---------- AI summary (cached per day in this browser, so it doesn't use up the free quota) ----------

const cacheKey = (k: string) => "sp-summary:" + k;
const readCache = (k: string): Summary | null => { try { const v = localStorage.getItem(cacheKey(k)); return v ? summarySchema.parse(JSON.parse(v)) : null; } catch { return null; } };
const writeCache = (k: string, s: Summary) => { try { localStorage.setItem(cacheKey(k), JSON.stringify(s)); } catch { /* ignore */ } };

export function AiSummary({ items, courses, studyTimes }: { items: PlanItem[]; courses: Course[]; studyTimes: StudyTime[] }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<"day" | "week">("week");
  const qc = useQueryClient();
  const now = new Date();
  const days = range === "day" ? [now] : Array.from({ length: 7 }, (_, k) => addDays(monday(now), k));
  const keys = new Set(days.map(dayKey));
  const inRange = items.filter((i) => keys.has(i.key));
  const hours: Record<string, number> = {};
  for (const d of days) for (const sl of slotsOn(d, studyTimes, courses)) hours[sl.course.code] = (hours[sl.course.code] ?? 0) + sl.e - sl.s;
  const sig = inRange.map((i) => `${i.id}${i.done ? 1 : 0}${i.due_at}`).join(",") + JSON.stringify(hours);
  const key = `${range}|${dayKey(now)}|${sig.length}|${hash(sig)}`;

  const q = useQuery({
    queryKey: ["summary", key],
    enabled: inRange.length > 0,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const cached = readCache(key);
      if (cached) return cached;
      // Only titles, types, and dates go to the AI.
      const s = await api("/summary", summarySchema, {
        range, today: format(now, "yyyy-MM-dd"), study_hours: hours,
        items: inRange.slice(0, 150).map((i) => ({ id: i.id, title: i.title, course_code: i.course.code, type: i.type, due_at: i.due_at, done: i.done })),
      });
      writeCache(key, s);
      return s;
    },
  });
  const refresh = () => { try { localStorage.removeItem(cacheKey(key)); } catch { /* ignore */ } qc.invalidateQueries({ queryKey: ["summary", key] }); };

  const word = range === "day" ? "today" : "this week";
  const headline = !inRange.length ? `Nothing due ${word}.` : q.data?.headline ?? (q.isLoading ? "Reading your calendar…" : q.error ? "The summary isn't available right now." : "");

  return (
    <section aria-label="AI summary" className="frost" style={sx(shell)}>
      <div style={sx("display: flex; align-items: center; gap: 10px; min-width: 0;")}>
        <span aria-hidden="true" style={sx("width: 30px; height: 30px; flex-shrink: 0; border-radius: 15px; background: var(--c1-soft); color: var(--c1); display: flex; align-items: center; justify-content: center;")}><Ico d={P.sparkle} size={15} sw={1.9} /></span>
        <div style={sx("flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px;")}>
          <h2 style={sx("margin: 0; font-size: 14px; font-weight: 800;")}>AI summary</h2>
          <span style={sx("font-size: 12px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: opacity .2s ease, max-height .3s ease; " + (open ? "opacity: 0; max-height: 0;" : "opacity: 1; max-height: 18px;"))}>{headline}</span>
        </div>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="sum-body" aria-label={open ? "Collapse the AI summary" : "Expand the AI summary"} title={open ? "Collapse the AI summary" : "Expand the AI summary"} style={sx(toggleBtn)}>
          <Ico d={open ? P.collapse : P.expand} size={14} sw={2.2} />
        </button>
      </div>
      <div id="sum-body" style={sx(bodyStyle(open))}>
        <div className="cal-scroll" style={sx("display: flex; flex-direction: column; gap: 10px; padding: 12px 4px 0 0; max-height: calc(100vh - 272px); overflow-y: auto; overscroll-behavior: contain; min-width: 0;")}>
          <div role="group" aria-label="Summary range" style={sx("align-self: flex-start; display: flex; padding: 3px; border-radius: 19px; border: 1px solid var(--line-strong);")}>
            <button type="button" onClick={() => setRange("day")} aria-pressed={range === "day"} style={sx(seg(range === "day"))}>Today</button>
            <button type="button" onClick={() => setRange("week")} aria-pressed={range === "week"} style={sx(seg(range === "week"))}>Week</button>
          </div>
          <p style={sx("margin: 0; font-size: 14px; line-height: 1.5; font-weight: 700;")}>{headline}</p>
          {q.isLoading && <span className="spinner" />}
          {q.error && <p role="alert" style={sx("margin: 0; font-size: 13px; color: var(--warn-text); font-weight: 700;")}>{errorText(q.error)}</p>}
          {q.data && inRange.length > 0 && (
            <ul style={sx("margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px;")}>
              {q.data.bullets.map((b, n) => (
                <li key={n} style={sx("display: flex; gap: 10px; align-items: flex-start; font-size: 13px; line-height: 1.5; color: var(--text-2);")}>
                  <span aria-hidden="true" style={sx("width: 7px; height: 7px; flex-shrink: 0; margin-top: 8px; border-radius: 50%; background: " + (b.priority === "high" ? "var(--weekend)" : "var(--line-strong)") + ";")} />
                  <span>{b.priority === "high" && <strong style={sx("color: var(--text);")}>Priority: </strong>}{b.text}</span>
                </li>
              ))}
            </ul>
          )}
          <div style={sx("display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 8px; border-top: 1px solid var(--line);")}>
            <span style={sx("font-size: 12px; color: var(--muted);")}>Written by AI from your calendar</span>
            <button type="button" onClick={refresh} disabled={!inRange.length || q.isFetching} style={sx("min-height: 32px; padding: 0 12px; border-radius: 16px; border: 1px solid var(--line-strong); background: transparent; font-size: 12px; font-weight: 700; color: var(--text); cursor: pointer;" + (!inRange.length || q.isFetching ? " opacity: 0.5; cursor: default;" : ""))}>
              {q.isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ---------- Overview ----------

export function Overview({ items, courses, studyTimes, onOpen }: { items: PlanItem[]; courses: Course[]; studyTimes: StudyTime[]; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const [tick, setTick] = useState(0);
  const today = new Date();
  const dates = range === "day" ? [today]
    : range === "week" ? Array.from({ length: 7 }, (_, k) => addDays(monday(today), k))
      : Array.from({ length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() }, (_, k) => new Date(today.getFullYear(), today.getMonth(), k + 1, 12));
  const keys = new Set(dates.map(dayKey));
  const per = new Map(courses.map((c) => [c.id, { total: 0, done: 0, study: 0 }]));
  let total = 0, done = 0, late = 0;
  for (const it of items) {
    if (!keys.has(it.key)) continue;
    const p = per.get(it.course.id); if (!p) continue;
    total++; p.total++;
    if (it.done) { done++; p.done++; } else if (it.overdue) late++;
  }
  for (const d of dates) for (const sl of slotsOn(d, studyTimes, courses)) { const p = per.get(sl.course.id); if (p) p.study += sl.e - sl.s; }
  const scale = range === "day" ? 1 / 7 : range === "week" ? 1 : dates.length / 7;
  const pct = total ? Math.round((done / total) * 100) : 100;
  const word = { day: "today", week: "this week", month: "this month" }[range];
  const fd = (x: Date) => fmtDay(x, { month: "short", day: "numeric" });
  const overdue = items.filter((i) => i.overdue).sort((a, b) => a.key.localeCompare(b.key));
  const weekKeys = new Set(Array.from({ length: 7 }, (_, k) => dayKey(addDays(monday(today), k))));
  const wk = items.filter((i) => weekKeys.has(i.key));
  const wkPct = wk.length ? Math.round((wk.filter((i) => i.done).length / wk.length) * 100) : 100;
  const studyTotal = [...per.values()].reduce((n, p) => n + p.study, 0);
  const todayKey = dayKey(today);

  return (
    <section aria-label="Overview" className="frost" style={sx(shell)}>
      <div style={sx("display: flex; align-items: center; gap: 10px; min-width: 0;")}>
        <span aria-hidden="true" style={sx("width: 30px; height: 30px; flex-shrink: 0; border-radius: 15px; background: var(--surface-3); color: var(--ok); display: flex; align-items: center; justify-content: center;")}><Ico d={P.chart} size={15} /></span>
        <div style={sx("flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column;")}>
          <h2 style={sx("margin: 0; font-size: 14px; font-weight: 800;")}>Overview</h2>
          <div aria-hidden={open} style={sx("display: flex; flex-direction: column; gap: 4px; min-width: 0; overflow: hidden; transition: max-height .3s cubic-bezier(.2,.8,.2,1), opacity .2s ease, margin-top .3s ease; " + (open ? "max-height: 0; opacity: 0; margin-top: 0;" : "max-height: 60px; opacity: 1; margin-top: 4px;"))}>
            <div style={sx("display: flex; align-items: center; gap: 8px; min-width: 0;")}>
              <span style={sx("min-width: 0; font-size: 12px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;")}>{wk.filter((i) => i.done).length} of {wk.length} done this week</span>
              <span aria-hidden="true" style={sx("width: 48px; height: 5px; flex-shrink: 0; border-radius: 3px; background: var(--surface-3); overflow: hidden;")}><span className="bar-anim" style={sx(`display: block; height: 100%; border-radius: 3px; width: ${wkPct}%; background: var(--ok);`)} /></span>
            </div>
            {overdue.length > 0 && <span style={sx("align-self: flex-start; padding: 1px 7px; border-radius: 9px; background: var(--warn-bg); color: var(--warn-text); font-size: 11px; font-weight: 800; white-space: nowrap;")}>{overdue.length} overdue</span>}
          </div>
        </div>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="ov-body" aria-label={open ? "Collapse the overview" : "Expand the overview"} title={open ? "Collapse the overview" : "Expand the overview"} style={sx(toggleBtn)}>
          <Ico d={open ? P.collapse : P.expand} size={14} sw={2.2} />
        </button>
      </div>
      <div id="ov-body" style={sx(bodyStyle(open))}>
        <div className="cal-scroll" style={sx("display: flex; flex-direction: column; gap: 14px; padding: 14px 4px 0 0; max-height: calc(100vh - 272px); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; min-width: 0;")}>
          <div style={sx("display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; min-width: 0;")}>
            <div role="radiogroup" aria-label="Overview range" style={sx("display: flex; padding: 3px; border-radius: 19px; border: 1px solid var(--line-strong);")}>
              {(["day", "week", "month"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={range === k} onClick={() => { setRange(k); setTick(tick + 1); }} style={sx(seg(range === k) + " padding: 0 10px;")}>{k[0]!.toUpperCase() + k.slice(1)}</button>
              ))}
            </div>
            <span style={sx("font-size: 12px; color: var(--text-2);")}>{range === "day" ? fd(today) : range === "week" ? fd(dates[0]!) + " to " + fd(dates[6]!) : fmtDay(today, { month: "long", year: "numeric" })}</span>
          </div>
          <div key={tick} style={sx("animation: " + (tick % 2 ? "cardInA" : "cardInB") + " .32s cubic-bezier(.2,.8,.2,1) backwards; display: flex; flex-direction: column; gap: 14px;")}>
            <div style={sx("display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;")}>
              {[
                { n: total, label: "due " + word, s: "" },
                { n: done, label: "done", s: " color: var(--ok);" },
                { n: total - done, label: late ? `left, ${late} late` : "left", s: late ? " color: var(--warn-text);" : "" },
              ].map((t) => (
                <div key={t.label} style={sx("min-width: 0; padding: 9px 8px; border-radius: 12px; background: var(--surface-2); display: flex; flex-direction: column; gap: 2px; overflow: hidden;")}>
                  <span style={sx("font-size: 20px; font-weight: 800;" + t.s)}>{t.n}</span>
                  <span style={sx("font-size: 11px; line-height: 1.3; color: var(--text-2); overflow-wrap: anywhere;")}>{t.label}</span>
                </div>
              ))}
            </div>
            <div style={sx("display: flex; flex-direction: column; gap: 6px;")}>
              <div style={sx("display: flex; justify-content: space-between; font-size: 13px;")}><span style={sx("font-weight: 800;")}>Done</span><span style={sx("color: var(--text-2);")}>{pct}%</span></div>
              <div style={sx("height: 8px; border-radius: 4px; background: var(--surface-3); overflow: hidden;")}><div className="bar-anim" style={sx(`width: ${pct}%; height: 100%; border-radius: 4px; background: var(--ok);`)} /></div>
            </div>
            <div style={sx("display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line);")}>
              <h3 style={sx("margin: 0; font-size: 13px; font-weight: 800;")}>By class</h3>
              {courses.map((c) => { const p = per.get(c.id)!; return (
                <div key={c.id} style={sx("display: flex; flex-direction: column; gap: 5px;")}>
                  <div style={sx("display: flex; justify-content: space-between; gap: 8px; font-size: 13px; min-width: 0; flex-wrap: wrap;")}><span style={sx("font-weight: 700;")}>{c.code}</span><span style={sx("color: var(--text-2);")}>{p.total ? `${p.done} of ${p.total} done` : "Nothing due"}</span></div>
                  <div style={sx("height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden;")}><div className="bar-anim" style={sx(`width: ${p.total ? Math.round((p.done / p.total) * 100) : 0}%; height: 100%; border-radius: 3px; background: ${col(c)};`)} /></div>
                </div>
              ); })}
            </div>
            <div style={sx("display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line);")}>
              <div style={sx("display: flex; justify-content: space-between; gap: 8px;")}><h3 style={sx("margin: 0; font-size: 13px; font-weight: 800;")}>Study time</h3><span style={sx("font-size: 12px; color: var(--text-2);")}>{r1(studyTotal)} h set aside</span></div>
              {courses.map((c) => { const p = per.get(c.id)!; const goal = budget(c) * scale; return (
                <div key={c.id} style={sx("display: flex; flex-direction: column; gap: 5px;")}>
                  <div style={sx("display: flex; justify-content: space-between; gap: 8px; font-size: 13px; min-width: 0; flex-wrap: wrap;")}><span style={sx("font-weight: 700;")}>{c.code}</span><span style={sx("color: var(--text-2);")}>{r1(p.study)} of {r1(goal)} h</span></div>
                  <div style={sx("height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden;")}><div className="bar-anim" style={sx(`width: ${goal ? Math.min(100, (p.study / goal) * 100) : 0}%; height: 100%; border-radius: 3px; background: ${col(c)};`)} /></div>
                </div>
              ); })}
            </div>
            <div style={sx("display: flex; flex-direction: column; gap: 8px;")}>
              <div style={sx("display: flex; align-items: center; gap: 8px;")}>
                <h3 style={sx("margin: 0; font-size: 13px; font-weight: 800;")}>Catch up</h3>
                {overdue.length > 0 && <span style={sx("padding: 1px 7px; border-radius: 9px; background: var(--warn-bg); color: var(--warn-text); font-size: 11px; font-weight: 800;")}>{overdue.length} overdue</span>}
              </div>
              {!overdue.length && <span style={sx("font-size: 13px; color: var(--text-2);")}>You're caught up.</span>}
              {overdue.map((o) => {
                const cd = cardOf(o, ""); const days = Math.round((new Date(todayKey + "T12:00:00").getTime() - new Date(o.key + "T12:00:00").getTime()) / 86400000);
                return (
                  <button key={o.id} type="button" onClick={() => onOpen(o.id)} aria-label={"Open overdue item " + cd.full} className="lift"
                    style={sx("display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 9px 10px; box-sizing: border-box; border-radius: 10px; border: 1px solid var(--warn-line); background: var(--surface-2); color: var(--text); cursor: pointer; text-align: left;")}>
                    <span aria-hidden="true" style={sx(cd.iconWrap)}><Ico d={cd.icon} size={12} /></span>
                    <span style={sx("display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere;")}>
                      <span style={sx("font-size: 13px; font-weight: 700;")}>{o.title}</span>
                      <span style={sx("font-size: 12px; font-weight: 600; color: var(--warn-text);")}>{o.course.code}, {days} {days === 1 ? "day" : "days"} late</span>
                      {o.course.late_policy && <span style={sx("font-size: 12px; color: var(--muted);")}>{o.course.late_policy}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
