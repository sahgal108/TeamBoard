import { Breadcrumb, Flex } from "antd";
import Link from "next/link";
import type { ReactNode } from "react";
import { Text, Title } from "@/components/ui/antd";
import { space } from "@/lib/design-system";

type Props = { title: ReactNode; subtitle?: ReactNode; crumbs?: { label: string; href?: string }[]; actions?: ReactNode; children?: ReactNode };

export function PageHeader({ title, subtitle, crumbs, actions, children }: Props) {
  return (
    <Flex vertical gap={space[3]}>
      {crumbs && crumbs.length > 0 && (
        <Breadcrumb items={crumbs.map(c => ({ title: c.href ? <Link href={c.href}>{c.label}</Link> : c.label }))} />
      )}
      <Flex wrap justify="space-between" align="flex-start" gap={space[4]}>
        <Flex vertical gap={space[1.5]} style={{ minWidth: 0 }}>
          <Title level={3} style={{ margin: 0 }}>{title}</Title>
          {subtitle && <Text type="secondary">{subtitle}</Text>}
        </Flex>
        {actions && <Flex align="center" gap={space[2]} style={{ flexShrink: 0 }}>{actions}</Flex>}
      </Flex>
      {children}
    </Flex>
  );
}
