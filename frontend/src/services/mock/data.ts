// Sample data for VITE_USE_MOCKS=true (no backend or keys needed).
import type { BlockLink, Course, Item, StudyTime } from "../../types/domain";

const d = (iso: string) => new Date(iso).toISOString();

export const mockCourses: Course[] = [
  { id: "c1", canvas_id: "1", code: "CSE 325", name: ".NET Software Development", color: "c1", credits: 3, hours_per_week: 7.5, online: true, meetings: [], confirmed: true, source: "canvas" },
  { id: "c2", canvas_id: "2", code: "CSE 280", name: "Discrete Mathematics", color: "c2", credits: 3, hours_per_week: 7.5, online: false, meetings: [{ day: 1, start: "09:45", end: "10:45" }, { day: 3, start: "09:45", end: "10:45" }], confirmed: false, source: "canvas" },
  { id: "c3", canvas_id: "3", code: "REL 212", name: "New Testament", color: "c3", credits: 2, hours_per_week: 5, online: true, meetings: [], confirmed: true, source: "canvas" },
];

const item = (id: string, course_id: string, title: string, type: Item["type"], due: string): Item => ({
  id, course_id, title, type, due_at: d(due), estimated_hours: 2, source: "canvas", confidence: 1, status: "todo", notes: null, deleted_at: null,
});

export const mockItems: Item[] = [
  item("i1", "c1", "U04 Blazor assignment", "assignment", "2026-11-07T23:59:00-07:00"),
  item("i2", "c1", "U04 Project Checkpoint 2", "project", "2026-11-07T23:59:00-07:00"),
  item("i3", "c2", "W08 Midterm exam", "exam", "2026-11-07T23:59:00-07:00"),
  item("i4", "c3", "W08 Teaching Truth post", "assignment", "2026-11-04T23:59:00-07:00"),
  item("i5", "c3", "W08 Share It!", "assignment", "2026-11-07T23:59:00-07:00"),
  item("i6", "c2", "W09 Reading quiz", "quiz", "2026-11-11T23:59:00-07:00"),
];

export const mockStudyTimes: StudyTime[] = [
  { id: "s1", course_id: "c1", weekday: 2, start_time: "18:00:00", end_time: "21:00:00" },
  { id: "s2", course_id: "c2", weekday: 1, start_time: "18:00:00", end_time: "21:00:00" },
  { id: "s3", course_id: "c3", weekday: 3, start_time: "15:00:00", end_time: "17:00:00" },
];

export const mockLinks: BlockLink[] = [{ block_key: "2026-11-03|18:00|c1", item_id: "i1" }];
