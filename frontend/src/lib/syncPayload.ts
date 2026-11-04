// Pure: builds the body for POST /api/google/sync from the student's data.
import { addDays, format, startOfDay } from "date-fns";
import type { BlockLink, Course, Item, ReminderRules, StudyTime } from "../types/domain";
import { at, dayKey, isDone, isoLocal, shortDue } from "./dates";

export interface SyncInput {
  courses: Course[];
  items: Item[];
  studyTimes: StudyTime[];
  links: BlockLink[];
  rules: ReminderRules;
  now: Date;
  timeZone: string;
  emoji: boolean;
  weeks?: number;            // how far ahead to create study blocks
  semesterEnd: Date;         // last day classes repeat until
}

/** One study block occurrence: "2026-11-03|18:00|<courseId>". */
export const blockKey = (day: Date, startTime: string, courseId: string): string =>
  `${dayKey(day)}|${startTime.slice(0, 5)}|${courseId}`;

export function buildSyncPayload(i: SyncInput) {
  const code = new Map(i.courses.map((c) => [c.id, c.code]));
  const live = i.items.filter((it) => !it.deleted_at && code.has(it.course_id));
  const byId = new Map(live.map((it) => [it.id, it]));
  const today = startOfDay(i.now);

  const due = live
    .filter((it) => it.due_at && new Date(it.due_at) >= startOfDay(i.now))
    .map((it) => ({
      key: `due|${it.id}`,
      title: it.title,
      course_code: code.get(it.course_id) ?? "",
      type: it.type,
      due_at: it.due_at as string,
      done: isDone(it, i.now),
      reminders_min: (i.rules[it.type] ?? []).slice(0, 5),
    }));

  const study = [];
  for (let k = 0; k < (i.weeks ?? 3) * 7; k++) {
    const day = addDays(today, k);
    for (const st of i.studyTimes) {
      if (st.weekday !== day.getDay() || !code.has(st.course_id)) continue;
      const bk = blockKey(day, st.start_time, st.course_id);
      const studyFor = i.links
        .filter((l) => l.block_key === bk)
        .map((l) => byId.get(l.item_id))
        .filter((it): it is Item => !!it && !isDone(it, i.now))
        .map((it) => (it.due_at ? `${it.title} (due ${shortDue(it.due_at)})` : it.title));
      study.push({
        key: `study|${bk}`,
        course_code: code.get(st.course_id) ?? "",
        start: isoLocal(at(day, st.start_time)),
        end: isoLocal(at(day, st.end_time)),
        study_for: studyFor,
      });
    }
  }

  const classes = i.courses
    .filter((c) => c.online === false)
    .flatMap((c) =>
      c.meetings.map((m, idx) => {
        const first = addDays(today, (m.day - today.getDay() + 7) % 7);
        return {
          key: `class|${c.id}|${idx}`,
          course_code: c.code,
          course_name: c.name,
          first_start: isoLocal(at(first, m.start)),
          first_end: isoLocal(at(first, m.end)),
          until: format(i.semesterEnd, "yyyyMMdd"),
        };
      }),
    );

  return { time_zone: i.timeZone, emoji: i.emoji, due, study, classes };
}
