import pg from "pg";
import { Sequelize } from "sequelize";

// Columns are `timestamp(3)` without a zone and hold UTC wall time. pg would parse them as
// local time, so read them as UTC; writes use the "+00:00" timezone below.
const TIMESTAMP_OID = 1114;
pg.types.setTypeParser(TIMESTAMP_OID, value => new Date(`${value.replace(" ", "T")}Z`));

// One instance per process. Next.js dev re-evaluates modules on hot reload, so cache on globalThis.
const globalForDb = globalThis as unknown as { sequelize?: Sequelize };

function createInstance() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new Sequelize(url, {
    dialect: "postgres",
    dialectModule: pg, // explicit module so bundlers don't need Sequelize's dynamic require
    timezone: "+00:00",
    logging: false,
    pool: { max: 10, idle: 10_000 },
    define: { freezeTableName: true },
  });
}

export const sequelize: Sequelize = globalForDb.sequelize ?? createInstance();

if (process.env.NODE_ENV !== "production") {
  globalForDb.sequelize = sequelize;
}
