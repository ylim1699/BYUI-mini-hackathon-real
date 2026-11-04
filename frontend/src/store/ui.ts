// App-wide UI state: settings kept in this browser, the toast with Undo.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_REMINDERS, type ReminderRules } from "../types/domain";

export interface Toast { id: number; text: string; undo?: () => void }
export type Bg = "original" | "day";
export type CalView = "day" | "week" | "month";

interface UiState {
  emoji: boolean;
  semesterEnd: string; // YYYY-MM-DD, last day classes repeat until
  rules: ReminderRules;
  bg: Bg;
  view: CalView;
  zoomIdx: number;
  toast: Toast | null;
  set: (patch: Partial<Pick<UiState, "emoji" | "semesterEnd" | "rules" | "bg" | "view" | "zoomIdx">>) => void;
  notify: (t: Omit<Toast, "id">) => void;
  dismiss: () => void;
}

const safeStorage = createJSONStorage(() => {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
});

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      emoji: true,
      semesterEnd: "2026-12-17",
      rules: DEFAULT_REMINDERS,
      bg: "original",
      view: "month",
      zoomIdx: 2,
      toast: null,
      set: (patch) => set(patch),
      notify: (t) => set({ toast: { ...t, id: Date.now() } }),
      dismiss: () => set({ toast: null }),
    }),
    {
      name: "syllabus-planner-ui",
      version: 2,
      storage: safeStorage,
      partialize: (s) => ({ emoji: s.emoji, semesterEnd: s.semesterEnd, rules: s.rules, bg: s.bg, view: s.view, zoomIdx: s.zoomIdx }),
    },
  ),
);

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Recently deleted keeps things for one day. */
export const stillRestorable = (iso: string | null, now = Date.now()): boolean => !!iso && now - new Date(iso).getTime() < DAY_MS;
