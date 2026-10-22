"use client";

import { Divider, Flex, Segmented } from "antd";
import { useRouter } from "next/navigation";
import type { TaskStatus } from "@/lib/db/enums";
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER } from "@/lib/labels";
import { space } from "@/lib/design-system";

type Props = { mine: boolean; status?: TaskStatus };

/** Assignment and status filters for /tasks; state lives in the URL. */
export function TaskFilters({ mine, status }: Props) {
  const router = useRouter();

  function go(next: { mine?: boolean; status?: TaskStatus | "ANY" }) {
    const q = new URLSearchParams();
    if (next.mine ?? mine) q.set("mine", "1");
    const s = next.status === undefined ? status : next.status === "ANY" ? undefined : next.status;
    if (s) q.set("status", s);
    const str = q.toString();
    router.push(`/tasks${str ? `?${str}` : ""}`);
  }

  return (
    <Flex wrap align="center" gap={space[2]}>
      <Segmented
        value={mine ? "mine" : "all"}
        onChange={v => go({ mine: v === "mine" })}
        options={[
          { value: "all", label: "All" },
          { value: "mine", label: "Assigned to me" },
        ]}
      />
      <Divider orientation="vertical" />
      <Segmented
        value={status ?? "ANY"}
        onChange={v => go({ status: v as TaskStatus | "ANY" })}
        options={[{ value: "ANY", label: "Any status" }, ...TASK_STATUS_ORDER.map(s => ({ value: s, label: TASK_STATUS_LABEL[s] }))]}
      />
    </Flex>
  );
}
