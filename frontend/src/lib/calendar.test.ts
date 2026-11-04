import { describe, expect, it } from "vitest";
import { mockCourses, mockItems, mockLinks, mockStudyTimes } from "../services/mock/data";
import { eventsForDay, type CalEvent } from "./calendar";

const tue = new Date(2026, 10, 3);
const mon = new Date(2026, 10, 2);
const data = { courses: mockCourses, items: mockItems, studyTimes: mockStudyTimes, links: mockLinks };

describe("eventsForDay", () => {
  it("hides class times until the class is confirmed", () => {
    expect(eventsForDay(mon, data).some((e) => e.kind === "class")).toBe(false);
    const confirmed = mockCourses.map((c) => ({ ...c, confirmed: true }));
    expect(eventsForDay(mon, { ...data, courses: confirmed }).filter((e) => e.kind === "class")).toHaveLength(1);
  });

  it("keeps starred items on their own class's block when two blocks share a time", () => {
    const both = [...mockStudyTimes, { id: "s4", course_id: "c2", weekday: 2, start_time: "18:00:00", end_time: "20:00:00" }];
    const blocks = eventsForDay(tue, { ...data, studyTimes: both }).filter((e): e is Extract<CalEvent, { kind: "study" }> => e.kind === "study");
    const forCourse = (id: string) => blocks.find((b) => b.course.id === id);
    expect(forCourse("c1")?.studyFor.map((i) => i.title)).toEqual(["U04 Blazor assignment"]);
    expect(forCourse("c2")?.studyFor).toEqual([]);
  });
});
