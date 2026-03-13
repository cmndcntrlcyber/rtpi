#!/bin/bash

# RTPI Production Build Script
# Method 2: Advanced Build with SSL (Production)
# Version: 1.0.0
#
# Usage:
#   sudo ./build.sh                                         # Standard (no SSL)
#   sudo ./build.sh --slug myorg --enable-ssl               # SSL + Cloudflare DNS
#   sudo ./build.sh --slug myorg --enable-ssl --server-ip 1.2.3.4
#
# SSL-enabled domains (example slug 'myorg'):
#   myorg.attck-node.net          — RTPI main dashboard
#   myorg-reports.attck-node.net  — SysReptor reporting
#   myorg-empire.attck-node.net   — Empire C2
#   myorg-mgmt.attck-node.net     — Portainer management
#   myorg-kasm.attck-node.net     — Kasm Workspaces
#
# Prerequisites:
#   - .env configured with CF_API_TOKEN, CF_ZONE_ID, CF_DOMAIN, CF_EMAIL
#   - Docker 20.10+ with Docker Compose v2
#   - Root access for SSL certificate generation

set -e

# ─── Configuration ──────────────────────────────────────────────────────────
DOMAIN="attck-node.net"
CERT_MANAGER="./setup/cert_manager.sh"
DNS_MANAGER="./setup/cloudflare_dns_manager.sh"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Logging ─────────────────────────────────────────────────────────────────
log()     { echo -e "${GREEN}[$(date +'%H:%M:%S')] BUILD: $1${NC}"; }
warn()    { echo -e "${YELLOW}[$(date +'%H:%M:%S')] BUILD WARNING: $1${NC}"; }
error()   { echo -e "${RED}[$(date +'%H:%M:%S')] BUILD ERROR: $1${NC}"; }
info()    { echo -e "${BLUE}[$(date +'%H:%M:%S')] BUILD INFO: $1${NC}"; }
section() { echo -e "\n${CYAN}══════════════════════════════════════════${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}══════════════════════════════════════════${NC}\n"; }

# ─── Argument Parsing ────────────────────────────────────────────────────────
SLUG=""
ENABLE_SSL=false
SERVER_IP=""
PROFILES="sysreptor management"  # Always start these

while [[ $# -gt 0 ]]; do
    case "$1" in
        --slug)       SLUG="$2";       shift 2 ;;
        --enable-ssl) ENABLE_SSL=true; shift   ;;
        --server-ip)  SERVER_IP="$2";  shift 2 ;;
        --profiles)   PROFILES="$2";   shift 2 ;;
        --help|-h)
            grep "^#" "$0" | head -20 | sed 's/^# //'
            exit 0
            ;;
        *)
            error "Unknown argument: $1"
            exit 1
            ;;
    esac
done

# ─── Pre-flight Checks ───────────────────────────────────────────────────────
preflight_checks() {
    section "Pre-flight Checks"

    # Docker
    docker info >/dev/null 2>&1 || { error "Docker daemon not running"; exit 1; }
    docker compose version >/dev/null 2>&1 || { error "Docker Compose v2 not installed"; exit 1; }
    log "Docker: ✅"

    # .env file
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        warn ".env not found — copying from .env.example"
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        error "Edit .env before continuing (set DB passwords, API keys, etc.)"
        exit 1
    fi
    log ".env: ✅"

    # Load environment
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/.env"
    set +a
    log "Environment loaded"

    # SSL-specific checks
    if [ "$ENABLE_SSL" = "true" ]; then
        [ -z "$SLUG" ]           && { error "--slug required when --enable-ssl is set"; exit 1; }
        [ -z "$CF_API_TOKEN" ]   && { error "CF_API_TOKEN not set in .env";  exit 1; }
        [ -z "$CF_ZONE_ID" ]     && { error "CF_ZONE_ID not set in .env";    exit 1; }
        [ -z "$CF_DOMAIN" ]      && { error "CF_DOMAIN not set in .env";     exit 1; }
        [ -z "$CF_EMAIL" ]       && { error "CF_EMAIL not set in .env";      exit 1; }
        [ "$EUID" -ne 0 ]        && { error "SSL setup requires root"; exit 1; }

        # Detect server IP if not provided
        if [ -z "$SERVER_IP" ]; then
            SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
            log "Detected server IP: $SERVER_IP"
        fi

        # Validate Cloudflare connectivity
        "$DNS_MANAGER" validate || { error "Cloudflare validation failed"; exit 1; }
        log "Cloudflare: ✅"
    fi

    # Disk space (warn if < 20GB)
    local available; available=$(df "$PROJECT_ROOT" | awk 'NR==2{print $4}')
    [ "$available" -lt 20971520 ] && warn "Less than 20GB disk space available"

    log "Pre-flight checks passed ✅"
}

# ─── SysReptor App.env Validation ────────────────────────────────────────────
validate_sysreptor_config() {
    local env_file="$PROJECT_ROOT/configs/rtpi-sysreptor/app.env"
    if grep -q "CHANGE_ME" "$env_file" 2>/dev/null; then
        warn "SysReptor app.env contains placeholder values"
        warn "Edit configs/rtpi-sysreptor/app.env before deploying to production"
        warn "Generate SECRET_KEY:      python3 -c \"from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())\""
        warn "Generate ENCRYPTION_KEY:  python3 -c \"import os,base64,uuid; k=base64.b64encode(os.urandom(32)).decode(); i=str(uuid.uuid4()); print(f'[{\\\"id\\\":\\\"'+i+'\\\",\\\"key\\\":\\\"'+k+'\\\",\\\"cipher\\\":\\\"AES-GCM\\\",\\\"revoked\\\":false}]')\""
    fi
}

# ─── SSL Certificate Setup ───────────────────────────────────────────────────
setup_ssl() {
    section "SSL Certificate Setup"
    local slug=$1
    local server_ip=$2

    log "Setting up SSL for slug: $slug (IP: $server_ip)"

    # Create DNS A records
    log "Creating Cloudflare DNS A records..."
    "$DNS_MANAGER" create-records "$slug" "$server_ip"

    # Wait for DNS propagation
    log "Waiting 60s for DNS propagation..."
    sleep 60

    # Generate and deploy certificates
    "$CERT_MANAGER" full-setup "$slug"

    log "✅ SSL setup complete"
    info "Domains:"
    for suffix in "" "-reports" "-empire" "-mgmt" "-kasm"; do
        info "  https://${slug}${suffix}.$DOMAIN"
    done
}

# ─── Build docker-compose profile flags ──────────────────────────────────────
build_compose_flags() {
    local flags=""
    for profile in $PROFILES; do
        flags="$flags --profile $profile"
    done
    echo "$flags"
}

# ─── Start Services ──────────────────────────────────────────────────────────
start_services() {
    section "Starting Services"
    cd "$PROJECT_ROOT"

    local compose_flags; compose_flags=$(build_compose_flags)
    log "Profiles: $PROFILES"
    log "Command: docker compose $compose_flags up -d"

    # Pull latest images first
    # shellcheck disable=SC2086
    docker compose $compose_flags pull --quiet 2>/dev/null || true

    # Start services
    # shellcheck disable=SC2086
    docker compose $compose_flags up -d

    log "Waiting 30s for services to initialize..."
    sleep 30

    # Health check
    # shellcheck disable=SC2086
    docker compose $compose_flags ps
}

# ─── Post-Deploy Summary ─────────────────────────────────────────────────────
print_summary() {
    section "Deployment Summary"

    if [ "$ENABLE_SSL" = "true" ] && [ -n "$SLUG" ]; then
        echo -e "${GREEN}SSL-Enabled Service URLs:${NC}"
        printf "  %-25s %s\n" "RTPI Dashboard:"  "https://$SLUG.$DOMAIN"
        printf "  %-25s %s\n" "SysReptor:"       "https://$SLUG-reports.$DOMAIN"
        printf "  %-25s %s\n" "Empire C2:"       "https://$SLUG-empire.$DOMAIN"
        printf "  %-25s %s\n" "Portainer:"       "https://$SLUG-mgmt.$DOMAIN"
        printf "  %-25s %s\n" "Kasm Workspaces:" "https://$SLUG-kasm.$DOMAIN"
        echo ""
        echo -e "${YELLOW}Post-SSL steps:${NC}"
        echo "  1. Install nginx SSL config:"
        echo "     sudo cp docker/nginx-ssl.conf /etc/nginx/conf.d/rtpi-ssl.conf"
        echo "     sudo nginx -t && sudo systemctl reload nginx"
        echo "  2. Set up auto-renewal:"
        echo "     sudo ./setup/cert_renewal.sh setup-cron"
    else
        echo -e "${GREEN}Local Service URLs:${NC}"
        printf "  %-25s %s\n" "RTPI Dashboard:"  "http://localhost:5000"
        printf "  %-25s %s\n" "RTPI API:"        "http://localhost:3001"
        printf "  %-25s %s\n" "SysReptor:"       "http://localhost:7777"
        printf "  %-25s %s\n" "Portainer:"       "https://localhost:9443"
        printf "  %-25s %s\n" "Empire C2:"       "http://localhost:1337"
        printf "  %-25s %s\n" "Kasm API:"        "https://localhost:8443  (--profile kasm)"
        printf "  %-25s %s\n" "Kasm VS Code:"    "http://localhost:6901   (--profile kasm)"
        printf "  %-25s %s\n" "Kasm Kali:"       "http://localhost:6902   (--profile kasm)"
    fi

    echo ""
    echo -e "${YELLOW}Default Credentials:${NC}"
    echo "  Portainer:    admin / (set on first access at https://localhost:9443)"
    echo "  SysReptor:    (set on first login at http://localhost:7777)"
    echo "  Kasm VNC:     password  (change via KASM_VNC_PASSWORD in .env)"
    echo ""
    echo -e "${YELLOW}Enable additional profiles:${NC}"
    echo "  Kasm full stack: docker compose --profile kasm up -d"
    echo "  SSL certbot:     docker compose --profile certbot up -d"
    echo "  GPU Ollama:      docker compose --profile gpu up -d"
    echo ""
    echo -e "${GREEN}✅ RTPI deployment complete${NC}"
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    section "RTPI Production Build"
    info "Slug:       ${SLUG:-none}"
    info "SSL:        $ENABLE_SSL"
    info "Server IP:  ${SERVER_IP:-auto-detect}"
    info "Profiles:   $PROFILES"

    preflight_checks
    validate_sysreptor_config

    if [ "$ENABLE_SSL" = "true" ]; then
        setup_ssl "$SLUG" "$SERVER_IP"
        # Add SSL nginx config to the proxy if nginx is installed
        if command -v nginx &>/dev/null; then
            log "Installing nginx SSL config..."
            cp "$PROJECT_ROOT/docker/nginx-ssl.conf" /etc/nginx/conf.d/rtpi-ssl.conf
            nginx -t && systemctl reload nginx && log "nginx reloaded ✅"
        fi
    fi

    start_services
    print_summary
}

main "$@"
