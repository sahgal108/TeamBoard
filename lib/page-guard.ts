import { notFound, redirect } from "next/navigation";
import { getCompanyContext, type CompanyContext } from "@/lib/auth/get-company-context";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";

/** Server components: resolve the tenant context or bounce to sign-in. */
export async function requireCompanyContext(): Promise<CompanyContext> {
  try {
    return await getCompanyContext();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/login");
    if (err instanceof ForbiddenError) redirect("/login?reason=no-company");
    throw err;
  }
}

/**
 * Runs a service call for a page. NotFound (including "exists but you can't see it")
 * renders the route group's not-found page; Forbidden bubbles to error.tsx.
 */
export async function forPage<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}
