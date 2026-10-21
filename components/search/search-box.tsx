"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const ref = useRef<HTMLInputElement>(null);

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

  function submit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <form onSubmit={submit} role="search" className="flex h-[34px] w-[360px] items-center gap-2 rounded-lg border border-line bg-canvas px-3 text-[13px] text-ink-3 focus-within:border-accent">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={ref}
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search projects, tasks, teams"
        aria-label="Search"
        className="w-full bg-transparent text-ink outline-none placeholder:text-ink-3"
      />
      <kbd className="rounded border border-line px-1.5 font-mono text-[11px]">⌘K</kbd>
    </form>
  );
}
