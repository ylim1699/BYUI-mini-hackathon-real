// Single source of truth for shared types. Mirrors backend/app/schemas.py and supabase/migrations.
import { z } from "zod";

export const ITEM_TYPES = ["assignment", "quiz", "exam", "project", "reading", "other"] as const;
export const itemTypeSchema = z.enum(ITEM_TYPES);
export type ItemType = z.infer<typeof itemTypeSchema>;

export const meetingSchema = z.object({
  day: z.number().int().min(0).max(6), // 0 = Sunday
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});
export type Meeting = z.infer<typeof meetingSchema>;

export const courseSchema = z.object({
  id: z.string(),
  canvas_id: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  color: z.string(),
  credits: z.coerce.number(),
  hours_per_week: z.coerce.number(),
  online: z.boolean().nullable(),
  meetings: z.array(meetingSchema),
  confirmed: z.boolean(),
  source: z.enum(["canvas", "syllabus", "manual"]),
  notes: z.string().nullable().default(null),
  late_policy: z.string().nullable().default(null),
  source_lines: z.array(z.object({ text: z.string(), highlight: z.boolean() })).default([]),
  file_name: z.string().nullable().default(null),
  renamed: z.boolean().default(false),
});
export type Course = z.infer<typeof courseSchema>;

export const itemSchema = z.object({
  id: z.string(),
  course_id: z.string(),
  title: z.string(),
  type: itemTypeSchema,
  due_at: z.string().nullable(),
  estimated_hours: z.coerce.number(),
  source: z.enum(["canvas", "syllabus", "manual"]),
  confidence: z.coerce.number(),
  status: z.enum(["todo", "done"]),
  notes: z.string().nullable(),
  deleted_at: z.string().nullable(),
  edited: z.boolean().default(false),
});
export type Item = z.infer<typeof itemSchema>;

export const studyTimeSchema = z.object({
  id: z.string(),
  course_id: z.string(),
  weekday: z.number().int().min(0).max(6),
  start_time: z.string(), // "18:00:00"
  end_time: z.string(),
});
export type StudyTime = z.infer<typeof studyTimeSchema>;

export const blockLinkSchema = z.object({ block_key: z.string(), item_id: z.string() });
export type BlockLink = z.infer<typeof blockLinkSchema>;

export const meSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  canvas: z.enum(["token", "feed"]).nullable(),
  google: z.boolean(),
  outlook: z.boolean().default(false),
});
export type Me = z.infer<typeof meSchema>;

export const summarySchema = z.object({
  headline: z.string(),
  bullets: z.array(z.object({ text: z.string(), item_id: z.string().nullable().optional(), priority: z.enum(["high", "normal"]) })),
});
export type Summary = z.infer<typeof summarySchema>;

export const importResultSchema = z.object({ courses: z.number(), items: z.number(), source: z.enum(["token", "feed"]) });
export type ImportResult = z.infer<typeof importResultSchema>;

export const syncResultSchema = z.object({
  created: z.number(), updated: z.number(), removed: z.number(), failed: z.number(), calendar_name: z.string(),
});
export type SyncResult = z.infer<typeof syncResultSchema>;

export const syllabusFileSchema = z.object({
  id: z.string(),
  course_id: z.string().nullable(),
  name: z.string(),
  status: z.string(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
});
export type SyllabusFile = z.infer<typeof syllabusFileSchema>;

export const startResultSchema = z.object({ url: z.string().url() });
export const connectResultSchema = z.object({ connected: z.enum(["token", "feed"]), name: z.string() });
export const okSchema = z.object({ ok: z.boolean() });
export const removedSchema = z.object({ removed: z.boolean() });

export const parsedSyllabusSchema = z.object({
  course_code: z.string().nullable(),
  course_name: z.string().nullable(),
  credits: z.number().nullable(),
  weekly_hours: z.number().nullable().default(null),
  online: z.boolean().nullable(),
  meetings: z.array(meetingSchema),
  meeting_days_text: z.string().nullable().default(null),
  late_policy: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  source_lines: z.array(z.object({ text: z.string(), highlight: z.boolean() })).default([]),
  items: z.array(z.object({
    title: z.string(),
    type: itemTypeSchema,
    due_date: z.string().nullable(),
    due_time: z.string().nullable(),
    confidence: z.number(),
    note: z.string().nullable(),
    hours: z.number().nullable().default(null),
  })),
});
export type ParsedSyllabus = z.infer<typeof parsedSyllabusSchema>;

/** Minutes before the due time, per type. Defaults from the plan. */
export type ReminderRules = Record<ItemType, number[]>;
export const DEFAULT_REMINDERS: ReminderRules = {
  exam: [10080, 2880, 720],
  project: [10080, 4320, 1440],
  quiz: [1440],
  assignment: [2880, 180],
  reading: [720],
  other: [1440],
};

export const COLORS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"] as const;
export const TYPE_LABEL: Record<ItemType, string> = {
  assignment: "Assignment", quiz: "Quiz", exam: "Exam", project: "Project", reading: "Reading", other: "Other",
};
