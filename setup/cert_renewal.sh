#!/bin/bash

# RTPI Certificate Renewal Script
# Checks and renews Let's Encrypt certificates before they expire
# Version: 1.0.0
#
# Usage:
#   sudo ./setup/cert_renewal.sh renew        # Renew expiring certs
#   sudo ./setup/cert_renewal.sh force        # Force renew all
#   ./setup/cert_renewal.sh status           # Show status
#   sudo ./setup/cert_renewal.sh setup-cron  # Add cron job

set -e

CERT_DIR="/etc/letsencrypt"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_MANAGER="$SCRIPT_DIR/cert_manager.sh"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] RENEWAL: $1${NC}"; }
warn()  { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] RENEWAL WARNING: $1${NC}"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] RENEWAL ERROR: $1${NC}"; }
info()  { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] RENEWAL INFO: $1${NC}"; }

check_root() { [ "$EUID" -ne 0 ] && { error "Must run as root"; exit 1; }; }

get_certificate_slugs() {
    [ ! -d "$CERT_DIR/live" ] && return
    for cert_dir in "$CERT_DIR/live"/*-services; do
        [ -d "$cert_dir" ] && basename "$cert_dir" | sed 's/-services$//'
    done
}

# Returns 0 if renewal needed (<30 days), 1 if still valid
check_certificate_expiry() {
    local slug=$1
    local cert_path="$CERT_DIR/live/$slug-services/fullchain.pem"
    [ ! -f "$cert_path" ] && { error "Certificate not found: $cert_path"; return 1; }

    local expiry_date; expiry_date=$(openssl x509 -in "$cert_path" -text -noout | grep "Not After" | cut -d: -f2- | xargs)
    local expiry_ts;   expiry_ts=$(date -d "$expiry_date" +%s)
    local now_ts;      now_ts=$(date +%s)
    local days=$(( (expiry_ts - now_ts) / 86400 ))
    info "Slug '$slug': expires in $days days ($expiry_date)"
    [ $days -lt 30 ]
}

renew_certificate() {
    local slug=$1
    log "Renewing $slug..."

    certbot renew --cert-name "$slug-services" --quiet

    "$CERT_MANAGER" deploy "$slug"

    # Reload nginx if running
    if systemctl is-active --quiet nginx 2>/dev/null; then
        systemctl reload nginx && log "nginx reloaded"
    fi

    # Restart sysreptor-caddy if running
    cd "$PROJECT_ROOT"
    docker compose restart sysreptor-caddy 2>/dev/null && log "sysreptor-caddy restarted" || true

    log "✅ Renewal complete for $slug"
}

renew_certificates() {
    log "Checking certificate renewals..."
    local renewed=0 failed=0

    while IFS= read -r slug; do
        [ -z "$slug" ] && continue
        if check_certificate_expiry "$slug"; then
            log "Renewing $slug (expires soon)"
            renew_certificate "$slug" && ((renewed++)) || ((failed++))
        fi
    done < <(get_certificate_slugs)

    log "Done — renewed: $renewed, failed: $failed"
    return $failed
}

force_renewal() {
    log "Force renewing all certificates..."
    while IFS= read -r slug; do
        [ -z "$slug" ] && continue
        renew_certificate "$slug"
    done < <(get_certificate_slugs)
}

show_status() {
    echo "═══ RTPI Certificate Status ═══"
    local found=0
    while IFS= read -r slug; do
        [ -z "$slug" ] && continue
        found=1
        local cert_path="$CERT_DIR/live/$slug-services/fullchain.pem"
        if [ -f "$cert_path" ]; then
            local expiry_date; expiry_date=$(openssl x509 -in "$cert_path" -text -noout | grep "Not After" | cut -d: -f2- | xargs)
            local expiry_ts;   expiry_ts=$(date -d "$expiry_date" +%s)
            local now_ts;      now_ts=$(date +%s)
            local days=$(( (expiry_ts - now_ts) / 86400 ))
            local status
            if   [ $days -lt 7  ]; then status="🚨 URGENT"
            elif [ $days -lt 30 ]; then status="⚠️  RENEW SOON"
            else                        status="✅ Valid"
            fi
            printf "  %-20s %s (%d days) %s\n" "$slug" "$expiry_date" "$days" "$status"
        fi
    done < <(get_certificate_slugs)
    [ $found -eq 0 ] && info "No certificates found"
}

setup_cron() {
    local cron_job="0 0,12 * * * /opt/rtpi/setup/cert_renewal.sh renew >>/var/log/rtpi-cert-renewal.log 2>&1"
    if crontab -l 2>/dev/null | grep -q "cert_renewal.sh"; then
        log "Cron job already exists"
    else
        (crontab -l 2>/dev/null; echo "$cron_job") | crontab -
        log "Cron added (runs at 00:00 and 12:00 daily)"
    fi
}

main() {
    case "$1" in
        renew)      check_root; renew_certificates ;;
        force)      check_root; force_renewal ;;
        status)     show_status ;;
        setup-cron) check_root; setup_cron ;;
        *)
            echo "Usage: $0 <renew|force|status|setup-cron>"
            exit 1
            ;;
    esac
}

main "$@"
