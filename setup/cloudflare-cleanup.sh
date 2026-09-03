#!/bin/bash

# RTPI Cloudflare Cleanup
# Tears down Cloudflare resources for a given slug: DNS records, tunnel, Pages
# project, and R2 bucket. Idempotent — safe to run when nothing exists.
#
# Called by build.sh Phase 0b when --clean is passed, or standalone:
#   ./cloudflare-cleanup.sh
#
# Requires .env to be sourced (or export vars):
#   CF_API_TOKEN, CF_ZONE_ID, CF_ACCOUNT_TOKEN, CLOUDFLARE_ACCOUNT_ID,
#   RTPI_SLUG, RTPI_DOMAIN

set -u

CF_API="https://api.cloudflare.com/client/v4"

ZONE_TOKEN="${CF_API_TOKEN:-}"
ZONE_ID="${CF_ZONE_ID:-}"
ACCOUNT_TOKEN="${CF_ACCOUNT_TOKEN:-}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
SLUG="${RTPI_SLUG:-}"
DOMAIN="${RTPI_DOMAIN:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[cleanup] $1${NC}"; }
warn()  { echo -e "${YELLOW}[cleanup] $1${NC}"; }
error() { echo -e "${RED}[cleanup] $1${NC}"; }
info()  { echo -e "${BLUE}[cleanup] $1${NC}"; }

preflight() {
    local ok=true
    [ -z "$SLUG" ]          && { error "RTPI_SLUG not set"; ok=false; }
    [ -z "$DOMAIN" ]        && { error "RTPI_DOMAIN not set"; ok=false; }
    [ -z "$ZONE_TOKEN" ]    && { error "CF_API_TOKEN not set"; ok=false; }
    [ -z "$ZONE_ID" ]       && { error "CF_ZONE_ID not set"; ok=false; }
    [ -z "$ACCOUNT_TOKEN" ] && { error "CF_ACCOUNT_TOKEN not set"; ok=false; }
    [ -z "$ACCOUNT_ID" ]    && { error "CLOUDFLARE_ACCOUNT_ID not set"; ok=false; }
    for dep in curl jq; do
        command -v "$dep" &>/dev/null || { error "$dep not found"; ok=false; }
    done
    [ "$ok" = "false" ] && return 1
    return 0
}

# ── DNS cleanup ──────────────────────────────────────────────────────────────

cleanup_dns() {
    log "Cleaning DNS records for slug '${SLUG}' in zone ${DOMAIN}..."

    local response
    response=$(curl -sf \
        -H "Authorization: Bearer ${ZONE_TOKEN}" \
        "${CF_API}/zones/${ZONE_ID}/dns_records?per_page=500" 2>/dev/null || echo "")

    if [ -z "$response" ]; then
        warn "Could not list DNS records — API unreachable"
        return 1
    fi

    local count
    count=$(echo "$response" | jq '.result | length' 2>/dev/null || echo "0")

    if [ "$count" -eq 0 ]; then
        info "No DNS records found for slug '${SLUG}'"
        return 0
    fi

    log "Found ${count} DNS record(s) to clean up"

    echo "$response" | jq -r '.result[] | "\(.id)|\(.type)|\(.name)"' 2>/dev/null | while IFS='|' read -r id type name; do
        # Only delete records that match this slug's subdomains
        case "$name" in
            ${SLUG}.${DOMAIN}|${SLUG}-*.${DOMAIN})
                log "Deleting ${type} record: ${name} (${id})"
                curl -sf -X DELETE \
                    -H "Authorization: Bearer ${ZONE_TOKEN}" \
                    "${CF_API}/zones/${ZONE_ID}/dns_records/${id}" >/dev/null 2>&1 \
                    && log "  Deleted ${name}" \
                    || warn "  Failed to delete ${name}"
                ;;
            *)
                info "  Skipping ${name} (not a ${SLUG} subdomain)"
                ;;
        esac
    done
}

# ── Access app cleanup ───────────────────────────────────────────────────────

cleanup_access() {
    log "Cleaning Access apps for slug '${SLUG}'..."

    local response
    response=$(curl -sf \
        -H "Authorization: Bearer ${ACCOUNT_TOKEN}" \
        "${CF_API}/accounts/${ACCOUNT_ID}/access/apps" 2>/dev/null || echo "")

    echo "$response" | jq -r '.result[] | "\(.id)|\(.name)|\(.domain)"' 2>/dev/null | while IFS='|' read -r app_id app_name app_domain; do
        case "$app_domain" in
            ${SLUG}-registry.${DOMAIN}|${SLUG}*.${DOMAIN})
                # Only delete apps we created (registry bypass), not the main wildcard
                case "$app_name" in
                    *Registry*|*registry*)
                        log "Deleting Access app '${app_name}' (${app_domain})"
                        curl -sf -X DELETE \
                            -H "Authorization: Bearer ${ACCOUNT_TOKEN}" \
                            "${CF_API}/accounts/${ACCOUNT_ID}/access/apps/${app_id}" >/dev/null 2>&1 \
                            && log "  Access app deleted" \
                            || warn "  Failed to delete Access app"
                        ;;
                esac
                ;;
        esac
    done
}

# ── Tunnel cleanup ───────────────────────────────────────────────────────────

cleanup_tunnel() {
    local tunnel_name="rtpi-${SLUG}"
    log "Cleaning tunnel '${tunnel_name}'..."

    local response
    response=$(curl -sf \
        -H "Authorization: Bearer ${ACCOUNT_TOKEN}" \
        "${CF_API}/accounts/${ACCOUNT_ID}/cfd_tunnel?name=${tunnel_name}&is_deleted=false" 2>/dev/null || echo "")

    if [ -z "$response" ]; then
        warn "Could not list tunnels — API unreachable"
        return 1
    fi

    local tunnel_id
    tunnel_id=$(echo "$response" | jq -r '.result[0].id // empty' 2>/dev/null)

    if [ -z "$tunnel_id" ]; then
        info "No tunnel '${tunnel_name}' found"
        return 0
    fi

    log "Deleting tunnel '${tunnel_name}' (${tunnel_id})..."
    local del_resp
    del_resp=$(curl -sf -X DELETE \
        -H "Authorization: Bearer ${ACCOUNT_TOKEN}" \
        "${CF_API}/accounts/${ACCOUNT_ID}/cfd_tunnel/${tunnel_id}" 2>/dev/null || echo "")

    local success
    success=$(echo "$del_resp" | jq -r '.success // false' 2>/dev/null)
    if [ "$success" = "true" ]; then
        log "  Tunnel deleted"
    else
        warn "  Failed to delete tunnel (may have active connections — stop cloudflared first)"
    fi
}

# ── Pages cleanup ────────────────────────────────────────────────────────────

cleanup_pages() {
    if ! command -v wrangler &>/dev/null; then
        warn "wrangler not found — skipping Pages cleanup"
        return 0
    fi

    for project in "rtpi-${SLUG}" "rtpi-registry-${SLUG}"; do
        log "Cleaning Pages project '${project}'..."
        if CLOUDFLARE_API_TOKEN="${ACCOUNT_TOKEN}" CLOUDFLARE_ACCOUNT_ID="${ACCOUNT_ID}" \
            wrangler pages project list 2>/dev/null | grep -q "${project}"; then
            # Remove custom domains first (required before project deletion)
            DOMAINS_RESP=$(curl -sf \
                -H "Authorization: Bearer ${ACCOUNT_TOKEN}" \
                "${CF_API}/accounts/${ACCOUNT_ID}/pages/projects/${project}/domains" 2>/dev/null || echo "")
            echo "$DOMAINS_RESP" | jq -r '.result[].name // empty' 2>/dev/null | while read -r domain_name; do
                [ -z "$domain_name" ] && continue
                log "  Removing custom domain '${domain_name}' from ${project}..."
                curl -sf -X DELETE \
                    -H "Authorization: Bearer ${ACCOUNT_TOKEN}" \
                    "${CF_API}/accounts/${ACCOUNT_ID}/pages/projects/${project}/domains/${domain_name}" >/dev/null 2>&1 \
                    && log "  Custom domain '${domain_name}' removed" \
                    || warn "  Failed to remove custom domain '${domain_name}'"
            done
            sleep 2
            CLOUDFLARE_API_TOKEN="${ACCOUNT_TOKEN}" CLOUDFLARE_ACCOUNT_ID="${ACCOUNT_ID}" \
                wrangler pages project delete "${project}" --yes 2>/dev/null \
                && log "  Pages project '${project}' deleted" \
                || warn "  Failed to delete Pages project '${project}'"
        else
            info "No Pages project '${project}' found"
        fi
    done
}

# ── R2 cleanup ───────────────────────────────────────────────────────────────

cleanup_r2() {
    local bucket="rtpi-releases-${SLUG}"
    log "Cleaning R2 bucket '${bucket}'..."

    if ! command -v wrangler &>/dev/null; then
        warn "wrangler not found — skipping R2 cleanup"
        return 0
    fi

    if CLOUDFLARE_API_TOKEN="${ACCOUNT_TOKEN}" CLOUDFLARE_ACCOUNT_ID="${ACCOUNT_ID}" \
        wrangler r2 bucket list 2>/dev/null | grep -q "${bucket}"; then
        CLOUDFLARE_API_TOKEN="${ACCOUNT_TOKEN}" CLOUDFLARE_ACCOUNT_ID="${ACCOUNT_ID}" \
            wrangler r2 bucket delete "${bucket}" 2>/dev/null \
            && log "  R2 bucket deleted" \
            || warn "  Failed to delete R2 bucket (may contain objects)"
    else
        info "No R2 bucket '${bucket}' found"
    fi
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
    log "═══ Cloudflare Cleanup for slug '${SLUG}' ═══"

    preflight || { error "Preflight failed — aborting cleanup"; exit 1; }

    cleanup_dns
    cleanup_tunnel
    cleanup_access
    cleanup_pages
    cleanup_r2

    log "═══ Cleanup complete ═══"
}

main "$@"
