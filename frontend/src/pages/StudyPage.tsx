import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useBlocker, useSearchParams } from "react-router-dom";
import { Button, Card, Confirm, Dialog, Dot, ErrorNote, inputCls, PageHeader, Spinner } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { qk, useCourses, useStudyTimes } from "../hooks/useData";
import { hm } from "../lib/dates";
import * as db from "../services/db";
import { useUi } from "../store/ui";
import type { StudyTime } from "../types/domain";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
interface Win { weekday: number; start: string; end: string }

const PRESETS: Record<string, Win[]> = {
  Mornings: [1, 2, 3, 4, 5].map((d) => ({ weekday: d, start: "08:00", end: "10:00" })),
  Afternoons: [1, 2, 3, 4, 5].map((d) => ({ weekday: d, start: "14:00", end: "16:00" })),
  Evenings: [1, 2, 3, 4].map((d) => ({ weekday: d, start: "18:00", end: "20:00" })),
  Clear: [],
};

const fromRows = (rows: StudyTime[], courseId: string): Win[] =>
  rows.filter((r) => r.course_id === courseId).map((r) => ({ weekday: r.weekday, start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) }))
    .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
const sig = (w: Win[]) => JSON.stringify([...w].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)));
const mins = (t: string) => { const [h, m] = hm(t); return h * 60 + m; };
const hours = (w: Win[]) => w.reduce((s, x) => s + Math.max(0, mins(x.end) - mins(x.start)), 0) / 60;
const invalid = (w: Win[]) => w.some((x) => mins(x.end) <= mins(x.start));

export function StudyPage() {
  const courses = useCourses();
  const study = useStudyTimes();
  const qc = useQueryClient();
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

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyIds.length > 0 && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirtyIds.length) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirtyIds.length]);

  if (courses.isLoading || study.isLoading) return <Spinner />;
  if (!cur) return <><PageHeader title="Set your study time" /><Card><p className="text-text-2">Add and confirm a class first.</p></Card></>;

  const win = draftOf(cur.id);
  const edit = (next: Win[]) => setDrafts((d) => ({ ...d, [cur.id]: next }));
  const discard = (ids: string[]) => setDrafts((d) => { const n = { ...d }; ids.forEach((id) => delete n[id]); return n; });

  const save = async (ids: string[]) => {
    setErr(null);
    const before = Object.fromEntries(ids.map((id) => [id, saved(id)]));
    try {
      for (const id of ids) await db.replaceStudyTimes(id, draftOf(id).map((w) => ({ weekday: w.weekday, start_time: `${w.start}:00`, end_time: `${w.end}:00` })));
      await qc.invalidateQueries({ queryKey: qk.study });
      discard(ids);
      const names = ids.map((id) => list.find((c) => c.id === id)?.code ?? "").join(", ");
      notify({
        text: `Saved study time for ${names}.`,
        undo: async () => {
          for (const id of ids) await db.replaceStudyTimes(id, (before[id] ?? []).map((w) => ({ weekday: w.weekday, start_time: `${w.start}:00`, end_time: `${w.end}:00` })));
          qc.invalidateQueries({ queryKey: qk.study });
        },
      });
      return true;
    } catch (e) { setErr(e); return false; }
  };

  const setAside = hours(win);
  const goal = cur.hours_per_week;

  return (
    <>
      <PageHeader title="Set your study time" sub="Pick weekly times for each class. They become study blocks on your calendar." />
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {list.map((c) => (
          <button key={c.id} role="tab" aria-selected={c.id === cur.id} onClick={() => setParams({ c: c.id })}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-bold ${c.id === cur.id ? "border-text bg-surface-3" : "border-line-strong text-text-2 hover:text-text"}`}>
            <Dot color={c.color} />{c.code}
            {dirty(c.id) && <span className="rounded bg-warn-bg px-1.5 text-[11px] text-warn">Unsaved</span>}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">{cur.code} <span className="text-text-2">{cur.name}</span></h2>
            <p className={`mt-1 text-sm font-bold ${setAside + 0.01 < goal ? "text-warn" : "text-ok"}`}>
              {setAside.toFixed(1)} of {goal} hours a week set aside
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PRESETS).map(([name, p]) => {
              const active = sig(p) === sig(win);
              return <button key={name} onClick={() => edit(p)} aria-pressed={active}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${active ? "bg-primary text-on-primary" : "border border-line-strong text-text-2 hover:text-text"}`}>{name}</button>;
            })}
          </div>
        </div>

        <div className="mt-5 divide-y divide-line">
          {DAYS.map((day, d) => {
            const mine = win.map((w, i) => ({ w, i })).filter((x) => x.w.weekday === d);
            return (
              <div key={day} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className={`w-24 text-sm font-bold ${d === 0 || d === 6 ? "text-[var(--weekend)]" : ""}`}>{day}</span>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {mine.map(({ w, i }) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: `var(--${cur.color}-soft)` }}>
                      <input aria-label={`${day} start`} type="time" className={`${inputCls} w-32 py-1`} value={w.start}
                        onChange={(e) => edit(win.map((x, n) => (n === i ? { ...x, start: e.target.value } : x)))} />
                      <span className="text-xs text-text-2">to</span>
                      <input aria-label={`${day} end`} type="time" className={`${inputCls} w-32 py-1`} value={w.end}
                        onChange={(e) => edit(win.map((x, n) => (n === i ? { ...x, end: e.target.value } : x)))} />
                      <button aria-label="Remove time" className="p-1 text-text-2 hover:text-text" onClick={() => edit(win.filter((_, n) => n !== i))}><Icon name="x" size={14} /></button>
                    </div>
                  ))}
                  <button className="text-xs font-bold text-text-2 hover:text-text" onClick={() => edit([...win, { weekday: d, start: "18:00", end: "20:00" }])}>+ Add time</button>
                </div>
              </div>
            );
          })}
        </div>
        {invalid(win) && <p className="mt-2 text-sm font-bold text-warn">Each time needs to end after it starts.</p>}
      </Card>

      <ErrorNote error={err} />

      {dirtyIds.length > 0 && (
        <div className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-line-strong bg-surface-2 p-3 shadow-card">
          <span className="mr-auto text-sm font-bold">{dirty(cur.id) ? `${cur.code} has unsaved changes` : "Other classes have unsaved changes"}</span>
          {dirty(cur.id) && <Button onClick={() => discard([cur.id])}>Discard</Button>}
          {dirty(cur.id) && <Button variant="primary" disabled={invalid(win)} onClick={() => setAsk("one")}>Confirm</Button>}
          {dirtyIds.length > 1 && <Button variant="primary" disabled={dirtyIds.some((id) => invalid(draftOf(id)))} onClick={() => setAsk("all")}>Confirm all classes</Button>}
        </div>
      )}

      <Confirm open={ask === "one"} title={`Confirm ${cur.code} study time?`} yes="Confirm" onClose={() => setAsk(null)}
        body={`${setAside.toFixed(1)} hours a week. Your calendar's study blocks will update.`} onYes={() => void save([cur.id])} />
      <Confirm open={ask === "all"} title={`Confirm study time for ${dirtyIds.length} classes?`} yes="Confirm all" onClose={() => setAsk(null)}
        body={dirtyIds.map((id) => list.find((c) => c.id === id)?.code).join(", ")} onYes={() => void save(dirtyIds)} />

      <Dialog open={blocker.state === "blocked"} title="You have unsaved study time" onClose={() => blocker.reset?.()}
        footer={<>
          <Button onClick={() => blocker.reset?.()}>Keep editing</Button>
          <Button onClick={() => { discard(dirtyIds); blocker.proceed?.(); }}>Discard</Button>
          <Button variant="primary" disabled={dirtyIds.some((id) => invalid(draftOf(id)))}
            onClick={async () => { if (await save(dirtyIds)) blocker.proceed?.(); else blocker.reset?.(); }}>Confirm and leave</Button>
        </>}>
        Changes for {dirtyIds.map((id) => list.find((c) => c.id === id)?.code).join(", ")} aren't saved yet.
      </Dialog>
    </>
  );
}
