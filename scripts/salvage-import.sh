#!/usr/bin/env bash
# Salvage-import: pull user-generated tables from the shadow Postgres
# (decommissioned host, running at localhost:55432) into the live stack.
#
# Preconditions:
#   - shadow pg running:  docker ps | grep rtpi-salvage-pg
#   - live stack up:      docker compose ps postgres (healthy)
#   - .env has current DB_PASSWORD + ENCRYPTION_KEY
#
# What it does:
#   1. pg_dump --data-only of the chosen table set from shadow
#   2. Rewrites the old-admin-user row to a "-legacy" suffix so it coexists
#   3. Loads into live DB inside a transaction
#   4. Remaps all FK references from old-admin-uuid → new-admin-uuid
#   5. Calls scripts/salvage-reencrypt.ts to fix AES-encrypted columns
#
# Abort-safe: the whole payload runs inside a single transaction. Any error
# rolls back. The shadow DB is never written to.

set -eo pipefail

REPO=/home/cmndcntrl/code/rtpi
cd "$REPO"

# Read only the variables we need from .env without sourcing (avoids bash
# interpreting $-references inside generated passwords as unbound vars).
read_env() {
  local key="$1" line
  line=$(grep -E "^${key}=" .env | head -1 || true)
  printf '%s' "${line#${key}=}"
}
DB_USER="$(read_env DB_USER)"
DB_PASSWORD="$(read_env DB_PASSWORD)"
DB_NAME="$(read_env DB_NAME)"

SHADOW_USER=rtpi
SHADOW_PASS=salvage
SHADOW_PORT=55432
SHADOW_CTN=rtpi-salvage-pg
SHADOW_DB=rtpi_main

LIVE_DB_USER="${DB_USER:-rtpi}"
LIVE_DB_NAME="${DB_NAME:-rtpi_main}"
LIVE_PG_CONTAINER="$(docker compose ps -q postgres 2>/dev/null)"
[ -n "$LIVE_PG_CONTAINER" ] || { echo "live postgres container not running"; exit 1; }

STAMP=$(date -u +%Y%m%d-%H%M%SZ)
DUMP=/tmp/rtpi-salvage-${STAMP}.sql

echo "═══════════════════════════════════════════════════════════════"
echo "  RTPI SALVAGE IMPORT — ${STAMP}"
echo "═══════════════════════════════════════════════════════════════"
echo "  Source : ${SHADOW_CTN} (rtpi_main) @ localhost:${SHADOW_PORT}"
echo "  Target : live postgres container (${LIVE_DB_NAME})"
echo "  Dump   : ${DUMP}"
echo
read -r -p "Proceed? (type 'salvage' to continue) > " C
[ "$C" = "salvage" ] || { echo "aborted."; exit 1; }

# ─── Resolve user ID remap (old admin → live admin) ────────────────────────
OLD_ADMIN_ID=$(docker exec "$SHADOW_CTN" psql -U "$SHADOW_USER" -d "$SHADOW_DB" -tAc \
  "SELECT id FROM users WHERE username='admin' LIMIT 1")
NEW_ADMIN_ID=$(docker exec "$LIVE_PG_CONTAINER" psql -U "$LIVE_DB_USER" -d "$LIVE_DB_NAME" -tAc \
  "SELECT id FROM users WHERE username='admin' LIMIT 1")
echo "[info] old admin: $OLD_ADMIN_ID"
echo "[info] new admin: $NEW_ADMIN_ID"
[ -n "$OLD_ADMIN_ID" ] && [ -n "$NEW_ADMIN_ID" ] || { echo "missing admin id"; exit 1; }

# ─── Tables in FK-dependency order ─────────────────────────────────────────
# Includes agents because workflow_tasks.agent_id is NOT NULL and FKs to agents.
# Live already has 16 seeded agents; import will add the old 34 on top.
# Names will overlap (e.g. "Reporter: Dashboard" appears twice). Acceptable —
# user can delete legacy duplicates manually; FK integrity is preserved.
TABLES=(
  users
  operations
  targets
  vulnerabilities
  discovered_assets
  discovered_services
  ax_scan_results
  agents
  agent_capabilities
  agent_dependencies
  agent_tactics
  agent_registry
  agent_builds
  agent_bundles
  agent_tool_builds
  agent_download_tokens
  agent_activity_reports
  agent_workflows
  workflow_tasks
  workflow_logs
  workflow_instances
  agent_messages
  reports
  empire_servers
  memory_contexts
  memory_entries
  memory_access_logs
  rd_artifacts
  rd_experiments
  research_projects
  burp_setup
  ai_enrichment_logs
  operations_manager_tasks
  operation_framework_coverage
  attack_campaigns
  nuclei_templates
  rust_nexus_certificates
)

# ─── Data-only dump ────────────────────────────────────────────────────────
TABLE_FLAGS=()
for t in "${TABLES[@]}"; do TABLE_FLAGS+=(-t "$t"); done

echo "[info] dumping ${#TABLES[@]} tables..."
docker exec "$SHADOW_CTN" pg_dump -U "$SHADOW_USER" -d "$SHADOW_DB" \
  --data-only --disable-triggers --no-owner --no-privileges \
  --column-inserts \
  "${TABLE_FLAGS[@]}" > "$DUMP"

echo "[info] dump: $(du -h "$DUMP" | cut -f1)"

# ─── Rewrite old-admin row so it doesn't collide with live admin ───────────
# Replace the old admin's UUID with a fresh one, suffix username/email, then
# remap every FK reference from the old UUID to the new admin UUID.
LEGACY_ADMIN_ID=$(cat /proc/sys/kernel/random/uuid)

# username/email are UNIQUE. Suffix them on the old row so they coexist.
# We keep the legacy row so downstream audit_logs / created_by history stays intact,
# *except* FK references that we explicitly want to point to the new admin.
# Simpler: drop the legacy admin row from dump + remap its FKs → new admin.
#
# pg_dump uses multi-row INSERT (...) form. We'll strip any INSERT row containing
# the old admin id inside the users-values block, and then UPDATE every FK afterwards.

python3 - <<PYEOF
import re, sys
old_id = "$OLD_ADMIN_ID"
inp = open("$DUMP").read()
# With --column-inserts pg_dump emits one statement per row:
#   INSERT INTO public.users (...) VALUES ('<uuid>', ...);
# Remove any users-INSERT whose first VALUES literal matches the old admin id.
pat = re.compile(
    r"^INSERT INTO public\.users \([^)]+\) VALUES \('"
    + re.escape(old_id)
    + r"'[^;]*;\s*\n",
    re.MULTILINE,
)
inp, n = pat.subn("", inp)
open("$DUMP", "w").write(inp)
print(f"[info] stripped legacy admin row: {n} match(es)", file=sys.stderr)
PYEOF

# ─── Load inside a transaction ─────────────────────────────────────────────
echo "[info] loading into live DB (single transaction)..."
{
  echo "BEGIN;"
  echo "SET session_replication_role = 'replica';"   # bypass triggers + FK checks during load
  cat "$DUMP"
  # Remap FK refs from old admin → new admin in every table that has a created_by / user_id / owner / created_by_user_id column.
  cat <<SQL
-- Remap legacy admin references to the live admin id.
DO \$\$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name IN ('created_by', 'updated_by', 'user_id', 'owner_id', 'author_id', 'assigned_to')
      AND c.data_type = 'uuid'
  LOOP
    EXECUTE format('UPDATE public.%I SET %I = %L WHERE %I = %L',
      r.table_name, r.column_name, '$NEW_ADMIN_ID'::text, r.column_name, '$OLD_ADMIN_ID'::text);
  END LOOP;
END;
\$\$;
SET session_replication_role = 'origin';
COMMIT;
SQL
} | docker exec -i "$LIVE_PG_CONTAINER" psql -U "$LIVE_DB_USER" -d "$LIVE_DB_NAME" -v ON_ERROR_STOP=1

# ─── Re-encrypt empire_servers ─────────────────────────────────────────────
echo "[info] re-encrypting empire_servers credentials..."
npx tsx scripts/salvage-reencrypt.ts

# ─── Summary ───────────────────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════════════════════════"
echo "  SALVAGE IMPORT COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
echo
echo "Row counts in live DB:"
docker exec "$LIVE_PG_CONTAINER" psql -U "$LIVE_DB_USER" -d "$LIVE_DB_NAME" -c "
SELECT relname, n_live_tup FROM pg_stat_user_tables
WHERE schemaname='public' AND relname = ANY(ARRAY[
  'targets','operations','vulnerabilities','discovered_assets','discovered_services',
  'agents','agent_workflows','workflow_tasks','reports','tool_registry','empire_servers',
  'memory_entries','users'
])
ORDER BY n_live_tup DESC;"
echo
echo "Dump kept at: $DUMP (delete when confident)."
