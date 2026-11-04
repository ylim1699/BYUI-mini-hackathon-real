import { useMutation } from "@tanstack/react-query";
import { addDays, format, isSameDay } from "date-fns";
import { useState } from "react";
import { Button, Card, Confirm, ErrorNote, inputCls, PageHeader, Spinner, Switch } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { useAll, useMe } from "../hooks/useData";
import { timeLabel } from "../lib/dates";
import { buildSyncPayload } from "../lib/syncPayload";
import { api } from "../services/api";
import { useUi } from "../store/ui";
import { ITEM_TYPES, removedSchema, syncResultSchema, TYPE_LABEL } from "../types/domain";

const UNITS: [string, number][] = [["w", 10080], ["d", 1440], ["h", 60], ["m", 1]];
export const fmtOffset = (m: number) => { for (const [u, n] of UNITS) if (m >= n && m % n === 0) return `${m / n}${u}`; return `${m}m`; };
export function parseOffsets(s: string): number[] | null {
  const parts = s.trim().split(/[\s,]+/).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const m = /^(\d+)\s*([wdhm])$/i.exec(p);
    if (!m) return null;
    const unit = UNITS.find(([u]) => u === m[2]!.toLowerCase());
    out.push(Number(m[1]) * (unit?.[1] ?? 1));
  }
  return out.slice(0, 5).sort((a, b) => b - a);
}

export function SyncPage() {
  const me = useMe();
  const data = useAll();
  const { emoji, semesterEnd, rules, set, notify } = useUi();
  const [askRemove, setAskRemove] = useState(false);
  const now = new Date();

  const payload = buildSyncPayload({
    courses: data.courses.filter((c) => c.confirmed), items: data.items, studyTimes: data.studyTimes, links: data.links,
    rules, now, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, emoji, semesterEnd: new Date(`${semesterEnd}T23:59`),
  });

  const sync = useMutation({
    mutationFn: () => api("/google/sync", syncResultSchema, payload),
    onSuccess: (r) => notify({ text: `Synced to "${r.calendar_name}": ${r.created} added, ${r.updated} updated, ${r.removed} removed${r.failed ? `, ${r.failed} failed` : ""}.` }),
  });
  const removeAll = useMutation({
    mutationFn: () => api("/google/remove-all", removedSchema, {}),
    onSuccess: (r) => notify({ text: r.removed ? "Removed the Syllabus Planner calendar from Google." : "There was nothing to remove." }),
  });

  const em = (k: string) => (emoji ? k : "");
  const preview = [0, 1].map((k) => {
    const day = addDays(now, k);
    const rows = [
      ...payload.classes.filter((c) => new Date(c.first_start).getDay() === day.getDay()).map((c) => ({ t: new Date(c.first_start).getHours() * 60 + new Date(c.first_start).getMinutes(), title: `${em("🏫 ")}Class: ${c.course_code} ${c.course_name}`, time: `${timeLabel(new Date(c.first_start))}–${timeLabel(new Date(c.first_end))}`, desc: "In-person class meeting." })),
      ...payload.study.filter((s) => isSameDay(new Date(s.start), day)).map((s) => ({ t: new Date(s.start).getHours() * 60 + new Date(s.start).getMinutes(), title: `${em("📚 ")}Study: ${s.course_code}`, time: `${timeLabel(new Date(s.start))}–${timeLabel(new Date(s.end))}`, desc: s.study_for.length ? `Study for: ${s.study_for.join("; ")}` : "Nothing picked yet." })),
      ...payload.due.filter((d) => isSameDay(new Date(d.due_at), day)).map((d) => ({ t: new Date(d.due_at).getHours() * 60 + new Date(d.due_at).getMinutes(), title: d.done ? `${em("✅ ")}Done: ${d.title}` : `${em("⏰ ")}Due: ${d.title}`, time: timeLabel(new Date(d.due_at)), desc: d.done ? "No reminders." : `Reminders ${d.reminders_min.map(fmtOffset).join(", ") || "none"} before.` })),
    ].sort((a, b) => a.t - b.t);
    return { label: k === 0 ? "Today" : "Tomorrow", day, rows };
  });

  if (data.loading) return <Spinner />;
  const google = me.data?.google;

  return (
    <>
      <PageHeader title="Reminders and sync" sub="Everything goes into its own “Syllabus Planner” calendar in your Google account." />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <Icon name="sync" />
              <h2 className="text-lg font-extrabold">Google Calendar</h2>
              <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${google ? "bg-[var(--c2-soft)] text-[var(--c2)]" : "bg-warn-bg text-warn"}`}>
                {me.isLoading ? "Checking…" : google ? "Connected" : "Not connected"}
              </span>
            </div>
            {!google && !me.isLoading && <p className="text-sm font-bold text-warn">Sign out and sign in with Google again, and allow the calendar permission.</p>}
            <p className="text-sm text-text-2">
              {payload.due.length} due dates, {payload.study.length} study blocks (next 3 weeks), {payload.classes.length} weekly class times.
              Syncing again updates what changed: done items get a ✅ and lose their reminders, and anything you deleted here is removed.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={!google || sync.isPending} onClick={() => sync.mutate()}>
                <Icon name="sync" size={16} />{sync.isPending ? "Syncing…" : "Sync now"}
              </Button>
              <Button variant="quiet" disabled={!google || removeAll.isPending} onClick={() => setAskRemove(true)}>Remove everything from Google</Button>
            </div>
            <ErrorNote error={sync.error ?? removeAll.error} />
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-extrabold">Settings</h2>
            <Switch label="Emoji in event titles" checked={emoji} onChange={(v) => set({ emoji: v })} />
            <label className="flex items-center justify-between gap-4 text-sm font-bold">
              Classes repeat until
              <input type="date" className={`${inputCls} w-44`} value={semesterEnd} onChange={(e) => e.target.value && set({ semesterEnd: e.target.value })} />
            </label>
          </Card>

          <Card>
            <h2 className="mb-1 text-lg font-extrabold">Reminders by type</h2>
            <p className="mb-3 text-sm text-text-2">How long before the due time. Use w, d, h, m, like “7d 2d 12h”. Up to 5.</p>
            <div className="space-y-2">
              {ITEM_TYPES.map((t) => <RuleRow key={t} label={TYPE_LABEL[t]} value={rules[t]} onSave={(v) => set({ rules: { ...rules, [t]: v } })} />)}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="mb-1 text-lg font-extrabold">Sync preview</h2>
          <p className="mb-4 text-sm text-text-2">What lands in your calendar, as it will look there.</p>
          {preview.map((p) => (
            <div key={p.label} className="mb-5">
              <h3 className="mb-2 text-sm font-extrabold">{p.label} <span className="text-text-2">· {format(p.day, "EEE, MMM d")}</span></h3>
              {!p.rows.length ? <p className="text-sm text-text-2">Nothing.</p> : (
                <ul className="space-y-2">
                  {p.rows.map((r, n) => (
                    <li key={n} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                      <p className="text-sm font-extrabold">{r.title}</p>
                      <p className="text-xs font-bold text-text-2">{r.time}</p>
                      <p className="mt-1 text-xs text-text-2">{r.desc}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Card>
      </div>

      <Confirm open={askRemove} danger title="Remove everything from Google?" yes="Remove" onClose={() => setAskRemove(false)}
        body="This deletes the Syllabus Planner calendar in Google. Your other calendars and events aren't touched, and your plan here stays. Sync again any time."
        onYes={() => removeAll.mutate()} />
    </>
  );
}

function RuleRow({ label, value, onSave }: { label: string; value: number[]; onSave: (v: number[]) => void }) {
  const [text, setText] = useState(value.map(fmtOffset).join(" "));
  const parsed = parseOffsets(text);
  return (
    <label className="flex items-center gap-3 text-sm font-bold">
      <span className="w-28">{label}</span>
      <input className={`${inputCls} flex-1 ${parsed ? "" : "border-[var(--warn-text)]"}`} value={text}
        onChange={(e) => setText(e.target.value)} onBlur={() => parsed && onSave(parsed)} aria-invalid={!parsed} />
    </label>
  );
}
