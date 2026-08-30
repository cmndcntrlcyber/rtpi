#!/usr/bin/env bash
# RTPI — Sync shared Postgres roles to .env
#
# The shared `rtpi-postgres` container provisions per-service roles
# (`sysreptor`, `docmost`, …) via docker/postgres-init/01-init-databases.sql.
# That init script only runs once, on first boot against an empty data volume.
# After first boot, rotating a password in .env will NOT propagate — the role
# in Postgres still has the original password, and dependent containers
# (rtpi-sysreptor-app, rtpi-docmost, …) crash-loop with `password
# authentication failed`.
#
# This script reconciles that state by reading the current `.env`, then for
# each managed (role, database, env_var) tuple:
#   - if the role does not exist, CREATE it with the .env password
#   - if it exists, ALTER it to the .env password
#   - if the database does not exist, CREATE it owned by the role
#   - ensure `public` schema ownership and required extensions
#
# Idempotent and safe to run on every deploy. Run it AFTER `rtpi-postgres`
# is healthy and BEFORE bringing up dependent profiles (sysreptor, docmost).
#
# Usage:
#   scripts/sync-shared-postgres-roles.sh
#   scripts/sync-shared-postgres-roles.sh --only docmost
#   scripts/sync-shared-postgres-roles.sh --container rtpi-postgres --super rtpi
#
# Exit codes:
#   0  All managed roles/databases reconciled.
#   1  Bad arguments.
#   2  Postgres container not running / not reachable.
#   3  SQL execution failed.

set -u
set -o pipefail

# ─── Repo location ──────────────────────────────────────────────────────────
if command -v git >/dev/null 2>&1 && git rev-parse --show-toplevel >/dev/null 2>&1; then
  REPO_ROOT="$(git rev-parse --show-toplevel)"
else
  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
cd "$REPO_ROOT"

# ─── Defaults / args ────────────────────────────────────────────────────────
CONTAINER="${RTPI_PG_CONTAINER:-rtpi-postgres}"
SUPER_USER="${RTPI_PG_SUPER_USER:-rtpi}"
SUPER_DB="${RTPI_PG_SUPER_DB:-postgres}"
ENV_FILE="${RTPI_ENV_FILE:-.env}"
ONLY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --container) CONTAINER="$2"; shift 2 ;;
    --super)     SUPER_USER="$2"; shift 2 ;;
    --super-db)  SUPER_DB="$2"; shift 2 ;;
    --env)       ENV_FILE="$2"; shift 2 ;;
    --only)      ONLY="$2"; shift 2 ;;
    -h|--help)   sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# ─── Logging ────────────────────────────────────────────────────────────────
info() { echo "  [info]  $*"; }
ok()   { echo "  [ ok ]  $*"; }
warn() { echo "  [warn]  $*" >&2; }
fail() { echo "  [fail]  $*" >&2; exit "${2:-3}"; }

# ─── Managed roles ──────────────────────────────────────────────────────────
# Tuples of: role | database | env-var-holding-password | extensions(csv)
# Add a new line here to manage additional shared-postgres roles.
MANAGED=(
  "rtpi|rtpi_main|DB_PASSWORD|"
  "sysreptor|sysreptor|SYSREPTOR_DB_PASSWORD|uuid-ossp"
  "docmost|docmost|DOCMOST_DB_PASSWORD|uuid-ossp"
)

# ─── External Postgres instances ────────────────────────────────────────────
# Separate containers (not sub-roles of rtpi-postgres).
# Tuples of: container | super_user | super_db | role | env-var-holding-password
# When role == super_user, ALTER ROLE updates the superuser's own password.
EXTERNAL_PG=(
  "rtpi-kasm-db|kasmapp|postgres|kasmapp|KASM_DB_PASSWORD"
)

# ─── Pre-flight ─────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || fail "docker not found in PATH" 2
[[ -f "$ENV_FILE" ]] || fail "env file not found: $ENV_FILE (run from repo root or pass --env)" 1

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  fail "container '$CONTAINER' is not running — start postgres first" 2
fi

# Wait briefly for the server to accept connections (covers race after `up -d`).
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if docker exec "$CONTAINER" pg_isready -U "$SUPER_USER" -d "$SUPER_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec "$CONTAINER" pg_isready -U "$SUPER_USER" -d "$SUPER_DB" >/dev/null 2>&1 \
  || fail "postgres in '$CONTAINER' not accepting connections" 2

# ─── Helpers ────────────────────────────────────────────────────────────────
# Read a KEY=VALUE from $ENV_FILE without sourcing the file (avoids executing
# anything inside it). Returns empty string if not present.
read_env() {
  local key="$1"
  awk -F= -v k="$key" '
    /^[[:space:]]*#/ { next }
    {
      sub(/^[[:space:]]+/, "", $1);
      sub(/[[:space:]]+$/, "", $1);
      if ($1 == k) {
        v = substr($0, index($0, "=") + 1);
        # strip surrounding quotes
        gsub(/^["'\'']|["'\'']$/, "", v);
        print v;
        exit;
      }
    }
  ' "$ENV_FILE"
}

# Escape a value for use inside a single-quoted SQL literal.
sql_quote() {
  printf "%s" "$1" | sed "s/'/''/g"
}

# Run a SQL script piped on stdin against $SUPER_DB.
psql_super() {
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -X -q -U "$SUPER_USER" -d "$SUPER_DB"
}

# Run a SQL script against a specific database (e.g. just-created role db).
psql_db() {
  local db="$1"
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -X -q -U "$SUPER_USER" -d "$db"
}

# ─── Reconcile each managed tuple ──────────────────────────────────────────
RECONCILED=0
SKIPPED=0

for spec in "${MANAGED[@]}"; do
  IFS='|' read -r role db env_var ext_csv <<<"$spec"

  if [[ -n "$ONLY" && "$ONLY" != "$role" ]]; then
    continue
  fi

  pw="$(read_env "$env_var")"
  if [[ -z "$pw" ]]; then
    warn "$env_var not set in $ENV_FILE — skipping role '$role'"
    ((SKIPPED++))
    continue
  fi

  info "reconciling role=$role db=$db (password from \$$env_var)"

  pw_sql="$(sql_quote "$pw")"

  # 1) Role: CREATE or ALTER to match .env. Idempotent.
  if ! psql_super <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$role') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '$role', '$pw_sql');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '$role', '$pw_sql');
  END IF;
END
\$\$;
SQL
  then
    fail "failed to create/alter role '$role'" 3
  fi

  # 2) Database: CREATE if missing, owned by role. (CREATE DATABASE can't run
  #    inside a DO block — guard with a SELECT-into-shell test instead.)
  exists=$(docker exec "$CONTAINER" psql -tA -U "$SUPER_USER" -d "$SUPER_DB" \
    -c "SELECT 1 FROM pg_database WHERE datname = '$db'" 2>/dev/null || true)
  if [[ "$exists" != "1" ]]; then
    info "  creating database '$db' owned by '$role'"
    docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -X -q -U "$SUPER_USER" -d "$SUPER_DB" \
      -c "CREATE DATABASE \"$db\" OWNER \"$role\";" >/dev/null \
      || fail "failed to create database '$db'" 3
  fi

  # Make sure the role can actually use the database (and that ownership /
  # schema perms are correct even if the db was created by a prior superuser).
  if ! psql_super <<SQL
GRANT ALL PRIVILEGES ON DATABASE "$db" TO "$role";
SQL
  then
    fail "failed to grant privileges on '$db' to '$role'" 3
  fi

  # 3) Inside the role's database: own public schema + required extensions.
  ext_sql=""
  if [[ -n "$ext_csv" ]]; then
    IFS=',' read -r -a exts <<<"$ext_csv"
    for ext in "${exts[@]}"; do
      ext_trim="$(echo "$ext" | tr -d '[:space:]')"
      [[ -z "$ext_trim" ]] && continue
      ext_sql+=$'\n'"CREATE EXTENSION IF NOT EXISTS \"$ext_trim\";"
    done
  fi

  if ! psql_db "$db" <<SQL
ALTER SCHEMA public OWNER TO "$role";
GRANT ALL ON SCHEMA public TO "$role";${ext_sql}
SQL
  then
    fail "failed to configure schema/extensions on '$db'" 3
  fi

  ok "$role / $db reconciled"
  ((RECONCILED++))
done

# ─── Reconcile external Postgres instances ──────────────────────────────────
for spec in "${EXTERNAL_PG[@]}"; do
  IFS='|' read -r ext_container ext_super ext_superdb role env_var <<<"$spec"

  if [[ -n "$ONLY" && "$ONLY" != "$role" ]]; then
    continue
  fi

  pw="$(read_env "$env_var")"
  if [[ -z "$pw" ]]; then
    warn "$env_var not set in $ENV_FILE — skipping role '$role' on $ext_container"
    ((SKIPPED++))
    continue
  fi

  if ! docker inspect -f '{{.State.Running}}' "$ext_container" 2>/dev/null | grep -q true; then
    warn "container '$ext_container' not running — skipping"
    ((SKIPPED++))
    continue
  fi

  for _ in 1 2 3 4 5; do
    docker exec "$ext_container" pg_isready -U "$ext_super" -d "$ext_superdb" >/dev/null 2>&1 && break
    sleep 2
  done

  info "reconciling role=$role on $ext_container (password from \$$env_var)"
  pw_sql="$(sql_quote "$pw")"

  if ! docker exec -i "$ext_container" psql -v ON_ERROR_STOP=1 -X -q \
       -U "$ext_super" -d "$ext_superdb" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$role') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '$role', '$pw_sql');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '$role', '$pw_sql');
  END IF;
END
\$\$;
SQL
  then
    fail "failed to alter role '$role' on $ext_container" 3
  fi

  ok "$role on $ext_container reconciled"
  ((RECONCILED++))
done

echo
ok "shared postgres roles synced: $RECONCILED reconciled, $SKIPPED skipped"
