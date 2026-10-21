"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import { btn } from "@/lib/ui";
import type { ActivityItem, ActivityPage } from "@/services/activity.service";
import { ActivityRow } from "./activity-feed";

type Props = { initialCursor: string | null; projectId?: string };

/** Appends further pages under a server-rendered first page. */
export function LoadMoreActivity({ initialCursor, projectId }: Props) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    if (!cursor) return;
    setPending(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "20", cursor });
      if (projectId) qs.set("projectId", projectId);
      const page = await api<ActivityPage>(`/api/activity?${qs}`);
      setItems(prev => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {items.map(i => (
        <ActivityRow key={i.id} item={i} />
      ))}
      {(cursor || error) && (
        <div className="flex items-center gap-3 px-4 py-3">
          {cursor && (
            <button type="button" className={btn} onClick={more} disabled={pending}>
              {pending ? "Loading…" : "Load more"}
            </button>
          )}
          {error && <span className="text-[13px] text-priority-urgent">{error}</span>}
        </div>
      )}
    </>
  );
}
