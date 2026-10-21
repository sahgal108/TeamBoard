import type { ReactNode } from "react";

type Props = { title: ReactNode; subtitle?: ReactNode; crumbs?: { label: string; href?: string }[]; actions?: ReactNode; children?: ReactNode };

export function PageHeader({ title, subtitle, crumbs, actions, children }: Props) {
  return (
    <div className="flex flex-col gap-3.5">
      {crumbs && crumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[12.5px] text-ink-3" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span>/</span>}
              {c.href ? <a href={c.href} className="hover:text-ink">{c.label}</a> : <span className="text-ink-2">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <div className="text-[13.5px] text-ink-2">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
