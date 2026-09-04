#!/bin/bash
# RTPI Container Healer
# Detects containers that have exited with non-zero code, are restarting, or
# have been up <5 minutes with a non-zero RestartCount, and attempts targeted
# repair with exponential cooldown.
#
# Designed to be triggered periodically by systemd timer rtpi-container-healer.timer.

set -u

RTPI_DIR="/home/cmndcntrl/code/rtpi"
LOG_DIR="${RTPI_DIR}/logs"
STATE_FILE="${LOG_DIR}/.container-healer-state"
COMPOSE_PROJECT="rtpi"

mkdir -p "$LOG_DIR"
touch "$STATE_FILE"

LOG_FILE="${LOG_DIR}/container-healer-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=============================================="
echo "RTPI Container Healer"
echo "Date: $(date -Iseconds)"
echo "=============================================="

# Containers that are expected to be absent/stopped (e.g., profile-gated).
# Touching these would restart services the operator has deliberately disabled.
DENYLIST=(
    rtpi-mem0-api
    rtpi-ollama
    rtpi-ollama-cpu
)

in_denylist() {
    local name="$1"
    for d in "${DENYLIST[@]}"; do
        [[ "$name" == "$d" ]] && return 0
    done
    return 1
}

# Repair action for a given container name. Fall back to `docker restart`.
repair_action() {
    local name="$1"
    case "$name" in
        rtpi-kasm-api|rtpi-kasm-manager|rtpi-kasm-share)
            docker exec rtpi-kasm-db psql -U kasmapp -d kasm -tAc \
              "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='kasm' AND pid != pg_backend_pid() AND (state = 'idle in transaction' OR (state = 'active' AND query_start < NOW() - INTERVAL '2 minutes'));" \
              2>/dev/null && echo "  Cleared stale kasm-db connections before restart" || true
            docker restart "$name" >/dev/null ;;
        rtpi-sysreptor-app|rtpi-sysreptor-redis|rtpi-sysreptor-caddy)
            ( cd "$RTPI_DIR" && docker compose --profile sysreptor up -d --force-recreate \
                "${name#rtpi-}" ) ;;
        rtpi-burp-agent)
            ( cd "$RTPI_DIR" && docker compose up -d --force-recreate offsec-burp ) ;;
        *)
            docker restart "$name" >/dev/null ;;
    esac
}

# State file format: one line per container: name=last_attempt_epoch:attempts
state_read() {
    local name="$1"
    grep -E "^${name}=" "$STATE_FILE" | tail -1 | sed -E "s/^${name}=//"
}

state_write() {
    local name="$1" ts="$2" attempts="$3"
    local tmp
    tmp=$(mktemp)
    grep -vE "^${name}=" "$STATE_FILE" > "$tmp" || true
    echo "${name}=${ts}:${attempts}" >> "$tmp"
    mv "$tmp" "$STATE_FILE"
}

cooldown_seconds() {
    local attempts="$1"
    local sec=$(( 60 * (1 << (attempts < 6 ? attempts : 6)) ))
    (( sec > 3600 )) && sec=3600
    echo "$sec"
}

# Returns the container start time as epoch seconds.
started_epoch() {
    local name="$1"
    local started
    started=$(docker inspect --format '{{.State.StartedAt}}' "$name" 2>/dev/null) || return 1
    date -d "$started" +%s 2>/dev/null
}

restart_count() {
    docker inspect --format '{{.State.RestartCount}}' "$1" 2>/dev/null
}

exit_code() {
    docker inspect --format '{{.State.ExitCode}}' "$1" 2>/dev/null
}

health_status() {
    docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$1" 2>/dev/null
}

now=$(date +%s)
unhealthy=()

# Enumerate all containers in the compose project, regardless of state.
mapfile -t rows < <(docker ps -a \
    --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
    --format '{{.Names}}|{{.State}}')

echo "Scanning ${#rows[@]} containers in project '${COMPOSE_PROJECT}'..."

for row in "${rows[@]}"; do
    name="${row%%|*}"
    state="${row##*|}"

    if in_denylist "$name"; then
        continue
    fi

    flagged=false
    reason=""

    case "$state" in
        exited)
            if [[ "$(exit_code "$name")" != "0" ]]; then
                flagged=true
                reason="exited with code $(exit_code "$name")"
            fi
            ;;
        restarting)
            flagged=true
            reason="in restart loop"
            ;;
        running)
            hs=$(health_status "$name")
            if [[ "$hs" == "unhealthy" ]]; then
                flagged=true
                reason="Docker healthcheck: unhealthy"
            else
                started=$(started_epoch "$name") || continue
                uptime=$(( now - started ))
                rc=$(restart_count "$name")
                if (( uptime < 300 )) && (( rc > 0 )); then
                    flagged=true
                    reason="up ${uptime}s with ${rc} restarts"
                fi
            fi
            ;;
    esac

    if [[ "$flagged" == true ]]; then
        unhealthy+=("${name}|${reason}")
    fi
done

if (( ${#unhealthy[@]} == 0 )); then
    echo "No unhealthy containers detected."
else
    echo "Unhealthy containers: ${#unhealthy[@]}"
    for entry in "${unhealthy[@]}"; do
        name="${entry%%|*}"
        reason="${entry##*|}"
        echo ""
        echo "---- ${name} ----"
        echo "Reason: ${reason}"

        # Enforce cooldown
        prior="$(state_read "$name")"
        last_ts="${prior%%:*}"
        attempts="${prior##*:}"
        [[ -z "$last_ts" ]] && last_ts=0
        [[ -z "$attempts" || "$attempts" == "$last_ts" ]] && attempts=0

        # Reset counter if container has been up healthy for >1h since last attempt
        uptime_since_last=$(( now - last_ts ))
        if (( uptime_since_last > 3600 )); then
            attempts=0
        fi

        cooldown=$(cooldown_seconds "$attempts")
        elapsed=$(( now - last_ts ))
        if (( elapsed < cooldown )); then
            echo "Skipping: cooldown ${cooldown}s, elapsed ${elapsed}s (attempt #${attempts})"
            continue
        fi

        echo "Diagnostics (last 60 log lines):"
        docker logs --tail 60 "$name" 2>&1 | sed 's/^/  | /'
        echo "Restart count: $(restart_count "$name")"

        echo "Applying repair (attempt #$((attempts + 1)))..."
        if repair_action "$name"; then
            echo "Repair dispatched successfully."
        else
            echo "Repair command returned non-zero."
        fi

        state_write "$name" "$now" $((attempts + 1))
    done
fi

# ── Structural health checks ────────────────────────────────────────────
echo ""
echo "Running structural health checks..."

# Check cloudflared tunnel connectivity
if docker ps --format '{{.Names}}' | grep -q '^rtpi-cloudflared$'; then
    if docker logs --tail 20 rtpi-cloudflared 2>&1 | grep -qE 'Tunnel not found|No ingress rules|ERR Register tunnel error'; then
        echo "WARNING: cloudflared tunnel registration failing"
        echo "  Restarting cloudflared..."
        docker restart rtpi-cloudflared >/dev/null 2>&1
        sleep 10
        if docker logs --tail 10 rtpi-cloudflared 2>&1 | grep -q 'Registered tunnel connection'; then
            echo "  cloudflared reconnected successfully."
        else
            echo "  CRITICAL: cloudflared still failing after restart."
            echo "  Check CF_TUNNEL_TOKEN in .env and Cloudflare dashboard config."
        fi
    else
        echo "  cloudflared: tunnel connections OK"
    fi
fi

# Check guac APIHOSTNAME is resolved
if docker ps --format '{{.Names}}' | grep -q '^rtpi-kasm-guac$'; then
    if docker logs --tail 20 rtpi-kasm-guac 2>&1 | grep -q 'ENOTFOUND apihostname'; then
        echo "WARNING: kasm-guac has unresolved APIHOSTNAME placeholder"
        echo "  Patching config and restarting..."
        docker exec rtpi-kasm-guac sh -c \
            'cp /opt/kasm/current/conf/app/guac/kasmguac.app.config.yaml /tmp/kasmguac.app.config.yaml 2>/dev/null; sed -i "s|APIHOSTNAME|kasm_proxy|g" /tmp/kasmguac.app.config.yaml 2>/dev/null' \
            && docker restart rtpi-kasm-guac >/dev/null 2>&1 \
            && echo "  kasm-guac patched and restarted." \
            || echo "  Failed to patch kasm-guac config."
    else
        echo "  kasm-guac: API hostname resolved OK"
    fi
fi

echo ""
echo "Cleaning healer logs older than 30 days..."
find "$LOG_DIR" -name 'container-healer-*.log' -mtime +30 -delete 2>/dev/null || true

echo "Done."
