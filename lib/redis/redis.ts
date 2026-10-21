import Redis from "ioredis";

// Two connections: one for commands (cache), one dedicated to pub/sub (a subscribed
// ioredis connection cannot issue regular commands). Both are lazy so importing this
// module never opens a socket by itself.
const globalForRedis = globalThis as unknown as { redis?: Redis; redisSub?: Redis };

function createClient(): Redis {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    // Back off up to 5s between reconnects; never give up (Redis being down must degrade, not crash).
    retryStrategy: attempt => Math.min(attempt * 200, 5000),
  });
  client.on("error", err => {
    // Logged, not thrown: callers treat Redis failures as a cache miss.
    console.warn("[redis]", err.message);
  });
  return client;
}

export const redis: Redis = globalForRedis.redis ?? createClient();
export const redisSub: Redis = globalForRedis.redisSub ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
  globalForRedis.redisSub = redisSub;
}

/** Connects if needed. Resolves false instead of throwing when Redis is unreachable. */
export async function ensureRedis(client: Redis = redis): Promise<boolean> {
  if (client.status === "ready") return true;
  try {
    if (client.status === "wait" || client.status === "end") {
      // connect() resolves once the connection is ready and rejects otherwise.
      await client.connect();
      return true;
    }
    // connecting / reconnecting: don't block the caller; treat as unavailable for now.
    return false;
  } catch {
    return false;
  }
}
