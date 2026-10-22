import { Button, Layout, Result } from "antd";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getCompanyContext, type CompanyContext } from "@/lib/auth/get-company-context";
import { roleLabel } from "@/lib/auth/role-label";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { listCompanies } from "@/services/auth.service";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext();
  } catch (err) {
    // Clear the stale cookie on the way out, or proxy.ts bounces /login back here forever.
    if (err instanceof UnauthorizedError) redirect("/api/auth/expired");
    if (err instanceof ForbiddenError) {
      return (
        <main className="flex flex-1 items-center justify-center p-8">
          <Result
            status="403"
            title="No company to show"
            subTitle={`${err.message}. Ask an administrator to add you to a company, then sign in again.`}
            extra={<Link href="/login"><Button type="primary">Back to sign in</Button></Link>}
          />
        </main>
      );
    }
    throw err;
  }

  const companies = await listCompanies(ctx.user.id);
  const role = ctx.membership.role;

  return (
    <Layout hasSider style={{ minHeight: "100vh" }}>
      <Sidebar
        user={{ name: ctx.user.name, email: ctx.user.email }}
        activeCompanyId={ctx.company.id}
        companies={companies}
        roleLabel={roleLabel(role)}
        scoped={role === "MEMBER" || role === "VIEWER" || role === "PROJECT_MANAGER"}
      />
      <Layout>
        <Topbar />
        {children}
      </Layout>
    </Layout>
  );
}
