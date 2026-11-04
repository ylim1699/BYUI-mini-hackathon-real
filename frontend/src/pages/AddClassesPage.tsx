import { useMutation } from "@tanstack/react-query";
import { useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Confirm, ErrorNote, Ico, P, PageHead, S } from "../components/ui";
import { useAll, useFiles, useMe, useRefreshAll, useUpdateFile } from "../hooks/useData";
import { pdfToText } from "../lib/pdfText";
import { col, soft } from "../lib/plan";
import { sx } from "../lib/sx";
import { api, errorText } from "../services/api";
import * as db from "../services/db";
import { useUi } from "../store/ui";
import { COLORS, connectResultSchema, importResultSchema, okSchema, parsedSyllabusSchema, type Course, type ParsedSyllabus } from "../types/domain";

interface Pending { id: string; name: string; status: string; error: boolean }
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const codeFromName = (name: string) => /([A-Z]{2,5})\s?-?(\d{3}[A-Z]?)/.exec(name)?.slice(1, 3).join(" ") ?? null;

export function AddClassesPage() {
  const nav = useNavigate();
  const { courses, items } = useAll();
  const files = useFiles();
  const refresh = useRefreshAll();
  const updateFile = useUpdateFile();
  const notify = useUi((s) => s.notify);
  const [pending, setPending] = useState<Pending[]>([]);
  const [drag, setDrag] = useState(false);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);

  const liveItems = items.filter((i) => !i.deleted_at).length;
  const shownFiles = (files.data ?? []).filter((f) => !f.deleted_at);

  const setP = (id: string, patch: Partial<Pending>) => setPending((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  /** Save what the AI found: a new class, or new items on a class you already have (no duplicates). */
  const saveParsed = async (p: ParsedSyllabus, fileName: string): Promise<{ course: Course; added: number; flags: number }> => {
    const [courses, items] = await Promise.all([db.listCourses(), db.listItems()]); // fresh, so several files in a row don't collide
    const code = (p.course_code || codeFromName(fileName) || fileName.replace(/\.pdf$/i, "")).trim().slice(0, 40);
    let course = courses.find((c) => norm(c.code) === norm(code));
    const credits = p.credits ?? 3;
    const notes = [p.notes, !p.meetings.length && p.meeting_days_text ? `The syllabus says: ${p.meeting_days_text}` : null].filter(Boolean).join(" ") || null;
    if (!course) {
      course = await db.insertCourse({
        canvas_id: null, code, name: (p.course_name ?? "").slice(0, 120), color: COLORS[courses.length % COLORS.length] ?? "c1",
        credits, hours_per_week: p.weekly_hours ?? credits * 2.5, online: p.online, meetings: p.meetings, confirmed: false, source: "syllabus",
        notes, late_policy: p.late_policy, source_lines: p.source_lines.slice(0, 8), file_name: fileName, renamed: false,
      });
    } else {
      await db.updateCourse(course.id, {
        file_name: fileName, source_lines: p.source_lines.slice(0, 8), late_policy: course.late_policy ?? p.late_policy, notes: course.notes ?? notes,
        ...(course.meetings.length || !p.meetings.length ? {} : { meetings: p.meetings, online: p.online ?? course.online }),
      });
    }
    const have = new Set(items.filter((i) => i.course_id === course.id).map((i) => norm(i.title)));
    const fresh = p.items.filter((it) => !have.has(norm(it.title)));
    await db.insertItems(fresh.map((it) => ({
      course_id: course.id, title: it.title.slice(0, 300), type: it.type,
      due_at: it.due_date ? new Date(`${it.due_date}T${it.due_time ?? "23:59"}`).toISOString() : null,
      estimated_hours: it.hours ?? 1, source: "syllabus", confidence: it.due_date ? it.confidence : Math.min(it.confidence, 0.5),
      status: "todo", notes: it.note ?? (it.due_date ? null : "No due date found. Add one."), deleted_at: null, edited: false,
    })));
    const flags = fresh.filter((it) => it.confidence < 0.7 || !it.due_date).length;
    return { course, added: fresh.length, flags };
  };

  const handleFiles = async (list: FileList | File[]) => {
    const pdfs = [...list].filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
    if (!pdfs.length) { notify({ text: "Choose PDF files." }); return; }
    for (const f of pdfs) {
      const id = `${f.name}-${Date.now()}`;
      setPending((l) => [...l, { id, name: f.name, status: "Reading the PDF…", error: false }]);
      try {
        if (f.size > 20 * 1024 * 1024) throw new Error("This file is over 20 MB.");
        const text = await pdfToText(f);
        if (text.length < 50) throw new Error("This PDF has almost no text (it may be a scan).");
        setP(id, { status: "Finding dates with AI…" });
        const parsed = await api("/syllabus/parse", parsedSyllabusSchema, { text: text.slice(0, 60_000), course_code: codeFromName(f.name) });
        const r = await saveParsed(parsed, f.name);
        const status = `${r.added} item${r.added === 1 ? "" : "s"} found` + (r.flags ? `, ${r.flags} to check` : "");
        await db.insertFile({ course_id: r.course.id, name: f.name, status });
        setPending((l) => l.filter((p) => p.id !== id));
        await refresh();
        notify({ text: `${r.course.code}: ${status}.` });
      } catch (e) {
        setP(id, { status: errorText(e), error: true });
      }
    }
  };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); void handleFiles(e.dataTransfer.files); };

  return (
    <div className="anim-page" style={sx("display: flex; flex-direction: column; gap: 16px;")}>
      <PageHead title="Add your classes"
        sub="Upload each syllabus as a PDF. For a Canvas syllabus page, print it to PDF. You check every item before anything reaches your calendar."
        right={<button type="button" onClick={() => nav("/review")} style={sx(S.primary)}>Review {liveItems} items</button>} />
      <div style={sx("display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start;")}>
        <section style={sx("flex: 2 1 440px; min-width: 0; padding: 18px; " + S.card)}>
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
            style={sx("display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 200px; padding: 26px 20px; box-sizing: border-box; border: 1.5px dashed " + (drag ? "var(--c1)" : "var(--line-strong)") + "; border-radius: 14px; text-align: center;" + (drag ? " background: var(--c1-soft);" : ""))}>
            <div style={sx("width: 52px; height: 52px; border-radius: 16px; background: var(--surface-3); color: var(--text); display: flex; align-items: center; justify-content: center;")}>
              <Ico d={P.upload} size={24} sw={1.8} />
            </div>
            <span style={sx("font-size: 17px; font-weight: 800;")}>Drop syllabus PDFs here</span>
            <span style={sx("font-size: 13px; color: var(--muted);")}>One file per class. PDF, up to 20 MB each. Read in your browser; only the text goes to the AI.</span>
            <label style={sx("position: relative; display: inline-flex; align-items: center; min-height: 42px; padding: 0 20px; margin-top: 4px; border-radius: 21px; border: 1px solid var(--line-strong); background: var(--surface-2); font-size: 14px; font-weight: 700; color: var(--text); cursor: pointer;")}>
              Choose files
              <input type="file" accept=".pdf,application/pdf" multiple onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ""; }}
                style={sx("position: absolute; inset: 0; opacity: 0; cursor: pointer;")} />
            </label>
          </div>
          <div style={sx("display: flex; flex-direction: column; margin-top: 14px;")}>
            {pending.map((p) => (
              <div key={p.id} style={sx("display: flex; align-items: center; gap: 14px; padding: 12px 4px; border-top: 1px solid var(--line);")}>
                <div style={sx("width: 38px; height: 38px; flex-shrink: 0; border-radius: 12px; background: var(--surface-3); display: flex; align-items: center; justify-content: center;")}>
                  {p.error ? <Ico d={P.warn} size={18} sw={1.8} style="color: var(--warn-text);" /> : <span className="spinner" />}
                </div>
                <div style={sx("flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px;")}>
                  <span style={sx("font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;")}>{p.name}</span>
                  <span role={p.error ? "alert" : "status"} style={sx("font-size: 13px; font-weight: 600; color: " + (p.error ? "var(--warn-text)" : "var(--text-2)") + ";")}>{p.status}</span>
                </div>
                {p.error && (
                  <button type="button" aria-label={`Dismiss ${p.name}`} onClick={() => setPending((l) => l.filter((x) => x.id !== p.id))}
                    style={sx("width: 36px; height: 36px; flex-shrink: 0; padding: 0; border-radius: 18px; border: 1px solid var(--line-strong); background: transparent; color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center;")}>
                    <Ico d={P.x} size={13} sw={2.6} />
                  </button>
                )}
              </div>
            ))}
            {shownFiles.map((f) => {
              const c = courses.find((x) => x.id === f.course_id);
              const tint = c ?? { color: "c1" };
              return (
                <div key={f.id} style={sx("display: flex; align-items: center; gap: 14px; padding: 12px 4px; border-top: 1px solid var(--line);")}>
                  <div style={sx(`width: 38px; height: 38px; flex-shrink: 0; border-radius: 12px; background: ${soft(tint)}; color: ${col(tint)}; display: flex; align-items: center; justify-content: center;`)}>
                    <Ico d={P.file} size={18} sw={1.8} />
                  </div>
                  <div style={sx("flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px;")}>
                    <span style={sx("font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;")}>{f.name}</span>
                    <span style={sx("font-size: 13px; font-weight: 600; color: var(--warn-text);")}>{f.status}</span>
                  </div>
                  <button type="button" onClick={() => nav(c ? `/review?c=${c.id}` : "/review")}
                    style={sx("min-height: 36px; padding: 0 16px; border-radius: 18px; border: 1px solid var(--line-strong); background: var(--surface-2); font-size: 13px; font-weight: 700; color: var(--text); cursor: pointer;")}>Review</button>
                  <button type="button" onClick={() => setDel({ id: f.id, name: f.name })} aria-label={`Delete ${f.name}`} title={`Delete ${f.name}`}
                    style={sx("width: 36px; height: 36px; flex-shrink: 0; padding: 0; border-radius: 18px; border: 1px solid var(--line-strong); background: transparent; color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center;")}>
                    <Ico d={P.trash} size={15} sw={1.9} />
                  </button>
                </div>
              );
            })}
            {!shownFiles.length && !pending.length && <span style={sx("padding: 12px 4px; font-size: 13px; font-weight: 700; color: var(--text-2);")}>No syllabi added yet.</span>}
          </div>
        </section>
        <CanvasCard />
      </div>

      <Confirm open={!!del} danger title={`Delete “${del?.name ?? ""}”?`} yes="Delete" onClose={() => setDel(null)}
        body="The file is removed from this list. Items you already reviewed stay on your calendar. You can restore it from Recently deleted for 1 day."
        onYes={() => {
          if (!del) return;
          const id = del.id;
          updateFile.mutate({ id, patch: { deleted_at: new Date().toISOString() } });
          notify({ text: `Deleted ${del.name}.`, undo: () => updateFile.mutate({ id, patch: { deleted_at: null } }) });
        }} />
    </div>
  );
}

function CanvasCard() {
  const me = useMe();
  const refresh = useRefreshAll();
  const nav = useNavigate();
  const notify = useUi((s) => s.notify);
  const [token, setToken] = useState("");
  const [feed, setFeed] = useState("");
  const linked = me.data?.canvas ?? null;

  const run = useMutation({
    mutationFn: async () => {
      if (!linked || token.trim() || feed.trim()) {
        await api("/canvas/connect", connectResultSchema, token.trim() ? { token: token.trim() } : { feed_url: feed.trim() });
      }
      return api("/canvas/import", importResultSchema, {});
    },
    onSuccess: async (r) => {
      setToken(""); setFeed("");
      await refresh();
      notify({ text: `Imported ${r.courses} classes and ${r.items} items from Canvas.` });
      if (r.items) nav("/review");
    },
  });
  const disconnect = useMutation({ mutationFn: () => api("/canvas/disconnect", okSchema, {}), onSuccess: () => refresh() });
  const ready = !!linked || token.trim().length >= 20 || /^https:\/\/.+/.test(feed.trim());

  return (
    <section style={sx("flex: 1 1 280px; min-width: 0; padding: 20px; display: flex; flex-direction: column; gap: 14px; " + S.card)}>
      <h2 style={sx("margin: 0; font-size: 18px; font-weight: 800; color: var(--text);")}>Import from Canvas</h2>
      <p style={sx("margin: 0; font-size: 13px; line-height: 1.55; font-weight: 700; color: var(--text);")}>Pull in what professors post in Canvas. Canvas dates win over the syllabus when they disagree, and nothing shows up twice.</p>
      {linked && (
        <span style={sx("align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 12px; background: var(--c2-soft); color: var(--ok); font-size: 12px; font-weight: 800;")}>
          <Ico d={P.check} size={13} sw={2.6} />Connected with {linked === "token" ? "your access token" : "your calendar feed"}
        </span>
      )}
      <div style={sx("display: flex; flex-direction: column; gap: 6px;")}>
        <label htmlFor="canvas-token" style={sx("font-size: 13px; font-weight: 800; color: var(--text);")}>{linked ? "New Canvas access token (optional)" : "Canvas access token"}</label>
        <input id="canvas-token" className="hi-input" type="password" autoComplete="off" placeholder="Paste your token" value={token} onChange={(e) => setToken(e.target.value)} style={sx(S.field)} />
        <span style={sx("font-size: 12px; line-height: 1.45; font-weight: 700; color: var(--text);")}>In Canvas: Account, then Settings, then New access token.</span>
      </div>
      <div style={sx("display: flex; flex-direction: column; gap: 6px;")}>
        <label htmlFor="feed" style={sx("font-size: 13px; font-weight: 800; color: var(--text);")}>Or calendar feed link</label>
        <input id="feed" className="hi-input" type="url" placeholder="https://byui.instructure.com/feeds/…" value={feed} onChange={(e) => setFeed(e.target.value)} style={sx(S.field)} />
        <span style={sx("font-size: 12px; line-height: 1.45; font-weight: 700; color: var(--text);")}>In Canvas: Calendar, then Calendar feed. Use this if tokens are turned off.</span>
      </div>
      <button type="button" onClick={() => run.mutate()} disabled={!ready || run.isPending}
        style={sx("min-height: 44px; border-radius: 22px; border: 0; background: var(--primary-bg); color: var(--primary-text); font-size: 14px; font-weight: 800; cursor: pointer;" + (!ready || run.isPending ? " opacity: 0.5; cursor: not-allowed;" : ""))}>
        {run.isPending ? "Importing…" : linked && !token && !feed ? "Import again" : "Import from Canvas"}
      </button>
      <ErrorNote error={run.error ?? disconnect.error} />
      <p style={sx("margin: 0; font-size: 12px; line-height: 1.5; font-weight: 700; color: var(--text);")}>Your token is stored encrypted and is only used to read your classes.</p>
      {linked && <button type="button" onClick={() => disconnect.mutate()} style={sx("align-self: flex-start; padding: 0; border: 0; background: transparent; color: var(--text-2); font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: underline;")}>Disconnect Canvas</button>}
    </section>
  );
}
