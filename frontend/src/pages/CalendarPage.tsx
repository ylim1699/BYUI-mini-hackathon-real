import { addDays, addMonths } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BlockDialog, ItemDetail, type BlockSel } from "../components/calendar/Dialogs";
import { ALARM, BOOK, cardOf, SCHOOL, slotStyles } from "../components/calendar/shared";
import { AiSummary, Overview } from "../components/calendar/Side";
import { ErrorNote, Ico, P, S, Spinner, SwitchTrack } from "../components/ui";
import { useAll } from "../hooks/useData";
import { dayKey } from "../lib/dates";
import { AN, col, dotStyle, fmtDay, fmtT, groupByDay, hm, liveLinks, overlapColumns, pill, planItems, slotsOn, type PlanItem, type Slot } from "../lib/plan";
import { sx } from "../lib/sx";
import { useUi } from "../store/ui";
import type { Course } from "../types/domain";

type Show = "todo" | "all" | "done" | "none";
const ZOOMS = [0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.75];
const HEADS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const SHOW_OPTS: [Show, string, string][] = [
  ["todo", "To do", "Only what still needs doing. This is the default."],
  ["all", "Everything", "Finished and unfinished assignments"],
  ["done", "Done", "Only what you have finished"],
  ["none", "No assignments", "Just your classes and study time"],
];
const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

export function CalendarPage() {
  const data = useAll();
  const nav = useNavigate();
  const { view, zoomIdx, set } = useUi();
  const [off, setOff] = useState({ day: 0, week: 0, month: 0 });
  const [filter, setFilter] = useState<string>("all");
  const [show, setShow] = useState<Show>("todo");
  const [studyShown, setStudyShown] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [block, setBlock] = useState<BlockSel | null>(null);
  const [studyTab, setStudyTab] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => { const t = setInterval(() => setNowTick(Date.now()), 60_000); return () => clearInterval(t); }, []);
  // Ctrl/Cmd + scroll over the calendar zooms it (from the prototype)
  useEffect(() => {
    let last = 0;
    const wheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !(e.target as HTMLElement)?.closest?.(".cal-scroll")) return;
      e.preventDefault();
      if (Date.now() - last < 90) return; last = Date.now();
      const z = useUi.getState().zoomIdx;
      useUi.getState().set({ zoomIdx: Math.max(0, Math.min(ZOOMS.length - 1, z + (e.deltaY < 0 ? 1 : -1))) });
    };
    document.addEventListener("wheel", wheel, { passive: false });
    return () => document.removeEventListener("wheel", wheel);
  }, []);

  const now = new Date(nowTick);
  const todayKey = dayKey(now);
  const all = useMemo(() => planItems(data.items, data.courses, now), [data.items, data.courses, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const byDay = useMemo(() => groupByDay(all), [all]);
  const byId = useMemo(() => new Map(all.map((i) => [i.id, i])), [all]);
  const anim = AN(tick);
  const bump = () => setTick((t) => t + 1);

  if (data.loading) return <Spinner />;
  if (!data.courses.length) {
    return (
      <div className="anim-page" style={sx("display: flex; flex-direction: column; gap: 16px;")}>
        <section style={sx(S.card + " padding: 28px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; max-width: 560px;")}>
          <h1 style={sx("margin: 0; font-size: 22px; font-weight: 800;")}>Your calendar is empty</h1>
          <span style={sx("font-size: 14px; line-height: 1.55; color: var(--text-2);")}>Add a syllabus PDF or import from Canvas. Once you check the dates, they show up here with your study time and class times.</span>
          <button type="button" onClick={() => nav("/add")} style={sx(S.primary)}>Add your classes</button>
        </section>
      </div>
    );
  }

  const pass = (c: Course) => filter === "all" || c.id === filter;
  const passShow = (it: PlanItem) => (show === "all" ? true : show === "todo" ? !it.done : show === "done" ? it.done : false);
  const visible = (it: PlanItem) => pass(it.course) && passShow(it);
  const itemsOn = (d: Date) => byDay.get(dayKey(d)) ?? [];
  const slots = (d: Date) => (studyShown ? slotsOn(d, data.studyTimes, data.courses).filter((sl) => pass(sl.course)) : []);
  const classesOn = (d: Date) => data.courses.filter((c) => c.confirmed && c.online === false && pass(c))
    .flatMap((c) => c.meetings.filter((m) => m.day === d.getDay()).map((m) => ({ c, s: hm(m.start), e: hm(m.end) })));
  const forLine = (sl: Slot) => { const L = liveLinks(sl.id, data.links, byId); return L.length ? "For: " + L.map((x) => x.title).join(", ") : ""; };
  const openBlock = (sl: Slot) => setBlock({ course: sl.course, key: sl.key, s: sl.s, e: sl.e, id: sl.id });
  const open = (id: string) => setSelected(id);

  // ----- titles and navigation -----
  const monthDate = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), off.month);
  const weekStart = addDays(monday(now), 7 * off.week);
  const dayDate = addDays(now, off.day);
  const fd = (x: Date) => fmtDay(x, { month: "short", day: "numeric" });
  const title = view === "day" ? fmtDay(dayDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : view === "month" ? fmtDay(monthDate, { month: "long", year: "numeric" })
      : fd(weekStart) + " to " + fd(addDays(weekStart, 6)) + ", " + addDays(weekStart, 6).getFullYear();
  const step = (n: number) => { setOff((o) => ({ ...o, [view]: o[view] + n })); setOpenDay(null); setStudyTab(0); bump(); };
  const notOnToday = off[view] !== 0;
  const unit = view === "day" ? "day" : view === "month" ? "month" : "week";

  // hidden count (items filtered out by Show)
  const rangeDays = view === "month"
    ? Array.from({ length: 42 }, (_, k) => addDays(monday(monthDate), k)).filter((d) => d.getMonth() === monthDate.getMonth())
    : view === "week" ? Array.from({ length: 7 }, (_, k) => addDays(weekStart, k)) : [];
  const hidden = rangeDays.reduce((n, d) => n + itemsOn(d).filter((it) => pass(it.course) && !passShow(it)).length, 0);

  const zBtn = (offd: boolean) => "width: 32px; height: 32px; padding: 0; border: 0; border-radius: 16px; background: transparent; display: flex; align-items: center; justify-content: center; " + (offd ? "color: var(--muted); opacity: 0.45; cursor: default;" : "color: var(--text); cursor: pointer;");
  const zoom = ZOOMS[zoomIdx] ?? 1;
  const sel = selected ? byId.get(selected) : undefined;

  return (
    <div className="anim-page" style={sx("display: flex; flex-direction: column; gap: 16px;")}>
      <ErrorNote error={data.error} />
      {/* toolbar */}
      <div style={sx("position: relative; z-index: 30; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;")}>
        <div role="group" aria-label="View" className="frost" style={sx("display: flex; padding: 3px; border-radius: 22px; border: 1px solid var(--line-strong); background: var(--surface);")}>
          {(["day", "week", "month"] as const).map((v) => (
            <button key={v} type="button" onClick={() => { set({ view: v }); bump(); }} aria-pressed={view === v} style={sx(pill(view === v))}>{v[0]!.toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
        <div className="frost" style={sx("flex: 1 1 420px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-height: 44px; padding: 3px 3px 3px 8px; box-sizing: border-box; border-radius: 22px; border: 1px solid var(--line-strong); background: var(--surface);")}>
          <div role="group" aria-label="Filter by class" style={sx("flex: 1 1 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 4px;")}>
            {[{ k: "all", label: "All classes", c: null as Course | null }, ...data.courses.map((c) => ({ k: c.id, label: c.code, c }))].map((f) => (
              <button key={f.k} type="button" onClick={() => { setFilter(f.k); bump(); }} aria-pressed={filter === f.k} style={sx(pill(filter === f.k))}>
                {f.c && <span aria-hidden="true" style={sx(dotStyle(f.c))} />}{f.label}
              </button>
            ))}
          </div>
          <span aria-hidden="true" style={sx("width: 1px; height: 24px; background: var(--line-strong); margin: 0 4px;")} />
          <div style={sx("position: relative;")}>
            <button type="button" onClick={() => setShowMenu(!showMenu)} aria-haspopup="true" aria-expanded={showMenu} aria-controls="show-menu"
              style={sx("display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 12px; border: 0; border-radius: 18px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; " + (showMenu || show !== "todo" || !studyShown ? "background: var(--surface-3); color: var(--text);" : "background: transparent; color: var(--text-2);"))}>
              <Ico d={P.filter} size={15} />
              <span>Show: {{ all: "Everything", todo: "To do", done: "Done", none: "No assignments" }[show]}{studyShown ? "" : ", no study time"}</span>
              <Ico d={P.chevron} size={13} sw={2.4} style={"transition: transform .25s ease;" + (showMenu ? " transform: rotate(180deg);" : "")} />
            </button>
            {showMenu && (
              <>
                <div aria-hidden="true" onClick={() => setShowMenu(false)} style={sx("position: fixed; inset: 0; z-index: 38;")} />
                <div id="show-menu" className="anim-pop" style={sx("position: absolute; right: 0; top: calc(100% + 8px); z-index: 40; width: 300px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 12px; display: flex; flex-direction: column; gap: 10px; border-radius: 16px; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: var(--shadow); color: var(--text); transform-origin: top right;")}>
                  <p style={sx("margin: 0; font-size: 12px; line-height: 1.45; color: var(--text-2);")}>Choose what shows on your calendar. The class buttons on the left still pick which classes.</p>
                  <span id="show-items-label" style={sx("font-size: 11px; font-weight: 800; color: var(--muted);")}>Assignments</span>
                  <div role="radiogroup" aria-labelledby="show-items-label" style={sx("display: flex; flex-direction: column; gap: 4px;")}>
                    {SHOW_OPTS.map(([k, label, desc]) => (
                      <button key={k} type="button" role="radio" aria-checked={show === k} onClick={() => { setShow(k); bump(); }}
                        style={sx("display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; box-sizing: border-box; border-radius: 10px; border: 0; color: var(--text); cursor: pointer; " + (show === k ? "background: var(--surface-3);" : "background: transparent;"))}>
                        <span style={sx("flex: 1 1 auto; display: flex; flex-direction: column; gap: 1px; text-align: left;")}>
                          <span style={sx("font-size: 13px; font-weight: 700;")}>{label}</span>
                          <span style={sx("font-size: 12px; color: var(--text-2);")}>{desc}</span>
                        </span>
                        {show === k && <Ico d={P.check} size={15} sw={2.6} />}
                      </button>
                    ))}
                  </div>
                  <div style={sx("height: 1px; background: var(--line);")} />
                  <button type="button" role="switch" aria-checked={studyShown} onClick={() => { setStudyShown(!studyShown); bump(); }}
                    style={sx("display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; box-sizing: border-box; border-radius: 10px; border: 0; background: transparent; color: var(--text); text-align: left; cursor: pointer;")}>
                    <span style={sx("flex: 1 1 auto; display: flex; flex-direction: column; gap: 1px;")}>
                      <span style={sx("font-size: 13px; font-weight: 700;")}>Study time</span>
                      <span style={sx("font-size: 12px; color: var(--text-2);")}>Class-colored blocks of time set aside to study</span>
                    </span>
                    <SwitchTrack on={studyShown} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={sx("display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start;")}>
        <section style={sx("flex: 999 1 700px; min-width: 0; display: flex; flex-direction: column; gap: 10px;")}>
          <div className="cal-head" style={sx("display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 8px;")}>
            <div style={sx("display: flex; align-items: center; gap: 4px;")}>
              <button type="button" onClick={() => step(-1)} aria-label={`Previous ${unit}`} title={`Previous ${unit}`} style={sx("width: 40px; height: 40px; border: 0; border-radius: 20px; background: transparent; color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center;")}><Ico d={P.left} size={18} /></button>
              {notOnToday && <button type="button" onClick={() => { setOff({ day: 0, week: 0, month: 0 }); bump(); }} style={sx("min-height: 32px; padding: 0 12px; border-radius: 16px; border: 1px solid var(--line-strong); background: transparent; color: var(--text); font-size: 12px; font-weight: 700; cursor: pointer;")}>Today</button>}
            </div>
            <h1 className="on-bg" style={sx("margin: 0; display: flex; align-items: baseline; gap: 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.01em; white-space: nowrap;")}>
              {title}
              {view !== "day" && hidden > 0 && <span style={sx("font-size: 14px; font-weight: 700; color: var(--muted);")}>+{hidden} hidden</span>}
            </h1>
            <div style={sx("display: flex; justify-content: flex-end; align-items: center; gap: 6px;")}>
              <div role="group" aria-label="Calendar size" className="frost cal-zoom" style={sx("display: flex; align-items: center; padding: 3px; border-radius: 20px; border: 1px solid var(--line-strong); background: var(--surface);")}>
                <button type="button" onClick={() => set({ zoomIdx: Math.max(0, zoomIdx - 1) })} disabled={zoomIdx === 0} aria-label="Make calendar smaller" title="Smaller" style={sx(zBtn(zoomIdx === 0))}><Ico d={P.minus} size={16} sw={2.2} /></button>
                <button type="button" onClick={() => set({ zoomIdx: 2 })} aria-label="Reset calendar size" title="Reset size" style={sx("min-width: 54px; height: 32px; border: 0; border-radius: 16px; background: transparent; color: var(--text); font-size: 12px; font-weight: 700; cursor: pointer;")}>{Math.round(zoom * 100)}%</button>
                <button type="button" onClick={() => set({ zoomIdx: Math.min(ZOOMS.length - 1, zoomIdx + 1) })} disabled={zoomIdx === ZOOMS.length - 1} aria-label="Make calendar bigger" title="Bigger" style={sx(zBtn(zoomIdx === ZOOMS.length - 1))}><Ico d={P.plus} size={16} sw={2.2} /></button>
              </div>
              <button type="button" onClick={() => step(1)} aria-label={`Next ${unit}`} title={`Next ${unit}`} style={sx("width: 40px; height: 40px; border: 0; border-radius: 20px; background: transparent; color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center;")}><Ico d={P.right} size={18} /></button>
            </div>
          </div>

          {view === "month" && (
            <MonthView key={"m" + tick} monthDate={monthDate} zoom={zoom} todayKey={todayKey} anim={anim} openDay={openDay} setOpenDay={setOpenDay}
              itemsOn={(d) => itemsOn(d).filter(visible)} slots={slots} classesOn={classesOn} open={open} openBlock={openBlock} />
          )}
          {view === "week" && (
            <WeekView key={"w" + tick} weekStart={weekStart} zoom={zoom} todayKey={todayKey} anim={anim} expanded={expanded} setExpanded={setExpanded}
              itemsOn={(d) => itemsOn(d).filter(visible)} slots={slots} classesOn={classesOn} forLine={forLine} open={open} openBlock={openBlock} />
          )}
          {view === "day" && (
            <DayView key={"d" + tick} d={dayDate} zoom={zoom} now={now} todayKey={todayKey} anim={anim} studyTab={studyTab} setStudyTab={setStudyTab}
              items={itemsOn(dayDate).filter(visible)} allItems={all} slots={slots(dayDate)} classes={classesOn(dayDate)} forLine={forLine} open={open} openBlock={openBlock} />
          )}

          <div aria-label="Calendar key" className="frost" style={sx("display: flex; flex-wrap: wrap; align-items: center; gap: 10px 22px; padding: 12px 16px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); font-size: 13px; font-weight: 600; color: var(--text);")}>
            <span style={sx("font-weight: 800; color: var(--text);")}>Key</span>
            <span style={sx("display: inline-flex; align-items: center; gap: 9px;")}><span aria-hidden="true" style={sx("display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; box-sizing: border-box; border-radius: 6px; background: var(--panel); border: 1px solid var(--line-strong); color: var(--text); font-size: 11px; font-weight: 800;")}><Ico d={ALARM} size={13} sw={2.2} />Due</span>Assignment, at its due time</span>
            <span style={sx("display: inline-flex; align-items: center; gap: 9px;")}><span aria-hidden="true" style={sx("display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; box-sizing: border-box; border-radius: 6px; background: var(--c1-block); border: 1px solid var(--c1-soft); color: var(--text); font-size: 11px; font-weight: 800;")}><Ico d={BOOK} size={13} />Study</span>Study time, filled in the class color</span>
            <span style={sx("display: inline-flex; align-items: center; gap: 9px;")}><span aria-hidden="true" style={sx("display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; box-sizing: border-box; border-radius: 6px; background: var(--class-bg); border: 1px solid var(--c1); border-left: 3px solid var(--c1); color: var(--text); font-size: 11px; font-weight: 800;")}><Ico d={SCHOOL} size={13} />Class</span>In-person class, outlined in the class color</span>
          </div>
        </section>

        <aside style={sx("flex: 1 1 290px; min-width: 0; display: flex; flex-direction: column; gap: 12px;")}>
          <AiSummary items={all} courses={data.courses} studyTimes={data.studyTimes} />
          <Overview items={all} courses={data.courses} studyTimes={data.studyTimes} onOpen={open} />
        </aside>
      </div>

      {sel && <ItemDetail key={sel.id} it={sel} onClose={() => setSelected(null)} />}
      {block && !sel && <BlockDialog sel={block} items={all} links={data.links} onClose={() => setBlock(null)} onOpenItem={open} />}
    </div>
  );
}

// ---------- Month ----------

function MonthView({ monthDate, zoom, todayKey, anim, openDay, setOpenDay, itemsOn, slots, classesOn, open, openBlock }: {
  monthDate: Date; zoom: number; todayKey: string; anim: string; openDay: string | null; setOpenDay: (k: string | null) => void;
  itemsOn: (d: Date) => PlanItem[]; slots: (d: Date) => Slot[]; classesOn: (d: Date) => { c: Course; s: number; e: number }[];
  open: (id: string) => void; openBlock: (sl: Slot) => void;
}) {
  const lead = (monthDate.getDay() + 6) % 7;
  const daysIn = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const count = Math.ceil((lead + daysIn) / 7) * 7;
  const cells = Array.from({ length: count }, (_, k) => new Date(monthDate.getFullYear(), monthDate.getMonth(), 1 - lead + k));

  return (
    <div className="anim-view cal-scroll" style={sx("overflow: auto; max-height: calc(100vh - 230px); min-height: 360px; padding: 0 10px 4px; margin: 0 -10px; overscroll-behavior: contain;")}>
      <div style={sx(`min-width: 760px; zoom: ${zoom};`)}>
        <div style={sx("position: sticky; top: 0; z-index: 7; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; padding: 8px 0; margin-bottom: 4px; border-bottom: 1px solid var(--line-strong); background: var(--rail-bg); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);")}>
          {HEADS.map((h, i) => <span key={h} style={sx("text-shadow: var(--onbg-shadow, none); text-align: center; font-size: 13px; font-weight: 800; letter-spacing: 0.04em; color: " + (i >= 5 ? "var(--weekend)" : "var(--text-2)") + ";")}>{h}</span>)}
        </div>
        <div style={sx("display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px;")}>
          {cells.map((d) => {
            const key = dayKey(d); const isToday = key === todayKey; const inMonth = d.getMonth() === monthDate.getMonth();
            const vis = itemsOn(d); const sl = slots(d); const cl = classesOn(d);
            const has = vis.length > 0 || sl.length > 0;
            const isOpen = openDay === key && has;
            const pop = fmtDay(d, { weekday: "short", month: "short", day: "numeric" });
            return (
              <div key={key} style={sx("position: relative; min-height: 120px; box-sizing: border-box; padding: 8px; display: flex; flex-direction: column; gap: 5px; border-radius: 6px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); " + (isToday ? "background: var(--today);" : "background: var(--surface);") + (isOpen ? " z-index: 5;" : ""))}>
                <div style={sx("display: flex; align-items: center; gap: 4px;")}>
                  <span style={sx("font-size: 15px; font-weight: 800; color: " + (!inMonth ? "var(--muted)" : d.getDay() === 0 ? "var(--weekend)" : "var(--text)") + ";" + (key < todayKey && !isToday ? " opacity: 0.7;" : ""))}>{d.getDate()}</span>
                  {isToday && <span role="img" aria-label="Today" style={sx("width: 5px; height: 5px; border-radius: 50%; background: var(--text);")} />}
                  <span style={sx("flex-grow: 1;")} />
                  {has && (
                    <>
                      {vis.length > 0 && <span style={sx("font-size: 12px; font-weight: 600; color: var(--muted); margin-right: 2px;")}>{vis.length}</span>}
                      <button type="button" onClick={() => setOpenDay(key)} aria-label={"Show all items for " + fmtDay(d, { month: "long", day: "numeric" })}
                        style={sx("width: 24px; height: 24px; padding: 0; border: 0; border-radius: 12px; background: transparent; color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center;")}><Ico d={P.expand} size={14} sw={2.2} /></button>
                    </>
                  )}
                </div>
                {vis.slice(0, 2).map((it) => { const cd = cardOf(it, anim); return (
                  <button key={it.id} type="button" onClick={() => open(it.id)} aria-label={cd.aria} title={cd.full} className="lift" style={sx(cd.style)}>
                    <span aria-hidden="true" style={sx(cd.iconWrap)}><Ico d={cd.icon} size={12} /></span>
                    <span className="clamp" style={sx(cd.textStyle)}>{it.title}</span>
                    <Ico d={ALARM} size={12} style="flex-shrink: 0; margin-left: auto; color: var(--text);" />
                  </button>
                ); })}
                {cl.map((x, n) => (
                  <div key={n} style={sx(`display: flex; align-items: center; gap: 5px; padding: 3px 7px; border-radius: 7px; background: var(--class-bg); border: 1px solid ${col(x.c)}; border-left: 3px solid ${col(x.c)};`)}>
                    <Ico d={SCHOOL} size={11} style="flex-shrink: 0;" />
                    <span style={sx("flex: 1 1 auto; font-size: 10px; font-weight: 800;")}>{x.c.code} class</span>
                    <span style={sx("font-size: 10px; font-weight: 700; color: var(--text-2); white-space: nowrap;")}>{fmtT(x.s).replace(":00", "")}</span>
                  </div>
                ))}
                {sl.map((s) => { const st = slotStyles(s, anim); return (
                  <button key={s.id} type="button" onClick={() => openBlock(s)} aria-label={`${s.course.code} study time, ${st.time}. Open to see what is due.`} className="lift" style={sx(st.chipStyle)}>
                    <Ico d={BOOK} size={11} style="flex-shrink: 0;" />
                    <span style={sx("flex: 1 1 auto; font-size: 10px; font-weight: 800;")}>{s.course.code}</span>
                    <span style={sx("font-size: 10px; font-weight: 700; color: var(--text-2); white-space: nowrap;")}>{st.short}</span>
                  </button>
                ); })}
                {isOpen && (
                  <div role="dialog" aria-label={pop} className="anim-pop" style={sx("position: absolute; top: -6px; left: -10px; right: -10px; z-index: 8; display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: var(--shadow); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);")}>
                    <div style={sx("display: flex; align-items: center; justify-content: space-between; padding: 0 2px 4px;")}>
                      <span style={sx("font-size: 13px; font-weight: 800; color: var(--weekend);")}>{pop}</span>
                      <button type="button" onClick={() => setOpenDay(null)} aria-label="Close" title="Close" style={sx("width: 28px; height: 28px; padding: 0; border: 0; border-radius: 14px; background: transparent; color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center;")}><Ico d={P.x} size={14} sw={2.6} /></button>
                    </div>
                    {vis.map((it) => { const cd = cardOf(it, ""); return (
                      <button key={it.id} type="button" onClick={() => open(it.id)} aria-label={cd.aria} className="lift" style={sx(cd.popStyle)}>
                        <span aria-hidden="true" style={sx(cd.iconWrap)}><Ico d={cd.icon} size={12} /></span>
                        <span style={sx("display: flex; flex-direction: column; gap: 1px; min-width: 0;")}>
                          <span style={sx("font-size: 10px; font-weight: 800; color: var(--muted);")}>{it.course.code}</span>
                          <span style={sx(cd.textStyle)}>{it.title}</span>
                        </span>
                      </button>
                    ); })}
                    {sl.map((s) => { const st = slotStyles(s, ""); return (
                      <button key={s.id} type="button" onClick={() => openBlock(s)} aria-label={`${s.course.code} study time, ${st.time}`} className="lift" style={sx(st.chipStyle)}>
                        <Ico d={BOOK} size={12} style="flex-shrink: 0;" />
                        <span style={sx("flex: 1 1 auto; font-size: 11px; font-weight: 800;")}>{s.course.code} study time</span>
                        <span style={sx("font-size: 11px; font-weight: 700; color: var(--text-2); white-space: nowrap;")}>{st.time}</span>
                      </button>
                    ); })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Week and Day views open scrolled to midday, so evening due times are in view. */
function useStartAtNoon(hourPx: number, zoom: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 5 * hourPx * zoom; }, [hourPx, zoom]);
  return ref;
}

// ---------- Week ----------

const H = 44;
const pos = (s: number, e: number) => `top: ${(Math.max(7, s) - 7) * H + 2}px; height: ${(Math.min(24, e) - Math.max(7, s)) * H - 4}px;`;
/** left/width so overlapping study blocks sit side by side */
const lane = (cols: Map<string, [number, number]>, id: string, pad: number) => {
  const [c, n] = cols.get(id) ?? [0, 1];
  return n === 1 ? `left: ${pad}px; right: ${pad}px;` : `left: calc(${pad}px + (100% - ${pad * 2}px) * ${c / n}); width: calc((100% - ${pad * 2}px) / ${n} - 2px);`;
};
const dueAnchor = (t: number, h: number) => (t >= 21 ? "bottom: " + Math.max(4, (24 - t) * h) + "px;" : "top: " + (Math.max(0, t - 7) * h + 2) + "px;");

function groups(items: PlanItem[]): [number, PlanItem[]][] {
  const g = new Map<number, PlanItem[]>();
  items.forEach((it) => g.set(it.time, [...(g.get(it.time) ?? []), it]));
  return [...g.entries()].sort((a, b) => a[0] - b[0]);
}

function WeekView({ weekStart, zoom, todayKey, anim, expanded, setExpanded, itemsOn, slots, classesOn, forLine, open, openBlock }: {
  weekStart: Date; zoom: number; todayKey: string; anim: string; expanded: Record<string, boolean>; setExpanded: (f: (e: Record<string, boolean>) => Record<string, boolean>) => void;
  itemsOn: (d: Date) => PlanItem[]; slots: (d: Date) => Slot[]; classesOn: (d: Date) => { c: Course; s: number; e: number }[];
  forLine: (sl: Slot) => string; open: (id: string) => void; openBlock: (sl: Slot) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const scroller = useStartAtNoon(H, zoom);
  const bg = (today: boolean) => "backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); background-color: " + (today ? "var(--today)" : "var(--surface)") + ";";
  return (
    <div ref={scroller} className="anim-view cal-scroll" style={sx("overflow: auto; max-height: calc(100vh - 230px); min-height: 360px; border-radius: 12px; overscroll-behavior: contain;")}>
      <div style={sx(`min-width: 860px; zoom: ${zoom};`)}>
        <div style={sx("position: sticky; top: 0; z-index: 7; display: grid; grid-template-columns: 56px repeat(7, minmax(0, 1fr)); border-bottom: 1px solid var(--line-strong); background: var(--rail-bg);")}>
          <div style={sx(bg(false))} />
          {days.map((d, i) => { const today = dayKey(d) === todayKey; return (
            <div key={i} style={sx("display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0; border-left: 1px solid var(--line); " + bg(today))}>
              <span style={sx("text-shadow: var(--onbg-shadow, none); font-size: 12px; font-weight: 800; letter-spacing: 0.04em; color: " + (i >= 5 ? "var(--weekend)" : "var(--text-2)") + ";")}>{HEADS[i]}</span>
              <span style={sx("width: 34px; height: 34px; border-radius: 17px; font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; " + (today ? "background: var(--today); color: var(--text);" : i === 6 ? "color: var(--weekend);" : "color: var(--text);"))}>{d.getDate()}</span>
            </div>
          ); })}
        </div>
        <div style={sx("display: grid; grid-template-columns: 56px repeat(7, minmax(0, 1fr));")}>
          <div className="frost" style={sx("position: relative; height: 790px; background: var(--surface);")}>
            {Array.from({ length: 17 }, (_, k) => k + 7).map((h) => (
              <span key={h} style={sx(`position: absolute; right: 8px; top: ${Math.max(2, (h - 7) * H - 7)}px; font-size: 11px; font-weight: 600; color: var(--muted); white-space: nowrap;`)}>{fmtT(h).replace(":00", "")}</span>
            ))}
          </div>
          {days.map((d, i) => {
            const today = dayKey(d) === todayKey;
            return (
              <div key={i} style={sx("position: relative; height: 790px; border-left: 1px solid var(--line); " + bg(today) + " background-image: repeating-linear-gradient(to bottom, var(--line) 0, var(--line) 1px, transparent 1px, transparent 44px);")}>
                {classesOn(d).map((x, n) => (
                  <div key={n} style={sx(`position: absolute; left: 3px; right: 3px; ${pos(x.s, x.e)} box-sizing: border-box; overflow: hidden; padding: 5px 8px; display: flex; flex-direction: column; gap: 1px; border-radius: 9px; background: var(--class-bg); border: 1px solid ${col(x.c)}; border-left: 4px solid ${col(x.c)};`)}>
                    <span style={sx("display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800; color: var(--text);")}><Ico d={SCHOOL} size={11} style="flex-shrink: 0;" />{x.c.code} class</span>
                    <span style={sx("font-size: 11px; color: var(--text-2);")}>{fmtT(x.s)} to {fmtT(x.e)}</span>
                  </div>
                ))}
                {(() => { const ds = slots(d); const cols = overlapColumns(ds); return ds.map((s) => { const st = slotStyles(s, anim, `position: absolute; ${lane(cols, s.id, 3)} ${pos(s.s, s.e)}`); const fl = forLine(s); return (
                  <button key={s.id} type="button" onClick={() => openBlock(s)} aria-label={`${s.course.code} study time, ${st.time}. Open to see what is due.`} className="lift" style={sx(st.style)}>
                    <span style={sx("display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800;")}><Ico d={BOOK} size={12} style="flex-shrink: 0;" />{s.course.code}</span>
                    <span style={sx("font-size: 11px; font-weight: 600; color: var(--text-2);")}>{st.time}</span>
                    {fl && <span style={sx("font-size: 11px; font-weight: 600; color: var(--text); line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;")}>{fl}</span>}
                  </button>
                ); }); })()}
                {groups(itemsOn(d)).map(([t, list]) => {
                  const gk = dayKey(d) + "|" + t; const isOpen = !!expanded[gk];
                  const shown = list.length > 2 && !isOpen ? list.slice(0, 2) : list;
                  return (
                    <div key={t} style={sx("position: absolute; left: 3px; right: 3px; z-index: 3; display: flex; flex-direction: column; gap: 3px; " + dueAnchor(t, H))}>
                      <span style={sx("font-size: 10px; font-weight: 800; color: var(--text); padding: 0 2px;")}>Due {fmtT(t)}</span>
                      {shown.map((it) => { const cd = cardOf(it, anim); return (
                        <button key={it.id} type="button" onClick={() => open(it.id)} aria-label={cd.aria} title={cd.full} className="lift" style={sx(cd.chip)}>
                          <Ico d={ALARM} size={12} style="flex-shrink: 0; color: var(--text);" />
                          <span aria-hidden="true" style={sx(cd.chipDot)} />
                          <span style={sx(cd.chipText)}>{it.title}</span>
                        </button>
                      ); })}
                      {list.length > 2 && (
                        <button type="button" onClick={() => setExpanded((e) => ({ ...e, [gk]: !e[gk] }))} style={sx("min-height: 24px; border-radius: 7px; border: 1px dashed var(--line-strong); background: var(--panel); color: var(--text); font-size: 11px; font-weight: 700; cursor: pointer;")}>
                          {isOpen ? "Show less" : `+${list.length - 2} more`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Day ----------

function DayView({ d, zoom, now, todayKey, anim, studyTab, setStudyTab, items, allItems, slots, classes, forLine, open, openBlock }: {
  d: Date; zoom: number; now: Date; todayKey: string; anim: string; studyTab: number; setStudyTab: (n: number) => void;
  items: PlanItem[]; allItems: PlanItem[]; slots: Slot[]; classes: { c: Course; s: number; e: number }[];
  forLine: (sl: Slot) => string; open: (id: string) => void; openBlock: (sl: Slot) => void;
}) {
  const HD = 56;
  const scroller = useStartAtNoon(HD, zoom);
  const posD = (a: number, b: number) => `top: ${(Math.max(7, a) - 7) * HD + 2}px; height: ${(Math.min(24, b) - Math.max(7, a)) * HD - 4}px;`;
  const key = dayKey(d); const isToday = key === todayKey;
  const dayWord = isToday ? "today" : fmtDay(d, { weekday: "long" });
  const nowH = now.getHours() + now.getMinutes() / 60;
  const studyHrs = slots.reduce((n, s) => n + s.e - s.s, 0);
  const dayCols = overlapColumns(slots);
  const upcomingFor = (c: Course) => {
    const out: PlanItem[] = [];
    for (let k = 0; k < 7 && out.length < 3; k++) {
      const kk = dayKey(addDays(d, k));
      allItems.filter((it) => it.key === kk && it.course.id === c.id && !it.done).forEach((it) => { if (out.length < 3) out.push(it); });
    }
    return out;
  };
  const rowOf = (it: PlanItem, withDay: boolean) => {
    const cd = cardOf(it, anim);
    return (
      <button key={it.id} type="button" onClick={() => open(it.id)} aria-label={"Open " + cd.full} className="lift"
        style={sx("display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; box-sizing: border-box; border-radius: 10px; border: 1px solid " + (it.overdue ? "var(--warn-line)" : "var(--line)") + "; background: var(--surface-2); color: var(--text); text-align: left; cursor: pointer; " + anim)}>
        <span aria-hidden="true" style={sx(cd.iconWrap)}><Ico d={cd.icon} size={13} /></span>
        <span style={sx("flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px;")}>
          <span style={sx("font-size: 13px; font-weight: 700;" + (it.done ? " text-decoration: line-through; opacity: 0.6;" : ""))}>{it.title}</span>
          <span style={sx("font-size: 12px; color: var(--text-2);")}>{it.course.code}, {it.type[0]!.toUpperCase() + it.type.slice(1)}, due {withDay ? fmtDay(new Date(it.key + "T12:00:00"), { weekday: "short" }) + " " : ""}{fmtT(it.time)}</span>
        </span>
        <span style={sx("flex-shrink: 0; font-size: 11px; font-weight: 800; color: " + (it.done ? "var(--ok)" : "var(--warn-text)") + ";")}>{it.done ? "Done" : it.overdue ? "Overdue" : ""}</span>
      </button>
    );
  };
  const cur = slots[Math.min(studyTab, Math.max(0, slots.length - 1))];
  const nx = cur ? upcomingFor(cur.course) : [];
  const navBtn = "width: 34px; height: 34px; flex-shrink: 0; padding: 0; border-radius: 17px; border: 1px solid var(--line-strong); background: var(--surface-2); color: var(--text); display: flex; align-items: center; justify-content: center; " + (slots.length < 2 ? "opacity: 0.35; cursor: default;" : "cursor: pointer;");
  const section = "box-sizing: border-box; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px;";

  return (
    <div className="anim-view" style={sx("display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start;")}>
      <div ref={scroller} className="cal-scroll" style={sx("flex: 999 1 420px; min-width: 0; overflow: auto; max-height: calc(100vh - 230px); min-height: 360px; border-radius: 12px; overscroll-behavior: contain;")}>
        <div style={sx(`display: grid; grid-template-columns: 64px minmax(0, 1fr); min-width: 360px; zoom: ${zoom};`)}>
          <div className="frost" style={sx("position: relative; height: 952px; background: var(--surface);")}>
            {Array.from({ length: 17 }, (_, k) => k + 7).map((h) => (
              <span key={h} style={sx(`position: absolute; right: 10px; top: ${Math.max(2, (h - 7) * HD - 7)}px; font-size: 12px; font-weight: 600; color: var(--muted); white-space: nowrap;`)}>{fmtT(h).replace(":00", "")}</span>
            ))}
          </div>
          <div style={sx(`position: relative; height: 952px; border-left: 1px solid var(--line); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); background-color: var(--surface); background-image: repeating-linear-gradient(to bottom, var(--line) 0, var(--line) 1px, transparent 1px, transparent ${HD}px);`)}>
            {classes.map((x, n) => (
              <div key={n} style={sx(`position: absolute; left: 6px; right: 6px; ${posD(x.s, x.e)} box-sizing: border-box; overflow: hidden; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; border-radius: 10px; background: var(--class-bg); border: 1px solid ${col(x.c)}; border-left: 4px solid ${col(x.c)};`)}>
                <span style={sx("display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800;")}><Ico d={SCHOOL} size={13} style="flex-shrink: 0;" />{x.c.code} class</span>
                <span style={sx("font-size: 12px; color: var(--text-2);")}>{fmtT(x.s)} to {fmtT(x.e)}</span>
              </div>
            ))}
            {slots.map((s) => {
              const st = slotStyles(s, anim, `position: absolute; ${posD(s.s, s.e)} ${lane(dayCols, s.id, 6)}`);
              const fl = forLine(s); const next = upcomingFor(s.course);
              return (
                <button key={s.id} type="button" onClick={() => openBlock(s)} aria-label={`${s.course.code} study time, ${st.time}. Open to see what is due.`} className="lift" style={sx(st.style)}>
                  <span style={sx("display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800;")}><Ico d={BOOK} size={15} style="flex-shrink: 0;" />{s.course.code} study time</span>
                  <span style={sx("font-size: 12px; font-weight: 600; color: var(--text-2);")}>{st.time}</span>
                  <span style={sx("font-size: 12px; color: var(--text);")}>{fl ? fl.replace("For: ", "Studying for: ") : next.length ? "Next up: " + next[0]!.title : "Nothing due soon"}</span>
                </button>
              );
            })}
            {groups(items).map(([t, list]) => (
              <div key={t} style={sx("position: absolute; left: 6px; right: 6px; z-index: 3; display: flex; flex-direction: column; gap: 4px; " + (t >= 21 ? "bottom: " + Math.max(6, (24 - t) * HD) + "px;" : "top: " + (Math.max(0, t - 7) * HD + 2) + "px;"))}>
                <span style={sx("font-size: 11px; font-weight: 800; color: var(--text); padding: 0 2px;")}>Due {fmtT(t)}</span>
                {list.map((it) => { const cd = cardOf(it, anim); return (
                  <button key={it.id} type="button" onClick={() => open(it.id)} aria-label={cd.aria} className="lift" style={sx(cd.chip.replace("padding: 4px 6px", "padding: 7px 10px"))}>
                    <Ico d={ALARM} size={13} style="flex-shrink: 0; color: var(--text);" />
                    <span aria-hidden="true" style={sx(cd.chipDot)} />
                    <span style={sx("flex: 1 1 auto; min-width: 0; font-size: 12px; font-weight: 700;" + (it.done ? " text-decoration: line-through; opacity: 0.6;" : ""))}>{it.title}</span>
                    <span style={sx("font-size: 11px; font-weight: 700; color: var(--text-2);")}>{it.course.code}</span>
                  </button>
                ); })}
              </div>
            ))}
            {isToday && nowH >= 7 && (
              <div aria-hidden="true" style={sx(`position: absolute; left: 0; right: 0; top: ${(nowH - 7) * HD}px; height: 2px; background: var(--weekend); z-index: 4;`)}>
                <span style={sx("position: absolute; left: -5px; top: -4px; width: 10px; height: 10px; border-radius: 5px; background: var(--weekend);")} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={sx("flex: 1 1 300px; min-width: 0; display: flex; flex-direction: column; gap: 12px;")}>
        <section className="frost" style={sx(section)}>
          <h2 style={sx("margin: 0; font-size: 15px; font-weight: 800;")}>At a glance</h2>
          <div style={sx("display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;")}>
            {[[String(items.length), items.length === 1 ? "thing due" : "things due"], [studyHrs + " h", "study time"], [String(classes.length), classes.length === 1 ? "class" : "classes"]].map(([n, l]) => (
              <div key={l} style={sx("padding: 10px; border-radius: 12px; background: var(--surface-2); display: flex; flex-direction: column; gap: 2px;")}>
                <span style={sx("font-size: 22px; font-weight: 800;")}>{n}</span>
                <span style={sx("font-size: 12px; color: var(--text-2);")}>{l}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="frost" style={sx(section)}>
          <h2 style={sx("margin: 0; font-size: 15px; font-weight: 800;")}>Due {dayWord}</h2>
          {items.map((it) => rowOf(it, false))}
          {!items.length && <span style={sx("font-size: 13px; color: var(--text-2);")}>Nothing due.</span>}
        </section>
        <section className="frost" style={sx(section)}>
          <h2 style={sx("margin: 0; font-size: 15px; font-weight: 800;")}>Study time {dayWord}</h2>
          {cur ? (
            <>
              <div style={sx("display: flex; align-items: center; gap: 10px;")}>
                <button type="button" disabled={slots.length < 2} onClick={() => setStudyTab((Math.min(studyTab, slots.length - 1) - 1 + slots.length) % slots.length)} aria-label="Previous class" title="Previous class" style={sx(navBtn)}><Ico d={P.left} size={15} sw={2.2} /></button>
                <div aria-live="polite" style={sx("flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center;")}>
                  <span style={sx("display: inline-flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 800;")}><span aria-hidden="true" style={sx(dotStyle(cur.course))} />{cur.course.code} {cur.course.name}</span>
                  <span style={sx("font-size: 12px; color: var(--text-2);")}>Class {Math.min(studyTab, slots.length - 1) + 1} of {slots.length}</span>
                </div>
                <button type="button" disabled={slots.length < 2} onClick={() => setStudyTab((Math.min(studyTab, slots.length - 1) + 1) % slots.length)} aria-label="Next class" title="Next class" style={sx(navBtn)}><Ico d={P.right} size={15} sw={2.2} /></button>
              </div>
              <div style={sx(`display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; background: var(--${cur.course.color}-block); border: 1px solid var(--${cur.course.color}-soft); ` + anim)}>
                <div style={sx("display: flex; align-items: baseline; justify-content: space-between; gap: 8px;")}>
                  <span style={sx("font-size: 14px; font-weight: 800;")}>{cur.course.code} {cur.course.name}</span>
                  <span style={sx("font-size: 12px; font-weight: 600; color: var(--text-2);")}>{fmtT(cur.s)} to {fmtT(cur.e)}</span>
                </div>
                <span style={sx("font-size: 12px; font-weight: 700; color: var(--text-2);")}>Coming up for this class</span>
                {nx.map((it) => rowOf(it, true))}
                {!nx.length && <span style={sx("font-size: 12px; color: var(--text-2);")}>Nothing due in the next week.</span>}
              </div>
            </>
          ) : <span style={sx("font-size: 13px; color: var(--text-2);")}>No study time set for this day.</span>}
        </section>
      </div>
    </div>
  );
}
