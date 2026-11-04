// Pure helpers shared by the screens (ported from the prototype's renderVals).
import type { BlockLink, Course, Item, ItemType, StudyTime } from "../types/domain";
import { dayKey } from "./dates";
import { blockKey } from "./syncPayload";

export const DAYN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "18:30" -> 18.5 */
export const hm = (v: string | null | undefined): number => {
  const [h = 0, m = 0] = (v || "0:0").split(":").map(Number);
  return h + (m || 0) / 60;
};
/** 18.5 -> "18:30" */
export const toHM = (x: number): string => {
  const h = Math.floor(x);
  return String(h).padStart(2, "0") + ":" + String(Math.round((x - h) * 60)).padStart(2, "0");
};
/** 18.5 -> "6:30 PM" */
export const fmtT = (x: number): string => {
  const hh = Math.floor(x); const m = Math.round((x - hh) * 60);
  return (((hh + 11) % 12) + 1) + ":" + String(m).padStart(2, "0") + " " + (hh >= 12 ? "PM" : "AM");
};
export const r1 = (x: number) => Math.round(x * 10) / 10;

export const ICON: Record<ItemType, string> = {
  exam: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  quiz: "M12 21a9 9 0 110-18 9 9 0 010 18zM8 12.5l2.8 2.8L16 9.5",
  assignment: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4",
  project: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 2.7-5 6-5s6 2 6 5M16 5.2a3 3 0 010 5.6M18 15.5c1.8.7 3 2.3 3 4.5",
  reading: "M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5zM4 20.5V5.5",
  other: "M12 8v4l2.5 2.5M12 21a9 9 0 110-18 9 9 0 010 18z",
};
export const ORDER: Record<ItemType, number> = { exam: 0, project: 1, assignment: 2, quiz: 3, reading: 4, other: 5 };

export const col = (c: Pick<Course, "color">) => `var(--${c.color})`;
export const soft = (c: Pick<Course, "color">) => `var(--${c.color}-soft)`;
export const blockBg = (c: Pick<Course, "color">) => `var(--${c.color}-block)`;
export const dotStyle = (c: Pick<Course, "color">) => `width: 9px; height: 9px; flex-shrink: 0; border-radius: 50%; background: ${col(c)};`;
export const budget = (c: Course) => c.hours_per_week || c.credits * 2.5;

/** An item placed on the calendar. */
export interface PlanItem extends Item { course: Course; key: string; time: number; done: boolean; overdue: boolean }

export function planItems(items: Item[], courses: Course[], now = new Date()): PlanItem[] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const today = dayKey(now);
  const out: PlanItem[] = [];
  for (const it of items) {
    const course = byId.get(it.course_id);
    if (!course || it.deleted_at || !it.due_at) continue;
    const d = new Date(it.due_at);
    const key = dayKey(d);
    const done = it.status === "done";
    out.push({ ...it, course, key, time: d.getHours() + d.getMinutes() / 60, done, overdue: !done && key < today });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key) || ORDER[a.type] - ORDER[b.type]);
}

export function groupByDay(list: PlanItem[]): Map<string, PlanItem[]> {
  const m = new Map<string, PlanItem[]>();
  for (const it of list) { const arr = m.get(it.key) ?? []; arr.push(it); m.set(it.key, arr); }
  return m;
}

export interface Slot { id: string; key: string; s: number; e: number; course: Course }

export function slotsOn(d: Date, studyTimes: StudyTime[], courses: Course[]): Slot[] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  return studyTimes
    .filter((st) => st.weekday === d.getDay() && byId.has(st.course_id))
    .map((st) => ({ id: blockKey(d, st.start_time, st.course_id), key: dayKey(d), s: hm(st.start_time), e: hm(st.end_time), course: byId.get(st.course_id)! }))
    .sort((a, b) => a.s - b.s);
}

/** Starred items for one study block that aren't done yet. */
export function liveLinks(bid: string, links: BlockLink[], byId: Map<string, PlanItem>): PlanItem[] {
  return links.filter((l) => l.block_key === bid).map((l) => byId.get(l.item_id)).filter((x): x is PlanItem => !!x && !x.done);
}

/** "Mon, Wed, 9:00 AM to 10:00 AM; Fri, 1:00 PM to 2:00 PM" */
export function meetingSummary(c: Course): string {
  const g = new Map<string, string[]>();
  [...c.meetings].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)).forEach((m) => {
    const k = fmtT(hm(m.start)) + " to " + fmtT(hm(m.end));
    g.set(k, [...(g.get(k) ?? []), DAYN[m.day] ?? ""]);
  });
  return [...g.entries()].map(([k, days]) => days.join(", ") + ", " + k).join("; ");
}

export function meetsLine(c: Course): string {
  if (c.online === true) return "Online. No scheduled class meetings.";
  if (c.online === false && c.meetings.length) return "Meets " + meetingSummary(c) + ".";
  return "Class times aren't set yet.";
}

export const fmtDay = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", o);
export const keyDate = (key: string) => new Date(key + "T12:00:00");
export const AN = (tick: number) => "animation: " + (tick % 2 ? "cardInA" : "cardInB") + " .32s cubic-bezier(.2,.8,.2,1) backwards;";
export const pill = (on: boolean, extra = "") =>
  "min-height: 36px; padding: 0 16px; border: 0; border-radius: 18px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; " +
  (on ? "background: var(--surface-3); color: var(--text);" : "background: transparent; color: var(--muted);") + extra;
export const seg = (on: boolean) => pill(on, " min-height: 32px; padding: 0 12px; border-radius: 16px; font-size: 12px;");

/** 2880 -> "2 days before" */
export const offsetLabel = (m: number) =>
  m % 10080 === 0 ? `${m / 10080} week${m === 10080 ? "" : "s"} before`
    : m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? "" : "s"} before`
      : m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"} before` : `${m} min before`;

/** Side-by-side columns for study blocks that overlap in time. id -> [column, columns] */
export function overlapColumns(slots: { id: string; s: number; e: number }[]): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  const sorted = [...slots].sort((a, b) => a.s - b.s || a.e - b.e);
  let cluster: { id: string; e: number; col: number }[] = [];
  let clusterEnd = -1;
  const flush = () => { const n = Math.max(1, ...cluster.map((x) => x.col + 1)); cluster.forEach((x) => out.set(x.id, [x.col, n])); cluster = []; };
  for (const sl of sorted) {
    if (sl.s >= clusterEnd) { flush(); clusterEnd = -1; }
    const used = new Set(cluster.filter((x) => x.e > sl.s).map((x) => x.col));
    let col = 0; while (used.has(col)) col++;
    cluster.push({ id: sl.id, e: sl.e, col });
    clusterEnd = Math.max(clusterEnd, sl.e);
  }
  flush();
  return out;
}
