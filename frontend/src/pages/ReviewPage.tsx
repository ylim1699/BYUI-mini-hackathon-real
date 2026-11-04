import { format } from "date-fns";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Confirm, Dot, ErrorNote, inputCls, PageHeader, Spinner } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { useAll, useRefreshAll, useUpdateCourse, useUpdateItem } from "../hooks/useData";
import * as db from "../services/db";
import { useUi } from "../store/ui";
import { ITEM_TYPES, TYPE_LABEL, type Course, type Item, type Meeting } from "../types/domain";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toLocalInput = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");

export function ReviewPage() {
  const { courses, items, loading, error } = useAll();
  const live = items.filter((i) => !i.deleted_at);
  const waiting = courses.filter((c) => !c.confirmed).length;

  return (
    <>
      <PageHeader title="Review items" sub={waiting ? `${waiting} ${waiting === 1 ? "class needs" : "classes need"} a look. Class times show on the calendar once you confirm.` : "Everything is confirmed."} />
      <ErrorNote error={error} />
      {loading ? <Spinner /> : !courses.length ? (
        <Card><p className="text-text-2">No classes yet. Add them from Canvas or a syllabus first.</p></Card>
      ) : (
        <div className="space-y-5">
          {courses.map((c) => <CourseCard key={c.id} course={c} items={live.filter((i) => i.course_id === c.id)} />)}
        </div>
      )}
    </>
  );
}

function CourseCard({ course: c, items }: { course: Course; items: Item[] }) {
  const updateCourse = useUpdateCourse();
  const refresh = useRefreshAll();
  const notify = useUi((s) => s.notify);
  const nav = useNavigate();
  const [ask, setAsk] = useState(false);
  const patch = (p: Partial<Course>) => updateCourse.mutate({ id: c.id, patch: p });

  const setMeeting = (idx: number, m: Partial<Meeting>) => patch({ meetings: c.meetings.map((x, n) => (n === idx ? { ...x, ...m } : x)) });
  const addItem = async () => {
    await db.insertItems([{ course_id: c.id, title: "New item", type: "assignment", due_at: null, estimated_hours: 1, source: "manual", confidence: 1, status: "todo", notes: null, deleted_at: null }]);
    refresh();
  };

  return (
    <Card className={c.confirmed ? "" : "border-[var(--warn-line)]"}>
      <div className="flex flex-wrap items-center gap-3">
        <Dot color={c.color} size={14} />
        <input aria-label="Class code" className={`${inputCls} w-28`} defaultValue={c.code} onBlur={(e) => e.target.value.trim() && e.target.value !== c.code && patch({ code: e.target.value.trim() })} />
        <input aria-label="Class name" className={`${inputCls} min-w-[180px] flex-1`} defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && patch({ name: e.target.value })} />
        {c.confirmed ? (
          <span className="flex items-center gap-1 rounded-full bg-[var(--c2-soft)] px-3 py-1 text-xs font-bold text-[var(--c2)]"><Icon name="check" size={14} />Confirmed</span>
        ) : (
          <Button variant="primary" onClick={() => setAsk(true)}>Confirm</Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-bold">
        <label className="flex items-center gap-2">Credits
          <input type="number" min={0} max={12} step={0.5} className={`${inputCls} w-20`} defaultValue={c.credits}
            onBlur={(e) => { const v = Number(e.target.value); if (v !== c.credits) patch({ credits: v, hours_per_week: v * 2.5 }); }} />
        </label>
        <label className="flex items-center gap-2">Study hours / week
          <input type="number" min={0} max={40} step={0.5} className={`${inputCls} w-20`} key={c.hours_per_week} defaultValue={c.hours_per_week}
            onBlur={(e) => { const v = Number(e.target.value); if (v !== c.hours_per_week) patch({ hours_per_week: v }); }} />
        </label>
        <div className="flex overflow-hidden rounded-lg border border-line-strong" role="group" aria-label="Class format">
          {([["In person", false], ["Online", true]] as const).map(([label, v]) => (
            <button key={label} onClick={() => patch({ online: v })} aria-pressed={c.online === v}
              className={`px-3 py-1.5 text-xs font-bold ${c.online === v ? "bg-surface-3 text-text" : "text-text-2"}`}>{label}</button>
          ))}
        </div>
      </div>

      {c.online === false && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-bold text-text-2">Class times</p>
          {c.meetings.map((m, n) => (
            <div key={n} className="flex flex-wrap items-center gap-2">
              <select aria-label="Day" className={`${inputCls} w-24`} value={m.day} onChange={(e) => setMeeting(n, { day: Number(e.target.value) })}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
              <input aria-label="Starts" type="time" className={`${inputCls} w-32`} value={m.start} onChange={(e) => setMeeting(n, { start: e.target.value })} />
              <span className="text-text-2">to</span>
              <input aria-label="Ends" type="time" className={`${inputCls} w-32`} value={m.end} onChange={(e) => setMeeting(n, { end: e.target.value })} />
              <button aria-label="Remove class time" className="p-1 text-text-2 hover:text-text" onClick={() => patch({ meetings: c.meetings.filter((_, i) => i !== n) })}><Icon name="x" size={16} /></button>
            </div>
          ))}
          <Button variant="quiet" onClick={() => patch({ meetings: [...c.meetings, { day: 1, start: "09:00", end: "10:00" }] })}><Icon name="add" size={15} />Add class time</Button>
        </div>
      )}

      <div className="mt-5 space-y-1.5">
        {items.map((it) => <ItemRow key={it.id} item={it} />)}
        {!items.length && <p className="text-sm text-text-2">No items for this class.</p>}
      </div>
      <Button variant="quiet" className="mt-2" onClick={addItem}><Icon name="add" size={15} />Add item</Button>

      <Confirm open={ask} title={`Confirm ${c.code}?`} yes="Confirm and set study time" onClose={() => setAsk(false)}
        body="Its class times and items will show on your calendar. Next you'll set when you study for it."
        onYes={() => {
          patch({ confirmed: true });
          notify({ text: `${c.code} confirmed.`, undo: () => patch({ confirmed: false }) });
          nav(`/study?c=${c.id}`);
        }} />
    </Card>
  );
}

function ItemRow({ item: it }: { item: Item }) {
  const update = useUpdateItem();
  const notify = useUi((s) => s.notify);
  const patch = (p: Partial<Item>) => update.mutate({ id: it.id, patch: p });
  const done = it.status === "done";
  const flagged = it.confidence < 0.7;

  return (
    <div className={`rounded-lg px-2 py-2 ${flagged ? "bg-[var(--flag-row)]" : "hover:bg-surface-2"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button aria-label={done ? "Mark not done" : "Mark done"} onClick={() => patch({ status: done ? "todo" : "done" })}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${done ? "border-ok bg-ok text-[#10201d]" : "border-line-strong"}`}>
          {done && <Icon name="check" size={14} />}
        </button>
        <input aria-label="Title" className={`${inputCls} min-w-[160px] flex-1 ${done ? "line-through opacity-60" : ""}`} defaultValue={it.title}
          onBlur={(e) => e.target.value.trim() && e.target.value !== it.title && patch({ title: e.target.value.trim() })} />
        <select aria-label="Type" className={`${inputCls} w-32`} value={it.type} onChange={(e) => patch({ type: e.target.value as Item["type"] })}>
          {ITEM_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <input aria-label="Due" type="datetime-local" className={`${inputCls} w-52`} defaultValue={toLocalInput(it.due_at)}
          onBlur={(e) => { const v = e.target.value ? new Date(e.target.value).toISOString() : null; if (v !== it.due_at) patch({ due_at: v, confidence: 1 }); }} />
        <button aria-label={`Delete ${it.title}`} className="rounded p-1 text-text-2 hover:text-[var(--weekend)]"
          onClick={() => { patch({ deleted_at: new Date().toISOString() }); notify({ text: `Deleted "${it.title}".`, undo: () => patch({ deleted_at: null }) }); }}>
          <Icon name="trash" size={16} />
        </button>
      </div>
      {flagged && <p className="mt-1 pl-8 text-xs font-bold text-warn">Check this: {it.notes ?? "the date wasn't clear in the syllabus"}</p>}
    </div>
  );
}
