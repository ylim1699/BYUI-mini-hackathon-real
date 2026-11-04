import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useBlocker, useNavigate, useSearchParams } from "react-router-dom";
import { Confirm, ErrorNote, Ico, P, PageHead, S, Spinner } from "../components/ui";
import { qk, useCourses, useStudyTimes } from "../hooks/useData";
import { budget, DAY_FULL, dotStyle, fmtT, hm, r1, toHM } from "../lib/plan";
import { sx } from "../lib/sx";
import * as db from "../services/db";
import { useUi } from "../store/ui";
import type { Course, StudyTime } from "../types/domain";

interface Win { d: number; s: number; e: number }
type Plan = Record<number, [number, number][]>;

// Quick setups from the prototype
const PRESETS: [string, string, Plan][] = [
  ["mornings", "Mornings", { 1: [[8, 11]], 2: [[8, 11]], 3: [[8, 11]], 4: [[8, 11]], 5: [[8, 11]], 6: [[9, 12]], 0: [] }],
  ["afternoons", "Afternoons", { 1: [[13, 17]], 2: [[13, 17]], 3: [[13, 17]], 4: [[13, 17]], 5: [[13, 16]], 6: [[10, 12]], 0: [] }],
  ["evenings", "Evenings", { 1: [[18, 21]], 2: [[18, 21]], 3: [[18, 21]], 4: [[18, 21]], 5: [[14, 17]], 6: [[10, 13]], 0: [] }],
  ["clear", "Clear", { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }],
];

const fromRows = (rows: StudyTime[], id: string): Win[] =>
  rows.filter((r) => r.course_id === id).map((r) => ({ d: r.weekday, s: hm(r.start_time), e: hm(r.end_time) }));
const sig = (w: Win[]) => w.map((x) => `${x.d}:${x.s}-${x.e}`).sort().join(",");
const hours = (w: Win[]) => w.reduce((n, x) => n + Math.max(0, x.e - x.s), 0);
const presetWins = (p: Plan): Win[] => Object.entries(p).flatMap(([d, list]) => list.map(([s, e]) => ({ d: Number(d), s, e })));

export function StudyPage() {
  const courses = useCourses();
  const study = useStudyTimes();
  const qc = useQueryClient();
  const nav = useNavigate();
  const notify = useUi((s) => s.notify);
  const [params, setParams] = useSearchParams();
  const [drafts, setDrafts] = useState<Record<string, Win[]>>({});
  const [ask, setAsk] = useState<"one" | "all" | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const list = courses.data ?? [];
  const rows = study.data ?? [];
  const cur = list.find((c) => c.id === params.get("c")) ?? list[0];
  const saved = (id: string) => fromRows(rows, id);
  const draftOf = (id: string) => drafts[id] ?? saved(id);
  const dirtyIds = useMemo(() => Object.keys(drafts).filter((id) => sig(drafts[id] ?? []) !== sig(fromRows(rows, id))), [drafts, rows]);
  const dirty = (id: string) => dirtyIds.includes(id);
  const name = (id: string) => list.find((c) => c.id === id)?.code ?? "";

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyIds.length > 0 && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirtyIds.length) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirtyIds.length]);

  if (courses.isLoading || study.isLoading) return <Spinner />;
  if (!cur) {
    return (
      <div className="anim-page" style={sx("display: flex; flex-direction: column; gap: 16px;")}>
        <PageHead title="Set your study time" sub="Add your classes first. Then pick when you study each one." />
        <button type="button" onClick={() => nav("/add")} style={sx(S.primary + " align-self: flex-start;")}>Add your classes</button>
      </div>
    );
  }

  const win = draftOf(cur.id);
  const edit = (next: Win[]) => setDrafts((d) => ({ ...d, [cur.id]: next }));
  const discard = (ids: string[]) => setDrafts((d) => { const n = { ...d }; ids.forEach((id) => delete n[id]); return n; });
  const toRows = (w: Win[]) => w.map((x) => ({ weekday: x.d, start_time: toHM(x.s) + ":00", end_time: toHM(x.e) + ":00" }));

  const save = async (ids: string[]) => {
    setErr(null);
    const before = Object.fromEntries(ids.map((id) => [id, saved(id)]));
    try {
      for (const id of ids) await db.replaceStudyTimes(id, toRows(draftOf(id)));
      await qc.invalidateQueries({ queryKey: qk.study });
      discard(ids);
      const label = ids.length === 1 ? `${name(ids[0]!)} study time` : "Study time";
      notify({
        text: `${label} saved to your calendar.`,
        undo: async () => { for (const id of ids) await db.replaceStudyTimes(id, toRows(before[id] ?? [])); qc.invalidateQueries({ queryKey: qk.study }); },
      });
      return true;
    } catch (e) { setErr(e); return false; }
  };

  const total = list.reduce((n, c) => n + hours(draftOf(c.id)), 0);
  const need = list.reduce((n, c) => n + budget(c), 0);
  const curDirty = dirty(cur.id);
  const others = dirtyIds.filter((id) => id !== cur.id);

  return (
    <div className="anim-page" style={sx("display: flex; flex-direction: column; gap: 16px;")}>
      <PageHead title="Set your study time"
        sub="Pick when you study each class. Those times show on your calendar every week in the class's color. Click one to see what that class has due."
        right={dirtyIds.length > 1 ? (
          <div style={sx("display: flex; flex-wrap: wrap; align-items: center; gap: 8px;")}>
            <button type="button" onClick={() => discard(dirtyIds)} style={sx(S.outline)}>Discard all</button>
            <button type="button" onClick={() => setAsk("all")} style={sx(S.primary)}>Confirm all classes</button>
          </div>
        ) : !dirtyIds.length ? <button type="button" onClick={() => nav("/calendar")} style={sx(S.primary)}>See it on the calendar</button> : undefined} />
      <ErrorNote error={err} />
      <div style={sx("display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start;")}>
        <section className="frost" style={sx("flex: 999 1 520px; min-width: 0; box-sizing: border-box; padding: 18px; display: flex; flex-direction: column; gap: 4px; background: var(--surface); border: 1px solid var(--line); border-radius: 18px;")}>
          <div style={sx("display: flex; flex-direction: column; gap: 12px; margin-bottom: 8px;")}>
            <div style={sx("display: flex; flex-direction: column; gap: 6px;")}>
              <span id="sf-label" style={sx("font-size: 12px; font-weight: 800; color: var(--text-2);")}>Setting study time for</span>
              <div role="tablist" aria-labelledby="sf-label" style={sx("display: flex; flex-wrap: wrap; gap: 6px;")}>
                {list.map((c) => {
                  const on = c.id === cur.id;
                  return (
                    <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => setParams({ c: c.id })}
                      style={sx("display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; border-radius: 20px; font-size: 13px; font-weight: 700; cursor: pointer; " + (on ? "background: var(--primary-bg); color: var(--primary-text); border: 1px solid var(--primary-bg);" : "background: var(--surface-2); color: var(--text); border: 1px solid var(--line-strong);"))}>
                      <span aria-hidden="true" style={sx(dotStyle(c))} />{c.code}
                      <span style={sx("font-size: 11px; font-weight: 700; opacity: 0.75;")}>{r1(hours(draftOf(c.id)))} h</span>
                      {dirty(c.id) && <span title="Not saved yet" style={sx("padding: 1px 6px; border-radius: 8px; background: var(--warn-bg); color: var(--warn-text); font-size: 10px; font-weight: 800;")}>Unsaved</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={sx("display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 12px; border-top: 1px solid var(--line);")}>
              <div style={sx("display: flex; flex-direction: column; gap: 2px;")}>
                <h2 style={sx("margin: 0; font-size: 18px; font-weight: 800;")}>{cur.code} {cur.name}</h2>
                <span style={sx("font-size: 12px; color: var(--text-2);")}>Only {cur.code} work goes in these times. {cur.code} needs about {budget(cur)} hours a week.</span>
              </div>
              <div role="radiogroup" aria-label="Quick setups" style={sx("display: flex; flex-wrap: wrap; gap: 6px;")}>
                {PRESETS.map(([k, label, plan]) => {
                  const on = sig(presetWins(plan)) === sig(win);
                  return (
                    <button key={k} type="button" role="radio" aria-checked={on} onClick={() => edit(presetWins(plan))}
                      style={sx("min-height: 36px; padding: 0 14px; border-radius: 18px; font-size: 12px; font-weight: 700; cursor: pointer; " + (on ? "background: var(--primary-bg); color: var(--primary-text); border: 1px solid var(--primary-bg);" : "background: var(--surface-2); color: var(--text); border: 1px solid var(--line-strong);"))}>{label}</button>
                  );
                })}
              </div>
            </div>
          </div>

          {[1, 2, 3, 4, 5, 6, 0].map((dw) => <DayRow key={dw} dw={dw} win={win} onChange={edit} />)}

          <div style={sx("position: sticky; bottom: 12px; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; padding: 12px 14px; border-radius: 16px; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: var(--shadow);")}>
            {curDirty ? (
              <>
                <span style={sx("font-size: 13px; font-weight: 700;")}>You changed {cur.code}. Confirm to put it on your calendar.</span>
                <div style={sx("display: flex; gap: 8px;")}>
                  <button type="button" onClick={() => discard([cur.id])} style={sx("min-height: 38px; padding: 0 14px; border-radius: 19px; border: 1px solid var(--line-strong); background: transparent; color: var(--text); font-size: 13px; font-weight: 700; cursor: pointer;")}>Discard</button>
                  <button type="button" onClick={() => setAsk("one")} style={sx("min-height: 38px; padding: 0 16px; border-radius: 19px; border: 0; background: var(--primary-bg); color: var(--primary-text); font-size: 13px; font-weight: 700; cursor: pointer;")}>Confirm {cur.code}</button>
                </div>
              </>
            ) : (
              <>
                <span style={sx("font-size: 13px; color: var(--text-2);")}>
                  {others.length ? `No changes here. ${others.map(name).join(", ")} still ${others.length === 1 ? "needs" : "need"} confirming.` : "All saved. Change a time to confirm it."}
                </span>
                <button type="button" disabled style={sx("min-height: 38px; padding: 0 16px; border-radius: 19px; border: 0; background: var(--surface-3); color: var(--muted); font-size: 13px; font-weight: 700; cursor: not-allowed;")}>Confirm {cur.code}</button>
              </>
            )}
          </div>
        </section>

        <aside style={sx("flex: 1 1 300px; min-width: 0; display: flex; flex-direction: column; gap: 16px;")}>
          <section className="frost" style={sx("box-sizing: border-box; padding: 18px; display: flex; flex-direction: column; gap: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 18px;")}>
            <h2 style={sx("margin: 0; font-size: 16px; font-weight: 800;")}>Weekly total</h2>
            <div style={sx("display: flex; align-items: baseline; gap: 8px;")}>
              <span style={sx("font-size: 34px; font-weight: 800; letter-spacing: -0.02em;")}>{r1(total)}</span>
              <span style={sx("font-size: 14px; color: var(--text-2);")}>hours of {r1(need)} your classes need</span>
            </div>
            <div style={sx("height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden;")}>
              <div className="bar-anim" style={sx(`width: ${need ? Math.min(100, (total / need) * 100) : 0}%; height: 100%; border-radius: 4px; background: ${total >= need ? "var(--ok)" : "var(--c1)"};`)} />
            </div>
            <span style={sx("font-size: 13px; line-height: 1.5; color: var(--text-2);")}>
              {total >= need ? "That covers what your classes need. Nice." : `About ${r1(need - total)} more hours a week would cover what your classes need. Add time on a day that's light for you.`}
            </span>
            {list.map((c: Course) => (
              <div key={c.id} style={sx("display: flex; align-items: center; gap: 10px; font-size: 13px;")}>
                <span aria-hidden="true" style={sx(dotStyle(c))} />
                <span style={sx("flex: 1 1 auto; font-weight: 700;")}>{c.code}</span>
                <span style={sx("color: var(--text-2);")}>{r1(hours(draftOf(c.id)))} of {budget(c)} h</span>
              </div>
            ))}
            <span style={sx("font-size: 12px; color: var(--muted);")}>2.5 hours per credit, or what the syllabus asks for.</span>
          </section>
        </aside>
      </div>

      <Confirm open={ask === "one"} title={`Confirm ${cur.code} study time?`} yes="Confirm" onClose={() => setAsk(null)}
        body="These times go on your calendar every week and sync to your connected calendar." onYes={() => void save([cur.id])} />
      <Confirm open={ask === "all"} title={`Confirm study time for ${dirtyIds.map(name).join(", ")}?`} yes="Confirm" onClose={() => setAsk(null)}
        body="These times go on your calendar every week and sync to your connected calendar." onYes={() => void save(dirtyIds)} />

      {blocker.state === "blocked" && (
        <div className="anim-backdrop" style={sx("position: fixed; inset: 0; z-index: 26; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(10,12,11,0.45);")}>
          <div role="alertdialog" aria-modal="true" aria-label="Confirm your study time?" className="anim-dialog" style={sx("width: 100%; max-width: 400px; box-sizing: border-box; padding: 20px; display: flex; flex-direction: column; gap: 12px; border-radius: 20px; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: var(--shadow); color: var(--text);")}>
            <h2 style={sx("margin: 0; font-size: 18px; font-weight: 800;")}>Confirm your study time?</h2>
            <p style={sx("margin: 0; font-size: 14px; line-height: 1.5; color: var(--text-2);")}>You changed {dirtyIds.map(name).join(", ")} but didn't confirm. Changes only go on your calendar after you confirm.</p>
            <div style={sx("display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; padding-top: 4px;")}>
              <button type="button" autoFocus onClick={() => blocker.reset?.()} style={sx("min-height: 40px; padding: 0 14px; border-radius: 20px; border: 0; background: transparent; color: var(--text-2); font-size: 13px; font-weight: 700; cursor: pointer;")}>Keep editing</button>
              <button type="button" onClick={() => { discard(dirtyIds); blocker.proceed?.(); }} style={sx("min-height: 40px; padding: 0 14px; border-radius: 20px; border: 1px solid var(--line-strong); background: transparent; color: var(--text); font-size: 13px; font-weight: 700; cursor: pointer;")}>Discard</button>
              <button type="button" onClick={async () => { if (await save(dirtyIds)) blocker.proceed?.(); else blocker.reset?.(); }} style={sx("min-height: 40px; padding: 0 16px; border-radius: 20px; border: 0; background: var(--primary-bg); color: var(--primary-text); font-size: 13px; font-weight: 700; cursor: pointer;")}>Confirm and leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DayRow({ dw, win, onChange }: { dw: number; win: Win[]; onChange: (w: Win[]) => void }) {
  const mine = win.map((w, idx) => ({ w, idx })).filter(({ w }) => w.d === dw);
  const hrs = hours(mine.map((x) => x.w));
  const nm = DAY_FULL[dw] ?? "";
  const setW = (idx: number, which: "s" | "e", val: string) => {
    const v = hm(val);
    onChange(win.map((w, n) => {
      if (n !== idx) return w;
      if (which === "s") { const len = w.e - w.s; return { ...w, s: v, e: Math.min(24, Math.max(v + 0.5, v + len)) }; }
      return { ...w, e: Math.max(w.s + 0.5, v) };
    }));
  };
  const add = () => {
    const last = mine.length ? Math.max(...mine.map((x) => x.w.e)) : 18;
    const a = last >= 22 ? 18 : last;
    onChange([...win, { d: dw, s: a, e: Math.min(24, a + 2) }]);
  };
  const timeInput = "min-height: 32px; padding: 0 6px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field); color: var(--text); font-size: 13px;";

  return (
    <div style={sx("display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 0; border-top: 1px solid var(--line);")}>
      <div style={sx("flex: 0 0 110px; display: flex; flex-direction: column;")}>
        <span style={sx("font-size: 14px; font-weight: 800;")}>{nm}</span>
        <span style={sx("font-size: 12px; color: var(--muted);")}>{hrs ? `${r1(hrs)} h` : ""}</span>
      </div>
      <div style={sx("flex: 1 1 300px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;")}>
        {mine.map(({ w, idx }) => (
          <div key={idx} style={sx("display: inline-flex; align-items: center; gap: 6px; padding: 4px 4px 4px 10px; border-radius: 14px; background: repeating-linear-gradient(135deg, var(--study-a) 0 8px, var(--study-b) 8px 16px); border: 1px solid var(--study-line);")}>
            <input type="time" value={toHM(w.s)} onChange={(e) => e.target.value && setW(idx, "s", e.target.value)} aria-label={`${nm} study start`} style={sx(timeInput)} />
            <span style={sx("font-size: 12px; color: var(--text-2);")}>to</span>
            <input type="time" value={toHM(w.e)} onChange={(e) => e.target.value && setW(idx, "e", e.target.value)} aria-label={`${nm} study end`} style={sx(timeInput)} />
            <button type="button" onClick={() => onChange(win.filter((_, n) => n !== idx))} aria-label={`Remove ${nm} ${fmtT(w.s)} study time`} style={sx("width: 30px; height: 30px; padding: 0; border: 0; border-radius: 15px; background: transparent; color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center;")}>
              <Ico d={P.x} size={12} sw={2.6} />
            </button>
          </div>
        ))}
        {!mine.length && <span style={sx("font-size: 13px; color: var(--muted);")}>No study time</span>}
        <button type="button" onClick={add} aria-label={`Add study time on ${nm}`} style={sx("display: inline-flex; align-items: center; gap: 4px; min-height: 34px; padding: 0 12px; border-radius: 17px; border: 1px dashed var(--line-strong); background: transparent; font-size: 12px; font-weight: 700; color: var(--text-2); cursor: pointer;")}>
          <Ico d={P.plus} size={12} sw={2.6} />Add time
        </button>
      </div>
    </div>
  );
}
