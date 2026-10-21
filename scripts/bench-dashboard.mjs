// Measures GET /api/dashboard latency with a cold cache (invalidating before every request)
// versus a warm cache (repeated hits). Prints p50 / p95 for both plus the DB-only work saved.
//
//   node scripts/bench-dashboard.mjs [baseUrl=http://localhost:3000] [iterations=40]
//
// Signs in as the seeded CEO; requires the dev server and Redis to be running.
import "dotenv/config";
import Redis from "ioredis";

const base = process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const iterations = Number(process.argv[3] ?? 40);
const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

const login = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "ceo@acme.test", password: "Password123!" }),
});
if (!login.ok) throw new Error(`login failed: ${login.status}`);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
const me = await (await fetch(`${base}/api/me`, { headers: { cookie } })).json();
const companyId = me.data.company.id;

async function timeOne() {
  const t0 = performance.now();
  const res = await fetch(`${base}/api/dashboard`, { headers: { cookie } });
  await res.arrayBuffer();
  return { ms: performance.now() - t0, cache: res.headers.get("x-cache") };
}

const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];

// Warm up the route once so Next's compilation is not measured.
await timeOne();

const cold = [];
for (let i = 0; i < iterations; i++) {
  await redis.del(`dashboard:${companyId}`);
  const r = await timeOne();
  if (r.cache !== "MISS") throw new Error(`expected MISS, got ${r.cache}`);
  cold.push(r.ms);
}

await timeOne(); // populate
const warm = [];
for (let i = 0; i < iterations; i++) {
  const r = await timeOne();
  if (r.cache !== "HIT") throw new Error(`expected HIT, got ${r.cache}`);
  warm.push(r.ms);
}

const fmt = n => `${n.toFixed(1)} ms`;
console.log(`GET /api/dashboard · ${iterations} requests each · ${base}`);
console.log(`cold (Redis MISS → 8 Postgres counts):  p50 ${fmt(pct(cold, 50))}   p95 ${fmt(pct(cold, 95))}`);
console.log(`warm (Redis HIT):                        p50 ${fmt(pct(warm, 50))}   p95 ${fmt(pct(warm, 95))}`);
console.log(`p50 saved by the cache: ${fmt(pct(cold, 50) - pct(warm, 50))} (${Math.round((1 - pct(warm, 50) / pct(cold, 50)) * 100)}%)`);
console.log("note: every response still runs the role-specific project list and activity feed uncached; only the company counts are served from Redis.");
redis.disconnect();
