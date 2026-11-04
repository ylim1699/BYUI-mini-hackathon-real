import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Confirm, Dot, ErrorNote, inputCls, PageHeader } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { useCourses, useMe, useRefreshAll } from "../hooks/useData";
import { pdfToText } from "../lib/pdfText";
import { api, errorText } from "../services/api";
import * as db from "../services/db";
import { useUi } from "../store/ui";
import {
  COLORS, connectResultSchema, importResultSchema, okSchema, parsedSyllabusSchema, TYPE_LABEL, type ParsedSyllabus,
} from "../types/domain";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AddClassesPage() {
  return (
    <>
      <PageHeader title="Add your classes" sub="Import from Canvas, add a syllabus, or both. Everything goes to Review before it reaches your calendar." />
      <div className="grid gap-5 lg:grid-cols-2">
        <CanvasCard />
        <SyllabusCard />
      </div>
    </>
  );
}

function CanvasCard() {
  const me = useMe();
  const refresh = useRefreshAll();
  const notify = useUi((s) => s.notify);
  const nav = useNavigate();
  const [token, setToken] = useState("");
  const [feed, setFeed] = useState("");

  const connect = useMutation({
    mutationFn: () => api("/canvas/connect", connectResultSchema, token.trim() ? { token: token.trim() } : { feed_url: feed.trim() }),
    onSuccess: (r) => { setToken(""); setFeed(""); refresh(); notify({ text: r.name ? `Connected to Canvas as ${r.name}.` : "Canvas calendar feed connected." }); },
  });
  const importNow = useMutation({
    mutationFn: () => api("/canvas/import", importResultSchema, {}),
    onSuccess: (r) => {
      refresh();
      notify({ text: `Imported ${r.courses} classes and ${r.items} items.`, action: { label: "Review them", run: () => nav("/review") } });
    },
  });
  const disconnect = useMutation({ mutationFn: () => api("/canvas/disconnect", okSchema, {}), onSuccess: () => refresh() });

  const linked = me.data?.canvas;
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon name="school" className="text-[var(--c1)]" />
        <h2 className="text-lg font-extrabold">Import from Canvas</h2>
        {linked && <span className="ml-auto rounded-full bg-[var(--c2-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--c2)]">Connected ({linked === "token" ? "access token" : "calendar feed"})</span>}
      </div>

      {!linked ? (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); connect.mutate(); }}>
          <div>
            <label htmlFor="cv-token" className="text-[13px] font-bold text-text">Canvas access token (best)</label>
            <input id="cv-token" type="password" autoComplete="off" className={`${inputCls} mt-1.5 w-full`} value={token}
              onChange={(e) => setToken(e.target.value)} placeholder="Paste your token" />
            <p className="mt-1.5 text-xs font-bold text-text">In Canvas: Account → Settings → New access token. Gets classes, assignments, and syllabus pages.</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-text"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <div>
            <label htmlFor="cv-feed" className="text-[13px] font-bold text-text">Calendar feed link (backup)</label>
            <input id="cv-feed" type="url" className={`${inputCls} mt-1.5 w-full`} value={feed}
              onChange={(e) => setFeed(e.target.value)} placeholder="https://byui.instructure.com/feeds/calendars/…" />
            <p className="mt-1.5 text-xs font-bold text-text">In Canvas: Calendar → Calendar Feed. Due dates only, no syllabus pages.</p>
          </div>
          <Button variant="primary" type="submit" disabled={connect.isPending || (!token.trim() && !feed.trim())}>
            {connect.isPending ? "Connecting…" : "Connect Canvas"}
          </Button>
          <p className="text-xs font-bold text-text">Your token is encrypted on our server and never shown again. You can disconnect any time.</p>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => importNow.mutate()} disabled={importNow.isPending}>
            <Icon name="sync" size={16} />{importNow.isPending ? "Importing…" : "Import classes and due dates"}
          </Button>
          <Button variant="quiet" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>Disconnect</Button>
        </div>
      )}
      <ErrorNote error={connect.error ?? importNow.error ?? disconnect.error} />
    </Card>
  );
}

function SyllabusCard() {
  const courses = useCourses();
  const refresh = useRefreshAll();
  const { files, addFile, removeFile, restoreFile, notify } = useUi();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [reading, setReading] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedSyllabus | null>(null);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setReadErr(null); setParsed(null); setFileName(f.name);
    if (!/^.+\.(pdf|PDF)$/.test(f.name) && f.type !== "application/pdf") { setText(await f.text()); return; }
    setReading(true);
    try {
      const t = await pdfToText(f);
      if (t.length < 50) setReadErr("This PDF has almost no text (it may be a scan). Paste the syllabus text instead.");
      setText(t);
    } catch { setReadErr("Couldn't read that PDF. Paste the syllabus text instead."); }
    finally { setReading(false); }
  };

  const parse = useMutation({
    mutationFn: () => api("/syllabus/parse", parsedSyllabusSchema, { text: text.slice(0, 60_000), course_code: code.trim() || null }),
    onSuccess: setParsed,
  });

  const save = useMutation({
    mutationFn: async (p: ParsedSyllabus) => {
      const list = courses.data ?? [];
      const codeText = (p.course_code || code || "New class").trim();
      let course = list.find((c) => c.code.toLowerCase() === codeText.toLowerCase());
      if (!course) {
        const credits = p.credits ?? 3;
        course = await db.insertCourse({
          canvas_id: null, code: codeText, name: p.course_name ?? "", color: COLORS[list.length % COLORS.length] ?? "c1",
          credits, hours_per_week: credits * 2.5, online: p.online, meetings: p.meetings, confirmed: false, source: "syllabus",
        });
      } else if (!course.meetings.length && p.meetings.length) {
        await db.updateCourse(course.id, { meetings: p.meetings, online: p.online ?? course.online });
      }
      await db.insertItems(p.items.map((it) => ({
        course_id: course.id, title: it.title, type: it.type,
        due_at: it.due_date ? new Date(`${it.due_date}T${it.due_time ?? "23:59"}`).toISOString() : null,
        estimated_hours: 1, source: "syllabus", confidence: it.confidence, status: "todo", notes: it.note, deleted_at: null,
      })));
      return course;
    },
    onSuccess: (course) => {
      addFile({ id: `${Date.now()}`, name: fileName ?? `${course.code} syllabus (pasted)`, courseId: course.id, addedAt: new Date().toISOString() });
      setParsed(null); setText(""); setFileName(null); setCode("");
      refresh();
      notify({ text: `Added ${course.code} to Review.` });
    },
  });

  const courseOf = (id: string) => courses.data?.find((c) => c.id === id);

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon name="file" className="text-[var(--c3)]" />
        <h2 className="text-lg font-extrabold">Add a syllabus</h2>
      </div>
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line-strong bg-field px-4 py-6 text-center text-sm font-bold hover:border-[var(--c3)]">
        <span>{reading ? "Reading the PDF…" : fileName ?? "Choose a syllabus PDF"}</span>
        <span className="text-xs text-text-2">Read in your browser. Only the text is sent to the AI.</span>
        <input type="file" accept=".pdf,.txt,application/pdf,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <textarea className={`${inputCls} h-28 w-full resize-y font-semibold`} value={text} onChange={(e) => { setText(e.target.value); setParsed(null); }}
        placeholder="…or paste the syllabus text here" aria-label="Syllabus text" />
      <div className="flex flex-wrap gap-2">
        <input className={`${inputCls} w-44`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Class code (optional)" aria-label="Class code" />
        <Button variant="primary" onClick={() => parse.mutate()} disabled={parse.isPending || reading || text.trim().length < 50}>
          <Icon name="sparkle" size={16} />{parse.isPending ? "Reading with AI…" : "Find dates"}
        </Button>
      </div>
      {readErr && <ErrorNote error={readErr} />}
      <ErrorNote error={parse.error ? errorText(parse.error) : null} />

      {parsed && (
        <div className="rounded-xl border border-line-strong bg-surface-2 p-4">
          <p className="font-extrabold">{parsed.course_code ?? (code || "New class")} {parsed.course_name && <span className="text-text-2">· {parsed.course_name}</span>}</p>
          <p className="mt-1 text-xs font-bold text-text-2">
            {parsed.online ? "Online" : parsed.meetings.length ? parsed.meetings.map((m) => `${DAYS[m.day]} ${m.start}–${m.end}`).join(", ") : "No class times found"}
            {parsed.credits ? ` · ${parsed.credits} credits` : ""}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {parsed.items.map((it, n) => (
              <li key={n} className={`rounded-lg px-2 py-1.5 ${it.confidence < 0.7 ? "bg-[var(--flag-row)]" : ""}`}>
                <span className="font-bold">{it.title}</span> <span className="text-text-2">· {TYPE_LABEL[it.type]} · {it.due_date ?? "no date"}</span>
                {it.confidence < 0.7 && <span className="block text-xs font-bold text-warn">Check this: {it.note ?? "the date wasn't clear"}</span>}
              </li>
            ))}
            {!parsed.items.length && <li className="text-text-2">No dated items found.</li>}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={() => save.mutate(parsed)} disabled={save.isPending}>{save.isPending ? "Adding…" : "Add to Review"}</Button>
            <Button variant="quiet" onClick={() => setParsed(null)}>Cancel</Button>
          </div>
          <ErrorNote error={save.error} />
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-extrabold">Added syllabi</h3>
        {!files.length ? <p className="text-sm text-text-2">No syllabi added yet.</p> : (
          <ul className="space-y-1.5">
            {files.map((f) => {
              const c = courseOf(f.courseId);
              return (
                <li key={f.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm font-bold">
                  {c && <Dot color={c.color} />}
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  {c && <span className="text-xs text-text-2">{c.code}</span>}
                  <button aria-label={`Delete ${f.name}`} onClick={() => setDel({ id: f.id, name: f.name })} className="rounded p-1 text-text-2 hover:text-[var(--weekend)]">
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Confirm open={!!del} title={`Delete "${del?.name ?? ""}"?`} danger yes="Delete" onClose={() => setDel(null)}
        body="Items you already reviewed stay. You can restore the file from Recently deleted for 1 day."
        onYes={() => { if (!del) return; const id = del.id; removeFile(id); notify({ text: "Syllabus deleted.", undo: () => restoreFile(id) }); }} />
    </Card>
  );
}
