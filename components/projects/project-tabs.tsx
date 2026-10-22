"use client";

import { Tabs } from "antd";
import { useRouter } from "next/navigation";

/** Board / Activity switch for a project; the active tab is in the URL so the server renders it. */
export function ProjectTabs({ projectId, active }: { projectId: string; active: "board" | "activity" }) {
  const router = useRouter();
  return (
    <Tabs
      activeKey={active}
      onChange={key => router.push(key === "activity" ? `/projects/${projectId}?tab=activity` : `/projects/${projectId}`)}
      items={[
        { key: "board", label: "Board" },
        { key: "activity", label: "Activity" },
      ]}
      style={{ marginBottom: -16 }}
    />
  );
}
