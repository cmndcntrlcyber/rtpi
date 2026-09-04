#!/usr/bin/env bash
set -e

# Runs inside the postgres container on first init only (empty data volume).
# Reads passwords from env vars passed via docker-compose.yml, falling back
# to legacy defaults. The sync script (scripts/sync-shared-postgres-roles.sh)
# reconciles on every deploy, so even if defaults are used here, the correct
# password will be applied before dependent services start.

SYSREPTOR_PW="${SYSREPTOR_DB_PASSWORD:-Yu4fDzCVtqDogPOusrdeWNdf29NvpewU}"
DOCMOST_PW="${DOCMOST_DB_PASSWORD:-docmostpassword}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE sysreptor;
  CREATE USER sysreptor WITH PASSWORD '${SYSREPTOR_PW}';
  GRANT ALL PRIVILEGES ON DATABASE sysreptor TO sysreptor;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname sysreptor <<-EOSQL
  ALTER SCHEMA public OWNER TO sysreptor;
  GRANT ALL ON SCHEMA public TO sysreptor;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE docmost;
  CREATE USER docmost WITH PASSWORD '${DOCMOST_PW}';
  GRANT ALL PRIVILEGES ON DATABASE docmost TO docmost;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname docmost <<-EOSQL
  ALTER SCHEMA public OWNER TO docmost;
  GRANT ALL ON SCHEMA public TO docmost;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname rtpi_main <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS "vector";
EOSQL

echo 'Database initialization completed successfully'
