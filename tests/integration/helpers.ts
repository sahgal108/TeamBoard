import type { AIProvider, JsonRequest, JsonResult } from "@/lib/ai/provider";
import { setProviderForTests } from "@/lib/ai/provider";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { Company, CompanyMember, User } from "@/lib/db/models";
import { ensureRedis, redis } from "@/lib/redis/redis";
import { seed } from "@/db/seed";

export type SeedIds = Awaited<ReturnType<typeof seed>>;

/** Fresh demo data (the same as `npm run db:seed`) and an empty Redis test db. */
export async function resetData(): Promise<SeedIds> {
  const ids = await seed();
  await flushRedis();
  return ids;
}

export async function flushRedis(): Promise<void> {
  if (!(await ensureRedis())) throw new Error("Redis is not reachable; integration tests need it");
  await redis.flushdb();
}

/** The same context getCompanyContext builds from a session, for a demo account. */
export async function ctxFor(email: string, companySlug?: string): Promise<CompanyContext> {
  const user = await User.findOne({ where: { email }, rejectOnEmpty: true });
  const membership = await CompanyMember.findOne({
    where: { userId: user.id },
    include: [{ model: Company, as: "company", ...(companySlug ? { where: { slug: companySlug } } : {}) }],
    rejectOnEmpty: true,
  });
  const company = membership.company!;
  return {
    user: { id: user.id, name: user.name, email: user.email },
    company: { id: company.id, name: company.name, slug: company.slug },
    membership: { id: membership.id, role: membership.role },
  };
}

export const login = {
  ceo: () => ctxFor("ceo@acme.test"),
  pm: () => ctxFor("pm@acme.test"),
  lead: () => ctxFor("lead@acme.test"),
  dev1: () => ctxFor("dev1@acme.test"),
  viewer: () => ctxFor("viewer@acme.test"),
  globexCeo: () => ctxFor("ceo@globex.test"),
};

/**
 * Stands in for Gemini. `reply` builds the model's answer from the request, so a test can
 * inspect exactly what would have been sent and return anything, including bad data.
 */
export function fakeProvider(reply: (req: JsonRequest<unknown>) => unknown) {
  const calls: JsonRequest<unknown>[] = [];
  const provider: AIProvider = {
    name: "fake",
    async generateJson<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
      calls.push(req as JsonRequest<unknown>);
      return { value: req.schema.parse(reply(req as JsonRequest<unknown>)), model: "fake-model", tokens: 100, ms: 1 };
    },
  };
  setProviderForTests(provider);
  return { calls };
}
