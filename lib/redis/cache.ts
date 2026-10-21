import { ensureRedis, redis } from "./redis";

export type CacheResult<T> = { value: T; hit: boolean };

/**
 * Cache-aside. Redis problems are logged and treated as a miss, so the app degrades to
 * "slower" rather than "broken". Values are JSON; Dates come back as ISO strings, so cached
 * shapes are the API response shapes, not Prisma rows.
 */
export async function getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<CacheResult<T>> {
  if (await ensureRedis()) {
    try {
      const raw = await redis.get(key);
      if (raw !== null) return { value: JSON.parse(raw) as T, hit: true };
    } catch (err) {
      console.warn("[cache] get failed", key, err instanceof Error ? err.message : err);
    }
  }

  const value = await loader();

  if (redis.status === "ready") {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      console.warn("[cache] set failed", key, err instanceof Error ? err.message : err);
    }
  }
  return { value, hit: false };
}

/** Exact-key invalidation only. Never KEYS/SCAN patterns: keys are known from lib/redis/keys.ts. */
export async function invalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (!(await ensureRedis())) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    console.warn("[cache] del failed", keys, err instanceof Error ? err.message : err);
  }
}
