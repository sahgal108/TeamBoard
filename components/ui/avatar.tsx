"use client";

import { Avatar as AntAvatar, Tooltip } from "antd";
import { avatarColor, initials } from "@/lib/format";
import { avatarSize, font } from "@/lib/design-system";

type Props = { name: string; size?: number; title?: string };

export function Avatar({ name, size = avatarSize.md, title }: Props) {
  return (
    <Tooltip title={title ?? name}>
      <AntAvatar size={size} style={{ background: avatarColor(name), flexShrink: 0, fontSize: size >= avatarSize.lg ? font.size.lg : font.size.xs, fontWeight: font.weight.semibold }}>
        {initials(name)}
      </AntAvatar>
    </Tooltip>
  );
}

export function AvatarStack({ names, size = avatarSize.sm, max = 5 }: { names: string[]; size?: number; max?: number }) {
  return (
    <AntAvatar.Group size={size} max={{ count: max, style: { fontSize: font.size.xs } }}>
      {names.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size={size} />
      ))}
    </AntAvatar.Group>
  );
}

/** Avatar beside a name, or a muted "Unassigned". */
export function PersonCell({ name, size = avatarSize.sm, empty = "Unassigned" }: { name: string | null | undefined; size?: number; empty?: string }) {
  if (!name) return <span className="text-ink-3">{empty}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar name={name} size={size} />
      {name}
    </span>
  );
}
