import { avatarColor, initials } from "@/lib/format";

type Props = { name: string; size?: number; className?: string; title?: string };

export function Avatar({ name, size = 28, className = "", title }: Props) {
  return (
    <span
      title={title ?? name}
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${className}`}
      style={{ width: size, height: size, background: avatarColor(name), fontSize: Math.max(9, Math.round(size * 0.38)) }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, size = 24, max = 5 }: { names: string[]; size?: number; max?: number }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size={size} className={`ring-2 ring-canvas ${i > 0 ? "-ml-1.5" : ""}`} />
      ))}
      {rest > 0 && (
        <span className="-ml-1.5 grid place-items-center rounded-full bg-line-2 text-[10px] font-medium text-ink-2 ring-2 ring-canvas" style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </span>
  );
}
