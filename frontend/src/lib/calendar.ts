// Pure: what shows on a given day. Class times only appear once the class is confirmed.
import { isSameDay } from "date-fns";
import type { BlockLink, Course, Item, StudyTime } from "../types/domain";
import { at } from "./dates";
import { blockKey } from "./syncPayload";

export type CalEvent =
  | { kind: "class"; id: string; start: Date; end: Date; course: Course }
  | { kind: "study"; id: string; start: Date; end: Date; course: Course; blockKey: string; studyFor: Item[] }
  | { kind: "due"; id: string; start: Date; course: Course; item: Item };

export interface CalData { courses: Course[]; items: Item[]; studyTimes: StudyTime[]; links: BlockLink[] }

export function eventsForDay(day: Date, d: CalData): CalEvent[] {
  const byId = new Map(d.courses.map((c) => [c.id, c]));
  const itemById = new Map(d.items.map((i) => [i.id, i]));
  const out: CalEvent[] = [];

  for (const c of d.courses) {
    if (!c.confirmed || c.online !== false) continue;
    c.meetings.forEach((m, n) => {
      if (m.day === day.getDay()) out.push({ kind: "class", id: `class|${c.id}|${n}`, start: at(day, m.start), end: at(day, m.end), course: c });
    });
  }
  for (const st of d.studyTimes) {
    const c = byId.get(st.course_id);
    if (!c || st.weekday !== day.getDay()) continue;
    const bk = blockKey(day, st.start_time, c.id);
    const studyFor = d.links.filter((l) => l.block_key === bk).map((l) => itemById.get(l.item_id))
      .filter((it): it is Item => !!it && !it.deleted_at && it.status !== "done");
    out.push({ kind: "study", id: `study|${bk}`, start: at(day, st.start_time), end: at(day, st.end_time), course: c, blockKey: bk, studyFor });
  }
  for (const it of d.items) {
    const c = byId.get(it.course_id);
    if (!c || it.deleted_at || !it.due_at || !isSameDay(new Date(it.due_at), day)) continue;
    out.push({ kind: "due", id: `due|${it.id}`, start: new Date(it.due_at), course: c, item: it });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
