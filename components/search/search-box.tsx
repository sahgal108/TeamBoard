"use client";

import { SearchOutlined } from "@ant-design/icons";
import { Input, Typography, type InputRef } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { layout } from "@/lib/design-system";

export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const ref = useRef<InputRef>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function submit() {
    const term = q.trim();
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <div role="search" style={{ width: layout.searchWidth }}>
      <Input
        ref={ref}
        value={q}
        onChange={e => setQ(e.target.value)}
        onPressEnter={submit}
        placeholder="Search projects, tasks, teams"
        aria-label="Search"
        allowClear
        variant="filled"
        prefix={<SearchOutlined />}
        suffix={<Typography.Text keyboard>⌘K</Typography.Text>}
      />
    </div>
  );
}
