"use client";

import { ReloadOutlined, StarOutlined } from "@ant-design/icons";
import { Alert, Badge, Button, Col, Flex, Row, Segmented, Skeleton, Tooltip, Typography } from "antd";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/antd";
import { KeyTag } from "@/components/ui/badges";
import { ApiError, api, errorMessage } from "@/lib/client-api";
import { relativeTime } from "@/lib/format";
import type { Summary, SummaryItem, SummaryPeriod } from "@/services/summary.service";
import { color, font, space, textStyle } from "@/lib/design-system";

const { Text, Paragraph } = Typography;

type Props = {
  /** e.g. `/api/projects/:id/summary`; the route decides who may read it. */
  endpoint: string;
  defaultPeriod?: SummaryPeriod;
  /** Stack the three lists (narrow cards, e.g. the dashboard). */
  compact?: boolean;
  /** Show which project each task belongs to (team and company scope). */
  showProject?: boolean;
};

const COLUMNS = [
  { key: "done", label: "Done", tint: color.taskStatus.DONE },
  { key: "inProgress", label: "In progress", tint: color.taskStatus.IN_PROGRESS },
  { key: "blocked", label: "Looks blocked", tint: color.feedback.danger },
] as const;

function ItemRow({ item, showProject }: { item: SummaryItem; showProject: boolean }) {
  return (
    <Flex vertical gap={space[0.5]} style={{ padding: `${space[2]}px 0`, borderTop: `1px solid ${color.neutral.borderSubtle}` }}>
      <Flex gap={space[2]} align="baseline" wrap>
        <KeyTag>{item.key}</KeyTag>
        <Link href={`/tasks/${item.taskId}`} className="font-medium">{item.title}</Link>
        {showProject && <Text type="secondary" style={textStyle.caption}>· {item.project}</Text>}
      </Flex>
      <Text type="secondary" style={{ fontSize: font.size.md }}>{item.note}</Text>
    </Flex>
  );
}

/**
 * AI standup summary. The lists come from the database; the model only writes the headline
 * and one note per task. Served from cache unless the user asks for a regeneration.
 */
export function SummaryPanel({ endpoint, defaultPeriod = "day", compact = false, showProject = false }: Props) {
  // Each change of `request` triggers one fetch; `n` makes "try again" and "regenerate" distinct requests.
  const [request, setRequest] = useState({ period: defaultPeriod, refresh: false, n: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);

  useEffect(() => {
    let stale = false;
    api<Summary>(`${endpoint}?period=${request.period}${request.refresh ? "&refresh=1" : ""}`)
      .then(
        s => !stale && setSummary(s),
        e => !stale && setError({ message: errorMessage(e), retryable: !(e instanceof ApiError && (e.code === "RATE_LIMITED" || e.code === "FORBIDDEN")) }),
      )
      .finally(() => {
        if (stale) return;
        setLoading(false);
        setRefreshing(false);
      });
    // A newer request (e.g. switching period quickly) wins; the older reply is ignored.
    return () => {
      stale = true;
    };
  }, [endpoint, request]);

  const go = useCallback((next: { period?: SummaryPeriod; refresh: boolean }) => {
    setError(null);
    if (next.refresh) setRefreshing(true);
    else setLoading(true);
    setRequest(r => ({ period: next.period ?? r.period, refresh: next.refresh, n: r.n + 1 }));
  }, []);
  const period = request.period;

  return (
    <Flex vertical gap={space[4]}>
      <Flex justify="space-between" align="center" gap={space[3]} wrap>
        <Segmented<SummaryPeriod>
          value={period}
          onChange={p => go({ period: p, refresh: false })}
          options={[
            { value: "day", label: "Last 24 hours" },
            { value: "week", label: "Last 7 days" },
          ]}
        />
        <Flex align="center" gap={space[3]}>
          {summary && (
            <Tooltip title={summary.model ? `Written by ${summary.model} from this ${summary.scope}'s activity. Lists come from the data; only the wording is AI.` : "Nothing to summarise, so no AI was used."}>
              <Text type="secondary" style={textStyle.caption}>
                <StarOutlined /> {summary.model ? "AI summary" : "Summary"} · {relativeTime(summary.generatedAt)}
              </Text>
            </Tooltip>
          )}
          <Tooltip title="Write a fresh summary (uses your AI allowance)">
            <Button size="small" icon={<ReloadOutlined />} loading={refreshing} disabled={loading} onClick={() => go({ refresh: true })}>
              Regenerate
            </Button>
          </Tooltip>
        </Flex>
      </Flex>

      {error && (
        <Alert
          type={error.retryable ? "error" : "warning"}
          showIcon
          title={error.message}
          action={error.retryable ? <Button size="small" onClick={() => go({ refresh: false })}>Try again</Button> : undefined}
        />
      )}

      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : summary ? (
        <>
          <Paragraph style={{ fontSize: font.size.lg, margin: 0 }}>{summary.headline}</Paragraph>
          <Row gutter={[space[5], space[4]]}>
            {COLUMNS.map(c => {
              const items = summary[c.key];
              const total = c.key === "done" ? summary.stats.completed : c.key === "inProgress" ? summary.stats.inProgress : summary.stats.blocked;
              if (compact && items.length === 0) return null;
              return (
                <Col key={c.key} xs={24} xl={compact ? 24 : 8}>
                  <Flex align="center" gap={space[2]} style={{ marginBottom: space[1] }}>
                    <Badge color={c.tint} />
                    <Text style={textStyle.columnLabel} strong>{c.label}</Text>
                    <Text type="secondary" className="font-mono" style={textStyle.caption}>
                      {total > items.length ? `${items.length} of ${total}` : total}
                    </Text>
                  </Flex>
                  {items.length ? items.map(i => <ItemRow key={i.taskId} item={i} showProject={showProject} />) : <EmptyState description="Nothing here" />}
                </Col>
              );
            })}
          </Row>
        </>
      ) : null}
    </Flex>
  );
}
