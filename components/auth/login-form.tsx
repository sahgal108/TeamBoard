"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DEMO_PASSWORD, type DemoAccount } from "@/lib/auth/demo-accounts";

type Props = { demoAccounts: DemoAccount[]; next: string };

export function LoginForm({ demoAccounts, next }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Sign in failed. Try again.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function fillDemo(account: DemoAccount) {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-7">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-ink-2">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-[42px] rounded-lg border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-ink-2">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="h-[42px] rounded-lg border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-priority-urgent">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || !email || !password}
          className="h-[42px] rounded-lg bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {demoAccounts.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line pt-5">
          <div className="text-xs uppercase tracking-[0.06em] text-ink-3">Demo accounts · click to fill</div>
          <div className="flex flex-wrap gap-2">
            {demoAccounts.map(a => (
              <button
                key={a.email}
                type="button"
                onClick={() => fillDemo(a)}
                className={`flex h-[34px] items-center gap-2 rounded-full border bg-surface pl-1.5 pr-3 text-[12.5px] font-medium text-ink transition-colors hover:border-accent ${
                  a.company === "Acme Technologies" ? "border-line" : "border-dashed border-line"
                } ${email === a.email ? "border-accent ring-2 ring-accent-soft" : ""}`}
              >
                <span
                  className="grid size-[22px] place-items-center rounded-full text-[9.5px] font-semibold text-white"
                  style={{ background: a.color }}
                >
                  {a.initials}
                </span>
                {a.name}
                <span className="font-normal text-ink-3">
                  {a.role}
                  {a.company !== "Acme Technologies" ? ` · ${a.company}` : ""}
                </span>
              </button>
            ))}
          </div>
          <div className="text-xs text-ink-3">
            Password for every demo account: <span className="font-mono">{DEMO_PASSWORD}</span>
          </div>
        </div>
      )}
    </div>
  );
}
