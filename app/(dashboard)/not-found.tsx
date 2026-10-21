import Link from "next/link";
import { btn, btnPrimary } from "@/lib/ui";

// Rendered for any project, task or team the caller cannot see, whether it belongs to another
// company or sits outside their scope in this one. The response is identical on purpose.
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-[460px] flex-col items-center gap-3.5 text-center">
        <span className="grid size-14 place-items-center rounded-2xl border border-line bg-surface text-ink-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /><path d="M8.5 8.5l5 5M13.5 8.5l-5 5" />
          </svg>
        </span>
        <h1 className="font-display text-[22px] font-semibold">We couldn&apos;t find that</h1>
        <p className="text-[13.5px] text-ink-2">
          It may have been removed, or it isn&apos;t part of your company or your projects. Anything you can work on is listed under Projects.
        </p>
        <div className="mt-1 flex gap-2.5">
          <Link href="/projects" className={btnPrimary}>Go to my projects</Link>
          <Link href="/dashboard" className={btn}>Back to dashboard</Link>
        </div>
      </div>
    </main>
  );
}
