import { useRef, useState } from "react";
import { PageHead, Spinner } from "../components/ui";
import { useAll, useAllCourses, useFiles, useRefreshAll, useUpdateCourse, useUpdateFile, useUpdateItem } from "../hooks/useData";
import { col } from "../lib/plan";
import { sx } from "../lib/sx";
import * as db from "../services/db";
import { DAY_MS, stillRestorable, useUi } from "../store/ui";

interface Row { id: string; kind: "item" | "file" | "course"; label: string; meta: string; color: string; at: number }

const ago = (ms: number) => (ms < 60000 ? "just now" : ms < 3600000 ? Math.round(ms / 60000) + " min ago" : Math.round(ms / 3600000) + " h ago");
const leftTxt = (ms: number) => (ms < 3600000 ? "Gone in " + Math.max(1, Math.round(ms / 60000)) + " min" : "Gone in " + Math.round(ms / 3600000) + " h");

export function TrashPage() {
  const { items, loading } = useAll();
  const allCourses = useAllCourses();
  const courses = allCourses.data ?? [];
  const updateCourse = useUpdateCourse();
  const files = useFiles();
  const updateItem = useUpdateItem();
  const updateFile = useUpdateFile();
  const refresh = useRefreshAll();
  const notify = useUi((s) => s.notify);
  const [purging, setPurging] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const now = Date.now();
  const course = (id: string | null) => courses.find((c) => c.id === id);
  const goneCourse = new Set(courses.filter((c) => c.deleted_at).map((c) => c.id));

  const rows: Row[] = [
    ...courses.filter((c) => stillRestorable(c.deleted_at)).map((c) => {
      const at = new Date(c.deleted_at!).getTime(); const n = items.filter((i) => i.course_id === c.id && !i.deleted_at).length;
      return { id: c.id, kind: "course" as const, label: `${c.code} ${c.name}`.trim(), color: col(c), at,
        meta: [`Class with ${n} item${n === 1 ? "" : "s"}`, "Deleted " + ago(now - at)].join(" · ") };
    }),
    ...items.filter((i) => stillRestorable(i.deleted_at) && !goneCourse.has(i.course_id)).map((i) => {
      const c = course(i.course_id); const at = new Date(i.deleted_at!).getTime();
      const due = i.due_at ? "Due " + new Date(i.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
      return { id: i.id, kind: "item" as const, label: i.title || "Untitled item", color: c ? col(c) : "var(--muted)", at,
        meta: [c?.code, due, "From your list", "Deleted " + ago(now - at)].filter(Boolean).join(" · ") };
    }),
    ...(files.data ?? []).filter((f) => stillRestorable(f.deleted_at)).map((f) => {
      const c = course(f.course_id); const at = new Date(f.deleted_at!).getTime();
      return { id: f.id, kind: "file" as const, label: f.name, color: c ? col(c) : "var(--muted)", at,
        meta: [c?.code, "Syllabus file", "Deleted " + ago(now - at)].filter(Boolean).join(" · ") };
    }),
  ].filter((r) => !purging.has(r.id)).sort((a, b) => b.at - a.at);

  const restore = (r: Row) => {
    const m = r.kind === "item" ? updateItem : r.kind === "course" ? updateCourse : updateFile;
    m.mutate({ id: r.id, patch: { deleted_at: null } });
    const at = new Date(r.at).toISOString();
    notify({ text: `Restored ${r.label}.`, undo: () => m.mutate({ id: r.id, patch: { deleted_at: at } }) });
  };

  // "Delete now" waits for the Undo window before deleting for real.
  const purge = (r: Row) => {
    setPurging((s) => new Set(s).add(r.id));
    const t = setTimeout(async () => {
      timers.current.delete(r.id);
      await (r.kind === "item" ? db.deleteItemForever(r.id) : r.kind === "course" ? db.deleteCourseForever(r.id) : db.deleteFileForever(r.id));
      refresh();
    }, 6500);
    timers.current.set(r.id, t);
    notify({
      text: `Deleted ${r.label} for good.`,
      undo: () => {
        clearTimeout(timers.current.get(r.id)); timers.current.delete(r.id);
        setPurging((s) => { const n = new Set(s); n.delete(r.id); return n; });
      },
    });
  };

  return (
    <div className="anim-page" style={sx("display: flex; flex-direction: column; gap: 16px;")}>
      <PageHead title="Recently deleted" sub="Anything you delete stays here for 1 day, then it's gone for good. Restore puts it back where it was." />
      {loading || allCourses.isLoading ? <Spinner /> : (
        <section aria-label="Deleted items" style={sx("max-width: 760px; box-sizing: border-box; padding: 8px 18px; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: 18px;")}>
          {!rows.length && (
            <div style={sx("display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 12px; text-align: center; color: var(--text-2);")}>
              <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 011.5-1.5h2A1.5 1.5 0 0114.5 5v2M6.5 7l1 12a2 2 0 002 1.8h5a2 2 0 002-1.8l1-12" /></svg>
              <span style={sx("font-size: 14px; font-weight: 700; color: var(--text);")}>Nothing deleted in the last day</span>
              <span style={sx("font-size: 13px;")}>Items you delete from the calendar or the review list show up here.</span>
            </div>
          )}
          {rows.map((r) => (
            <div key={r.kind + r.id} style={sx("display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--line);")}>
              <span aria-hidden="true" style={sx(`width: 10px; height: 10px; flex-shrink: 0; border-radius: 5px; background: ${r.color};`)} />
              <div style={sx("flex: 1 1 240px; min-width: 0; display: flex; flex-direction: column; gap: 2px;")}>
                <span style={sx("font-size: 14px; font-weight: 700; overflow-wrap: anywhere;")}>{r.label}</span>
                <span style={sx("font-size: 12px; color: var(--text-2);")}>{r.meta}</span>
              </div>
              <span style={sx("font-size: 12px; font-weight: 700; color: var(--warn-text); white-space: nowrap;")}>{leftTxt(r.at + DAY_MS - now)}</span>
              <div style={sx("display: flex; gap: 8px;")}>
                <button type="button" onClick={() => restore(r)} aria-label={`Restore ${r.label}`} style={sx("min-height: 36px; padding: 0 14px; border-radius: 18px; border: 0; background: var(--primary-bg); color: var(--primary-text); font-size: 13px; font-weight: 700; cursor: pointer;")}>Restore</button>
                <button type="button" onClick={() => purge(r)} aria-label={`Delete ${r.label} now`} style={sx("min-height: 36px; padding: 0 14px; border-radius: 18px; border: 1px solid var(--line-strong); background: transparent; color: var(--text-2); font-size: 13px; font-weight: 700; cursor: pointer;")}>Delete now</button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
