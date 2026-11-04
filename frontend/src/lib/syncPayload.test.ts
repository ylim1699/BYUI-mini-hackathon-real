import { describe, expect, it } from "vitest";
import { mockCourses, mockItems, mockLinks, mockStudyTimes } from "../services/mock/data";
import { DEFAULT_REMINDERS } from "../types/domain";
import { buildSyncPayload } from "./syncPayload";

const now = new Date(2026, 10, 3, 12, 0); // Tue Nov 3, noon local
const base = {
  courses: mockCourses, items: mockItems, studyTimes: mockStudyTimes, links: mockLinks,
  rules: DEFAULT_REMINDERS, now, timeZone: "America/Denver", emoji: true, semesterEnd: new Date(2026, 11, 16),
};

describe("buildSyncPayload", () => {
  it("adds upcoming due items with reminders by type", () => {
    const p = buildSyncPayload(base);
    expect(p.due.map((d) => d.title)).toContain("U04 Blazor assignment");
    expect(p.due.find((d) => d.title === "W08 Midterm exam")?.reminders_min).toEqual([10080, 2880, 720]);
  });

  it("puts starred items in the study block notes and skips done ones", () => {
    const p = buildSyncPayload(base);
    const tue = p.study.find((s) => s.key.startsWith("study|2026-11-03|18:00"));
    expect(tue?.study_for).toEqual(["U04 Blazor assignment (due Sat, Nov 7)"]);
    const done = buildSyncPayload({ ...base, items: mockItems.map((i) => (i.id === "i1" ? { ...i, status: "done" as const } : i)) });
    expect(done.study.find((s) => s.key.startsWith("study|2026-11-03|18:00"))?.study_for).toEqual([]);
  });

  it("creates 3 weeks of study blocks and weekly classes only for in-person courses", () => {
    const p = buildSyncPayload(base);
    expect(p.study).toHaveLength(9); // 3 weekly blocks x 3 weeks
    expect(p.classes.map((c) => c.course_code)).toEqual(["CSE 280", "CSE 280"]);
    expect(p.classes[0]?.until).toBe("20261216");
  });

  it("keeps done items but marks them done", () => {
    const p = buildSyncPayload({ ...base, items: mockItems.map((i) => (i.id === "i1" ? { ...i, status: "done" as const } : i)) });
    expect(p.due.find((d) => d.title === "U04 Blazor assignment")?.done).toBe(true);
  });

  it("leaves deleted items out", () => {
    const p = buildSyncPayload({ ...base, items: mockItems.map((i) => (i.id === "i3" ? { ...i, deleted_at: now.toISOString() } : i)) });
    expect(p.due.map((d) => d.title)).not.toContain("W08 Midterm exam");
  });
});
