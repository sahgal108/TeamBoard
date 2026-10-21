import type { CompanyRole } from "@/generated/prisma/enums";
import { signSession } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { LoginInput } from "@/validations/auth.schema";

export type CompanySummary = { id: string; name: string; slug: string; role: CompanyRole };

export type LoginResult = {
  token: string;
  user: { id: string; name: string; email: string };
  companies: CompanySummary[];
  activeCompanyId: string | null;
};

async function listCompanies(userId: string): Promise<CompanySummary[]> {
  const rows = await prisma.companyMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { role: true, company: { select: { id: true, name: true, slug: true } } },
  });
  return rows.map(r => ({ ...r.company, role: r.role }));
}

/** Verifies credentials and issues a session. The first company joined becomes the active one. */
export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true, passwordHash: true },
  });

  // Always run the comparison so unknown emails cost the same time as wrong passwords.
  const ok = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !ok) throw new UnauthorizedError("Incorrect email or password");

  const companies = await listCompanies(user.id);
  const activeCompanyId = companies[0]?.id ?? null;
  const token = await signSession({ sub: user.id, activeCompanyId });

  return { token, user: { id: user.id, name: user.name, email: user.email }, companies, activeCompanyId };
}

/** Re-issues the session for another company the user belongs to. Non-members get 403. */
export async function switchCompany(userId: string, companyId: string): Promise<{ token: string; company: CompanySummary }> {
  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { role: true, company: { select: { id: true, name: true, slug: true } } },
  });
  if (!membership) throw new ForbiddenError("You are not a member of that company");

  const token = await signSession({ sub: userId, activeCompanyId: companyId });
  return { token, company: { ...membership.company, role: membership.role } };
}

export { listCompanies };
