// Reads and writes the student's own rows in Supabase (row-level security enforces ownership).
// With VITE_USE_MOCKS=true everything lives in memory, so the app runs with no keys.
import { z } from "zod";
import {
  blockLinkSchema, courseSchema, itemSchema, studyTimeSchema,
  type BlockLink, type Course, type Item, type StudyTime,
} from "../types/domain";
import { mockCourses, mockItems, mockLinks, mockStudyTimes } from "./mock/data";
import { supabase, USE_MOCKS } from "./supabase";

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const mem = { courses: [...mockCourses], items: [...mockItems], study: [...mockStudyTimes], links: [...mockLinks] };
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function sb() {
  if (!supabase) throw new Error("Supabase isn't configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  return supabase;
}

async function uid(): Promise<string> {
  const { data } = await sb().auth.getUser();
  if (!data.user) throw new Error("You're signed out. Sign in again.");
  return data.user.id;
}

async function rows<T>(schema: z.ZodType<T>, q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return z.array(schema).parse(data ?? []);
}

async function check(q: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await q;
  if (error) throw new Error(error.message);
}

// ---------- Courses ----------

export async function listCourses(): Promise<Course[]> {
  if (USE_MOCKS) return wait().then(() => [...mem.courses]);
  return rows(courseSchema, sb().from("courses").select("*").order("code"));
}

export async function insertCourse(c: Omit<Course, "id">): Promise<Course> {
  if (USE_MOCKS) { const row = { ...c, id: newId() }; mem.courses = [...mem.courses, row]; return row; }
  const { data, error } = await sb().from("courses").insert({ ...c, user_id: await uid() }).select("*").single();
  if (error) throw new Error(error.message);
  return courseSchema.parse(data);
}

export async function updateCourse(id: string, patch: Partial<Omit<Course, "id">>): Promise<void> {
  if (USE_MOCKS) { mem.courses = mem.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)); return; }
  await check(sb().from("courses").update(patch).eq("id", id));
}

// ---------- Items ----------

export async function listItems(): Promise<Item[]> {
  if (USE_MOCKS) return wait().then(() => [...mem.items]);
  return rows(itemSchema, sb().from("items").select("*").order("due_at", { ascending: true, nullsFirst: false }));
}

export async function insertItems(list: Omit<Item, "id">[]): Promise<void> {
  if (!list.length) return;
  if (USE_MOCKS) { mem.items = [...mem.items, ...list.map((i) => ({ ...i, id: newId() }))]; return; }
  const user_id = await uid();
  await check(sb().from("items").insert(list.map((i) => ({ ...i, user_id }))));
}

export async function updateItem(id: string, patch: Partial<Omit<Item, "id">>): Promise<void> {
  if (USE_MOCKS) { mem.items = mem.items.map((i) => (i.id === id ? { ...i, ...patch } : i)); return; }
  await check(sb().from("items").update(patch).eq("id", id));
}

export async function deleteItemForever(id: string): Promise<void> {
  if (USE_MOCKS) { mem.items = mem.items.filter((i) => i.id !== id); return; }
  await check(sb().from("items").delete().eq("id", id));
}

// ---------- Study times ----------

export async function listStudyTimes(): Promise<StudyTime[]> {
  if (USE_MOCKS) return wait().then(() => [...mem.study]);
  return rows(studyTimeSchema, sb().from("study_times").select("*"));
}

export type StudyWindow = Pick<StudyTime, "weekday" | "start_time" | "end_time">;

/** Replaces one class's weekly study times. */
export async function replaceStudyTimes(courseId: string, windows: StudyWindow[]): Promise<void> {
  if (USE_MOCKS) {
    mem.study = [...mem.study.filter((s) => s.course_id !== courseId), ...windows.map((w) => ({ ...w, id: newId(), course_id: courseId }))];
    return;
  }
  const user_id = await uid();
  await check(sb().from("study_times").delete().eq("course_id", courseId));
  if (windows.length) await check(sb().from("study_times").insert(windows.map((w) => ({ ...w, course_id: courseId, user_id }))));
}

// ---------- "Studying for" links ----------

export async function listLinks(): Promise<BlockLink[]> {
  if (USE_MOCKS) return wait().then(() => [...mem.links]);
  return rows(blockLinkSchema, sb().from("block_links").select("block_key,item_id"));
}

export async function setLink(block_key: string, item_id: string, on: boolean): Promise<void> {
  if (USE_MOCKS) {
    mem.links = mem.links.filter((l) => !(l.block_key === block_key && l.item_id === item_id));
    if (on) mem.links.push({ block_key, item_id });
    return;
  }
  if (on) await check(sb().from("block_links").upsert({ block_key, item_id, user_id: await uid() }));
  else await check(sb().from("block_links").delete().eq("block_key", block_key).eq("item_id", item_id));
}
