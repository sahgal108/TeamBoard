import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ensureRedis, redis } from "@/lib/redis/redis";

type Check = { ok: true; latencyMs: number } | { ok: false; error: string };

async function timed(fn: () => Promise<unknown>): Promise<Check> {
  const start = performance.now();
  try {
    await Promise.race([fn(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout after 3000ms")), 3000))]);
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const [postgres, redisCheck] = await Promise.all([
    timed(() => prisma.$queryRaw`SELECT 1`),
    timed(async () => {
      if (!(await ensureRedis())) throw new Error("not connected");
      const pong = await redis.ping();
      if (pong !== "PONG") throw new Error(`unexpected reply ${pong}`);
    }),
  ]);

  const ok = postgres.ok && redisCheck.ok;
  return NextResponse.json(
    { ok, postgres, redis: redisCheck, node: process.version, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
