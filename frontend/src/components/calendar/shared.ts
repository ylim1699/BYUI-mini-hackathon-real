// Style builders for calendar items, ported from the prototype's card() and slotObj().
import { blockBg, col, fmtT, ICON, soft, type PlanItem, type Slot } from "../../lib/plan";

export function cardOf(it: PlanItem, anim: string) {
  const done = it.done;
  const late = it.overdue;
  const c = it.course;
  return {
    icon: ICON[it.type],
    iconWrap: `width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%; background: ${soft(c)}; color: ${col(c)}; display: flex; align-items: center; justify-content: center;`,
    textStyle: "font-size: 12px; line-height: 1.3; font-weight: 600; text-align: left;" + (done ? " text-decoration: line-through; opacity: 0.6;" : ""),
    style: "display: flex; align-items: center; gap: 7px; width: 100%; padding: 6px 7px; box-sizing: border-box; border-radius: 8px; border: 1px solid " + (late ? "var(--warn-line)" : "var(--line)") + "; background: var(--surface-2); color: var(--text); cursor: pointer; text-align: left; " + anim,
    popStyle: "display: flex; align-items: center; gap: 9px; width: 100%; padding: 7px 9px; box-sizing: border-box; border-radius: 9px; border: 1px solid var(--line); background: var(--surface-2); color: var(--text); cursor: pointer; text-align: left;",
    chip: "display: flex; align-items: center; gap: 5px; width: 100%; padding: 4px 6px; box-sizing: border-box; border-radius: 7px; background: var(--panel); border: 1px solid " + (late ? "var(--warn-line)" : "var(--line-strong)") + "; color: var(--text); text-align: left; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.25); " + anim,
    chipDot: `width: 7px; height: 7px; flex-shrink: 0; border-radius: 50%; background: ${col(c)};`,
    chipText: "flex: 1 1 auto; min-width: 0; font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" + (done ? " text-decoration: line-through; opacity: 0.6;" : ""),
    full: c.code + ": " + it.title,
    aria: "Open " + c.code + " " + it.title + (done ? ", done" : ""),
  };
}

export function slotStyles(sl: Slot, anim: string, position = "") {
  const bg = `background: ${blockBg(sl.course)}; border: 1px solid ${soft(sl.course)};`;
  return {
    time: fmtT(sl.s) + " to " + fmtT(sl.e),
    short: fmtT(sl.s).replace(":00", ""),
    style: position + " box-sizing: border-box; overflow: hidden; padding: 7px 9px; display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 2px; border-radius: 10px; color: var(--text); text-align: left; cursor: pointer; " + bg + " " + anim,
    chipStyle: "display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; padding: 4px 7px; box-sizing: border-box; border-radius: 7px; color: var(--text); text-align: left; cursor: pointer; " + bg + " " + anim,
  };
}

export const ALARM = "M12 20a7 7 0 100-14 7 7 0 000 14zM12 9.5V13l2.5 1.5M4 6.5L7 4M20 6.5L17 4";
export const BOOK = "M12 6.5C10.5 5.3 8.3 4.8 4.5 5v13c3.8-.2 6 .3 7.5 1.5 1.5-1.2 3.7-1.7 7.5-1.5V5c-3.8-.2-6 .3-7.5 1.5zM12 6.5v13";
export const SCHOOL = "M3.5 20h17M5.5 20v-9.5L12 6l6.5 4.5V20M10 20v-4.5h4V20M12 6V3.5h3";
