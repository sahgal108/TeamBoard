// Drops and recreates the public schema, then applies all migrations.
//   node scripts/reset-db.mjs            → dev database (DATABASE_URL), then seeds
// Non-interactive replacement for `prisma migrate reset`, which refuses to run without a TTY.
import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";

const args = new Set(process.argv.slice(2));
const targets = [{ name: "dev", url: process.env.DATABASE_URL, seed: !args.has("--no-seed") }];

function run(cmd, cmdArgs, url) {
  const r = spawnSync(process.platform === "win32" ? `${cmd}.cmd` : cmd, cmdArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, DATABASE_URL: url },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

for (const t of targets) {
  if (!t.url) {
    console.error(`No URL configured for the ${t.name} database`);
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: t.url });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.end();
  console.log(`[reset-db] ${t.name}: schema dropped, applying migrations`);
  run("npx", ["prisma", "migrate", "deploy"], t.url);
  if (t.seed) run("npx", ["prisma", "db", "seed"], t.url);
}
