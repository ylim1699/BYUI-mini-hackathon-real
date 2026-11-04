import { useMutation } from "@tanstack/react-query";
import { addDays, addWeeks, endOfDay, format, isSameDay, isToday, startOfDay, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Dialog, Dot, ErrorNote, PageHeader, Spinner } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { useAll, useSetLink, useUpdateItem } from "../hooks/useData";
import { eventsForDay, type CalEvent } from "../lib/calendar";
import { shortDue, timeLabel } from "../lib/dates";
import { api } from "../services/api";
import { summarySchema, TYPE_LABEL, type Item } from "../types/domain";

type Kind = CalEvent["kind"];
const KIND_LABEL: Record<Kind, string> = { due: "Due", study: "Study", class: "Class" };

export function CalendarPage() {
  const data = useAll();
  const nav = useNavigate();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [show, setShow] = useState<Record<Kind, boolean>>({ due: true, study: true, class: true });
  const [hidden, setHidden] = useState<string[]>([]);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [openBlock, setOpenBlock] = useState<{ id: string; day: Date } | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const cal = { courses: data.courses, items: data.items, studyTimes: data.studyTimes, links: data.links };
  const byDay = days.map((d) => eventsForDay(d, cal).filter((e) => show[e.kind] && !hidden.includes(e.course.id)));

  const item = data.items.find((i) => i.id === openItem);
  const block = openBlock ? eventsForDay(openBlock.day, cal).find((e) => e.id === openBlock.id) : undefined;

  if (data.loading) return <Spinner />;
  if (!data.courses.length) {
    return <><PageHeader title="Calendar" /><Card><p className="mb-3 text-text-2">Nothing here yet. Add your classes to fill your calendar.</p><Button variant="primary" onClick={() => nav("/add")}>Add classes</Button></Card></>;
  }

  return (
    <>
      <PageHeader title="Calendar" sub={`${format(week, "MMM d")} – ${format(addDays(week, 6), "MMM d, yyyy")}`}
        right={<div className="flex items-center gap-1">
          <Button variant="quiet" aria-label="Previous week" onClick={() => setWeek(addWeeks(week, -1))}><Icon name="left" /></Button>
          <Button onClick={() => setWeek(startOfWeek(new Date()))}>Today</Button>
          <Button variant="quiet" aria-label="Next week" onClick={() => setWeek(addWeeks(week, 1))}><Icon name="right" /></Button>
        </div>} />
      <ErrorNote error={data.error} />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Overview items={data.items} days={days} onOpen={setOpenItem} />
        <AiSummary days={days} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold">
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <button key={k} aria-pressed={show[k]} onClick={() => setShow({ ...show, [k]: !show[k] })}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${show[k] ? "border-text-2 text-text" : "border-line text-muted line-through"}`}>
            <Icon name={k === "due" ? "alarm" : k === "study" ? "book" : "school"} size={14} />{KIND_LABEL[k]}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        {data.courses.map((c) => (
          <button key={c.id} aria-pressed={!hidden.includes(c.id)} onClick={() => setHidden(hidden.includes(c.id) ? hidden.filter((x) => x !== c.id) : [...hidden, c.id])}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${hidden.includes(c.id) ? "border-line text-muted line-through" : "border-text-2"}`}>
            <Dot color={c.color} />{c.code}
          </button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d, i) => (
          <div key={d.toISOString()} className={`min-h-[180px] rounded-xl border border-line p-2 ${isToday(d) ? "bg-[var(--today)]" : "bg-surface"}`}>
            <p className={`mb-2 text-xs font-extrabold ${d.getDay() === 0 || d.getDay() === 6 ? "text-[var(--weekend)]" : "text-text-2"}`}>
              {format(d, "EEE")} <span className="text-base text-text">{format(d, "d")}</span>
            </p>
            <div className="space-y-1.5">
              {(byDay[i] ?? []).map((e) => <EventChip key={e.id} e={e} onClick={() => (e.kind === "due" ? setOpenItem(e.item.id) : e.kind === "study" ? setOpenBlock({ id: e.id, day: d }) : undefined)} />)}
            </div>
          </div>
        ))}
      </div>

      {item && <ItemDialog item={item} code={data.courses.find((c) => c.id === item.course_id)?.code ?? ""} onClose={() => setOpenItem(null)} />}
      {block?.kind === "study" && <BlockDialog block={block} day={openBlock!.day} items={data.items} onClose={() => setOpenBlock(null)} />}
    </>
  );
}

function EventChip({ e, onClick }: { e: CalEvent; onClick: () => void }) {
  const color = e.course.color;
  if (e.kind === "class") {
    return (
      <div className="rounded-lg border px-2 py-1.5 text-xs" style={{ borderColor: `var(--${color})`, borderLeftWidth: 4, background: "var(--class-bg)" }}>
        <p className="flex items-center gap-1 font-extrabold"><Icon name="school" size={13} />{e.course.code}</p>
        <p className="text-text-2">{timeLabel(e.start)}–{timeLabel(e.end)}</p>
      </div>
    );
  }
  if (e.kind === "study") {
    return (
      <button onClick={onClick} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:brightness-110" style={{ background: `var(--${color}-block)` }}>
        <p className="flex items-center gap-1 font-extrabold"><Icon name="book" size={13} />Study {e.course.code}</p>
        <p className="text-text-2">{timeLabel(e.start)}–{timeLabel(e.end)}</p>
        {e.studyFor.length > 0 && <p className="mt-0.5 line-clamp-2 font-bold">For: {e.studyFor.map((i) => i.title).join(", ")}</p>}
      </button>
    );
  }
  const done = e.item.status === "done";
  return (
    <button onClick={onClick} className={`flex w-full items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-surface-2 ${done ? "opacity-55" : ""}`}
      style={{ background: `var(--${color}-soft)` }}>
      <Icon name={done ? "check" : "alarm"} size={13} className="mt-0.5 shrink-0" />
      <span className={`font-bold ${done ? "line-through" : ""}`}>{e.item.title}</span>
    </button>
  );
}

function Overview({ items, days, onOpen }: { items: Item[]; days: Date[]; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const from = startOfDay(days[0] ?? new Date()), to = endOfDay(days[6] ?? new Date());
  const now = new Date();
  const live = items.filter((i) => !i.deleted_at && i.due_at);
  const week = live.filter((i) => { const t = new Date(i.due_at!); return t >= from && t <= to; });
  const done = week.filter((i) => i.status === "done").length;
  const overdue = live.filter((i) => i.status !== "done" && new Date(i.due_at!) < now).length;
  const pct = week.length ? Math.round((done / week.length) * 100) : 0;

  return (
    <Card className="p-4">
      <button className="flex w-full items-center justify-between text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <h2 className="font-extrabold">Overview <span className="text-text-2">· {week.length} due this week</span></h2>
        <Icon name={open ? "x" : "right"} size={16} />
      </button>
      {!open && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-bold">{done} of {week.length} done</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full bg-ok" style={{ width: `${pct}%` }} /></div>
          {overdue > 0 && <span className="inline-block rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-bold text-warn">{overdue} overdue</span>}
        </div>
      )}
      {open && (
        <ul className="mt-3 space-y-1">
          {week.map((i) => (
            <li key={i.id}>
              <button onClick={() => onOpen(i.id)} className={`flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-sm hover:bg-surface-2 ${i.status === "done" ? "text-muted line-through" : ""}`}>
                <span className="font-bold">{i.title}</span><span className="shrink-0 text-xs text-text-2">{shortDue(i.due_at!)}</span>
              </button>
            </li>
          ))}
          {!week.length && <li className="text-sm text-text-2">Nothing due this week.</li>}
        </ul>
      )}
    </Card>
  );
}

function AiSummary({ days }: { days: Date[] }) {
  const { courses, items, studyTimes } = useAll();
  const first = days[0] ?? new Date();
  const run = useMutation({
    mutationFn: () => {
      const from = startOfDay(first), to = endOfDay(days[6] ?? first);
      const code = new Map(courses.map((c) => [c.id, c.code]));
      const week = items.filter((i) => !i.deleted_at && i.due_at && new Date(i.due_at) >= from && new Date(i.due_at) <= to);
      const hours: Record<string, number> = {};
      for (const s of studyTimes) {
        const c = code.get(s.course_id); if (!c) continue;
        const [sh = 0, sm = 0] = s.start_time.split(":").map(Number), [eh = 0, em = 0] = s.end_time.split(":").map(Number);
        hours[c] = (hours[c] ?? 0) + (eh * 60 + em - sh * 60 - sm) / 60;
      }
      // Only titles, types, and dates go to the AI. No names or notes.
      return api("/summary", summarySchema, {
        range: "week", today: format(new Date(), "yyyy-MM-dd"), study_hours: hours,
        items: week.map((i) => ({ id: i.id, title: i.title, course_code: code.get(i.course_id) ?? "", type: i.type, due_at: i.due_at, done: i.status === "done" })),
      });
    },
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-extrabold"><Icon name="sparkle" className="text-[var(--c3)]" />AI summary</h2>
        <Button variant="quiet" onClick={() => run.mutate()} disabled={run.isPending}>{run.isPending ? "Thinking…" : run.data ? "Refresh" : "Summarize this week"}</Button>
      </div>
      {run.data && (
        <div className="mt-2">
          <p className="text-sm font-bold">{run.data.headline}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {run.data.bullets.map((b, n) => <li key={n} className={`flex gap-2 ${b.priority === "high" ? "font-bold text-warn" : "text-text-2"}`}><span>•</span>{b.text}</li>)}
          </ul>
        </div>
      )}
      {!run.data && !run.isPending && <p className="mt-2 text-sm text-text-2">A short read on what matters this week. Uses only titles and dates.</p>}
      <ErrorNote error={run.error} />
    </Card>
  );
}

function ItemDialog({ item, code, onClose }: { item: Item; code: string; onClose: () => void }) {
  const update = useUpdateItem();
  const nav = useNavigate();
  const done = item.status === "done";
  return (
    <Dialog open title={item.title} onClose={onClose}
      footer={<>
        <Button variant="quiet" onClick={() => nav("/review")}>Edit in Review</Button>
        <Button variant="primary" onClick={() => { update.mutate({ id: item.id, patch: { status: done ? "todo" : "done" } }); onClose(); }}>
          {done ? "Mark not done" : "Mark done"}
        </Button>
      </>}>
      <p className="font-bold text-text">{code} · {TYPE_LABEL[item.type]}</p>
      {item.due_at && <p className="mt-1">Due {format(new Date(item.due_at), "EEEE, MMM d 'at' h:mm a")}</p>}
      {done && <p className="mt-2 font-bold text-ok">Done. It stays on your calendar with a check and no reminders.</p>}
    </Dialog>
  );
}

function BlockDialog({ block, day, items, onClose }: { block: Extract<CalEvent, { kind: "study" }>; day: Date; items: Item[]; onClose: () => void }) {
  const setLink = useSetLink();
  const nav = useNavigate();
  const linked = new Set(block.studyFor.map((i) => i.id));
  const open = items.filter((i) => !i.deleted_at && i.status !== "done" && i.due_at);

  const today = open.filter((i) => isSameDay(new Date(i.due_at!), day));
  const later = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (let k = 1; k <= 7; k++) {
      const d = addDays(day, k);
      const list = open.filter((i) => i.course_id === block.course.id && isSameDay(new Date(i.due_at!), d));
      if (list.length) groups.set(format(d, "EEEE, MMM d"), list);
    }
    return groups;
  }, [open, day, block.course.id]);

  const Row = ({ it }: { it: Item }) => {
    const on = linked.has(it.id);
    return (
      <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
        <button aria-pressed={on} aria-label={on ? `Stop studying for ${it.title}` : `Study for ${it.title} in this block`}
          onClick={() => setLink.mutate({ block_key: block.blockKey, item_id: it.id, on: !on })}
          className={on ? "text-[var(--c8)]" : "text-muted hover:text-text"}><Icon name="star" filled={on} size={18} /></button>
        <span className="flex-1 font-bold text-text">{it.title}</span>
        <span className="text-xs">{TYPE_LABEL[it.type]}</span>
      </li>
    );
  };

  return (
    <Dialog open wide title={`Study ${block.course.code} · ${format(day, "EEE, MMM d")}, ${timeLabel(block.start)}–${timeLabel(block.end)}`} onClose={onClose}
      footer={<Button onClick={() => nav(`/study?c=${block.course.id}`)}>Edit {block.course.code} study time</Button>}>
      <p className="mb-3">Star what you'll work on. It shows on the block and in the event notes when you sync.</p>
      <h3 className="mb-1 font-extrabold text-text">Due today</h3>
      {today.length ? <ul>{today.map((it) => <Row key={it.id} it={it} />)}</ul> : <p className="mb-2">Nothing due that day.</p>}
      {[...later.entries()].map(([label, list]) => (
        <div key={label} className="mt-3">
          <h3 className="mb-1 font-extrabold text-text">{label}</h3>
          <ul>{list.map((it) => <Row key={it.id} it={it} />)}</ul>
        </div>
      ))}
    </Dialog>
  );
}
