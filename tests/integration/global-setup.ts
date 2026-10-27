import { spawnSync } from "node:child_process";
import pg from "pg";
import { applyTestEnv } from "./test-env";

/** Once per run: empty the test database and apply every migration. Files seed their own data. */
export default async function setup() {
  applyTestEnv();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.end();

  const r = spawnSync("npx sequelize-cli db:migrate", {
    stdio: "pipe",
    shell: true,
    env: process.env,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`Migrations failed:\n${r.stdout}\n${r.stderr}`);
}
