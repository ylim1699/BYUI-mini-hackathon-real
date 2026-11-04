import { formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";
import { Button, Card, Confirm, Dot, PageHeader, Spinner } from "../components/ui";
import { useAll, useRefreshAll, useUpdateItem } from "../hooks/useData";
import * as db from "../services/db";
import { DAY_MS, stillRestorable, useUi } from "../store/ui";

interface Row { id: string; kind: "item" | "file"; label: string; where: string; color?: string; at: string }

export function TrashPage() {
  const { courses, items, loading } = useAll();
  const update = useUpdateItem();
  const refresh = useRefreshAll();
  const { filesGone, restoreFile, purgeFile, notify } = useUi();
  const [purge, setPurge] = useState<Row | null>(null);

  const course = (id: string) => courses.find((c) => c.id === id);
  const rows: Row[] = [
    ...items.filter((i) => stillRestorable(i.deleted_at)).map((i) => ({
      id: i.id, kind: "item" as const, label: i.title, where: course(i.course_id)?.code ?? "", color: course(i.course_id)?.color, at: i.deleted_at!,
    })),
    ...filesGone.filter((f) => stillRestorable(f.goneAt)).map((f) => ({
      id: f.id, kind: "file" as const, label: f.name, where: "Syllabus file", color: course(f.courseId)?.color, at: f.goneAt,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const restore = (r: Row) => {
    if (r.kind === "item") update.mutate({ id: r.id, patch: { deleted_at: null } });
    else restoreFile(r.id);
    notify({ text: `Restored "${r.label}".` });
  };
  const remove = async (r: Row) => {
    if (r.kind === "item") { await db.deleteItemForever(r.id); refresh(); } else purgeFile(r.id);
    notify({ text: `Deleted "${r.label}" for good.` });
  };

  return (
    <>
      <PageHeader title="Recently deleted" sub="Deleted items and syllabi stay here for 1 day, then they're gone." />
      {loading ? <Spinner /> : (
        <Card>
          {!rows.length ? <p className="text-text-2">Nothing deleted in the last day.</p> : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={`${r.kind}${r.id}`} className="flex flex-wrap items-center gap-3 py-3">
                  {r.color && <Dot color={r.color} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{r.label}</p>
                    <p className="text-xs text-text-2">{r.where} · gone in {formatDistanceToNowStrict(new Date(new Date(r.at).getTime() + DAY_MS))}</p>
                  </div>
                  <Button onClick={() => restore(r)}>Restore</Button>
                  <Button variant="quiet" onClick={() => setPurge(r)}>Delete now</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <Confirm open={!!purge} danger title={`Delete "${purge?.label ?? ""}" for good?`} yes="Delete now" onClose={() => setPurge(null)}
        body="You can't undo this." onYes={() => purge && void remove(purge)} />
    </>
  );
}
