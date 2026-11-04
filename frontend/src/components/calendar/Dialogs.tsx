import { addDays, format } from "date-fns";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetLink, useUpdateItem } from "../../hooks/useData";
import { dayKey } from "../../lib/dates";
import { blockBg, col, fmtDay, fmtT, ICON, keyDate, offsetLabel, soft, type PlanItem } from "../../lib/plan";
import { sx } from "../../lib/sx";
import { useUi } from "../../store/ui";
import { ITEM_TYPES, TYPE_LABEL, type BlockLink, type Course } from "../../types/domain";
import { Confirm, Ico, Modal, P } from "../ui";
import { cardOf } from "./shared";

// ---------- Item detail ----------

export function ItemDetail({ it, onClose }: { it: PlanItem; onClose: () => void }) {
  const update = useUpdateItem();
  const rules = useUi((s) => s.rules);
  const notify = useUi((s) => s.notify);
  const [editing, setEditing] = useState(false);
  const [askDel, setAskDel] = useState(false);
  const d = new Date(it.due_at!);
  const [draft, setDraft] = useState({ t: it.title, type: it.type, date: format(d, "yyyy-MM-dd"), time: format(d, "HH:mm") });
  const [err, setErr] = useState("");
  const c = it.course;
  const rem = (rules[it.type] ?? []).map(offsetLabel);
  const label = "font-size: 12px; font-weight: 700; color: var(--text-2);";
  const fieldS = "min-height: 42px; box-sizing: border-box; padding: 0 8px; border-radius: 12px; border: 1px solid var(--line-strong); background: var(--field); font-size: 14px; color: var(--text);";

  const save = () => {
    const t = draft.t.trim();
    if (!t) { setErr("Give it a title."); return; }
    if (!draft.date) { setErr("Pick a due date."); return; }
    const prev = { title: it.title, type: it.type, due_at: it.due_at, edited: it.edited };
    update.mutate({ id: it.id, patch: { title: t, type: draft.type, due_at: new Date(`${draft.date}T${draft.time || "23:59"}`).toISOString(), edited: true } });
    setEditing(false); setErr("");
    notify({ text: `Saved changes to ${t}.`, undo: () => update.mutate({ id: it.id, patch: prev }) });
  };
  const toggleDone = () => {
    const was = it.done;
    update.mutate({ id: it.id, patch: { status: was ? "todo" : "done" } });
    onClose();
    notify({ text: (was ? "Marked not done: " : "Marked done: ") + it.title + ".", undo: () => update.mutate({ id: it.id, patch: { status: was ? "done" : "todo" } }) });
  };

  return (
    <>
      <Modal open={!askDel} label={it.title} onClose={onClose} blur
        box="width: 100%; max-width: 440px; box-sizing: border-box; padding: 22px; display: flex; flex-direction: column; gap: 16px; border-radius: 22px; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: var(--shadow); color: var(--text); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);">
        <div style={sx("display: flex; align-items: flex-start; gap: 12px;")}>
          <span aria-hidden="true" style={sx(`width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; background: ${soft(c)}; color: ${col(c)}; display: flex; align-items: center; justify-content: center;`)}><Ico d={ICON[it.type]} size={18} /></span>
          <div style={sx("flex: 1 1 auto; display: flex; flex-direction: column; gap: 3px; min-width: 0;")}>
            <span style={sx("font-size: 12px; font-weight: 800; color: var(--muted);")}>{c.code} {c.name}</span>
            <h2 style={sx("margin: 0; font-size: 20px; line-height: 1.25; font-weight: 800;")}>{it.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={sx("width: 38px; height: 38px; flex-shrink: 0; border: 0; border-radius: 19px; background: var(--surface-2); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center;")}><Ico d={P.x} size={15} sw={2.4} /></button>
        </div>
        {!editing ? (
          <>
            <dl style={sx("margin: 0; display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px 12px; font-size: 14px;")}>
              <dt style={sx("color: var(--muted); font-weight: 600;")}>Due</dt><dd style={sx("margin: 0; font-weight: 700;")}>{fmtDay(d, { weekday: "long", month: "long", day: "numeric" })} at {fmtT(it.time)}</dd>
              <dt style={sx("color: var(--muted); font-weight: 600;")}>Type</dt><dd style={sx("margin: 0;")}>{TYPE_LABEL[it.type]}</dd>
              <dt style={sx("color: var(--muted); font-weight: 600;")}>Reminders</dt><dd style={sx("margin: 0;")}>{it.done ? "None, it's done" : rem.length ? rem.join(", ") : "None"}</dd>
              <dt style={sx("color: var(--muted); font-weight: 600;")}>Status</dt><dd style={sx("margin: 0; font-weight: 700; color: " + (it.done ? "var(--ok)" : it.overdue ? "var(--warn-text)" : "var(--text)") + ";")}>{it.done ? "Done" : it.overdue ? "Overdue" : "Not done yet"}</dd>
            </dl>
            {it.edited && <span style={sx("font-size: 12px; font-weight: 600; color: var(--c1);")}>Edited by you</span>}
            <div style={sx("display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding-top: 14px; border-top: 1px solid var(--line);")}>
              <button type="button" onClick={() => setAskDel(true)} style={sx("display: inline-flex; align-items: center; gap: 6px; min-height: 42px; padding: 0 16px; border-radius: 21px; border: 1px solid var(--weekend); background: transparent; color: var(--weekend); font-size: 14px; font-weight: 700; cursor: pointer;")}>
                <Ico d={P.trashSmall} size={16} sw={1.9} />Delete
              </button>
              <span style={sx("flex-grow: 1;")} />
              <button type="button" onClick={() => setEditing(true)} style={sx("display: inline-flex; align-items: center; gap: 6px; min-height: 42px; padding: 0 16px; border-radius: 21px; border: 1px solid var(--line-strong); background: transparent; color: var(--text); font-size: 14px; font-weight: 700; cursor: pointer;")}>
                <Ico d={P.pencil} size={15} sw={1.9} />Edit
              </button>
              <button type="button" data-autofocus onClick={toggleDone} style={sx("min-height: 42px; padding: 0 20px; border: 0; border-radius: 21px; background: var(--primary-bg); color: var(--primary-text); font-size: 14px; font-weight: 700; cursor: pointer;")}>{it.done ? "Mark not done" : "Mark done"}</button>
            </div>
          </>
        ) : (
          <div style={sx("display: flex; flex-direction: column; gap: 12px;")}>
            <div style={sx("display: flex; flex-direction: column; gap: 5px;")}>
              <label htmlFor="ie-title" style={sx(label)}>Title</label>
              <input id="ie-title" value={draft.t} onChange={(e) => setDraft({ ...draft, t: e.target.value })} style={sx(fieldS + " padding: 0 12px; font-weight: 700;")} />
            </div>
            <div style={sx("display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;")}>
              <div style={sx("display: flex; flex-direction: column; gap: 5px;")}>
                <label htmlFor="ie-type" style={sx(label)}>Type</label>
                <select id="ie-type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as PlanItem["type"] })} style={sx("min-height: 42px; padding: 0 8px; border-radius: 12px; font-size: 14px;")}>
                  {ITEM_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </div>
              <div style={sx("display: flex; flex-direction: column; gap: 5px;")}>
                <label htmlFor="ie-date" style={sx(label)}>Due date</label>
                <input id="ie-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={sx(fieldS)} />
              </div>
              <div style={sx("display: flex; flex-direction: column; gap: 5px;")}>
                <label htmlFor="ie-time" style={sx(label)}>Due time</label>
                <input id="ie-time" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} style={sx(fieldS)} />
              </div>
            </div>
            {err && <span role="alert" style={sx("font-size: 12px; font-weight: 600; color: var(--weekend);")}>{err}</span>}
            <span style={sx("font-size: 12px; color: var(--muted);")}>Changing the date moves it on your calendar and resets its reminders.</span>
            <div style={sx("display: flex; justify-content: flex-end; gap: 10px; padding-top: 12px; border-top: 1px solid var(--line);")}>
              <button type="button" onClick={() => { setEditing(false); setErr(""); }} style={sx("min-height: 42px; padding: 0 18px; border-radius: 21px; border: 1px solid var(--line-strong); background: transparent; color: var(--text); font-size: 14px; font-weight: 700; cursor: pointer;")}>Cancel</button>
              <button type="button" onClick={save} style={sx("min-height: 42px; padding: 0 20px; border: 0; border-radius: 21px; background: var(--primary-bg); color: var(--primary-text); font-size: 14px; font-weight: 700; cursor: pointer;")}>Save changes</button>
            </div>
          </div>
        )}
      </Modal>
      <Confirm open={askDel} danger title={`Delete “${it.title}”?`} yes="Delete" onClose={() => setAskDel(false)}
        body="It will be removed from your calendar and its reminders will stop. You can restore it from Recently deleted for 1 day."
        onYes={() => {
          update.mutate({ id: it.id, patch: { deleted_at: new Date().toISOString() } });
          onClose();
          notify({ text: `Deleted ${it.title}.`, undo: () => update.mutate({ id: it.id, patch: { deleted_at: null } }) });
        }} />
    </>
  );
}

// ---------- Study block ----------

export interface BlockSel { course: Course; key: string; s: number; e: number; id: string }

export function BlockDialog({ sel, items, links, onClose, onOpenItem }: {
  sel: BlockSel; items: PlanItem[]; links: BlockLink[]; onClose: () => void; onOpenItem: (id: string) => void;
}) {
  const nav = useNavigate();
  const update = useUpdateItem();
  const setLink = useSetLink();
  const [weekOff, setWeekOff] = useState(0);
  const c = sel.course;
  const bd = keyDate(sel.key);
  const todayKey = dayKey(new Date());
  const byId = new Map(items.map((i) => [i.id, i]));
  const linked = links.filter((l) => l.block_key === sel.id).map((l) => byId.get(l.item_id)).filter((x): x is PlanItem => !!x && !x.done);
  const linkedIds = new Set(linked.map((x) => x.id));
  const mine = items.filter((i) => i.course.id === c.id);
  const monday = addDays(bd, -((bd.getDay() + 6) % 7));
  const thisMon = addDays(new Date(), -((new Date().getDay() + 6) % 7));
  const ws = addDays(monday, 7 * weekOff); const we = addDays(ws, 6);
  const diff = Math.round((ws.getTime() - thisMon.getTime()) / 604800000);
  const fd = (x: Date) => fmtDay(x, { month: "short", day: "numeric" });
  const dayItems = mine.filter((i) => i.key === sel.key);
  const weekDays = Array.from({ length: 7 }, (_, k) => addDays(ws, k))
    .map((d) => ({ d, key: dayKey(d), items: mine.filter((i) => i.key === dayKey(d)) }))
    .filter((x) => x.items.length);

  const Row = ({ it }: { it: PlanItem }) => {
    const cd = cardOf(it, "");
    const fav = linkedIds.has(it.id);
    return (
      <div className="lift" style={sx("display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; box-sizing: border-box; border-radius: 10px; border: 1px solid " + (it.overdue ? "var(--warn-line)" : "var(--line)") + "; background: var(--surface-2); color: var(--text);")}>
        <button type="button" onClick={() => update.mutate({ id: it.id, patch: { status: it.done ? "todo" : "done" } })} aria-pressed={it.done}
          aria-label={(it.done ? "Mark not done: " : "Mark done: ") + it.title} title={(it.done ? "Mark not done: " : "Mark done: ") + it.title}
          style={sx("width: 24px; height: 24px; flex-shrink: 0; padding: 0; border-radius: 7px; display: flex; align-items: center; justify-content: center; cursor: pointer; " + (it.done ? "background: var(--ok); border: 1px solid var(--ok); color: #0F1A18;" : "background: transparent; border: 1.5px solid var(--line-strong); color: transparent;"))}>
          {it.done && <Ico d={P.check} size={13} sw={3} />}
        </button>
        <button type="button" onClick={() => onOpenItem(it.id)} aria-label={cd.aria} style={sx("flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 0; border: 0; background: transparent; color: var(--text); text-align: left; cursor: pointer;")}>
          <span aria-hidden="true" style={sx(cd.iconWrap)}><Ico d={cd.icon} size={12} /></span>
          <span style={sx("flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px;")}>
            <span style={sx("font-size: 13px; font-weight: 700;" + (it.done ? " text-decoration: line-through; opacity: 0.6;" : ""))}>{it.title}</span>
            <span style={sx("font-size: 11px; color: var(--text-2);")}>Due {fmtT(it.time)}</span>
          </span>
          <span style={sx("flex-shrink: 0; font-size: 11px; font-weight: 800; color: " + (it.done ? "var(--ok)" : "var(--warn-text)") + ";")}>{it.done ? "Done" : it.overdue ? "Overdue" : ""}</span>
        </button>
        {!it.done && (
          <button type="button" onClick={() => setLink.mutate({ block_key: sel.id, item_id: it.id, on: !fav })} aria-pressed={fav}
            aria-label={(fav ? "Remove from this study block: " : "Study for this in this block: ") + it.title} title={(fav ? "Remove from this study block: " : "Study for this in this block: ") + it.title}
            style={sx("width: 30px; height: 30px; flex-shrink: 0; padding: 0; border: 0; border-radius: 15px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .15s ease; color: " + (fav ? "#F2C14E" : "var(--muted)") + ";")}>
            <Ico d={P.star} size={16} sw={1.8} fill={fav ? "#F2C14E" : "none"} />
          </button>
        )}
      </div>
    );
  };

  return (
    <Modal open label={`${c.code} study time`} onClose={onClose}
      box="width: 100%; max-width: 480px; height: min(640px, calc(100vh - 32px)); box-sizing: border-box; display: flex; flex-direction: column; border-radius: 22px; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: var(--shadow); color: var(--text); overflow: hidden;">
      <div style={sx("display: flex; align-items: flex-start; gap: 12px; padding: 18px 18px 14px 20px; border-bottom: 1px solid var(--line); background: " + blockBg(c) + ";")}>
        <div style={sx("flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px; min-width: 0;")}>
          <span style={sx("font-size: 12px; font-weight: 700; color: var(--text-2);")}>{fmtDay(bd, { weekday: "long", month: "short", day: "numeric" })}, {fmtT(sel.s)} to {fmtT(sel.e)}</span>
          <h2 style={sx("margin: 0; font-size: 20px; font-weight: 800;")}>{c.code} {c.name}</h2>
          <span style={sx("font-size: 12px; color: var(--text-2);")}>What {c.code} has due.</span>
          <button type="button" onClick={() => nav(`/study?c=${c.id}`)} style={sx("align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; min-height: 32px; padding: 0 12px; border-radius: 16px; border: 1px solid var(--line-strong); background: var(--surface-2); color: var(--text); font-size: 12px; font-weight: 700; cursor: pointer;")}>
            <Ico d={P.clock} size={13} sw={2.2} />Edit {c.code} study time
          </button>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={sx("width: 36px; height: 36px; flex-shrink: 0; border: 0; border-radius: 18px; background: var(--surface-2); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center;")}><Ico d={P.x} size={15} sw={2.4} /></button>
      </div>
      <div style={sx("flex: 1 1 auto; min-height: 0; overflow: hidden; padding: 14px 20px 18px; display: flex; flex-direction: column; gap: 14px;")}>
        <div style={sx("flex: 0 0 auto; display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--line);")}>
          <div style={sx("display: flex; align-items: center; gap: 8px;")}>
            <span style={sx("color: #F2C14E; display: flex;")}><Ico d={P.star} size={15} sw={1.6} fill="#F2C14E" /></span>
            <h3 style={sx("margin: 0; font-size: 14px; font-weight: 800;")}>Studying for in this block</h3>
          </div>
          {linked.map((it) => (
            <div key={it.id} style={sx("display: flex; align-items: center; gap: 8px; min-width: 0;")}>
              <span aria-hidden="true" style={sx(`width: 8px; height: 8px; flex-shrink: 0; border-radius: 4px; background: ${col(it.course)};`)} />
              <span style={sx("flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column;")}>
                <span style={sx("font-size: 13px; font-weight: 700; overflow-wrap: anywhere;")}>{it.title}</span>
                <span style={sx("font-size: 11px; color: var(--text-2);")}>{it.course.code}, due {fmtDay(keyDate(it.key), { weekday: "short", month: "short", day: "numeric" })}</span>
              </span>
              <button type="button" onClick={() => setLink.mutate({ block_key: sel.id, item_id: it.id, on: false })} aria-label={`Remove ${it.title} from this study block`} title={`Remove ${it.title} from this study block`}
                style={sx("width: 28px; height: 28px; flex-shrink: 0; padding: 0; border: 0; border-radius: 14px; background: transparent; color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center;")}><Ico d={P.x} size={12} sw={2.6} /></button>
            </div>
          ))}
          <span style={sx("font-size: 12px; line-height: 1.45; color: var(--muted);")}>
            {linked.length ? `Your calendar event will say: Study for ${linked.map((x) => x.title).join(", ")}.` : "Star an assignment below and it goes in this block's calendar notes."}
          </span>
        </div>
        <div className="cal-scroll" style={sx("flex: 0 0 auto; max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;")}>
          <h3 style={sx("margin: 0; font-size: 14px; font-weight: 800;")}>{sel.key === todayKey ? "Due today" : "Due " + fmtDay(bd, { weekday: "long", month: "short", day: "numeric" })}</h3>
          {dayItems.length ? dayItems.map((it) => <Row key={it.id} it={it} />) : <span style={sx("font-size: 13px; color: var(--text-2);")}>{sel.key === todayKey ? "Nothing due today." : "Nothing due that day."}</span>}
        </div>
        <div style={sx("flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding-top: 14px; border-top: 1px solid var(--line);")}>
          <div style={sx("flex: 0 0 auto; display: flex; align-items: center; gap: 10px;")}>
            <button type="button" onClick={() => setWeekOff(weekOff - 1)} aria-label="Previous week" title="Previous week" style={sx("width: 36px; height: 36px; flex-shrink: 0; padding: 0; border-radius: 18px; border: 1px solid var(--line-strong); background: var(--surface-2); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center;")}><Ico d={P.left} size={16} sw={2.2} /></button>
            <div aria-live="polite" style={sx("flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; gap: 1px; text-align: center;")}>
              <span style={sx("font-size: 14px; font-weight: 800;")}>{diff === 0 ? "This week" : diff === 1 ? "Next week" : diff === -1 ? "Last week" : "Week of " + fd(ws)}</span>
              <span style={sx("font-size: 12px; color: var(--text-2);")}>{fd(ws)} to {fd(we)}</span>
            </div>
            <button type="button" onClick={() => setWeekOff(weekOff + 1)} aria-label="Next week" title="Next week" style={sx("width: 36px; height: 36px; flex-shrink: 0; padding: 0; border-radius: 18px; border: 1px solid var(--line-strong); background: var(--surface-2); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center;")}><Ico d={P.right} size={16} sw={2.2} /></button>
          </div>
          <div key={weekOff} className="cal-scroll" style={sx("animation: " + (weekOff % 2 ? "cardInA" : "cardInB") + " .3s cubic-bezier(.2,.8,.2,1) backwards; flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 14px; overscroll-behavior: contain;")}>
            {weekDays.map((wd) => (
              <div key={wd.key} style={sx("display: flex; flex-direction: column; gap: 6px;")}>
                <span style={sx("font-size: 12px; font-weight: 800; color: var(--text-2);")}>{(wd.key === todayKey ? "Today, " : "") + fmtDay(wd.d, { weekday: "long", month: "short", day: "numeric" })}</span>
                {wd.items.map((it) => <Row key={it.id} it={it} />)}
              </div>
            ))}
            {!weekDays.length && <span style={sx("font-size: 13px; color: var(--text-2);")}>Nothing due this week.</span>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
