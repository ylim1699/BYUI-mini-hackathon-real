import { format, formatISO, startOfDay } from "date-fns";
import type { Item } from "../types/domain";

/** "2026-11-03" in the browser's time zone. */
export const dayKey = (d: Date): string => format(d, "yyyy-MM-dd");

/** "18:00:00" or "18:00" -> [18, 0] */
export function hm(t: string): [number, number] {
  const [h = "0", m = "0"] = t.split(":");
  return [Number(h), Number(m)];
}

export function at(day: Date, time: string): Date {
  const [h, m] = hm(time);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

export const isoLocal = (d: Date): string => formatISO(d); // keeps the local offset

/** Done if marked done, or if its due date is before today (matches the prototype). */
export function isDone(item: Pick<Item, "status" | "due_at">, now: Date = new Date()): boolean {
  if (item.status === "done") return true;
  return item.due_at !== null && new Date(item.due_at) < startOfDay(now);
}

export const shortDue = (iso: string): string => format(new Date(iso), "EEE, MMM d");
export const timeLabel = (d: Date): string => format(d, d.getMinutes() ? "h:mm a" : "h a");
