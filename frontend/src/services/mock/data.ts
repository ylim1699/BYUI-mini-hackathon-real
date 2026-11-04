// Sample data for `npm run dev:mock` (local development and tests only).
// The real app starts empty: you only see what you add from your own syllabus or Canvas.
import type { BlockLink, Course, Item, StudyTime, SyllabusFile } from "../../types/domain";

const course = (c: Partial<Course> & Pick<Course, "id" | "code" | "name" | "color">): Course => ({
  canvas_id: null, credits: 3, hours_per_week: 7.5, online: true, meetings: [], confirmed: true, source: "syllabus",
  notes: null, late_policy: null, source_lines: [], file_name: null, renamed: false, ...c,
});

export const mockCourses: Course[] = [
  course({ id: "c1", code: "CSE 325", name: ".NET Software Development", color: "c1", file_name: "Syllabus for .NET Software Development.pdf",
    notes: "Credits and grade weights aren't listed. Using 3 credits.", late_policy: "Loses 5% a day, up to 50%",
    source_lines: [{ text: "The course is organized into 2-week units.", highlight: false }, { text: "Sat Nov 7, 2026: U04 Assignment: .NET Blazor Application", highlight: true }] }),
  course({ id: "c2", code: "CSE 280", name: "Discrete Mathematics", color: "c2", online: null, confirmed: false,
    file_name: "Syllabus for Discrete Mathematics.pdf", notes: "Add your class times so study blocks avoid them.",
    source_lines: [{ text: "The class meets 3 days a week: Monday and Wednesday lecture, Friday group activity.", highlight: true }] }),
  course({ id: "c3", code: "REL 212", name: "New Testament", color: "c3", credits: 2, hours_per_week: 7, file_name: "Syllabus for New Testament.pdf",
    late_policy: "Late work only with your instructor's OK" }),
];

const item = (id: string, course_id: string, title: string, type: Item["type"], due: string, extra: Partial<Item> = {}): Item => ({
  id, course_id, title, type, due_at: new Date(due).toISOString(), estimated_hours: 2, source: "syllabus", confidence: 1,
  status: "todo", notes: null, deleted_at: null, edited: false, ...extra,
});

export const mockItems: Item[] = [
  item("i0", "c2", "W07 Problem Set", "assignment", "2026-10-31T23:59:00-06:00"),
  item("i1", "c1", "U04 Blazor assignment", "assignment", "2026-11-07T23:59:00-07:00", { confidence: 0.5, notes: "Same title as the U03 assignment. Check Canvas that this is a separate part." }),
  item("i2", "c1", "U04 Project Checkpoint 2", "project", "2026-11-07T23:59:00-07:00"),
  item("i3", "c2", "W08 Midterm exam", "exam", "2026-11-07T23:59:00-07:00"),
  item("i4", "c3", "W08 Teaching Truth post", "assignment", "2026-11-04T23:59:00-07:00"),
  item("i5", "c3", "W08 Share It!", "assignment", "2026-11-07T23:59:00-07:00"),
  item("i6", "c2", "W09 Reading quiz", "quiz", "2026-11-11T23:59:00-07:00"),
  item("i7", "c3", "W08 Directed Study", "reading", "2026-11-04T23:59:00-07:00", { status: "done" }),
];

export const mockStudyTimes: StudyTime[] = [
  { id: "s1", course_id: "c1", weekday: 2, start_time: "18:00:00", end_time: "21:00:00" },
  { id: "s2", course_id: "c2", weekday: 1, start_time: "18:00:00", end_time: "21:00:00" },
  { id: "s3", course_id: "c3", weekday: 3, start_time: "15:00:00", end_time: "17:00:00" },
];

export const mockLinks: BlockLink[] = [{ block_key: "2026-11-03|18:00|c1", item_id: "i1" }];

export const mockFiles: SyllabusFile[] = [
  { id: "f1", course_id: "c1", name: "Syllabus for .NET Software Development.pdf", status: "3 items found, 1 to check", deleted_at: null, created_at: "2026-11-01T00:00:00Z" },
];
