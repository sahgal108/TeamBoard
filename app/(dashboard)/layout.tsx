import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getCompanyContext, type CompanyContext } from "@/lib/auth/get-company-context";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { listCompanies } from "@/services/auth.service";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  let ctx: CompanyContext;
  try {
    ctx = await getCompanyContext();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/login");
    if (err instanceof ForbiddenError) {
      return (
        <main className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h1 className="font-display text-xl font-semibold">No company to show</h1>
            <p className="mt-2 text-sm text-ink-2">{err.message}. Ask an administrator to add you to a company, then sign in again.</p>
          </div>
        </main>
      );
    }
    throw err;
  }

  const companies = await listCompanies(ctx.user.id);

  return (
    <div className="flex min-h-screen">
      <Sidebar ctx={ctx} companies={companies} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {children}
      </div>
    </div>
  );
}
