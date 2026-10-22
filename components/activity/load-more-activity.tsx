"use client";

import { Button, Divider, Flex, Typography } from "antd";
import { Fragment, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import type { ActivityItem, ActivityPage } from "@/services/activity.service";
import { ActivityRow } from "./activity-feed";
import { color, space } from "@/lib/design-system";

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
        <Fragment key={i.id}>
          <Divider style={{ margin: 0 }} />
          <ActivityRow item={i} />
        </Fragment>
      ))}
      {(cursor || error) && (
        <Flex align="center" gap={space[3]} style={{ padding: `${space[3]}px ${space[4]}px`, borderTop: `1px solid ${color.neutral.borderSubtle}` }}>
          {cursor && (
            <Button onClick={more} loading={pending}>
              Load more
            </Button>
          )}
          {error && <Typography.Text type="danger">{error}</Typography.Text>}
        </Flex>
      )}
    </>
  );
}
