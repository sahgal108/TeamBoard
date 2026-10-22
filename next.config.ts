import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sequelize loads dialect code at runtime; keep it and the pg driver out of the server bundle.
  serverExternalPackages: ["sequelize", "pg", "pg-hstore"],
};

export default nextConfig;
