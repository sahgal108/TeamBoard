import type { NextRequest } from "next/server";
import { getCompanyContext, type CompanyContext } from "@/lib/auth/get-company-context";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/get-current-user";
import { toResponse } from "@/lib/errors";

/** Next 16 route handler signature: params arrive as a Promise. */
export type RouteContext<P = Record<string, string>> = { params: Promise<P> };

type Handler<P> = (req: NextRequest, route: RouteContext<P>) => Promise<Response>;
type UserHandler<P> = (req: NextRequest, current: CurrentUser, route: RouteContext<P>) => Promise<Response>;
type CompanyHandler<P> = (req: NextRequest, ctx: CompanyContext, route: RouteContext<P>) => Promise<Response>;

/** Public route: only guarantees the error envelope. */
export function handle<P = Record<string, string>>(fn: Handler<P>): Handler<P> {
  return async (req, route) => {
    try {
      return await fn(req, route);
    } catch (err) {
      return toResponse(err);
    }
  };
}

/** Route that needs a signed-in user but no company (e.g. switch-company, list my companies). */
export function withUser<P = Record<string, string>>(fn: UserHandler<P>): Handler<P> {
  return handle(async (req, route) => fn(req, await getCurrentUser(req), route));
}

/**
 * Route inside a tenant. Step 1 of the mutation pipeline: the context is
 * resolved and membership proven before the handler body runs. Handlers then parse input,
 * load the resource tenant-scoped, check `can()`, and call a service.
 */
export function withAuth<P = Record<string, string>>(fn: CompanyHandler<P>): Handler<P> {
  return handle(async (req, route) => fn(req, await getCompanyContext(req), route));
}

/** Parses a JSON body; an empty or malformed body becomes `{}` so zod reports the fields. */
export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Query string as a plain object for zod (`?status=DONE&mine=1`). Repeated keys keep the last value. */
export function readQuery(req: NextRequest): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}
