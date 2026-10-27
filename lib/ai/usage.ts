import type { CompanyContext } from "@/lib/auth/get-company-context";
import { AiUnavailableError, RateLimitedError } from "@/lib/errors";
import { limitKeys } from "@/lib/redis/keys";
import { ensureRedis, redis } from "@/lib/redis/redis";
import { getProvider, type JsonRequest, type JsonResult } from "./provider";

const USER_HOURLY_LIMIT = Number(process.env.AI_USER_HOURLY_LIMIT ?? 20);
const COMPANY_DAILY_TOKENS = Number(process.env.AI_DAILY_TOKEN_BUDGET ?? 200_000);

const hourBucket = (d: Date) => d.toISOString().slice(0, 13); // 2026-10-27T16
const dayBucket = (d: Date) => d.toISOString().slice(0, 10); // 2026-10-27
const secondsUntilNextHour = (d: Date) => 3600 - (d.getUTCMinutes() * 60 + d.getUTCSeconds());
const secondsUntilNextDay = (d: Date) => 86_400 - (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds());

/**
 * Every model call goes through here: per-user hourly request limit, per-company daily token
 * budget, then the provider, then the tokens actually used are added to the budget.
 *
 * Unlike the cache, these limits fail CLOSED: if Redis is down nobody can spend tokens,
 * because an unmetered AI endpoint is a bill nobody agreed to.
 */
export async function generateJson<T>(ctx: CompanyContext, req: JsonRequest<T>): Promise<JsonResult<T>> {
  const provider = getProvider();
  if (!(await ensureRedis())) throw new AiUnavailableError("AI usage limits cannot be checked right now, so AI is paused.");

  const now = new Date();
  const userKey = limitKeys.aiUserHour(ctx.user.id, hourBucket(now));
  const budgetKey = limitKeys.aiCompanyTokensDay(ctx.company.id, dayBucket(now));

  // exec() → [[err, incr], [err, expire], [err, get]]
  const replies = await redis.multi().incr(userKey).expire(userKey, 3600).get(budgetKey).exec();
  const requests = Number(replies?.[0]?.[1] ?? 0);
  const used = Number(replies?.[2]?.[1] ?? 0);
  if (requests > USER_HOURLY_LIMIT) {
    throw new RateLimitedError(`You can make ${USER_HOURLY_LIMIT} AI requests an hour. Try again later.`, secondsUntilNextHour(now));
  }
  if (used >= COMPANY_DAILY_TOKENS) {
    throw new RateLimitedError(`${ctx.company.name} has used today's AI allowance. It resets at midnight UTC.`, secondsUntilNextDay(now));
  }

  const result = await provider.generateJson(req);
  try {
    await redis.multi().incrby(budgetKey, result.tokens).expire(budgetKey, 2 * 86_400).exec();
  } catch (err) {
    console.warn("[ai] could not record token usage", err instanceof Error ? err.message : err);
  }
  return result;
}
