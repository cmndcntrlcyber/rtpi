#!/bin/bash
#
# SSL Setup Script for RTPI Kasm Workspaces
# Phase 2: SSL Automation (#KW-11 to #KW-15)
#
# This script automates SSL certificate provisioning and nginx configuration
# for Kasm Workspaces and Empire C2 listeners.
#
# Usage:
#   ./setup-ssl.sh [OPTIONS]
#
# Options:
#   -d DOMAIN        Domain name (required)
#   -e EMAIL         Email for Let's Encrypt (required)
#   -t TYPE          Challenge type: http-01 or dns-01 (default: http-01)
#   -k TOKEN         Cloudflare API token (required for dns-01)
#   -w               Wildcard certificate (implies dns-01)
#   -n               Dry run (test without issuing certificate)
#   -h               Show this help message
#

set -e

# ============================================================================
# Configuration
# ============================================================================

CERTBOT_CONTAINER="rtpi-certbot"
NGINX_CONTAINER="rtpi-kasm-proxy"
CERT_PATH="/etc/letsencrypt/live"
WEBROOT="/var/www/certbot"

# Default values
CHALLENGE_TYPE="http-01"
DRY_RUN=""
WILDCARD=false

# ============================================================================
# Functions
# ============================================================================

show_help() {
    cat << EOF
SSL Setup Script for RTPI Kasm Workspaces

Usage: $0 [OPTIONS]

Options:
  -d DOMAIN        Domain name (required)
  -e EMAIL         Email for Let's Encrypt (required)
  -t TYPE          Challenge type: http-01 or dns-01 (default: http-01)
  -k TOKEN         Cloudflare API token (required for dns-01)
  -w               Wildcard certificate (implies dns-01)
  -n               Dry run (test without issuing certificate)
  -h               Show this help message

Examples:
  # HTTP-01 challenge (single domain)
  $0 -d kasm.example.com -e admin@example.com

  # DNS-01 challenge (wildcard)
  $0 -d example.com -e admin@example.com -w -k cf_token_here

  # Dry run
  $0 -d kasm.example.com -e admin@example.com -n

EOF
}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
    exit 1
}

check_container() {
    local container=$1
    if ! docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        error "Container ${container} is not running. Start it with: docker compose --profile certbot up -d"
    fi
}

# ============================================================================
# Parse Arguments
# ============================================================================

while getopts "d:e:t:k:wnh" opt; do
    case $opt in
        d) DOMAIN="$OPTARG" ;;
        e) EMAIL="$OPTARG" ;;
        t) CHALLENGE_TYPE="$OPTARG" ;;
        k) CLOUDFLARE_TOKEN="$OPTARG" ;;
        w) WILDCARD=true; CHALLENGE_TYPE="dns-01" ;;
        n) DRY_RUN="--dry-run" ;;
        h) show_help; exit 0 ;;
        *) show_help; exit 1 ;;
    esac
done

# Validate required arguments
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    error "Domain (-d) and email (-e) are required"
fi

if [ "$CHALLENGE_TYPE" = "dns-01" ] && [ -z "$CLOUDFLARE_TOKEN" ]; then
    error "Cloudflare API token (-k) is required for DNS-01 challenge"
fi

# ============================================================================
# Main Script
# ============================================================================

log "Starting SSL setup for ${DOMAIN}..."
log "Challenge type: ${CHALLENGE_TYPE}"
log "Email: ${EMAIL}"
if [ -n "$DRY_RUN" ]; then
    log "DRY RUN MODE - No certificate will be issued"
fi

# Check if containers are running
log "Checking Docker containers..."
check_container "$CERTBOT_CONTAINER"
check_container "$NGINX_CONTAINER"

# Setup Cloudflare credentials for DNS-01
if [ "$CHALLENGE_TYPE" = "dns-01" ]; then
    log "Setting up Cloudflare DNS credentials..."
    docker exec "$CERTBOT_CONTAINER" sh -c "
        mkdir -p /etc/letsencrypt
        echo 'dns_cloudflare_api_token = ${CLOUDFLARE_TOKEN}' > /etc/letsencrypt/cloudflare.ini
        chmod 600 /etc/letsencrypt/cloudflare.ini
    "
    log "Cloudflare credentials configured"
fi

# Build certbot command
log "Requesting certificate..."
CERTBOT_CMD="certbot certonly --non-interactive --agree-tos"

if [ "$CHALLENGE_TYPE" = "dns-01" ]; then
    CERTBOT_CMD="$CERTBOT_CMD --dns-cloudflare --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini"

    if [ "$WILDCARD" = true ]; then
        CERTBOT_CMD="$CERTBOT_CMD -d ${DOMAIN} -d *.${DOMAIN}"
        log "Requesting wildcard certificate for ${DOMAIN} and *.${DOMAIN}"
    else
        CERTBOT_CMD="$CERTBOT_CMD -d ${DOMAIN}"
    fi
else
    CERTBOT_CMD="$CERTBOT_CMD --webroot --webroot-path ${WEBROOT} -d ${DOMAIN}"
fi

CERTBOT_CMD="$CERTBOT_CMD --email ${EMAIL} ${DRY_RUN}"

# Execute certbot
log "Executing: docker exec ${CERTBOT_CONTAINER} ${CERTBOT_CMD}"
if docker exec "$CERTBOT_CONTAINER" $CERTBOT_CMD; then
    log "Certificate request successful!"
else
    error "Certificate request failed"
fi

# Copy certificates to nginx directory (skip if dry run)
if [ -z "$DRY_RUN" ]; then
    log "Copying certificates to nginx directory..."
    docker exec "$CERTBOT_CONTAINER" sh -c "
        if [ -d ${CERT_PATH}/${DOMAIN} ]; then
            cp -L ${CERT_PATH}/${DOMAIN}/fullchain.pem /etc/nginx/certs/${DOMAIN}.crt
            cp -L ${CERT_PATH}/${DOMAIN}/privkey.pem /etc/nginx/certs/${DOMAIN}.key
            echo 'Certificates copied successfully'
        fi
    "
fi

# Test nginx configuration
log "Testing nginx configuration..."
if docker exec "$NGINX_CONTAINER" nginx -t; then
    log "Nginx configuration is valid"
else
    error "Nginx configuration test failed"
fi

# Reload nginx (skip if dry run)
if [ -z "$DRY_RUN" ]; then
    log "Reloading nginx..."
    if docker exec "$NGINX_CONTAINER" nginx -s reload; then
        log "Nginx reloaded successfully"
    else
        error "Nginx reload failed"
    fi
fi

# Display certificate information (skip if dry run)
if [ -z "$DRY_RUN" ]; then
    log "Certificate information:"
    docker exec "$CERTBOT_CONTAINER" certbot certificates --cert-name "$DOMAIN"
fi

# ============================================================================
# Success
# ============================================================================

log "SSL setup complete!"
if [ -z "$DRY_RUN" ]; then
    log ""
    log "Next steps:"
    log "1. Update your DNS records to point ${DOMAIN} to this server"
    log "2. Configure nginx to use the certificate at:"
    log "   - Certificate: /etc/nginx/certs/${DOMAIN}.crt"
    log "   - Key: /etc/nginx/certs/${DOMAIN}.key"
    log "3. Test HTTPS access: https://${DOMAIN}"
    log ""
    log "Certificate will auto-renew 30 days before expiry"
else
    log ""
    log "Dry run complete. Run without -n flag to issue the actual certificate."
fi
