import { format } from "date-fns";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Confirm, ErrorNote, Ico, P, PageHead, S, Spinner } from "../components/ui";
import { useAll, useRefreshAll, useUpdateCourse, useUpdateItem } from "../hooks/useData";
import { DAY_FULL, dotStyle, hm, meetingSummary, meetsLine } from "../lib/plan";
import { sx } from "../lib/sx";
import * as db from "../services/db";
import { useUi } from "../store/ui";
import { ITEM_TYPES, TYPE_LABEL, type Course, type Item } from "../types/domain";

interface Session { d: number; s: string; e: string }
interface TimesDraft { mode: "person" | "online"; sessions: Session[]; error: string }

export const isFlagged = (i: Item) => i.confidence < 0.7 && !i.edited;
const MWF: Session[] = [1, 3, 5].map((d) => ({ d, s: "09:00", e: "10:00" }));

export function ReviewPage() {
  const { courses, items, loading, error } = useAll();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();

  if (loading) return <Spinner />;
  const rc = courses.find((c) => c.id === params.get("c")) ?? courses[0];
  const live = items.filter((i) => !i.deleted_at);
  const flagsFor = (c: Course) => live.filter((i) => i.course_id === c.id && isFlagged(i)).length + (c.online === null ? 1 : 0);

  return (
    <div className="anim-page" style={sx("display: flex; flex-direction: column; gap: 16px;")}>
      <PageHead title="Check what we found"
        sub="Edit anything that's off. Highlighted rows are ones we weren't sure about. Nothing goes to your calendar until you confirm each class."
        right={<button type="button" onClick={() => nav("/study")} style={sx(S.primary)}>Continue to study time</button>} />
      <ErrorNote error={error} />
      {!rc ? (
        <section style={sx(S.card + " padding: 28px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px;")}>
          <span style={sx("font-size: 15px; font-weight: 800;")}>No classes yet</span>
          <span style={sx("font-size: 14px; color: var(--text-2);")}>Add a syllabus PDF or import from Canvas, and what we find shows up here to check.</span>
          <button type="button" onClick={() => nav("/add")} style={sx(S.primary)}>Add your classes</button>
        </section>
      ) : (
        <>
          <div role="tablist" aria-label="Classes" style={sx("display: flex; flex-wrap: wrap; gap: 8px;")}>
            {courses.map((c) => {
              const on = c.id === rc.id; const flags = flagsFor(c);
              return (
                <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => setParams({ c: c.id })}
                  style={sx("display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 16px; border-radius: 21px; font-size: 14px; font-weight: 700; cursor: pointer; color: var(--text); " + (on ? "background: var(--surface-3); border: 1px solid var(--line-strong);" : "background: var(--surface); border: 1px solid var(--line);"))}>
                  <span aria-hidden="true" style={sx(dotStyle(c))} />
                  {c.code}
                  {flags > 0 && <span style={sx("padding: 2px 8px; border-radius: 10px; background: var(--warn-bg); color: var(--warn-text); font-size: 11px; font-weight: 800;")}>{flags} to check</span>}
                  {c.confirmed && <svg role="img" aria-label="Confirmed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={P.check} /></svg>}
                </button>
              );
            })}
          </div>
          <CoursePanel key={rc.id} course={rc} items={live.filter((i) => i.course_id === rc.id)} />
        </>
      )}
    </div>
  );
}

function CoursePanel({ course: c, items }: { course: Course; items: Item[] }) {
  const updateCourse = useUpdateCourse();
  const notify = useUi((s) => s.notify);
  const nav = useNavigate();
  const refresh = useRefreshAll();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState({ code: c.code, name: c.name });
  const [renameError, setRenameError] = useState("");
  const [times, setTimes] = useState<TimesDraft | null>(null);
  const [ask, setAsk] = useState<null | { kind: "course" } | { kind: "row"; item: Item }>(null);
  const updateItem = useUpdateItem();
  const patch = (p: Partial<Course>) => updateCourse.mutate({ id: c.id, patch: p });

  const rows = [...items].sort((a, b) => (a.due_at ?? "9").localeCompare(b.due_at ?? "9"));

  const saveRename = () => {
    const code = draft.code.trim(); const name = draft.name.trim();
    if (!code) { setRenameError("Add a class code, like CSE 280."); return; }
    const prev = { code: c.code, name: c.name, renamed: c.renamed };
    patch({ code, name, renamed: true });
    setRenaming(false); setRenameError("");
    notify({ text: `Renamed to ${code}${name ? " " + name : ""}.`, undo: () => patch(prev) });
  };

  const saveTimes = () => {
    if (!times) return;
    const prev = { online: c.online, meetings: c.meetings };
    if (times.mode === "person") {
      if (!times.sessions.length) { setTimes({ ...times, error: "Add at least one day." }); return; }
      if (times.sessions.some((x) => hm(x.e) <= hm(x.s))) { setTimes({ ...times, error: "Each end time has to be after its start time." }); return; }
      patch({ online: false, meetings: times.sessions.map((x) => ({ day: x.d, start: x.s, end: x.e })) });
      notify({ text: `Saved ${c.code} class times.${c.confirmed ? " They now show on your calendar." : ""}`, undo: () => patch(prev) });
    } else {
      patch({ online: true, meetings: [] });
      notify({ text: `${c.code} is marked online. Set up study time for it when you're ready.`, undo: () => patch(prev) });
    }
    setTimes(null);
  };

  const openTimes = (mode: "person" | "online") =>
    setTimes({ mode, error: "", sessions: c.meetings.length ? c.meetings.map((m) => ({ d: m.day, s: m.start, e: m.end })) : /mon.*wed.*fri|m\/?w\/?f/i.test(c.notes ?? "") ? MWF : [{ d: 1, s: "09:00", e: "10:00" }] });

  const addRow = async () => {
    await db.insertItems([{ course_id: c.id, title: "", type: "assignment", due_at: null, estimated_hours: 2, source: "manual", confidence: 1, status: "todo", notes: null, deleted_at: null, edited: true }]);
    refresh();
  };

  const missing = c.online === null && !times;
  const box = "display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 14px; " + (missing ? "background: var(--warn-card); border: 1px solid var(--warn-line);" : "background: var(--surface-2); border: 1px solid var(--line);");
  const btnSm = "min-height: 36px; padding: 0 16px; border-radius: 18px; font-size: 13px; font-weight: 700; cursor: pointer;";
  const solidSm = btnSm + " border: 0; background: var(--primary-bg); color: var(--primary-text);";
  const outSm = btnSm + " border: 1px solid var(--line-strong); background: var(--surface-2); color: var(--text);";
  const segB = (on: boolean) => "flex: 1 1 0; min-height: 36px; border: 0; border-radius: 18px; font-size: 13px; font-weight: 700; cursor: pointer; padding: 0 14px; " + (on ? "background: var(--surface-3); color: var(--text);" : "background: transparent; color: var(--muted);");

  return (
    <div style={sx("display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start;")}>
      <section style={sx("flex: 999 1 620px; min-width: 0; padding: 18px; display: flex; flex-direction: column; gap: 14px; " + S.card)}>
        <div style={sx("display: flex; flex-direction: column; gap: 4px;")}>
          {!renaming ? (
            <div style={sx("display: flex; align-items: center; gap: 6px; flex-wrap: wrap;")}>
              <h2 style={sx("margin: 0; font-size: 20px; font-weight: 800;")}>{c.code} {c.name}</h2>
              <button type="button" onClick={() => { setDraft({ code: c.code, name: c.name }); setRenaming(true); }} aria-label="Rename class" title="Rename class"
                style={sx("width: 34px; height: 34px; padding: 0; border: 0; border-radius: 17px; background: transparent; color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center;")}>
                <Ico d={P.pencil} size={16} sw={1.9} />
              </button>
              {c.renamed && <span style={sx("font-size: 12px; font-weight: 600; color: var(--c1);")}>Renamed by you</span>}
            </div>
          ) : (
            <div className="anim-pop" style={sx("display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; padding: 12px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--line-strong);")}>
              <div style={sx("display: flex; flex-direction: column; gap: 4px; flex: 0 1 130px;")}>
                <label htmlFor="rename-code" style={sx("font-size: 12px; font-weight: 700; color: var(--text-2);")}>Class code</label>
                <input id="rename-code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="CSE 280" style={sx("min-height: 40px; box-sizing: border-box; padding: 0 12px; border-radius: 12px; border: 1px solid var(--line-strong); background: var(--field); font-size: 14px; font-weight: 700; color: var(--text);")} />
              </div>
              <div style={sx("display: flex; flex-direction: column; gap: 4px; flex: 1 1 220px;")}>
                <label htmlFor="rename-name" style={sx("font-size: 12px; font-weight: 700; color: var(--text-2);")}>Class name</label>
                <input id="rename-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Discrete Mathematics" style={sx("min-height: 40px; box-sizing: border-box; padding: 0 12px; border-radius: 12px; border: 1px solid var(--line-strong); background: var(--field); font-size: 14px; color: var(--text);")} />
              </div>
              <div style={sx("display: flex; gap: 8px;")}>
                <button type="button" onClick={() => { setRenaming(false); setRenameError(""); }} style={sx("min-height: 40px; padding: 0 14px; border-radius: 20px; border: 1px solid var(--line-strong); background: transparent; color: var(--text); font-size: 13px; font-weight: 700; cursor: pointer;")}>Cancel</button>
                <button type="button" onClick={saveRename} style={sx("min-height: 40px; padding: 0 16px; border: 0; border-radius: 20px; background: var(--primary-bg); color: var(--primary-text); font-size: 13px; font-weight: 700; cursor: pointer;")}>Save</button>
              </div>
              {renameError && <span role="alert" style={sx("flex: 1 1 100%; font-size: 12px; font-weight: 600; color: var(--weekend);")}>{renameError}</span>}
              <span style={sx("flex: 1 1 100%; font-size: 12px; color: var(--muted);")}>The new name shows everywhere, including events sent to your calendar.</span>
            </div>
          )}
          <span style={sx("font-size: 13px; color: var(--text-2);")}>{meetsLine(c)}</span>
          {c.notes && <span style={sx("font-size: 12px; font-weight: 600; color: var(--warn-text);")}>{c.notes}</span>}
          <span style={sx("font-size: 12px; color: var(--muted);")}>{rows.length} items · {c.credits} credits · {c.hours_per_week} study hours a week</span>
        </div>

        <div className="anim-pop" style={sx(box)}>
          {missing && (
            <div style={sx("display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px;")}>
              <span aria-hidden="true" style={sx("width: 32px; height: 32px; flex-shrink: 0; border-radius: 16px; background: var(--warn-bg); color: var(--warn-text); display: flex; align-items: center; justify-content: center;")}><Ico d={P.warn} size={15} sw={2.1} /></span>
              <div style={sx("flex: 1 1 260px; display: flex; flex-direction: column; gap: 4px; min-width: 0;")}>
                <span style={sx("font-size: 11px; font-weight: 800; color: var(--warn-text);")}>Needs attention</span>
                <span style={sx("font-size: 14px; font-weight: 800;")}>Class times are missing</span>
                <span style={sx("font-size: 13px; line-height: 1.5; color: var(--text-2);")}>The syllabus doesn't say exactly when this class meets. Does it meet in person or online?</span>
              </div>
              <div style={sx("display: flex; flex-wrap: wrap; gap: 8px; align-self: center;")}>
                <button type="button" onClick={() => openTimes("person")} style={sx(solidSm)}>In person</button>
                <button type="button" onClick={() => { patch({ online: true, meetings: [] }); notify({ text: `${c.code} is marked online.`, undo: () => patch({ online: null }) }); }} style={sx(outSm)}>Online</button>
              </div>
            </div>
          )}
          {!times && c.online === false && (
            <div style={sx("display: flex; flex-wrap: wrap; align-items: center; gap: 12px;")}>
              <span aria-hidden="true" style={sx("width: 32px; height: 32px; flex-shrink: 0; border-radius: 16px; background: var(--surface-3); color: var(--text); display: flex; align-items: center; justify-content: center;")}><Ico d={P.clock} size={15} /></span>
              <div style={sx("flex: 1 1 240px; display: flex; flex-direction: column; gap: 2px; min-width: 0;")}>
                <span style={sx("font-size: 14px; font-weight: 800;")}>Meets in person</span>
                <span style={sx("font-size: 13px; color: var(--text);")}>{c.meetings.length ? meetingSummary(c) : "No times added yet."}</span>
                <span style={sx("font-size: 12px; color: var(--muted);")}>{c.confirmed ? "Shows on your calendar every week." : "Shows on your calendar every week after you confirm."}</span>
              </div>
              <button type="button" onClick={() => openTimes("person")} style={sx(outSm)}>Edit class times</button>
            </div>
          )}
          {!times && c.online === true && (
            <div style={sx("display: flex; flex-wrap: wrap; align-items: center; gap: 12px;")}>
              <span aria-hidden="true" style={sx("width: 32px; height: 32px; flex-shrink: 0; border-radius: 16px; background: var(--surface-3); color: var(--text); display: flex; align-items: center; justify-content: center;")}><Ico d={P.screen} size={15} /></span>
              <div style={sx("flex: 1 1 240px; display: flex; flex-direction: column; gap: 2px; min-width: 0;")}>
                <span style={sx("font-size: 14px; font-weight: 800;")}>Online class</span>
                <span style={sx("font-size: 13px; color: var(--text-2);")}>No class meetings, so set aside study time for it instead.</span>
              </div>
              <div style={sx("display: flex; flex-wrap: wrap; gap: 8px;")}>
                <button type="button" onClick={() => nav(`/study?c=${c.id}`)} style={sx(solidSm)}>Set up study time</button>
                <button type="button" onClick={() => openTimes("person")} style={sx(outSm)}>It meets in person</button>
              </div>
            </div>
          )}
          {times && (
            <div className="anim-fade" style={sx("display: flex; flex-direction: column; gap: 12px;")}>
              <div style={sx("display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;")}>
                <span style={sx("font-size: 14px; font-weight: 800;")}>When does {c.code} meet?</span>
                <div role="radiogroup" aria-label="How the class meets" style={sx("display: flex; padding: 3px; border-radius: 21px; border: 1px solid var(--line-strong); background: var(--field);")}>
                  <button type="button" role="radio" aria-checked={times.mode === "person"} onClick={() => setTimes({ ...times, mode: "person", error: "" })} style={sx(segB(times.mode === "person"))}>In person</button>
                  <button type="button" role="radio" aria-checked={times.mode === "online"} onClick={() => setTimes({ ...times, mode: "online", error: "" })} style={sx(segB(times.mode === "online"))}>Online</button>
                </div>
              </div>
              {times.mode === "person" ? (
                <div style={sx("display: flex; flex-direction: column; gap: 8px;")}>
                  {times.sessions.map((x, n) => {
                    const setRow = (p: Partial<Session>) => setTimes({ ...times, error: "", sessions: times.sessions.map((r, m) => (m === n ? { ...r, ...p } : r)) });
                    return (
                      <div key={n} className="anim-fade" style={sx("display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 8px 8px 10px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line);")}>
                        <select value={x.d} onChange={(e) => setRow({ d: Number(e.target.value) })} aria-label={`Day for meeting ${n + 1}`} style={sx("min-height: 38px; padding: 0 8px; border-radius: 10px; font-size: 14px; font-weight: 700;")}>
                          {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DAY_FULL[d]}</option>)}
                        </select>
                        <input type="time" value={x.s} onChange={(e) => setRow({ s: e.target.value })} aria-label={`${DAY_FULL[x.d]} start time`} style={sx("min-height: 38px; box-sizing: border-box; padding: 0 8px; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--field); font-size: 14px; color: var(--text);")} />
                        <span style={sx("font-size: 13px; color: var(--text-2);")}>to</span>
                        <input type="time" value={x.e} onChange={(e) => setRow({ e: e.target.value })} aria-label={`${DAY_FULL[x.d]} end time`} style={sx("min-height: 38px; box-sizing: border-box; padding: 0 8px; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--field); font-size: 14px; color: var(--text);")} />
                        <span style={sx("flex-grow: 1;")} />
                        <button type="button" onClick={() => setTimes({ ...times, error: "", sessions: times.sessions.filter((_, m) => m !== n) })} aria-label={`Remove ${DAY_FULL[x.d]}`} style={sx("width: 34px; height: 34px; padding: 0; border: 0; border-radius: 17px; background: transparent; color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center;")}><Ico d={P.x} size={13} sw={2.6} /></button>
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => {
                    const used = times.sessions.map((r) => r.d); const next = [1, 2, 3, 4, 5, 6, 0].find((d) => !used.includes(d)) ?? 1;
                    const last = times.sessions[times.sessions.length - 1];
                    setTimes({ ...times, error: "", sessions: [...times.sessions, { d: next, s: last?.s ?? "09:00", e: last?.e ?? "10:00" }] });
                  }} style={sx("align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px; border-radius: 18px; border: 1px dashed var(--line-strong); background: transparent; color: var(--text); font-size: 13px; font-weight: 700; cursor: pointer;")}>
                    <Ico d={P.plus} size={13} sw={2.4} />Add a day
                  </button>
                  <span style={sx("font-size: 12px; color: var(--muted);")}>Each day can have its own time, like a lab on Fridays.</span>
                </div>
              ) : <span style={sx("font-size: 13px; color: var(--text-2);")}>No class meetings will be added. You can set up study time for it next.</span>}
              {times.error && <span role="alert" style={sx("font-size: 12px; font-weight: 600; color: var(--weekend);")}>{times.error}</span>}
              <div style={sx("display: flex; justify-content: flex-end; gap: 8px;")}>
                <button type="button" onClick={() => setTimes(null)} style={sx(btnSm + " border: 1px solid var(--line-strong); background: transparent; color: var(--text);")}>Cancel</button>
                <button type="button" onClick={saveTimes} style={sx(solidSm)}>Save</button>
              </div>
            </div>
          )}
        </div>

        <div style={sx("overflow-x: auto; margin: 0 -6px;")}>
          <table style={sx("width: 100%; min-width: 720px; border-collapse: separate; border-spacing: 0; font-size: 13px;")}>
            <thead>
              <tr>
                {["Item", "Type", "Due date", "Time", "Est. hours"].map((h, n) => (
                  <th key={h} style={sx("text-align: left; padding: 8px 10px; font-size: 12px; font-weight: 700; color: var(--muted);" + (n === 0 ? " width: 36%;" : ""))}>{h}</th>
                ))}
                <th style={sx("padding: 8px 10px;")}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((it) => <Row key={it.id} it={it} onDelete={() => setAsk({ kind: "row", item: it })} />)}
            </tbody>
          </table>
          {!rows.length && <p style={sx("margin: 8px 10px; font-size: 13px; color: var(--text-2);")}>No items for this class yet.</p>}
        </div>

        <div style={sx("display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;")}>
          <button type="button" onClick={addRow} style={sx("display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 16px; border-radius: 20px; border: 1px dashed var(--line-strong); background: transparent; font-size: 13px; font-weight: 700; color: var(--text); cursor: pointer;")}>
            <Ico d={P.plus} size={16} />Add item
          </button>
          {c.confirmed ? (
            <span style={sx("display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 22px; background: var(--surface-2); color: var(--ok); font-size: 14px; font-weight: 700;")}>
              <Ico d={P.check} size={18} sw={2.2} />Confirmed for your calendar
            </span>
          ) : <button type="button" onClick={() => setAsk({ kind: "course" })} style={sx(S.primary)}>Confirm {c.code}</button>}
        </div>
      </section>

      <aside style={sx("flex: 1 1 280px; min-width: 0; padding: 18px; display: flex; flex-direction: column; gap: 12px; " + S.card)}>
        <h2 style={sx("margin: 0; font-size: 15px; font-weight: 800;")}>From the syllabus</h2>
        <p style={sx("margin: 0; font-size: 12px; color: var(--muted);")}>{c.file_name ?? (c.source === "canvas" ? "Imported from Canvas" : "Added by you")}</p>
        {c.source_lines.length > 0 ? (
          <>
            <div style={sx("display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line); font-size: 13px; line-height: 1.55;")}>
              {c.source_lines.map((s, n) => (
                <span key={n} style={sx(s.highlight ? "padding: 3px 8px; margin: 0 -8px; border-radius: 8px; background: var(--surface-3); color: var(--text);" : "color: var(--muted);")}>{s.text}</span>
              ))}
            </div>
            <p style={sx("margin: 0; font-size: 12px; line-height: 1.5; color: var(--muted);")}>Highlighted lines are where we found the dates.</p>
          </>
        ) : <p style={sx("margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-2);")}>Add this class's syllabus PDF on Add classes to see where the dates came from.</p>}
        {c.late_policy && <p style={sx("margin: 0; font-size: 12px; line-height: 1.5; color: var(--text-2);")}><strong style={sx("color: var(--text);")}>Late work: </strong>{c.late_policy}</p>}
      </aside>

      <Confirm open={ask?.kind === "course"} title={`Confirm ${c.code}?`} yes="Confirm and set study time" onClose={() => setAsk(null)}
        body={`Its assignments${c.online === false && c.meetings.length ? " and class times" : ""} will show on your calendar and sync. Next you'll set its study time. You can still edit everything later.`}
        onYes={() => {
          patch({ confirmed: true });
          notify({ text: `${c.code} confirmed. Now set its study time.`, undo: () => { patch({ confirmed: false }); nav(`/review?c=${c.id}`); } });
          nav(`/study?c=${c.id}`);
        }} />
      <Confirm open={ask?.kind === "row"} danger yes="Delete" onClose={() => setAsk(null)}
        title={`Delete “${ask?.kind === "row" ? ask.item.title || "this item" : ""}”?`}
        body="It will be removed from this class's list and won't be sent to your calendar. You can restore it from Recently deleted for 1 day."
        onYes={() => {
          if (ask?.kind !== "row") return;
          const id = ask.item.id; const label = ask.item.title || "this item";
          updateItem.mutate({ id, patch: { deleted_at: new Date().toISOString() } });
          notify({ text: `Deleted ${label}.`, undo: () => updateItem.mutate({ id, patch: { deleted_at: null } }) });
        }} />
    </div>
  );
}

function Row({ it, onDelete }: { it: Item; onDelete: () => void }) {
  const update = useUpdateItem();
  const flagged = isFlagged(it);
  const date = it.due_at ? format(new Date(it.due_at), "yyyy-MM-dd") : "";
  const time = it.due_at ? format(new Date(it.due_at), "HH:mm") : "23:59";
  const save = (p: Partial<Item>) => update.mutate({ id: it.id, patch: { ...p, edited: true } });
  const setDue = (d: string, t: string) => save({ due_at: d ? new Date(`${d}T${t || "23:59"}`).toISOString() : null });
  const td = "padding: 6px 4px; border-top: 1px solid var(--line); vertical-align: top;";

  return (
    <tr style={sx(flagged ? "background: var(--flag-row);" : it.edited && it.source !== "manual" ? "background: var(--edit-row);" : "")}>
      <td style={sx(td)}>
        <input className="cell" aria-label="Item name" defaultValue={it.title} placeholder="New item" style={sx("font-weight: 700;")}
          onBlur={(e) => e.target.value.trim() !== it.title && save({ title: e.target.value.trim() })} />
        {flagged && (
          <div style={sx("display: flex; gap: 6px; align-items: flex-start; padding: 2px 8px 6px; font-size: 12px; line-height: 1.45; color: var(--warn-text);")}>
            <Ico d={P.warn} size={14} style="flex-shrink: 0; margin-top: 2px;" />
            <span>{it.notes ?? "We weren't sure about this one. Check the date and type."}</span>
          </div>
        )}
        {it.edited && it.source !== "manual" && <div style={sx("padding: 0 8px 6px; font-size: 12px; font-weight: 600; color: var(--c1);")}>Edited by you</div>}
      </td>
      <td style={sx(td)}>
        <select className="cell" aria-label="Type" value={it.type} onChange={(e) => save({ type: e.target.value as Item["type"] })}>
          {ITEM_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
      </td>
      <td style={sx(td)}><input className="cell" type="date" aria-label="Due date" defaultValue={date} key={"d" + date} onChange={(e) => setDue(e.target.value, time)} /></td>
      <td style={sx(td)}><input className="cell" type="time" aria-label="Due time" defaultValue={time} key={"t" + time} onBlur={(e) => date && e.target.value !== time && setDue(date, e.target.value)} /></td>
      <td style={sx(td + " width: 90px;")}><input className="cell" type="number" min={0} step={0.5} aria-label="Estimated hours" defaultValue={it.estimated_hours}
        onBlur={(e) => Number(e.target.value) !== it.estimated_hours && save({ estimated_hours: Number(e.target.value) || 0 })} /></td>
      <td style={sx(td + " width: 48px;")}>
        <button type="button" onClick={onDelete} aria-label={`Delete ${it.title || "item"}`} style={sx("width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center;")}>
          <Ico d={P.trashSmall} size={17} sw={1.8} />
        </button>
      </td>
    </tr>
  );
}

