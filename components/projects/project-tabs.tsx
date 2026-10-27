"use client";

import { Tabs } from "antd";
import { useRouter } from "next/navigation";

export type ProjectTab = "board" | "summary" | "activity";

/** Board / Summary / Activity switch for a project; the active tab is in the URL so the server renders it. */
export function ProjectTabs({ projectId, active, showSummary }: { projectId: string; active: ProjectTab; showSummary: boolean }) {
  const router = useRouter();
  return (
    <Tabs
      activeKey={active}
      onChange={key => router.push(key === "board" ? `/projects/${projectId}` : `/projects/${projectId}?tab=${key}`)}
      items={[
        { key: "board", label: "Board" },
        ...(showSummary ? [{ key: "summary", label: "Summary" }] : []),
        { key: "activity", label: "Activity" },
      ]}
      style={{ marginBottom: -16 }}
    />
  );
}
