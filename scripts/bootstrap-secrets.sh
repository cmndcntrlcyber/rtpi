#!/usr/bin/env bash
# RTPI Secret Bootstrap
# Generates every secret/key/password the stack needs, writes them into
# .env, configs/rtpi-sysreptor/app.env, and docker/postgres-init/01-init-databases.sql,
# then saves a backup copy to ~/.rtpi/credentials-<timestamp>.env (mode 600).
#
# Usage: bootstrap-secrets.sh [--force] [--reset-volumes]
#   --force           Regenerate even if .env already exists with a bootstrap marker.
#   --reset-volumes   When rotating (--force), also tear down the stack and
#                     remove stateful DB volumes so the new credentials apply.
#                     DESTRUCTIVE: wipes sysreptor / workbench / postgres data.

set -euo pipefail

# ─── Repo location ──────────────────────────────────────────────────────────
if command -v git >/dev/null 2>&1 && git rev-parse --show-toplevel >/dev/null 2>&1; then
  REPO_ROOT="$(git rev-parse --show-toplevel)"
else
  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
cd "$REPO_ROOT"

# ─── Args ───────────────────────────────────────────────────────────────────
FORCE=0
RESET_VOLUMES=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --reset-volumes) RESET_VOLUMES=1 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# Stateful volumes that embed auth credentials. Rotating secrets without
# clearing these leaves services running with the OLD password — new env
# values are ignored because *_INITDB_* scripts only run on first boot.
STATEFUL_VOLUMES=(
  rtpi_workbench-db-data
  rtpi_postgres-data
  rtpi_sysreptor-db-data
  rtpi_mem0-postgres-data
  rtpi_kasm-db-data
  rtpi_kasm-api-data
  rtpi_kasm-manager-data
  rtpi_kasm-agent-data
  rtpi_kasm-guac-data
)

MARKER="# RTPI_BOOTSTRAP_GENERATED"
ENV_FILE=".env"
SYSREPTOR_ENV="configs/rtpi-sysreptor/app.env"
SYSREPTOR_ENV_EXAMPLE="configs/rtpi-sysreptor/app.env.example"
PG_INIT="docker/postgres-init/01-init-databases.sql"

# ─── Logging ────────────────────────────────────────────────────────────────
info()    { echo "  [info]  $*"; }
ok()      { echo "  [ ok ]  $*"; }
warn()    { echo "  [warn]  $*" >&2; }
fatal()   { echo "  [fail]  $*" >&2; exit 1; }

# ─── Pre-flight ─────────────────────────────────────────────────────────────
command -v openssl >/dev/null 2>&1 || fatal "openssl is required but not installed"
[[ -f ".env.example" ]] || fatal ".env.example not found at repo root"
[[ -f "$SYSREPTOR_ENV_EXAMPLE" ]] || fatal "$SYSREPTOR_ENV_EXAMPLE not found"
[[ -f "$PG_INIT" ]] || fatal "$PG_INIT not found"

# Idempotency guard
if [[ -f "$ENV_FILE" && "$FORCE" -eq 0 ]]; then
  if head -1 "$ENV_FILE" | grep -q "$MARKER"; then
    info ".env already bootstrapped; use --force to regenerate"
    exit 0
  else
    fatal ".env exists but was not produced by this script. Refusing to overwrite. Move it aside or pass --force."
  fi
fi

# ─── Stateful volume handling on rotation ──────────────────────────────────
# When FORCE=1 and stateful volumes already exist, the new secrets will NOT
# apply to those services until the volumes are reset. Either clear them
# automatically (--reset-volumes) or print a loud warning so the operator
# knows what to do.
if [[ "$FORCE" -eq 1 ]] && command -v docker >/dev/null 2>&1; then
  existing_volumes=()
  for v in "${STATEFUL_VOLUMES[@]}"; do
    if docker volume inspect "$v" >/dev/null 2>&1; then
      existing_volumes+=("$v")
    fi
  done

  if [[ ${#existing_volumes[@]} -gt 0 ]]; then
    if [[ "$RESET_VOLUMES" -eq 1 ]]; then
      info "Resetting stateful volumes: ${existing_volumes[*]}"
      docker compose --profile sysreptor down -v --remove-orphans 2>/dev/null || \
        docker compose down -v --remove-orphans 2>/dev/null || true
      for v in "${existing_volumes[@]}"; do
        docker volume rm -f "$v" >/dev/null 2>&1 || warn "could not remove $v (container still attached?)"
      done
      ok "Stateful volumes cleared"
    else
      warn "Existing stateful volumes detected: ${existing_volumes[*]}"
      warn "These volumes hold credentials from a prior bootstrap. New passwords"
      warn "will NOT take effect until the volumes are cleared. Re-run with"
      warn "  $0 --force --reset-volumes"
      warn "or manually: docker compose down -v && docker volume rm ${existing_volumes[*]}"
    fi
  fi
fi

# ─── Generators ─────────────────────────────────────────────────────────────
gen_hex()    { openssl rand -hex "$1"; }
gen_b64()    { openssl rand -base64 "$1" | tr -d '\n'; }
gen_alnum()  { openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$1"; }
gen_uuid()   { if [[ -r /proc/sys/kernel/random/uuid ]]; then cat /proc/sys/kernel/random/uuid; else uuidgen; fi; }
gen_password() {
  # alnum + one of each: upper, lower, digit, symbol; total length = $1
  local len="$1"
  # NOTE: intentionally excludes $ ` \ ' " # (unsafe in .env / docker-compose
  # variable interpolation and shell quoting).
  local symbols='!@%^&*-_=+.:?'
  local upper=$(openssl rand -base64 6 | tr -dc 'A-Z' | head -c 1)
  local lower=$(openssl rand -base64 6 | tr -dc 'a-z' | head -c 1)
  local digit=$(openssl rand -base64 6 | tr -dc '0-9' | head -c 1)
  local sym="${symbols:$(( RANDOM % ${#symbols} )):1}"
  local rest=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c $(( len - 4 )))
  # shuffle
  echo "${upper}${lower}${digit}${sym}${rest}" | fold -w1 | shuf | tr -d '\n'
}

# ─── Generate values ────────────────────────────────────────────────────────
info "Generating secrets..."
ENCRYPTION_KEY="$(gen_hex 32)"                  # 64 hex chars
SESSION_SECRET="$(gen_b64 64)"
JWT_SECRET="$(gen_b64 64)"
DEFAULT_ADMIN_PASSWORD="$(gen_password 24)"
REDIS_PASSWORD="$(gen_alnum 32)"
EMPIRE_PASSWORD="$(gen_password 24)"
WORKBENCH_DB_PASSWORD="$(gen_alnum 32)"
WORKBENCH_SESSION_SECRET="$(gen_b64 64)"
KASM_VNC_PASSWORD="$(gen_password 16)"
KASM_SHARE_ID="$(gen_uuid)"                     # kasmweb/share requires a valid UUID
KASM_MANAGER_ID="$(gen_uuid)"                   # kasmweb/manager requires a valid UUID
KASM_AGENT_ID="$(gen_uuid)"                     # kasmweb/agent requires a valid UUID
KASM_DB_PASSWORD="$(gen_alnum 32)"              # Postgres password for kasmapp user
SYSREPTOR_DB_PASSWORD="$(gen_alnum 32)"
SYSREPTOR_REDIS_PASSWORD="$(gen_alnum 32)"
SYSREPTOR_SECRET_KEY="$(gen_b64 50)"
SYSREPTOR_AES_KEY="$(gen_b64 32)"
SYSREPTOR_KEY_ID="$(gen_uuid)"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%SZ)"

# ─── Helper: in-place substitution with `|` delimiter (base64-safe) ────────
sub() {
  # sub <file> <VAR> <value>
  local file="$1" var="$2" val="$3"
  # Escape backslashes and pipes in value for sed RHS
  local escaped
  escaped=$(printf '%s' "$val" | sed -e 's/[\\&|]/\\&/g')
  if grep -qE "^${var}=" "$file"; then
    sed -i -E "s|^${var}=.*|${var}=${escaped}|" "$file"
  else
    echo "${var}=${val}" >> "$file"
  fi
}

# ─── Build .env ────────────────────────────────────────────────────────────
info "Writing $ENV_FILE"
cp .env.example "$ENV_FILE"

# Prepend marker
sed -i "1i ${MARKER} ${TIMESTAMP}" "$ENV_FILE"

sub "$ENV_FILE" ENCRYPTION_KEY             "$ENCRYPTION_KEY"
sub "$ENV_FILE" SESSION_SECRET             "$SESSION_SECRET"
sub "$ENV_FILE" JWT_SECRET                 "$JWT_SECRET"
sub "$ENV_FILE" DEFAULT_ADMIN_PASSWORD     "$DEFAULT_ADMIN_PASSWORD"
sub "$ENV_FILE" REDIS_PASSWORD             "$REDIS_PASSWORD"
sub "$ENV_FILE" EMPIRE_PASSWORD            "$EMPIRE_PASSWORD"
sub "$ENV_FILE" WORKBENCH_DB_PASSWORD      "$WORKBENCH_DB_PASSWORD"
sub "$ENV_FILE" WORKBENCH_SESSION_SECRET   "$WORKBENCH_SESSION_SECRET"
sub "$ENV_FILE" KASM_VNC_PASSWORD          "$KASM_VNC_PASSWORD"
sub "$ENV_FILE" KASM_PROXY_ENABLED         "true"
sub "$ENV_FILE" KASM_PUBLIC_HTTPS_PORT     "8443"
sub "$ENV_FILE" KASM_SHARE_ID              "$KASM_SHARE_ID"
sub "$ENV_FILE" KASM_MANAGER_ID            "$KASM_MANAGER_ID"
sub "$ENV_FILE" KASM_AGENT_ID              "$KASM_AGENT_ID"
sub "$ENV_FILE" KASM_DB_PASSWORD           "$KASM_DB_PASSWORD"
sub "$ENV_FILE" SYSREPTOR_DB_PASSWORD      "$SYSREPTOR_DB_PASSWORD"
sub "$ENV_FILE" SYSREPTOR_REDIS_PASSWORD   "$SYSREPTOR_REDIS_PASSWORD"
chmod 600 "$ENV_FILE"
ok "Wrote $ENV_FILE"

# ─── Build configs/rtpi-sysreptor/app.env ──────────────────────────────────
info "Writing $SYSREPTOR_ENV"
cp "$SYSREPTOR_ENV_EXAMPLE" "$SYSREPTOR_ENV"
sed -i "1i ${MARKER} ${TIMESTAMP}" "$SYSREPTOR_ENV"

ENCRYPTION_KEYS_JSON=$(printf '[{"id":"%s","key":"%s","cipher":"AES-GCM","revoked":false}]' \
  "$SYSREPTOR_KEY_ID" "$SYSREPTOR_AES_KEY")

CELERY_URL="redis://:${SYSREPTOR_REDIS_PASSWORD}@sysreptor-redis:6379/0"

sub "$SYSREPTOR_ENV" SECRET_KEY                "$SYSREPTOR_SECRET_KEY"
sub "$SYSREPTOR_ENV" ENCRYPTION_KEYS           "$ENCRYPTION_KEYS_JSON"
sub "$SYSREPTOR_ENV" DEFAULT_ENCRYPTION_KEY_ID "$SYSREPTOR_KEY_ID"
sub "$SYSREPTOR_ENV" DATABASE_PASSWORD         "$SYSREPTOR_DB_PASSWORD"
sub "$SYSREPTOR_ENV" REDIS_PASSWORD            "$SYSREPTOR_REDIS_PASSWORD"
sub "$SYSREPTOR_ENV" CELERY_BROKER_URL         "$CELERY_URL"
sub "$SYSREPTOR_ENV" CELERY_RESULT_BACKEND     "$CELERY_URL"
chmod 600 "$SYSREPTOR_ENV"
ok "Wrote $SYSREPTOR_ENV"

# ─── Patch docker/postgres-init/01-init-databases.sql ──────────────────────
info "Patching $PG_INIT"
# Replace whatever password is currently on the CREATE USER sysreptor line.
# Escape for sed replacement
escaped_db_pw=$(printf '%s' "$SYSREPTOR_DB_PASSWORD" | sed -e 's/[\\&|]/\\&/g')
if grep -qE "CREATE USER sysreptor WITH PASSWORD '[^']+';" "$PG_INIT"; then
  sed -i -E "s|(CREATE USER sysreptor WITH PASSWORD ')[^']+(';)|\1${escaped_db_pw}\2|g" "$PG_INIT"
  ok "Patched $PG_INIT"
else
  warn "$PG_INIT has no matching CREATE USER sysreptor line; skipping"
fi

# ─── Credentials backup ────────────────────────────────────────────────────
# Support running in a container where HOME might be /root
BACKUP_DIR="${HOME:-/root}/.rtpi"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/credentials-${TIMESTAMP}.env"

cat > "$BACKUP_FILE" <<EOF
# RTPI generated credentials
# Generated: ${TIMESTAMP}
# Source files written:
#   ${REPO_ROOT}/${ENV_FILE}
#   ${REPO_ROOT}/${SYSREPTOR_ENV}
#   ${REPO_ROOT}/${PG_INIT}
#
# Destinations (for reference):
#   ENCRYPTION_KEY, SESSION_SECRET, JWT_SECRET, DEFAULT_ADMIN_PASSWORD,
#   REDIS_PASSWORD, EMPIRE_PASSWORD, WORKBENCH_DB_PASSWORD,
#   WORKBENCH_SESSION_SECRET, KASM_VNC_PASSWORD, SYSREPTOR_*  -> .env
#
#   SECRET_KEY, ENCRYPTION_KEYS, DEFAULT_ENCRYPTION_KEY_ID,
#   DATABASE_PASSWORD, REDIS_PASSWORD, CELERY_*  -> configs/rtpi-sysreptor/app.env
#
#   sysreptor user password  -> docker/postgres-init/01-init-databases.sql

ENCRYPTION_KEY=${ENCRYPTION_KEY}
SESSION_SECRET=${SESSION_SECRET}
JWT_SECRET=${JWT_SECRET}
DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
EMPIRE_PASSWORD=${EMPIRE_PASSWORD}
WORKBENCH_DB_PASSWORD=${WORKBENCH_DB_PASSWORD}
WORKBENCH_SESSION_SECRET=${WORKBENCH_SESSION_SECRET}
KASM_VNC_PASSWORD=${KASM_VNC_PASSWORD}
KASM_SHARE_ID=${KASM_SHARE_ID}
KASM_MANAGER_ID=${KASM_MANAGER_ID}
KASM_AGENT_ID=${KASM_AGENT_ID}
KASM_DB_PASSWORD=${KASM_DB_PASSWORD}
SYSREPTOR_DB_PASSWORD=${SYSREPTOR_DB_PASSWORD}
SYSREPTOR_REDIS_PASSWORD=${SYSREPTOR_REDIS_PASSWORD}
SYSREPTOR_SECRET_KEY=${SYSREPTOR_SECRET_KEY}
SYSREPTOR_AES_KEY=${SYSREPTOR_AES_KEY}
SYSREPTOR_KEY_ID=${SYSREPTOR_KEY_ID}
EOF
chmod 600 "$BACKUP_FILE"
ln -sf "$BACKUP_FILE" "${BACKUP_DIR}/credentials.latest.env"
ok "Backup saved to $BACKUP_FILE"

# ─── Summary ────────────────────────────────────────────────────────────────
cat <<EOF

─────────────────────────────────────────────────────────────────────
  RTPI bootstrap complete
─────────────────────────────────────────────────────────────────────
  .env                              written (mode 600)
  configs/rtpi-sysreptor/app.env    written (mode 600)
  docker/postgres-init/01-init-*    patched
  Backup credentials                ${BACKUP_FILE}
  Latest symlink                    ${BACKUP_DIR}/credentials.latest.env

  Default admin login (printed here ONLY — also in backup file):
    username  admin
    password  ${DEFAULT_ADMIN_PASSWORD}

  NOTE: if postgres data volume already exists from a previous run,
  you must \`docker compose down -v\` before \`up\` so the postgres-init
  script runs again with the new password. Existing sysreptor data
  will be lost.
─────────────────────────────────────────────────────────────────────
EOF
