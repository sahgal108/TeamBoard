"use client";

import { useEffect, type ReactNode } from "react";

type Props = { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; width?: number };

export function Modal({ open, onClose, title, description, children, width = 480 }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-side/40 p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="w-full rounded-xl border border-line bg-surface shadow-[0_24px_60px_rgba(15,26,22,.18)]" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="modal-title" className="font-display text-[17px] font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg bg-[#fdecec] px-3 py-2 text-[13px] text-priority-urgent">{message}</p>;
}
