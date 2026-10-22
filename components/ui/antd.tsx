"use client";

import { Empty, Layout, Skeleton, Typography } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { space } from "@/lib/design-system";

// Server components cannot dot into a client module (`Typography.Title` throws there),
// so the compound members they need are re-exported here as plain client components.
export const Title = Typography.Title;
export const Text = Typography.Text;
export const Paragraph = Typography.Paragraph;
export const Header = Layout.Header;
export const Content = Layout.Content;
export const Sider = Layout.Sider;
export const SkeletonInput = Skeleton.Input;

/** Compact empty state for tables, cards and feeds. */
export function EmptyState({ description, style }: { description: ReactNode; style?: CSSProperties }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} style={{ padding: `${space[4]}px 0`, ...style }} />;
}
