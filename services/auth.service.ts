import { signSession } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import type { CompanyRole } from "@/lib/db/enums";
import { Company, CompanyMember, User } from "@/lib/db/models";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { LoginInput } from "@/validations/auth.schema";

export type CompanySummary = { id: string; name: string; slug: string; role: CompanyRole };

export type LoginResult = {
  token: string;
  user: { id: string; name: string; email: string };
  companies: CompanySummary[];
  activeCompanyId: string | null;
};

const withCompany = { model: Company, as: "company", attributes: ["id", "name", "slug"] };

const toSummary = (m: CompanyMember): CompanySummary => ({ id: m.company!.id, name: m.company!.name, slug: m.company!.slug, role: m.role });

async function listCompanies(userId: string): Promise<CompanySummary[]> {
  const rows = await CompanyMember.findAll({ where: { userId }, attributes: ["role"], include: [withCompany], order: [["createdAt", "ASC"]] });
  return rows.map(toSummary);
}

/** Verifies credentials and issues a session. The first company joined becomes the active one. */
export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await User.findOne({ where: { email: input.email }, attributes: ["id", "name", "email", "passwordHash"] });

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
  const membership = await CompanyMember.findOne({ where: { companyId, userId }, attributes: ["role"], include: [withCompany] });
  if (!membership?.company) throw new ForbiddenError("You are not a member of that company");

  const token = await signSession({ sub: userId, activeCompanyId: companyId });
  return { token, company: toSummary(membership) };
}

export { listCompanies };
