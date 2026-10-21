import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { DEMO_ACCOUNTS, showDemoAccounts } from "@/lib/auth/demo-accounts";
import { WordmarkIcon } from "@/components/layout/wordmark-icon";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string }> };

// Only allow relative in-app paths as a post-login destination.
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
      <section className="hidden flex-col bg-side px-14 py-12 text-side-ink lg:flex">
        <div className="flex items-center gap-2.5 text-white">
          <span className="grid size-[30px] place-items-center rounded-lg bg-accent">
            <WordmarkIcon size={16} />
          </span>
          <span className="font-display text-[19px] font-bold">TeamBoard</span>
        </div>

        <div className="mt-28 flex max-w-[460px] flex-col gap-5">
          <h1 className="font-display text-[40px] font-semibold leading-[1.08] text-white [text-wrap:balance]">
            One company. Every team, project and task, in the right hands.
          </h1>
          <p className="text-[15px] leading-relaxed text-side-muted">
            Role-based access that follows your org chart, enforced on every request.
          </p>
        </div>

        <pre className="mt-14 font-mono text-[13px] leading-[1.7] text-side-muted">
          <b className="font-medium text-white">Acme Technologies</b>
          {"\n├── "}
          <b className="font-medium text-white">Engineering</b>
          {"\n│   ├── "}
          <b className="font-medium text-white">Payment Service</b>
          {"        "}
          <span className="text-[#6fd3b3]">PM · Neha Kapoor</span>
          {"\n│   │   ├── Payment API             "}
          <span className="text-[#6fd3b3]">done</span>
          {"\n│   │   ├── Add retry mechanism     "}
          <span className="text-[#6fd3b3]">in progress</span>
          {"\n│   │   └── Webhook handler         "}
          <span className="text-[#6fd3b3]">in review</span>
          {"\n│   └── "}
          <b className="font-medium text-white">User Platform</b>
          {"\n├── "}
          <b className="font-medium text-white">Product</b>
          {"\n│   └── "}
          <b className="font-medium text-white">Mobile App</b>
          {"\n└── "}
          <b className="font-medium text-white">Design</b>
        </pre>

        <div className="mt-auto flex gap-5 text-xs text-side-muted">
          <span>Multi-tenant</span>
          <span>Hierarchical RBAC</span>
          <span>Real-time boards</span>
          <span>Audit log</span>
        </div>
      </section>

      <section className="flex flex-col justify-center bg-canvas px-6 py-12 sm:px-16 xl:px-[120px]">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-7">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="grid size-7 place-items-center rounded-lg bg-accent">
              <WordmarkIcon size={15} />
            </span>
            <span className="font-display text-[17px] font-bold">TeamBoard</span>
          </div>
          <div>
            <h2 className="font-display text-[26px] font-semibold">Sign in</h2>
            <p className="mt-1.5 text-[13.5px] text-ink-2">
              Use your work email. If you belong to more than one company, you can switch after signing in.
            </p>
          </div>
          <LoginForm demoAccounts={showDemoAccounts() ? DEMO_ACCOUNTS : []} next={safeNext(next)} />
        </div>
      </section>
    </div>
  );
}
