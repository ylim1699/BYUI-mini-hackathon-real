import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, isSameDay } from "date-fns";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Confirm, ErrorNote, Ico, P, PageHead, S, Spinner, SwitchTrack } from "../components/ui";
import { qk, useAll, useMe } from "../hooks/useData";
import { useAuth } from "../hooks/useAuth";
import { fmtT, offsetLabel } from "../lib/plan";
import { sx } from "../lib/sx";
import { buildSyncPayload } from "../lib/syncPayload";
import { api, errorText } from "../services/api";
import { useUi } from "../store/ui";
import { ITEM_TYPES, okSchema, removedSchema, startResultSchema, syncResultSchema, TYPE_LABEL, type ItemType } from "../types/domain";

type Provider = "google" | "outlook";
const NAMES: Record<Provider, string> = { google: "Google Calendar", outlook: "Outlook" };
const OFFSETS = [10080, 4320, 2880, 1440, 720, 180, 60, 30];
const NOTE: Partial<Record<ItemType, string>> = { exam: "Biggest lead time", project: "Team checkpoints", quiz: "Includes Canvas challenges" };


const hourOf = (iso: string) => { const d = new Date(iso); return d.getHours() + d.getMinutes() / 60; };

export function SyncPage() {
  const me = useMe();
  const data = useAll();
  const qc = useQueryClient();
  const { emoji, semesterEnd, rules, set, notify } = useUi();
  const { startOver } = useAuth();
  const [params, setParams] = useSearchParams();
  const [askRemove, setAskRemove] = useState<Provider | null>(null);
  const [askReset, setAskReset] = useState(false);
  const [adding, setAdding] = useState<ItemType | null>(null);
  const now = new Date();

  // Back from Google / Microsoft
  useEffect(() => {
    const cal = params.get("calendar") as Provider | null; const result = params.get("result");
    if (!cal || !result) return;
    const name = NAMES[cal] ?? "Calendar";
    notify({ text: result === "connected" ? `${name} connected. Send your schedule when you're ready.` : result === "cancelled" ? `${name} wasn't connected.` : `${name} didn't connect. Try again.` });
    qc.invalidateQueries({ queryKey: qk.me });
    setParams({}, { replace: true });
  }, [params, setParams, notify, qc]);

  const confirmed = data.courses.filter((c) => c.confirmed);
  const payload = buildSyncPayload({
    courses: confirmed, items: data.items, studyTimes: data.studyTimes, links: data.links,
    rules, now, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, emoji, semesterEnd: new Date(`${semesterEnd}T23:59`),
  });
  const connected = (["google", "outlook"] as Provider[]).filter((p) => me.data?.[p]);

  const connect = useMutation({
    mutationFn: async (p: Provider) => { const r = await api(`/${p}/start`, startResultSchema, {}); window.location.assign(r.url); },
  });
  const disconnect = useMutation({
    mutationFn: (p: Provider) => api(`/${p}/disconnect`, okSchema, {}),
    onSuccess: (_r, p) => { qc.invalidateQueries({ queryKey: qk.me }); notify({ text: `${NAMES[p]} disconnected. Events already sent stay until you remove them.` }); },
  });
  const send = useMutation({
    mutationFn: async () => {
      const out: string[] = [];
      for (const p of connected) {
        try {
          const r = await api(`/${p}/sync`, syncResultSchema, payload);
          out.push(`${NAMES[p]}: ${r.created} added, ${r.updated} updated, ${r.removed} removed${r.failed ? `, ${r.failed} failed` : ""}`);
        } catch (e) { out.push(`${NAMES[p]}: ${errorText(e)}`); }
      }
      return out.join(". ") + ".";
    },
    onSuccess: (text) => notify({ text }),
  });
  const removeAll = useMutation({
    mutationFn: (p: Provider) => api(`/${p}/remove-all`, removedSchema, {}),
    onSuccess: (r, p) => notify({ text: r.removed ? `Removed the Syllabus Planner calendar from ${NAMES[p]}.` : `Nothing to remove from ${NAMES[p]}.` }),
  });

  const em = (k: string) => (emoji ? k : "");
  const colorOf = (code: string) => { const c = confirmed.find((x) => x.code === code); return c ? `var(--${c.color})` : "var(--study-line)"; };
  const preview = [0, 1].map((k) => {
    const day = addDays(now, k);
    const ev = [
      ...payload.study.filter((s) => isSameDay(new Date(s.start), day)).map((s) => ({ t: hourOf(s.start), code: s.course_code, title: `${em("📚 ")}Study: ${s.course_code}`, time: `${fmtT(hourOf(s.start))} to ${fmtT(hourOf(s.end))}`, desc: s.study_for.length ? `Study for: ${s.study_for.join("; ")}` : "Nothing picked yet. Open this block in the app and star what you'll work on." })),
      ...payload.classes.filter((c) => new Date(c.first_start).getDay() === day.getDay()).map((c) => ({ t: hourOf(c.first_start), code: c.course_code, title: `${em("🏫 ")}Class: ${c.course_code} ${c.course_name}`, time: `${fmtT(hourOf(c.first_start))} to ${fmtT(hourOf(c.first_end))}`, desc: "In-person class meeting." })),
      ...payload.due.filter((d) => isSameDay(new Date(d.due_at), day)).map((d) => ({ t: hourOf(d.due_at), code: d.course_code, title: d.done ? `${em("✅ ")}Done: ${d.title}` : `${em("⏰ ")}Due: ${d.title}`, time: fmtT(hourOf(d.due_at)), desc: d.done ? `${d.course_code} ${d.type}. Done, so no reminders.` : `${d.course_code} ${d.type}. Reminders follow your settings for ${TYPE_LABEL[d.type].toLowerCase()}s.` })),
    ].sort((a, b) => a.t - b.t);
    return { label: (k === 0 ? "Today, " : "Tomorrow, ") + day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), ev };
  });

  if (data.loading) return <Spinner />;
  const sendLabel = `Send ${payload.due.length} items, ${payload.study.length} study blocks${payload.classes.length ? ` and ${payload.classes.length} class times` : ""}`;

  return (
    <div className="anim-page" style={sx("display: flex; flex-direction: column; gap: 16px;")}>
      <PageHead title="Reminders and sync" sub="Choose how far ahead you're reminded for each kind of work, and where your schedule goes." />
      <div style={sx("display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start;")}>
        <section style={sx("flex: 999 1 520px; min-width: 0; padding: 18px; display: flex; flex-direction: column; " + S.card)}>
          <h2 style={sx("margin: 0 0 8px; font-size: 18px; font-weight: 800;")}>Reminders by type</h2>
          {ITEM_TYPES.map((t) => {
            const offs = rules[t] ?? [];
            const free = OFFSETS.filter((m) => !offs.includes(m));
            return (
              <div key={t} style={sx("display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 0; border-top: 1px solid var(--line);")}>
                <div style={sx("flex: 0 0 160px; display: flex; flex-direction: column; gap: 2px;")}>
                  <span style={sx("font-size: 14px; font-weight: 800;")}>{TYPE_LABEL[t]}</span>
                  <span style={sx("font-size: 12px; color: var(--muted);")}>{NOTE[t] ?? ""}</span>
                </div>
                <div style={sx("flex: 1 1 260px; display: flex; flex-wrap: wrap; gap: 8px; position: relative;")}>
                  {offs.map((m) => (
                    <span key={m} style={sx("display: inline-flex; align-items: center; gap: 2px; min-height: 34px; padding: 0 4px 0 12px; border-radius: 17px; background: var(--surface-2); border: 1px solid var(--line); font-size: 13px; font-weight: 700;")}>
                      {offsetLabel(m)}
                      <button type="button" aria-label={`Remove ${offsetLabel(m)} reminder for ${TYPE_LABEL[t]}`} onClick={() => set({ rules: { ...rules, [t]: offs.filter((x) => x !== m) } })}
                        style={sx("width: 26px; height: 26px; border: 0; border-radius: 13px; background: transparent; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center;")}>
                        <Ico d={P.x} size={12} sw={2.6} />
                      </button>
                    </span>
                  ))}
                  {!offs.length && <span style={sx("align-self: center; font-size: 13px; color: var(--muted);")}>No reminders</span>}
                  {offs.length < 5 && free.length > 0 && (
                    <button type="button" aria-expanded={adding === t} onClick={() => setAdding(adding === t ? null : t)}
                      style={sx("display: inline-flex; align-items: center; gap: 4px; min-height: 34px; padding: 0 12px; border-radius: 17px; border: 1px dashed var(--line-strong); background: transparent; font-size: 13px; font-weight: 700; color: var(--text-2); cursor: pointer;")}>
                      <Ico d={P.plus} size={13} sw={2.4} />Add
                    </button>
                  )}
                  {adding === t && (
                    <>
                      <div aria-hidden="true" onClick={() => setAdding(null)} style={sx("position: fixed; inset: 0; z-index: 38;")} />
                      <div role="menu" className="anim-pop" style={sx("position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; display: flex; flex-direction: column; gap: 2px; padding: 6px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: var(--shadow);")}>
                        {free.map((m) => (
                          <button key={m} type="button" role="menuitem" onClick={() => { set({ rules: { ...rules, [t]: [...offs, m].sort((a, b) => b - a) } }); setAdding(null); }}
                            style={sx("padding: 8px 12px; border: 0; border-radius: 8px; background: transparent; color: var(--text); font-size: 13px; font-weight: 700; text-align: left; cursor: pointer;")}>{offsetLabel(m)}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <p style={sx("margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: var(--muted);")}>Outlook allows one reminder per event, so it gets the earliest one.</p>
        </section>

        <div style={sx("flex: 1 1 300px; min-width: 0; display: flex; flex-direction: column; gap: 16px;")}>
          <section style={sx("padding: 18px; display: flex; flex-direction: column; gap: 12px; " + S.card)}>
            <h2 style={sx("margin: 0; font-size: 18px; font-weight: 800;")}>Calendars</h2>
            {(["google", "outlook"] as Provider[]).map((p) => {
              const on = !!me.data?.[p];
              return (
                <div key={p} style={sx("display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--line);")}>
                  <div style={sx("display: flex; align-items: center; gap: 12px;")}>
                    <div style={sx("flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px;")}>
                      <span style={sx("font-size: 14px; font-weight: 800;")}>{NAMES[p]}</span>
                      <span style={sx("font-size: 12px; color: " + (on ? "var(--ok)" : "var(--muted)") + ";")}>{me.isLoading ? "Checking…" : on ? "Connected" : "Not connected"}</span>
                    </div>
                    <button type="button" disabled={connect.isPending || disconnect.isPending} onClick={() => (on ? disconnect.mutate(p) : connect.mutate(p))} style={sx(on ? S.smallOutline : S.smallSolid)}>
                      {on ? "Disconnect" : connect.isPending && connect.variables === p ? "Opening…" : "Connect"}
                    </button>
                  </div>
                  {on && (
                    <button type="button" onClick={() => setAskRemove(p)} style={sx("align-self: flex-start; padding: 0; border: 0; background: transparent; color: var(--text-2); font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: underline;")}>
                      Remove everything this app added
                    </button>
                  )}
                </div>
              );
            })}
            <label style={sx("display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; font-weight: 700;")}>
              Classes repeat until
              <input type="date" value={semesterEnd} onChange={(e) => e.target.value && set({ semesterEnd: e.target.value })}
                style={sx("min-height: 38px; box-sizing: border-box; padding: 0 10px; border-radius: 12px; border: 1px solid var(--line-strong); background: var(--field); font-size: 13px; color: var(--text);")} />
            </label>
            <p style={sx("margin: 0; font-size: 12px; line-height: 1.5; color: var(--muted);")}>Events go into a separate "Syllabus Planner" calendar, so your own events are never changed. Sending again updates what changed: done items get a ✅ and lose their reminders.</p>
            <button type="button" onClick={() => send.mutate()} disabled={!connected.length || send.isPending}
              style={sx("min-height: 44px; border-radius: 22px; border: 0; background: var(--primary-bg); color: var(--primary-text); font-size: 14px; font-weight: 700; cursor: pointer;" + (!connected.length || send.isPending ? " opacity: 0.5; cursor: not-allowed;" : ""))}>
              {send.isPending ? "Sending…" : sendLabel}
            </button>
            {!connected.length && !me.isLoading && <span style={sx("font-size: 12px; color: var(--muted);")}>Connect a calendar first.</span>}
            {!confirmed.length && <span style={sx("font-size: 12px; color: var(--warn-text); font-weight: 700;")}>Confirm a class in Review to send it.</span>}
            <ErrorNote error={connect.error ?? disconnect.error ?? send.error ?? removeAll.error} />
          </section>

          <section aria-label="Sync preview" style={sx("padding: 18px; display: flex; flex-direction: column; gap: 12px; " + S.card)}>
            <div style={sx("display: flex; flex-direction: column; gap: 4px;")}>
              <h2 style={sx("margin: 0; font-size: 18px; font-weight: 800;")}>Sync preview</h2>
              <span style={sx("font-size: 12px; line-height: 1.5; color: var(--text-2);")}>This is how events will look in Google Calendar or Outlook.</span>
            </div>
            <button type="button" role="switch" aria-checked={emoji} onClick={() => set({ emoji: !emoji })}
              style={sx("display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); color: var(--text); cursor: pointer; text-align: left;")}>
              <span style={sx("flex: 1 1 auto; display: flex; flex-direction: column; gap: 1px;")}>
                <span style={sx("font-size: 13px; font-weight: 700;")}>Emoji in event titles</span>
                <span style={sx("font-size: 12px; color: var(--text-2);")}>📚 study, 🏫 class, ⏰ due date</span>
              </span>
              <SwitchTrack on={emoji} />
            </button>
            {preview.map((d) => (
              <div key={d.label} style={sx("display: flex; flex-direction: column; gap: 6px;")}>
                <span style={sx("font-size: 12px; font-weight: 800; color: var(--text-2);")}>{d.label}</span>
                {d.ev.map((e, n) => (
                  <div key={n} style={sx("display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--line); border-left: 4px solid " + colorOf(e.code) + ";")}>
                    <div style={sx("display: flex; align-items: baseline; justify-content: space-between; gap: 8px;")}>
                      <span style={sx("font-size: 13px; font-weight: 800; overflow-wrap: anywhere;")}>{e.title}</span>
                      <span style={sx("flex-shrink: 0; font-size: 11px; font-weight: 700; color: var(--text-2);")}>{e.time}</span>
                    </div>
                    <span style={sx("font-size: 12px; line-height: 1.45; color: var(--text-2);")}>{e.desc}</span>
                  </div>
                ))}
                {!d.ev.length && <span style={sx("font-size: 12px; color: var(--muted);")}>No events.</span>}
              </div>
            ))}
          </section>

          <section style={sx("padding: 18px; display: flex; flex-direction: column; gap: 10px; " + S.card)}>
            <h2 style={sx("margin: 0; font-size: 16px; font-weight: 800;")}>Start over</h2>
            <span style={sx("font-size: 13px; line-height: 1.5; color: var(--text-2);")}>Your plan is saved for this browser. Starting over clears it here and returns to the start screen.</span>
            <button type="button" onClick={() => setAskReset(true)} style={sx(S.smallOutline + " align-self: flex-start; border-color: var(--weekend); color: var(--weekend);")}>Start over</button>
          </section>
        </div>
      </div>

      <Confirm open={!!askRemove} danger yes="Remove" title={`Remove everything from ${askRemove ? NAMES[askRemove] : ""}?`} onClose={() => setAskRemove(null)}
        body="This deletes the Syllabus Planner calendar there. Your other calendars and events aren't touched, and your plan here stays. You can send it again any time."
        onYes={() => askRemove && removeAll.mutate(askRemove)} />
      <Confirm open={askReset} danger yes="Start over" title="Start over?" onClose={() => setAskReset(false)}
        body="Your classes, items, and study times in this browser will be cleared. Events already sent to your calendars stay until you remove them above."
        onYes={() => { qc.clear(); void startOver(); }} />
    </div>
  );
}
