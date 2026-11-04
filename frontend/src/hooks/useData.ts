// Data hooks. Pages use these; they never call db.ts or api.ts directly.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import * as db from "../services/db";
import { meSchema, type Course, type Item } from "../types/domain";

export const qk = {
  me: ["me"] as const,
  courses: ["courses"] as const,
  items: ["items"] as const,
  study: ["study"] as const,
  links: ["links"] as const,
};

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: () => api("/me", meSchema) });
export const useCourses = () => useQuery({ queryKey: qk.courses, queryFn: db.listCourses });
export const useItems = () => useQuery({ queryKey: qk.items, queryFn: db.listItems });
export const useStudyTimes = () => useQuery({ queryKey: qk.study, queryFn: db.listStudyTimes });
export const useLinks = () => useQuery({ queryKey: qk.links, queryFn: db.listLinks });

/** Everything the calendar and sync need, with loading/error rolled up. */
export function useAll() {
  const c = useCourses(), i = useItems(), s = useStudyTimes(), l = useLinks();
  return {
    courses: c.data ?? [], items: i.data ?? [], studyTimes: s.data ?? [], links: l.data ?? [],
    loading: c.isLoading || i.isLoading || s.isLoading || l.isLoading,
    error: c.error ?? i.error ?? s.error ?? l.error,
  };
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<Item, "id">> }) => db.updateItem(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.items });
      const prev = qc.getQueryData<Item[]>(qk.items);
      qc.setQueryData<Item[]>(qk.items, (old) => old?.map((it) => (it.id === id ? { ...it, ...patch } : it)));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.items, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.items }),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<Course, "id">> }) => db.updateCourse(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.courses });
      const prev = qc.getQueryData<Course[]>(qk.courses);
      qc.setQueryData<Course[]>(qk.courses, (old) => old?.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.courses, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.courses }),
  });
}

export function useSetLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ block_key, item_id, on }: { block_key: string; item_id: string; on: boolean }) => db.setLink(block_key, item_id, on),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.links }),
  });
}

export function useRefreshAll() {
  const qc = useQueryClient();
  return () => Promise.all([qk.courses, qk.items, qk.study, qk.links, qk.me].map((k) => qc.invalidateQueries({ queryKey: k })));
}
