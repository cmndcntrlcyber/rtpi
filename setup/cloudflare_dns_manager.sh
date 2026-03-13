#!/bin/bash

# RTPI Cloudflare DNS Manager
# Manages DNS records for Let's Encrypt ACME challenges and service A records
# Version: 1.1.0
#
# Requires .env to be sourced (or export vars):
#   CF_API_TOKEN, CF_DOMAIN, CF_ZONE_ID, CF_EMAIL

# Configuration from environment (loaded by build.sh via: set -a; source .env; set +a)
CLOUDFLARE_API_TOKEN=${CF_API_TOKEN}
DOMAIN=${CF_DOMAIN:-attck-node.net}
ZONE_ID=${CF_ZONE_ID}
EMAIL=${CF_EMAIL}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] DNS: $1${NC}"; }
warn()  { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] DNS WARNING: $1${NC}"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] DNS ERROR: $1${NC}"; }
info()  { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] DNS INFO: $1${NC}"; }

check_dependencies() {
    for dep in curl jq dig; do
        if ! command -v "$dep" &>/dev/null; then
            error "Required dependency '$dep' not found"
            exit 1
        fi
    done
}

validate_config() {
    log "Validating Cloudflare configuration..."
    local ok=true

    [ -z "$CLOUDFLARE_API_TOKEN" ] && { error "CF_API_TOKEN not set"; ok=false; }
    [ -z "$DOMAIN" ]               && { error "CF_DOMAIN not set";     ok=false; }
    [ -z "$ZONE_ID" ]              && { error "CF_ZONE_ID not set";    ok=false; }
    [ -z "$EMAIL" ]                && { error "CF_EMAIL not set";      ok=false; }
    [ "$ok" = "false" ]            && return 1

    info "Domain:    $DOMAIN"
    info "Email:     $EMAIL"
    info "Zone ID:   ${ZONE_ID:0:8}..."
    info "API Token: ${CLOUDFLARE_API_TOKEN:0:8}..."

    local response
    response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json")

    local success; success=$(echo "$response" | jq -r '.success // false')
    if [ "$success" = "true" ]; then
        local zone_name; zone_name=$(echo "$response" | jq -r '.result.name // "unknown"')
        log "✅ API connectivity OK — Zone: $zone_name"
    else
        error "❌ API connectivity failed"
        echo "$response" | jq -r '.errors[]?.message // "Unknown error"' >&2
        return 1
    fi
}

# Create DNS TXT record for ACME challenge
# Prints the record ID to stdout on success
create_acme_record() {
    local subdomain=$1
    local token=$2

    local record_name="_acme-challenge.$subdomain"
    log "Creating TXT $record_name.$DOMAIN"

    local response
    response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{\"type\":\"TXT\",\"name\":\"$record_name\",\"content\":\"$token\",\"ttl\":120,\"proxied\":false}")

    local record_id; record_id=$(echo "$response" | jq -r '.result.id // empty')
    local success;   success=$(echo  "$response" | jq -r '.success // false')

    if [ "$success" = "true" ] && [ -n "$record_id" ] && [ "$record_id" != "null" ]; then
        log "✅ TXT record created: $record_id"
        echo "$record_id"
        return 0
    else
        error "❌ Failed to create TXT record for $subdomain"
        echo "$response" | jq -r '.errors[]?.message // "Unknown error"' >&2
        return 1
    fi
}

delete_dns_record() {
    local record_id=$1
    local subdomain=$2

    local response
    response=$(curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$record_id" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json")

    local success; success=$(echo "$response" | jq -r '.success // false')
    if [ "$success" = "true" ]; then
        log "✅ Record $record_id deleted"
    else
        warn "⚠️ Failed to delete record $record_id for $subdomain"
        echo "$response" | jq -r '.errors[]?.message // "Unknown error"' >&2
    fi
}

# Handle ACME challenge create/delete (called by certbot hooks)
handle_dns_challenge() {
    local action=$1
    local subdomain=$2
    local token=$3

    case "$action" in
        create)
            [ -z "$token" ] && { error "Token required for create"; return 1; }
            local record_id
            record_id=$(create_acme_record "$subdomain" "$token") || return 1
            echo "$record_id" > "/tmp/acme_record_${subdomain//[^a-zA-Z0-9]/_}.id"
            log "Waiting 30s for DNS propagation..."
            sleep 30
            local check; check=$(dig +short TXT "_acme-challenge.$subdomain.$DOMAIN" @1.1.1.1 2>/dev/null | tr -d '"' | head -1)
            [ -n "$check" ] && log "✅ TXT record verified" || warn "⚠️ Not yet visible, continuing..."
            ;;
        delete)
            local id_file="/tmp/acme_record_${subdomain//[^a-zA-Z0-9]/_}.id"
            if [ -f "$id_file" ]; then
                delete_dns_record "$(cat "$id_file")" "$subdomain"
                rm -f "$id_file"
            else
                warn "No record ID found for cleanup of $subdomain"
            fi
            ;;
        *)
            error "Invalid action: $action. Use create or delete"
            return 1
            ;;
    esac
}

# Create A records pointing to server IP for all service subdomains
create_service_records() {
    local slug=$1
    local server_ip=$2

    [ -z "$slug" ] || [ -z "$server_ip" ] && { error "Usage: create_service_records <slug> <ip>"; return 1; }

    local services=("$slug" "$slug-reports" "$slug-empire" "$slug-mgmt" "$slug-kasm")
    for service in "${services[@]}"; do
        log "A record: $service.$DOMAIN -> $server_ip"
        local response
        response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"type\":\"A\",\"name\":\"$service\",\"content\":\"$server_ip\",\"ttl\":300,\"proxied\":false}")
        local success; success=$(echo "$response" | jq -r '.success // false')
        [ "$success" = "true" ] \
            && log "✅ A record created: $service.$DOMAIN" \
            || warn "⚠️ Failed: $service.$DOMAIN — $(echo "$response" | jq -r '.errors[0].message // "unknown"')"
    done
}

check_dependencies

main() {
    local action=$1; shift
    case "$action" in
        challenge)       handle_dns_challenge "$@" ;;
        create-records)  create_service_records "$@" ;;
        validate)        validate_config ;;
        *)
            echo "Usage: $0 <challenge|create-records|validate>"
            echo "  challenge create <subdomain> <token>"
            echo "  challenge delete <subdomain>"
            echo "  create-records <slug> <server_ip>"
            echo "  validate"
            exit 1
            ;;
    esac
}

main "$@"
