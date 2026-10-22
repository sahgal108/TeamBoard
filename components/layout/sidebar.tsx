"use client";

import {
  AppstoreOutlined,
  CheckSquareOutlined,
  FolderOutlined,
  HistoryOutlined,
  LogoutOutlined,
  SettingOutlined,
  SwapOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Dropdown, Flex, Layout, Menu, Tooltip, Typography, type MenuProps } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { avatarSize, color, font, layout, radius, space } from "@/lib/design-system";
import { initials } from "@/lib/format";
import type { CompanySummary } from "@/services/auth.service";
import { WordmarkIcon } from "./wordmark-icon";

type Props = {
  user: { name: string; email: string };
  activeCompanyId: string;
  companies: CompanySummary[];
  roleLabel: string;
  scoped: boolean;
};

// Text styles on the dark sidebar.
const strong = { color: color.sidebar.textStrong, fontWeight: font.weight.medium, fontSize: font.size.md } as const;
const muted = { color: color.sidebar.textMuted, fontSize: font.size.xs } as const;

const NAV_KEYS = ["/dashboard", "/teams", "/projects", "/tasks", "/activity", "/settings"];

export function Sidebar({ user, activeCompanyId, companies, roleLabel, scoped }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const active = companies.find(c => c.id === activeCompanyId);
  const selected = NAV_KEYS.find(k => pathname === k || pathname.startsWith(`${k}/`));

  const items: MenuProps["items"] = [
    { key: "/dashboard", icon: <AppstoreOutlined />, label: <Link href="/dashboard">Dashboard</Link> },
    { key: "/teams", icon: <TeamOutlined />, label: <Link href="/teams">Teams</Link> },
    { key: "/projects", icon: <FolderOutlined />, label: <Link href="/projects">Projects</Link> },
    { key: "/tasks", icon: <CheckSquareOutlined />, label: <Link href="/tasks">{scoped ? "My tasks" : "Tasks"}</Link> },
    { key: "/activity", icon: <HistoryOutlined />, label: <Link href="/activity">Activity</Link> },
    {
      type: "group",
      label: "Workspace",
      children: [{ key: "/settings", icon: <SettingOutlined />, label: <Link href="/settings">Settings</Link> }],
    },
  ];

  async function switchTo(companyId: string) {
    if (companyId === activeCompanyId) return;
    setPending(true);
    try {
      const res = await fetch("/api/auth/switch-company", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const companyCard = (
    <Flex
      align="center"
      justify="space-between"
      gap={space[2]}
      style={{
        background: color.sidebar.backgroundActive,
        border: `1px solid ${color.sidebar.border}`,
        borderRadius: radius.md,
        padding: `${space[2]}px ${space[3]}px`,
        cursor: companies.length > 1 ? "pointer" : "default",
      }}
    >
      <div className="min-w-0">
        <Typography.Text ellipsis style={{ ...strong, display: "block" }}>
          {active?.name}
        </Typography.Text>
        <Typography.Text style={muted}>{roleLabel}</Typography.Text>
      </div>
      {companies.length > 1 && <SwapOutlined style={{ color: color.sidebar.textMuted }} />}
    </Flex>
  );

  return (
    <Layout.Sider width={layout.sidebarWidth} theme="dark" style={{ position: "sticky", top: 0, height: "100vh" }}>
      <Flex vertical gap={space[5]} style={{ height: "100%", padding: `${space[5]}px ${space[3]}px` }}>
        <Flex align="center" gap={space[3]} style={{ padding: `0 ${space[2]}px` }}>
          <span className="grid size-7 place-items-center rounded-md bg-accent">
            <WordmarkIcon size={font.size.lg} />
          </span>
          <span className="font-display text-xl font-bold text-white">TeamBoard</span>
        </Flex>

        {companies.length > 1 ? (
          <Dropdown
            trigger={["click"]}
            disabled={pending}
            menu={{
              selectable: true,
              selectedKeys: [activeCompanyId],
              items: companies.map(c => ({ key: c.id, label: c.name })),
              onClick: ({ key }) => switchTo(key),
            }}
          >
            {companyCard}
          </Dropdown>
        ) : (
          companyCard
        )}

        <Menu theme="dark" mode="inline" selectedKeys={selected ? [selected] : []} items={items} style={{ borderInlineEnd: 0 }} />

        <Flex align="center" gap={space[3]} style={{ marginTop: "auto", borderTop: `1px solid ${color.sidebar.border}`, padding: `${space[3]}px ${space[3]}px 0` }}>
          <Avatar size={avatarSize.md} style={{ background: color.brand.primary, flexShrink: 0, fontSize: font.size.xs }}>
            {initials(user.name)}
          </Avatar>
          <div className="min-w-0 flex-1">
            <Typography.Text ellipsis style={{ ...strong, display: "block" }}>
              {user.name}
            </Typography.Text>
            <Typography.Text ellipsis style={{ ...muted, display: "block" }}>
              {user.email}
            </Typography.Text>
          </div>
          <Tooltip title="Sign out">
            <Button type="text" aria-label="Sign out" icon={<LogoutOutlined />} onClick={signOut} disabled={pending} style={{ color: color.sidebar.textMuted }} />
          </Tooltip>
        </Flex>
      </Flex>
    </Layout.Sider>
  );
}
