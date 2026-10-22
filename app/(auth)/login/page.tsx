import { Alert, Flex, Tag } from "antd";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Paragraph, Title } from "@/components/ui/antd";
import { DEMO_ACCOUNTS, showDemoAccounts } from "@/lib/auth/demo-accounts";
import { WordmarkIcon } from "@/components/layout/wordmark-icon";
import { color, font, layout, space } from "@/lib/design-system";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string; reason?: string }> };

const REASON_MESSAGE: Record<string, string> = {
  expired: "Your session has ended. Sign in again.",
  "no-company": "You are no longer a member of that company. Sign in again to continue.",
};

// Only allow relative in-app paths as a post-login destination.
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export default async function LoginPage({ searchParams }: Props) {
  const { next, reason } = await searchParams;

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
      <section className="hidden flex-col bg-side px-14 py-12 text-side-ink lg:flex">
        <div className="flex items-center gap-2.5 text-white">
          <span className="grid size-8 place-items-center rounded-md bg-accent">
            <WordmarkIcon size={font.size.lg} />
          </span>
          <span className="font-display text-xl font-bold">TeamBoard</span>
        </div>

        <div className="mt-28 flex flex-col gap-5" style={{ maxWidth: layout.heroTextMaxWidth }}>
          <Title level={1} style={{ margin: 0, color: color.sidebar.textStrong, fontSize: font.size.display, lineHeight: font.lineHeight.tight, textWrap: "balance" }}>
            One company. Every team, project and task, in the right hands.
          </Title>
          <Paragraph style={{ margin: 0, fontSize: font.size.lg, color: color.sidebar.textMuted }}>
            Role-based access that follows your org chart, enforced on every request.
          </Paragraph>
        </div>

        <Flex wrap gap={space[2]} style={{ marginTop: "auto" }}>
          {["Multi-tenant", "Hierarchical RBAC", "Real-time boards", "Audit log"].map(f => (
            <Tag key={f} variant="outlined" style={{ background: "transparent", color: color.sidebar.textMuted, borderColor: color.sidebar.border }}>
              {f}
            </Tag>
          ))}
        </Flex>
      </section>

      <section className="flex flex-col justify-center bg-canvas px-6 py-12 sm:px-16 xl:px-30">
        <div className="mx-auto flex w-full flex-col gap-7" style={{ maxWidth: layout.authFormMaxWidth }}>
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="grid size-7 place-items-center rounded-lg bg-accent">
              <WordmarkIcon size={font.size.lg} />
            </span>
            <span className="font-display text-xl font-bold">TeamBoard</span>
          </div>
          <div>
            <Title level={2} style={{ margin: 0 }}>Sign in</Title>
            <Paragraph type="secondary" style={{ marginTop: space[1.5], marginBottom: 0 }}>
              Use your work email. If you belong to more than one company, you can switch after signing in.
            </Paragraph>
          </div>
          {reason && REASON_MESSAGE[reason] && <Alert type="info" showIcon title={REASON_MESSAGE[reason]} />}
          <LoginForm demoAccounts={showDemoAccounts() ? DEMO_ACCOUNTS : []} next={safeNext(next)} />
        </div>
      </section>
    </div>
  );
}
