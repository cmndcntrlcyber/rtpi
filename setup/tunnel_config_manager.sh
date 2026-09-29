#!/bin/bash

# RTPI Cloudflare Tunnel Configuration Manager
# Syncs ingress rules from services.manifest to the remotely-managed tunnel,
# auto-detecting the host's network IP so routes never go stale.
#
# Usage:
#   ./setup/tunnel_config_manager.sh sync [--dry-run]    # push ingress to CF API
#   ./setup/tunnel_config_manager.sh show                # print current CF config
#   ./setup/tunnel_config_manager.sh detect-ip           # print detected network IP
#
# Requires .env sourced: CF_TUNNEL_TOKEN, CF_API_TOKEN (or CF_ACCOUNT_TOKEN),
#                         RTPI_SLUG, CF_DOMAIN

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_PATH="${SCRIPT_DIR}/services.manifest"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/services_manifest.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[$(date +'%H:%M:%S')] TUNNEL: $1${NC}"; }
warn()  { echo -e "${YELLOW}[$(date +'%H:%M:%S')] TUNNEL WARNING: $1${NC}"; }
error() { echo -e "${RED}[$(date +'%H:%M:%S')] TUNNEL ERROR: $1${NC}"; }
info()  { echo -e "${BLUE}[$(date +'%H:%M:%S')] TUNNEL INFO: $1${NC}"; }

# ── Detect primary LAN IP ────────────────────────────────────────────────────
detect_network_ip() {
    local ip=""

    ip=$(ip -4 route show default 2>/dev/null \
        | grep -oP 'dev \K\S+' | head -1 \
        | xargs -I{} ip -4 addr show dev {} 2>/dev/null \
        | grep -oP 'inet \K[0-9.]+' | head -1) || true

    if [ -z "$ip" ]; then
        ip=$(ip -4 addr show scope global 2>/dev/null \
            | grep -v 'docker\|br-\|veth\|virbr\|tun\|wg' \
            | grep -oP 'inet \K[0-9.]+' | head -1) || true
    fi

    if [ -z "$ip" ]; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}') || true
    fi

    if [ -z "$ip" ]; then
        error "Could not detect network IP"
        return 1
    fi
    echo "$ip"
}

# ── Extract account & tunnel IDs from the connector token ─────────────────────
parse_tunnel_token() {
    local token=${CF_TUNNEL_TOKEN:-}
    if [ -z "$token" ]; then
        error "CF_TUNNEL_TOKEN not set"
        return 1
    fi

    local decoded
    decoded=$(echo "$token" | base64 -d 2>/dev/null) || { error "Failed to decode tunnel token"; return 1; }

    CF_ACCOUNT_ID=$(echo "$decoded" | jq -r '.a // empty')
    CF_TUNNEL_ID=$(echo "$decoded" | jq -r '.t // empty')

    if [ -z "$CF_ACCOUNT_ID" ]; then
        error "No account ID in tunnel token"
        return 1
    fi
    if [ -z "$CF_TUNNEL_ID" ]; then
        error "No tunnel ID in tunnel token"
        return 1
    fi
}

# ── Choose the best API token ─────────────────────────────────────────────────
resolve_api_token() {
    TUNNEL_API_TOKEN="${CF_ACCOUNT_TOKEN:-${CF_API_TOKEN:-}}"
    if [ -z "$TUNNEL_API_TOKEN" ]; then
        error "Neither CF_ACCOUNT_TOKEN nor CF_API_TOKEN is set"
        return 1
    fi
}

# ── Build ingress JSON from services.manifest ─────────────────────────────────
build_ingress_json() {
    local host_ip=$1
    local slug=${RTPI_SLUG:-}
    local domain=${CF_DOMAIN:-}
    local profiles=${ACTIVE_PROFILES:-}

    if [ -z "$slug" ]; then
        error "RTPI_SLUG not set"
        return 1
    fi
    if [ -z "$domain" ]; then
        error "CF_DOMAIN not set"
        return 1
    fi

    local ingress_entries=""
    local suffix gate upstream ws tls

    while IFS='|' read -r suffix gate upstream ws tls; do
        local hostname="${slug}${suffix}.${domain}"

        local service
        service=$(echo "$upstream" | sed "s|0\.0\.0\.0|${host_ip}|g")

        local origin_opts=""
        if [ "$tls" = "true" ]; then
            origin_opts="${origin_opts}\"noTLSVerify\":true,"
        fi
        if [ "$ws" = "true" ]; then
            origin_opts="${origin_opts}\"connectTimeout\":30,"
        else
            origin_opts="${origin_opts}\"connectTimeout\":10,"
        fi
        origin_opts="${origin_opts%,}"

        local entry
        entry=$(cat <<ENTRY
{"hostname":"${hostname}","service":"${service}","originRequest":{${origin_opts}}}
ENTRY
)
        if [ -n "$ingress_entries" ]; then
            ingress_entries="${ingress_entries},${entry}"
        else
            ingress_entries="${entry}"
        fi
    done < <(iterate_manifest "$MANIFEST_PATH" "$profiles")

    ingress_entries="${ingress_entries},{\"service\":\"http_status:404\"}"

    printf '{"config":{"ingress":[%s]}}' "$ingress_entries"
}

# ── Push config to Cloudflare API ─────────────────────────────────────────────
push_tunnel_config() {
    local config_json=$1

    local url="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations"

    local response
    response=$(curl -s -X PUT "$url" \
        -H "Authorization: Bearer ${TUNNEL_API_TOKEN}" \
        -H "Content-Type: application/json" \
        --data "$config_json")

    local success
    success=$(echo "$response" | jq -r '.success // false')
    if [ "$success" = "true" ]; then
        log "✅ Tunnel ingress updated successfully"
    else
        error "❌ Failed to update tunnel ingress"
        echo "$response" | jq -r '.errors[]?.message // "Unknown error"' >&2
        echo "$response" | jq . >&2
        return 1
    fi
}

# ── Fetch current tunnel config from CF API ───────────────────────────────────
show_tunnel_config() {
    local url="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations"

    local response
    response=$(curl -s -X GET "$url" \
        -H "Authorization: Bearer ${TUNNEL_API_TOKEN}" \
        -H "Content-Type: application/json")

    local success
    success=$(echo "$response" | jq -r '.success // false')
    if [ "$success" = "true" ]; then
        echo "$response" | jq '.result.config.ingress'
    else
        error "Failed to fetch tunnel config"
        echo "$response" | jq -r '.errors[]?.message // "Unknown error"' >&2
        return 1
    fi
}

# ── Commands ──────────────────────────────────────────────────────────────────
cmd_sync() {
    local dry_run=false
    if [ "${1:-}" = "--dry-run" ]; then
        dry_run=true
    fi

    parse_tunnel_token
    resolve_api_token

    local host_ip
    host_ip=$(detect_network_ip)
    log "Detected network IP: ${host_ip}"

    info "Account:  ${CF_ACCOUNT_ID:0:8}..."
    info "Tunnel:   ${CF_TUNNEL_ID}"
    info "Slug:     ${RTPI_SLUG}"
    info "Domain:   ${CF_DOMAIN}"

    local config_json
    config_json=$(build_ingress_json "$host_ip")

    if [ "$dry_run" = "true" ]; then
        info "Dry-run — generated config:"
        echo "$config_json" | jq .
        return 0
    fi

    push_tunnel_config "$config_json"

    local config_yml="${SCRIPT_DIR}/../infra/cloudflare-tunnel/config.yml"
    if [ -d "$(dirname "$config_yml")" ]; then
        log "Updating local config.yml reference..."
        generate_local_config "$host_ip" > "$config_yml"
        log "Local config.yml updated (reference only — tunnel is remotely managed)"
    fi
}

cmd_show() {
    parse_tunnel_token
    resolve_api_token
    show_tunnel_config
}

cmd_detect_ip() {
    detect_network_ip
}

# ── Generate local config.yml (reference copy) ───────────────────────────────
generate_local_config() {
    local host_ip=$1
    local slug=${RTPI_SLUG:-}
    local domain=${CF_DOMAIN:-}
    local tunnel_name=${CF_TUNNEL_NAME:-rtpi-${slug}}

    cat <<HEADER
# Cloudflare Tunnel ingress rules — generated by tunnel_config_manager.sh
# Last sync: $(date -u +'%Y-%m-%dT%H:%M:%SZ') | Host IP: ${host_ip}
# This file is a local reference. The active config is remotely managed
# via the Cloudflare API (token-mode tunnel).

tunnel: ${tunnel_name}
credentials-file: /etc/cloudflared/${tunnel_name}.json

ingress:
HEADER

    local suffix gate upstream ws tls
    while IFS='|' read -r suffix gate upstream ws tls; do
        local hostname="${slug}${suffix}.${domain}"
        local service
        service=$(echo "$upstream" | sed "s|0\.0\.0\.0|${host_ip}|g")

        local label="${suffix:-bare-slug}"
        echo "  # ── ${label#-} ──"
        echo "  - hostname: ${hostname}"
        echo "    service: ${service}"
        echo "    originRequest:"
        if [ "$tls" = "true" ]; then
            echo "      noTLSVerify: true"
        fi
        if [ "$ws" = "true" ]; then
            echo "      connectTimeout: 30s"
        else
            echo "      connectTimeout: 10s"
        fi
        echo ""
    done < <(iterate_manifest "$MANIFEST_PATH" "${ACTIVE_PROFILES:-}")

    echo "  # ── Catch-all ──"
    echo "  - service: http_status:404"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    local action=${1:-help}; shift || true
    case "$action" in
        sync)       cmd_sync "$@" ;;
        show)       cmd_show ;;
        detect-ip)  cmd_detect_ip ;;
        help|--help|-h)
            echo "Usage: $0 <sync [--dry-run] | show | detect-ip>"
            echo ""
            echo "  sync        Auto-detect host IP, push ingress rules to CF API"
            echo "  sync --dry-run  Print the config that would be pushed"
            echo "  show        Fetch and display the current CF tunnel config"
            echo "  detect-ip   Print the detected network IP"
            ;;
        *)
            error "Unknown action: $action"
            exit 1
            ;;
    esac
}

main "$@"
