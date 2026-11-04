import { describe, expect, it } from "vitest";
import { mockCourses, mockItems, mockLinks, mockStudyTimes } from "../services/mock/data";
import { fmtT, hm, liveLinks, meetsLine, offsetLabel, planItems, slotsOn, toHM } from "./plan";

const now = new Date(2026, 10, 3, 12, 0); // Tue Nov 3, noon
const tue = new Date(2026, 10, 3);

describe("plan helpers", () => {
  it("formats times", () => {
    expect(hm("18:30")).toBe(18.5);
    expect(toHM(18.5)).toBe("18:30");
    expect(fmtT(18.5)).toBe("6:30 PM");
    expect(fmtT(9)).toBe("9:00 AM");
    expect(offsetLabel(2880)).toBe("2 days before");
    expect(offsetLabel(10080)).toBe("1 week before");
    expect(offsetLabel(180)).toBe("3 hours before");
  });

  it("places items on local days and marks overdue only when not done", () => {
    const list = planItems(mockItems, mockCourses, now);
    const ps = list.find((i) => i.title === "W07 Problem Set")!;
    expect(ps.key).toBe("2026-10-31");
    expect(ps.overdue).toBe(true);
    expect(list.find((i) => i.title === "W08 Directed Study")!.overdue).toBe(false); // done
    expect(list.every((i) => i.due_at)).toBe(true);
  });

  it("keeps starred items on their own class's block when two blocks share a time", () => {
    const both = [...mockStudyTimes, { id: "s4", course_id: "c2", weekday: 2, start_time: "18:00:00", end_time: "20:00:00" }];
    const slots = slotsOn(tue, both, mockCourses);
    const byId = new Map(planItems(mockItems, mockCourses, now).map((i) => [i.id, i]));
    const c1 = slots.find((s) => s.course.id === "c1")!;
    const c2 = slots.find((s) => s.course.id === "c2")!;
    expect(liveLinks(c1.id, mockLinks, byId).map((i) => i.title)).toEqual(["U04 Blazor assignment"]);
    expect(liveLinks(c2.id, mockLinks, byId)).toEqual([]);
  });

  it("describes when a class meets", () => {
    const c = { ...mockCourses[1]!, online: false, meetings: [{ day: 1, start: "09:00", end: "10:00" }, { day: 3, start: "09:00", end: "10:00" }, { day: 5, start: "13:00", end: "14:00" }] };
    expect(meetsLine(c)).toBe("Meets Mon, Wed, 9:00 AM to 10:00 AM; Fri, 1:00 PM to 2:00 PM.");
    expect(meetsLine({ ...c, online: null, meetings: [] })).toBe("Class times aren't set yet.");
  });
});

import { overlapColumns } from "./plan";
describe("overlapColumns", () => {
  it("puts overlapping blocks side by side and leaves others full width", () => {
    const m = overlapColumns([{ id: "a", s: 18, e: 21 }, { id: "b", s: 18, e: 20 }, { id: "c", s: 9, e: 10 }, { id: "d", s: 20, e: 22 }]);
    expect(m.get("c")).toEqual([0, 1]);
    expect(m.get("a")![1]).toBe(2);
    expect(m.get("b")![1]).toBe(2);
    expect(m.get("a")![0]).not.toBe(m.get("b")![0]);
    expect(m.get("d")![0]).not.toBe(m.get("a")![0]); // d overlaps a, not b

  });
});
