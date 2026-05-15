#!/usr/bin/env bash
# RTPI VPN Manager — entrypoint
#
# Subcommands:
#   daemon                          long-running supervisor (default CMD)
#   connect openvpn   <name>        bring up /etc/openvpn/configs/<name>.ovpn
#   connect wireguard <name>        bring up /etc/wireguard/configs/<name>.conf
#   disconnect openvpn   <name>     stop the openvpn process for <name>
#   disconnect wireguard <name>     `wg-quick down <name>`
#   status [name]                   JSON status (all tunnels, or just <name>)
#   list                            JSON listing of available config files
#
# State is tracked in /var/run/vpn:
#   openvpn-<name>.pid              pid of the openvpn process for <name>
#   openvpn-<name>.log              tail of openvpn stdout/stderr
#   wireguard-<name>.active         touch-file marking wg interface up
#
# All operator-visible output (status / list) is JSON on stdout; human-
# readable progress goes to stderr so callers can pipe stdout into jq.

set -euo pipefail

OVPN_DIR=/etc/openvpn/configs
WG_DIR=/etc/wireguard/configs
RUN_DIR=/var/run/vpn
LOG_DIR=/var/log/vpn

mkdir -p "$RUN_DIR" "$LOG_DIR"

log()  { printf '[vpn-manager] %s\n' "$*" >&2; }
die()  { log "ERROR: $*"; exit 1; }
emit() { printf '%s\n' "$*"; }

# ---------------------------------------------------------------------------
# OpenVPN
# ---------------------------------------------------------------------------

ovpn_config_path() {
    local name="$1"
    local path="$OVPN_DIR/${name}.ovpn"
    [[ -f "$path" ]] || die "openvpn config not found: $path"
    printf '%s' "$path"
}

ovpn_pid_file() { printf '%s/openvpn-%s.pid' "$RUN_DIR" "$1"; }
ovpn_log_file() { printf '%s/openvpn-%s.log' "$LOG_DIR" "$1"; }

ovpn_running() {
    local pidfile; pidfile=$(ovpn_pid_file "$1")
    [[ -f "$pidfile" ]] || return 1
    local pid; pid=$(cat "$pidfile" 2>/dev/null || true)
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

ovpn_connect() {
    local name="$1"
    local cfg; cfg=$(ovpn_config_path "$name")
    local pidfile; pidfile=$(ovpn_pid_file "$name")
    local logfile; logfile=$(ovpn_log_file "$name")

    if ovpn_running "$name"; then
        log "openvpn '$name' already running (pid $(cat "$pidfile"))"
        return 0
    fi

    log "starting openvpn '$name' from $cfg"
    # --daemon detaches but writes the pid for us; --log appends so we can
    # tail across reconnects. cd into the config dir so relative `auth-user-pass`,
    # `ca`, `cert`, `key` paths resolve.
    (
        cd "$OVPN_DIR"
        openvpn \
            --config "$cfg" \
            --daemon "openvpn-${name}" \
            --writepid "$pidfile" \
            --log-append "$logfile" \
            --script-security 2 \
            --verb 3
    )

    # openvpn --daemon returns immediately; give it a moment to write the pid.
    local waited=0
    while [[ ! -s "$pidfile" && $waited -lt 50 ]]; do
        sleep 0.1
        waited=$((waited + 1))
    done

    if ! ovpn_running "$name"; then
        die "openvpn '$name' failed to start; see $logfile"
    fi
    log "openvpn '$name' started (pid $(cat "$pidfile"))"
}

ovpn_disconnect() {
    local name="$1"
    local pidfile; pidfile=$(ovpn_pid_file "$name")

    if ! ovpn_running "$name"; then
        log "openvpn '$name' not running"
        rm -f "$pidfile"
        return 0
    fi

    local pid; pid=$(cat "$pidfile")
    log "stopping openvpn '$name' (pid $pid)"
    kill -TERM "$pid" 2>/dev/null || true

    local waited=0
    while kill -0 "$pid" 2>/dev/null && [[ $waited -lt 50 ]]; do
        sleep 0.1
        waited=$((waited + 1))
    done

    if kill -0 "$pid" 2>/dev/null; then
        log "openvpn '$name' did not exit on SIGTERM; sending SIGKILL"
        kill -KILL "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
}

# ---------------------------------------------------------------------------
# WireGuard
# ---------------------------------------------------------------------------

# wg-quick reads /etc/wireguard/<name>.conf — we keep the canonical copy in
# /etc/wireguard/configs/<name>.conf and symlink it into place at connect time
# so that the config volume stays clean and uploads don't have to land in the
# wg-quick lookup path.

wg_config_path() {
    local name="$1"
    local path="$WG_DIR/${name}.conf"
    [[ -f "$path" ]] || die "wireguard config not found: $path"
    printf '%s' "$path"
}

wg_active_marker() { printf '%s/wireguard-%s.active' "$RUN_DIR" "$1"; }

wg_running() {
    local name="$1"
    ip link show "$name" >/dev/null 2>&1
}

wg_connect() {
    local name="$1"
    local cfg; cfg=$(wg_config_path "$name")
    local link="/etc/wireguard/${name}.conf"

    if wg_running "$name"; then
        log "wireguard interface '$name' already up"
        return 0
    fi

    log "linking $cfg → $link"
    ln -sf "$cfg" "$link"

    log "wg-quick up $name"
    wg-quick up "$name"
    touch "$(wg_active_marker "$name")"
    log "wireguard '$name' up"
}

wg_disconnect() {
    local name="$1"
    local link="/etc/wireguard/${name}.conf"

    if ! wg_running "$name"; then
        log "wireguard interface '$name' not up"
        rm -f "$(wg_active_marker "$name")"
        return 0
    fi

    log "wg-quick down $name"
    wg-quick down "$name" || true
    rm -f "$link" "$(wg_active_marker "$name")"
}

# ---------------------------------------------------------------------------
# Status / listing
# ---------------------------------------------------------------------------

ovpn_status_json() {
    local name="$1"
    local pidfile; pidfile=$(ovpn_pid_file "$name")
    local pid="" connected="false"
    if ovpn_running "$name"; then
        pid=$(cat "$pidfile")
        connected="true"
    fi
    jq -n \
        --arg name "$name" \
        --arg type "openvpn" \
        --arg pid  "$pid" \
        --argjson connected "$connected" \
        '{name: $name, type: $type, connected: $connected, pid: ($pid | select(length>0) | tonumber? // null)}'
}

wg_status_json() {
    local name="$1"
    local connected="false" address=""
    if wg_running "$name"; then
        connected="true"
        address=$(ip -4 addr show "$name" | awk '/inet /{print $2; exit}')
    fi
    jq -n \
        --arg name "$name" \
        --arg type "wireguard" \
        --arg address "$address" \
        --argjson connected "$connected" \
        '{name: $name, type: $type, connected: $connected, address: ($address | select(length>0))}'
}

cmd_status() {
    local target="${1:-}"
    if [[ -n "$target" ]]; then
        # Look in both directories — the caller didn't tell us the type.
        if [[ -f "$OVPN_DIR/${target}.ovpn" ]]; then
            ovpn_status_json "$target"
            return
        fi
        if [[ -f "$WG_DIR/${target}.conf" ]]; then
            wg_status_json "$target"
            return
        fi
        die "no config named '$target' in $OVPN_DIR or $WG_DIR"
    fi

    # No target: list status of every config we know about.
    local entries=()
    if compgen -G "$OVPN_DIR/*.ovpn" >/dev/null; then
        for f in "$OVPN_DIR"/*.ovpn; do
            entries+=("$(ovpn_status_json "$(basename "$f" .ovpn)")")
        done
    fi
    if compgen -G "$WG_DIR/*.conf" >/dev/null; then
        for f in "$WG_DIR"/*.conf; do
            entries+=("$(wg_status_json "$(basename "$f" .conf)")")
        done
    fi
    if [[ ${#entries[@]} -eq 0 ]]; then
        emit '[]'
    else
        printf '%s\n' "${entries[@]}" | jq -s '.'
    fi
}

cmd_list() {
    local entries=()
    if compgen -G "$OVPN_DIR/*.ovpn" >/dev/null; then
        for f in "$OVPN_DIR"/*.ovpn; do
            entries+=("$(jq -n --arg name "$(basename "$f" .ovpn)" --arg type "openvpn" '{name: $name, type: $type}')")
        done
    fi
    if compgen -G "$WG_DIR/*.conf" >/dev/null; then
        for f in "$WG_DIR"/*.conf; do
            entries+=("$(jq -n --arg name "$(basename "$f" .conf)" --arg type "wireguard" '{name: $name, type: $type}')")
        done
    fi
    if [[ ${#entries[@]} -eq 0 ]]; then
        emit '[]'
    else
        printf '%s\n' "${entries[@]}" | jq -s '.'
    fi
}

# ---------------------------------------------------------------------------
# Daemon mode
# ---------------------------------------------------------------------------

cmd_daemon() {
    log "vpn-manager daemon starting (pid $$)"

    # Tear down any active tunnels on shutdown so the host doesn't keep
    # routes pointing at a dead container.
    cleanup() {
        log "shutdown requested — bringing down active tunnels"
        if compgen -G "$RUN_DIR/openvpn-*.pid" >/dev/null; then
            for pidfile in "$RUN_DIR"/openvpn-*.pid; do
                local n; n=$(basename "$pidfile" .pid); n="${n#openvpn-}"
                ovpn_disconnect "$n" || true
            done
        fi
        if compgen -G "$RUN_DIR/wireguard-*.active" >/dev/null; then
            for marker in "$RUN_DIR"/wireguard-*.active; do
                local n; n=$(basename "$marker" .active); n="${n#wireguard-}"
                wg_disconnect "$n" || true
            done
        fi
        log "shutdown complete"
        exit 0
    }
    trap cleanup TERM INT

    # Idle loop: lifecycle is driven by `docker exec ... connect|disconnect`
    # from the backend; the daemon just needs to stay alive and reap zombies
    # (tini handles that as PID 1).
    while true; do
        sleep 30 &
        wait $!
    done
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

main() {
    local cmd="${1:-daemon}"
    shift || true

    case "$cmd" in
        daemon)
            cmd_daemon
            ;;
        connect)
            local kind="${1:-}" name="${2:-}"
            [[ -n "$kind" && -n "$name" ]] || die "usage: connect <openvpn|wireguard> <name>"
            case "$kind" in
                openvpn)   ovpn_connect "$name" ;;
                wireguard) wg_connect   "$name" ;;
                *) die "unknown vpn type: $kind" ;;
            esac
            ;;
        disconnect)
            local kind="${1:-}" name="${2:-}"
            [[ -n "$kind" && -n "$name" ]] || die "usage: disconnect <openvpn|wireguard> <name>"
            case "$kind" in
                openvpn)   ovpn_disconnect "$name" ;;
                wireguard) wg_disconnect   "$name" ;;
                *) die "unknown vpn type: $kind" ;;
            esac
            ;;
        status)
            cmd_status "${1:-}"
            ;;
        list)
            cmd_list
            ;;
        *)
            die "unknown command: $cmd (expected daemon|connect|disconnect|status|list)"
            ;;
    esac
}

main "$@"
