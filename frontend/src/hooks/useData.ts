// Data hooks. Pages use these; they never call db.ts or api.ts directly.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import * as db from "../services/db";
import { meSchema, type Course, type Item, type SyllabusFile } from "../types/domain";

export const qk = {
  me: ["me"] as const,
  courses: ["courses"] as const,
  items: ["items"] as const,
  study: ["study"] as const,
  links: ["links"] as const,
  files: ["files"] as const,
};

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: () => api("/me", meSchema) });
export const useCourses = () => useQuery({ queryKey: qk.courses, queryFn: db.listCourses });
export const useItems = () => useQuery({ queryKey: qk.items, queryFn: db.listItems });
export const useStudyTimes = () => useQuery({ queryKey: qk.study, queryFn: db.listStudyTimes });
export const useLinks = () => useQuery({ queryKey: qk.links, queryFn: db.listLinks });
export const useFiles = () => useQuery({ queryKey: qk.files, queryFn: db.listFiles });

/** Everything the calendar and sync need, with loading/error rolled up. */
export function useAll() {
  const c = useCourses(), i = useItems(), s = useStudyTimes(), l = useLinks();
  return {
    courses: c.data ?? [], items: i.data ?? [], studyTimes: s.data ?? [], links: l.data ?? [],
    loading: c.isLoading || i.isLoading || s.isLoading || l.isLoading,
    error: c.error ?? i.error ?? s.error ?? l.error,
  };
}

function useOptimisticUpdate<T extends { id: string }>(key: readonly string[], write: (id: string, patch: Partial<T>) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<T> }) => write(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<T[]>(key);
      qc.setQueryData<T[]>(key, (old) => old?.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export const useUpdateItem = () => useOptimisticUpdate<Item>(qk.items, (id, p) => db.updateItem(id, p));
export const useUpdateCourse = () => useOptimisticUpdate<Course>(qk.courses, (id, p) => db.updateCourse(id, p));
export const useUpdateFile = () => useOptimisticUpdate<SyllabusFile>(qk.files, (id, p) => db.updateFile(id, p));

export function useSetLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ block_key, item_id, on }: { block_key: string; item_id: string; on: boolean }) => db.setLink(block_key, item_id, on),
    onMutate: async ({ block_key, item_id, on }) => {
      await qc.cancelQueries({ queryKey: qk.links });
      qc.setQueryData<{ block_key: string; item_id: string }[]>(qk.links, (old = []) => {
        const rest = old.filter((l) => !(l.block_key === block_key && l.item_id === item_id));
        return on ? [...rest, { block_key, item_id }] : rest;
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.links }),
  });
}

export function useRefreshAll() {
  const qc = useQueryClient();
  return () => Promise.all(Object.values(qk).map((k) => qc.invalidateQueries({ queryKey: k })));
}
