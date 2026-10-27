import "dotenv/config";

/**
 * Points the app at the test database and a separate Redis db. Refuses to run against
 * anything that does not look like a test database, because every file truncates the tables.
 */
export function applyTestEnv(): void {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set; integration tests need their own database");
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to run against "${dbName}": the test database name must end in _test`);

  process.env.DATABASE_URL = url;
  const redis = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
  redis.pathname = "/15";
  process.env.REDIS_URL = redis.toString();
  // A key must exist for the AI features to switch on; tests swap in a fake provider.
  process.env.GEMINI_API_KEY = "test-key";
  process.env.AI_USER_HOURLY_LIMIT = "50";
  process.env.AI_DAILY_TOKEN_BUDGET = "100000";
}
