"use client";

import { btn } from "@/lib/ui";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-[460px] flex-col items-center gap-3 text-center">
        <h1 className="font-display text-[22px] font-semibold">Something went wrong</h1>
        <p className="text-[13.5px] text-ink-2">{error.message || "The page could not be loaded."}</p>
        <button type="button" className={btn} onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
