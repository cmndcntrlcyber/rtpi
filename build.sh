#!/bin/bash

# RTPI Production Build Script
# Method 2: Advanced Build with SSL (Production)
# Version: 1.0.0
#
# Usage:
#   sudo ./build.sh                                                 # Standard (no SSL)
#   sudo ./build.sh --slug myorg --enable-ssl                       # Let's Encrypt + Cloudflare DNS-01
#   sudo ./build.sh --slug myorg --enable-ssl --origin-ca           # Cloudflare Origin CA (15-yr, Full Strict)
#   sudo ./build.sh --slug myorg --enable-ssl --server-ip 1.2.3.4
#
# Cert source modes:
#   default      — Let's Encrypt (DNS-01) via setup/cert_manager.sh.
#                  Requires CF_API_TOKEN (Zone:DNS:Edit) + CF_EMAIL.
#   --origin-ca  — Cloudflare Origin CA via setup/origin_cert_manager.sh.
#                  Requires CLOUDFLARE_API_USER_SERVICE_KEY (Origin CA Key,
#                  format `v1.0-...`). One POST, no ACME, 15-year cert by
#                  default. Cloudflare SSL/TLS mode MUST be Full (Strict).
#
# SSL-enabled domains (example slug 'myorg', CF_DOMAIN='example.com'):
#   myorg.example.com          — RTPI main dashboard
#   myorg-reports.example.com  — SysReptor reporting
#   myorg-empire.example.com   — Empire C2
#   myorg-mgmt.example.com     — Portainer management
#   myorg-kasm.example.com     — Kasm Workspaces
#
# Prerequisites:
#   - .env configured with CF_API_TOKEN, CF_ZONE_ID, CF_DOMAIN, CF_EMAIL
#     (plus CLOUDFLARE_API_USER_SERVICE_KEY for --origin-ca)
#   - Docker 20.10+ with Docker Compose v2
#   - Root access for SSL certificate generation

set -e

# ─── Configuration ──────────────────────────────────────────────────────────
# Parent domain comes from .env's CF_DOMAIN (loaded in preflight_checks).
CERT_MANAGER="./setup/cert_manager.sh"
ORIGIN_CERT_MANAGER="./setup/origin_cert_manager.sh"
DNS_MANAGER="./setup/cloudflare_dns_manager.sh"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_PATH="${PROJECT_ROOT}/setup/services.manifest"
# shellcheck disable=SC1091
source "${PROJECT_ROOT}/setup/services_manifest.sh"

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
ORIGIN_CA=false
SERVER_IP=""
PROFILES="sysreptor management"  # Always start these

while [[ $# -gt 0 ]]; do
    case "$1" in
        --slug)       SLUG="$2";       shift 2 ;;
        --enable-ssl) ENABLE_SSL=true; shift   ;;
        --origin-ca)  ORIGIN_CA=true;  shift   ;;
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
        if [ "$ORIGIN_CA" = "true" ] && [ -z "$CLOUDFLARE_API_USER_SERVICE_KEY" ]; then
            error "CLOUDFLARE_API_USER_SERVICE_KEY not set in .env (required for --origin-ca)"
            error "  Get it from: Cloudflare dashboard → My Profile → API Tokens → Origin CA Key"
            exit 1
        fi

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
    log "Cert source: $([ "$ORIGIN_CA" = "true" ] && echo "Cloudflare Origin CA" || echo "Let's Encrypt (DNS-01)")"

    # Create DNS A records (only for subdomains whose profile is active)
    log "Creating Cloudflare DNS A records..."
    "$DNS_MANAGER" create-records "$slug" "$server_ip" "$PROFILES"

    # Wait for DNS propagation (skippable for Origin CA — it doesn't use ACME,
    # but downstream nginx/curl checks still need DNS to resolve)
    log "Waiting 60s for DNS propagation..."
    sleep 60

    # Generate and deploy certificates (manifest-filtered by active profiles).
    # Both paths write to /opt/rtpi/certs/$SLUG/{nginx.crt,nginx.key,...} so
    # downstream nginx config + sysreptor wiring is identical.
    if [ "$ORIGIN_CA" = "true" ]; then
        "$ORIGIN_CERT_MANAGER" full-setup "$slug" "$PROFILES"
        # Origin CA path reuses cert_manager.sh's manifest-driven nginx config
        # writer and sysreptor app.env updater (no cert work done in this step).
        "$CERT_MANAGER" configure "$slug" "$PROFILES"
    else
        "$CERT_MANAGER" full-setup "$slug" "$PROFILES"
    fi

    log "✅ SSL setup complete"
    info "Domains:"
    local m_suffix m_gate m_upstream m_ws m_tls
    while IFS='|' read -r m_suffix m_gate m_upstream m_ws m_tls; do
        info "  https://${slug}${m_suffix}.${CF_DOMAIN}"
    done < <(iterate_manifest "$MANIFEST_PATH" "$PROFILES")
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

# ─── Post-Deploy Self-Healing ────────────────────────────────────────────────
# Structural repairs that deploy-verify.sh's state-only checks can't catch.
# Each repair is idempotent — safe to run on every deploy.
post_deploy_heal() {
    section "Post-Deploy Self-Healing"
    local healed=0 checks=0

    # ── 1. Cloudflared tunnel connectivity ────────────────────────────
    checks=$((checks + 1))
    log "Checking cloudflared tunnel registration..."
    if docker ps --format '{{.Names}}' | grep -q '^rtpi-cloudflared$'; then
        local cf_ok=false
        for _ in 1 2 3 4 5 6; do
            if docker logs --tail 30 rtpi-cloudflared 2>&1 | grep -q 'Registered tunnel connection'; then
                cf_ok=true
                break
            fi
            sleep 5
        done
        if [ "$cf_ok" = true ]; then
            if docker logs --tail 20 rtpi-cloudflared 2>&1 | grep -q 'No ingress rules'; then
                warn "cloudflared registered but has no ingress rules (all requests → 503)"
                warn "  Configure ingress in Cloudflare Zero Trust dashboard:"
                warn "  Networks → Tunnels → rtpi-${RTPI_SLUG:-c3s} → Public Hostname"
            else
                log "cloudflared: tunnel registered, ingress OK ✅"
            fi
        else
            warn "cloudflared did not register within 30s — restarting..."
            docker restart rtpi-cloudflared >/dev/null 2>&1
            sleep 10
            if docker logs --tail 10 rtpi-cloudflared 2>&1 | grep -q 'Registered tunnel connection'; then
                log "cloudflared: recovered after restart ✅"
                healed=$((healed + 1))
            else
                error "cloudflared: tunnel still not registered — check CF_TUNNEL_TOKEN"
            fi
        fi
    else
        info "cloudflared not running (skipped)"
    fi

    # ── 2. Kasm guac APIHOSTNAME placeholder ──────────────────────────
    checks=$((checks + 1))
    log "Checking kasm-guac API hostname resolution..."
    if docker ps --format '{{.Names}}' | grep -q '^rtpi-kasm-guac$'; then
        sleep 5
        if docker logs --tail 30 rtpi-kasm-guac 2>&1 | grep -q 'ENOTFOUND apihostname'; then
            warn "kasm-guac has unresolved APIHOSTNAME — patching..."
            docker exec rtpi-kasm-guac sh -c '
                SRC=/opt/kasm/current/conf/app/guac/kasmguac.app.config.yaml
                TMP=/tmp/kasmguac.app.config.yaml
                if [ -f "$TMP" ]; then
                    sed -i "s|APIHOSTNAME|kasm_proxy|g" "$TMP"
                elif [ -f "$SRC" ]; then
                    cp "$SRC" "$TMP"
                    sed -i "s|APIHOSTNAME|kasm_proxy|g" "$TMP"
                fi
            ' 2>/dev/null
            docker restart rtpi-kasm-guac >/dev/null 2>&1
            sleep 8
            if docker logs --tail 10 rtpi-kasm-guac 2>&1 | grep -q 'ENOTFOUND apihostname'; then
                error "kasm-guac: APIHOSTNAME still unresolved after patch"
            else
                log "kasm-guac: patched APIHOSTNAME → kasm_proxy ✅"
                healed=$((healed + 1))
            fi
        else
            log "kasm-guac: API hostname OK ✅"
        fi
    else
        info "kasm-guac not running (skipped)"
    fi

    # ── 3. Kasm manager healthcheck port ──────────────────────────────
    checks=$((checks + 1))
    log "Checking kasm-manager healthcheck..."
    if docker ps --format '{{.Names}}' | grep -q '^rtpi-kasm-manager$'; then
        local hc_test
        hc_test=$(docker inspect rtpi-kasm-manager --format '{{json .Config.Healthcheck.Test}}' 2>/dev/null)
        if echo "$hc_test" | grep -q 'localhost:8080'; then
            warn "kasm-manager healthcheck targets 8080 instead of 8181"
            warn "  Fix docker-compose.yml — container-healer.sh will handle restarts"
        else
            log "kasm-manager: healthcheck port OK ✅"
        fi
    else
        info "kasm-manager not running (skipped)"
    fi

    # ── 4. Deploy verification gate ───────────────────────────────────
    checks=$((checks + 1))
    log "Running deploy verification gate..."
    local verify_script="${PROJECT_ROOT}/scripts/deploy-verify.sh"
    if [ -x "$verify_script" ]; then
        if "$verify_script" --timeout 180 --stability 15; then
            log "Deploy verification passed ✅"
        else
            local rc=$?
            if [ $rc -eq 3 ]; then
                warn "Verification timed out — container-healer.sh will continue monitoring"
            else
                error "Deploy verification failed (exit $rc) — check logs above"
            fi
        fi
    else
        warn "deploy-verify.sh not found or not executable — skipping"
    fi

    echo ""
    log "Self-healing complete: ${checks} checks, ${healed} repairs applied"
}

# ─── Post-Deploy Summary ─────────────────────────────────────────────────────
print_summary() {
    section "Deployment Summary"

    if [ "$ENABLE_SSL" = "true" ] && [ -n "$SLUG" ]; then
        echo -e "${GREEN}SSL-Enabled Service URLs:${NC}"
        local m_suffix m_gate m_upstream m_ws m_tls label
        while IFS='|' read -r m_suffix m_gate m_upstream m_ws m_tls; do
            case "$m_suffix" in
                "")        label="RTPI Dashboard:" ;;
                -reports)  label="SysReptor:" ;;
                -empire)   label="Empire C2:" ;;
                -mgmt)     label="Portainer:" ;;
                -kasm)     label="Kasm Workspaces:" ;;
                -wiki)     label="Docmost Wiki:" ;;
                -vscode)   label="Kasm VS Code:" ;;
                -kali)      label="Kasm Kali:" ;;
                -workbench) label="ATT&CK Workbench:" ;;
                *)          label="${m_suffix#-}:" ;;
            esac
            printf "  %-25s %s\n" "$label" "https://${SLUG}${m_suffix}.${CF_DOMAIN}"
        done < <(iterate_manifest "$MANIFEST_PATH" "$PROFILES")
        echo ""
        echo -e "${YELLOW}Post-SSL steps:${NC}"
        echo "  1. Install nginx SSL config:"
        echo "     sudo cp docker/nginx-ssl.conf /etc/nginx/conf.d/rtpi-ssl.conf"
        echo "     sudo nginx -t && sudo systemctl reload nginx"
        if [ "$ORIGIN_CA" = "true" ]; then
            echo "  2. Cloudflare dashboard → SSL/TLS → Overview → set mode to 'Full (Strict)'"
            echo "     (Origin CA certs are only trusted by the Cloudflare edge)"
            echo "  3. Renewal: not required — 15-year validity. Cert id + expiry stored in"
            echo "     /opt/rtpi/certs/$SLUG/origin-ca/origin.{id,expires}"
        else
            echo "  2. Set up auto-renewal:"
            echo "     sudo ./setup/cert_renewal.sh setup-cron"
        fi
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
    info "Cert mode:  $([ "$ORIGIN_CA" = "true" ] && echo "Cloudflare Origin CA (15yr)" || echo "Let's Encrypt")"
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
    post_deploy_heal
    print_summary
}

main "$@"
