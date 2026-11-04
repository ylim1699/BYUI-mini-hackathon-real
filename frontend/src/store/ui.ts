// Small app-wide state: settings kept in this browser, the toast, and added syllabus files.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_REMINDERS, type ReminderRules } from "../types/domain";

export interface SyllabusFile { id: string; name: string; courseId: string; addedAt: string }
export interface GoneFile extends SyllabusFile { goneAt: string }
export interface Toast { id: number; text: string; undo?: () => void; action?: { label: string; run: () => void } }

interface UiState {
  emoji: boolean;
  semesterEnd: string; // YYYY-MM-DD, last day classes repeat until
  rules: ReminderRules;
  files: SyllabusFile[];
  filesGone: GoneFile[];
  toast: Toast | null;
  set: (patch: Partial<Pick<UiState, "emoji" | "semesterEnd" | "rules">>) => void;
  addFile: (f: SyllabusFile) => void;
  removeFile: (id: string) => void;
  restoreFile: (id: string) => void;
  purgeFile: (id: string) => void;
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
      files: [],
      filesGone: [],
      toast: null,
      set: (patch) => set(patch),
      addFile: (f) => set((s) => ({ files: [f, ...s.files] })),
      removeFile: (id) => set((s) => {
        const f = s.files.find((x) => x.id === id);
        return f ? { files: s.files.filter((x) => x.id !== id), filesGone: [{ ...f, goneAt: new Date().toISOString() }, ...s.filesGone] } : s;
      }),
      restoreFile: (id) => set((s) => {
        const f = s.filesGone.find((x) => x.id === id);
        if (!f) return s;
        const { goneAt: _goneAt, ...file } = f;
        return { filesGone: s.filesGone.filter((x) => x.id !== id), files: [file, ...s.files] };
      }),
      purgeFile: (id) => set((s) => ({ filesGone: s.filesGone.filter((x) => x.id !== id) })),
      notify: (t) => set({ toast: { ...t, id: Date.now() } }),
      dismiss: () => set({ toast: null }),
    }),
    {
      name: "syllabus-planner-ui",
      storage: safeStorage,
      partialize: (s) => ({ emoji: s.emoji, semesterEnd: s.semesterEnd, rules: s.rules, files: s.files, filesGone: s.filesGone }),
    },
  ),
);

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Recently deleted keeps things for one day. */
export const stillRestorable = (iso: string | null, now = Date.now()): boolean => !!iso && now - new Date(iso).getTime() < DAY_MS;
