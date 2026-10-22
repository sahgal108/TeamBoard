// sequelize-cli connection settings. Every environment reads DATABASE_URL.
require("dotenv/config");

const base = { use_env_variable: "DATABASE_URL", dialect: "postgres", logging: false };

module.exports = { development: base, test: base, production: base };
