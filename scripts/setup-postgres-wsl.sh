#!/usr/bin/env bash
# One-shot local database setup for WSL Ubuntu (no Docker).
# Installs PostgreSQL, enables it and Redis on boot, creates the TeamBoard role and databases.
# Safe to re-run: every step is idempotent.
#
# Usage (from a WSL terminal):  sudo bash scripts/setup-postgres-wsl.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi

DB_USER="workstack"
DB_PASS="workstack"

echo "==> Installing PostgreSQL (Ubuntu default version)"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib >/dev/null

echo "==> Enabling PostgreSQL and Redis to start with WSL"
systemctl enable --now postgresql >/dev/null
systemctl enable --now redis-server >/dev/null 2>&1 || true

echo "==> Waiting for PostgreSQL to accept connections"
for _ in $(seq 1 20); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done
sudo -u postgres pg_isready

echo "==> Creating role '${DB_USER}' and databases (skips anything that already exists)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}' CREATEDB;
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_USER} OWNER ${DB_USER}'
  WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${DB_USER}')\gexec
SQL

# PostgreSQL 14 leaves the public schema owned by postgres even when the database has another
# owner; scripts/reset-db.mjs drops and recreates that schema, so hand it to the app role.
sudo -u postgres psql -d "${DB_USER}" -qc "ALTER SCHEMA public OWNER TO ${DB_USER};"

echo "==> Verifying with the app credentials"
PGPASSWORD="${DB_PASS}" psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_USER}" -tAc "SELECT 'connected as ' || current_user || ' to ' || current_database() || ' on ' || split_part(version(), ',', 1);"

cat <<EOF

Done. Connection details (already in .env):
  host 127.0.0.1  port 5432  user ${DB_USER}  password ${DB_PASS}
  database: ${DB_USER}
EOF
