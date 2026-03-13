#!/bin/bash

# RTPI Certificate Manager
# Let's Encrypt SSL certificate automation using Cloudflare DNS-01 challenge
# Version: 1.0.0
#
# Usage:
#   sudo ./setup/cert_manager.sh full-setup <slug>
#   sudo ./setup/cert_manager.sh generate <slug>
#   sudo ./setup/cert_manager.sh deploy <slug>
#   ./setup/cert_manager.sh configure <slug>
#   ./setup/cert_manager.sh validate <slug>
#   sudo ./setup/cert_manager.sh setup-renewal <slug>

set -e

DOMAIN="attck-node.net"
EMAIL="${CF_EMAIL:-admin@example.com}"
CERT_DIR="/etc/letsencrypt"
DEPLOY_BASE="/opt/rtpi/certs"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DNS_MANAGER="$SCRIPT_DIR/cloudflare_dns_manager.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] CERT: $1${NC}"; }
warn()  { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] CERT WARNING: $1${NC}"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] CERT ERROR: $1${NC}"; }
info()  { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] CERT INFO: $1${NC}"; }

check_root() {
    [ "$EUID" -ne 0 ] && { error "Must run as root"; exit 1; }
}

install_dependencies() {
    log "Installing dependencies..."
    apt-get update -qq
    apt-get install -y certbot python3-certbot-dns-cloudflare jq curl dnsutils openssl
    log "Dependencies installed"
}

# Create DNS hook scripts for certbot manual mode
create_dns_hooks() {
    local hook_dir="$CERT_DIR/renewal-hooks"
    mkdir -p "$hook_dir"

    chmod +x "$DNS_MANAGER"

    cat > "$hook_dir/auth-hook.sh" << HOOK
#!/bin/bash
set -e
DNS_MANAGER="$DNS_MANAGER"
log() { echo "\$(date +'%Y-%m-%d %H:%M:%S') AUTH: \$1" >> /var/log/certbot-dns-hooks.log; }
[ ! -f "\$DNS_MANAGER" ] && { echo "DNS manager not found: \$DNS_MANAGER"; exit 1; }
SUBDOMAIN=\$(echo "\$CERTBOT_DOMAIN" | sed 's/\\.attck-node\\.net\$//')
log "Creating DNS record for \$SUBDOMAIN"
"\$DNS_MANAGER" challenge create "\$SUBDOMAIN" "\$CERTBOT_VALIDATION"
log "Waiting 30s for propagation..."
sleep 30
HOOK

    cat > "$hook_dir/cleanup-hook.sh" << HOOK
#!/bin/bash
DNS_MANAGER="$DNS_MANAGER"
log() { echo "\$(date +'%Y-%m-%d %H:%M:%S') CLEANUP: \$1" >> /var/log/certbot-dns-hooks.log; }
[ ! -f "\$DNS_MANAGER" ] && { echo "DNS manager not found: \$DNS_MANAGER"; exit 1; }
SUBDOMAIN=\$(echo "\$CERTBOT_DOMAIN" | sed 's/\\.attck-node\\.net\$//')
log "Cleaning up DNS record for \$SUBDOMAIN"
"\$DNS_MANAGER" challenge delete "\$SUBDOMAIN" || true
HOOK

    chmod +x "$hook_dir/auth-hook.sh" "$hook_dir/cleanup-hook.sh"
    touch /var/log/certbot-dns-hooks.log
    chmod 644 /var/log/certbot-dns-hooks.log
    log "DNS hooks created"
}

generate_certificates() {
    local slug=$1
    [ -z "$slug" ] && { error "Usage: generate_certificates <slug>"; return 1; }

    log "Generating certificates for slug: $slug"
    local services=("$slug" "$slug-reports" "$slug-empire" "$slug-mgmt" "$slug-kasm")
    local domains=()
    for s in "${services[@]}"; do domains+=("-d" "$s.$DOMAIN"); done
    log "Domains: ${services[*]}"

    certbot certonly \
        --manual \
        --preferred-challenges=dns \
        --email "$EMAIL" \
        --server https://acme-v02.api.letsencrypt.org/directory \
        --agree-tos \
        --manual-auth-hook    "$CERT_DIR/renewal-hooks/auth-hook.sh" \
        --manual-cleanup-hook "$CERT_DIR/renewal-hooks/cleanup-hook.sh" \
        --cert-name "$slug-services" \
        "${domains[@]}" \
        --non-interactive

    log "✅ Certificates generated for $slug"
}

deploy_certificates() {
    local slug=$1
    [ -z "$slug" ] && { error "Usage: deploy_certificates <slug>"; return 1; }

    local cert_path="$CERT_DIR/live/$slug-services"
    [ ! -d "$cert_path" ] && { error "Certificate not found: $cert_path"; return 1; }

    local deploy_dir="$DEPLOY_BASE/$slug"
    mkdir -p "$deploy_dir"

    cp "$cert_path/fullchain.pem" "$deploy_dir/"
    cp "$cert_path/privkey.pem"   "$deploy_dir/"
    cp "$cert_path/cert.pem"      "$deploy_dir/"
    cp "$cert_path/chain.pem"     "$deploy_dir/"

    chmod 644 "$deploy_dir/fullchain.pem" "$deploy_dir/cert.pem" "$deploy_dir/chain.pem"
    chmod 600 "$deploy_dir/privkey.pem"
    chown -R root:root "$deploy_dir"

    # nginx-compatible files
    cat "$cert_path/fullchain.pem" > "$deploy_dir/nginx.crt"
    cat "$cert_path/privkey.pem"   > "$deploy_dir/nginx.key"
    chmod 644 "$deploy_dir/nginx.crt"
    chmod 600 "$deploy_dir/nginx.key"

    log "✅ Certificates deployed to $deploy_dir"
}

update_service_configs() {
    local slug=$1
    [ -z "$slug" ] && { error "Usage: update_service_configs <slug>"; return 1; }

    # Update SysReptor ALLOWED_HOSTS
    local sysreptor_env="$PROJECT_ROOT/configs/rtpi-sysreptor/app.env"
    if [ -f "$sysreptor_env" ]; then
        local allowed_hosts="$slug-reports.$DOMAIN,sysreptor,sysreptor-app,0.0.0.0,127.0.0.1,localhost"
        if grep -q "^ALLOWED_HOSTS=" "$sysreptor_env"; then
            sed -i "s|^ALLOWED_HOSTS=.*|ALLOWED_HOSTS=$allowed_hosts|" "$sysreptor_env"
        else
            echo "ALLOWED_HOSTS=$allowed_hosts" >> "$sysreptor_env"
        fi
        sed -i "s|^SECURE_SSL_REDIRECT=.*|SECURE_SSL_REDIRECT=on|" "$sysreptor_env"
        log "SysReptor config updated"
    fi

    # Generate nginx SSL config
    local nginx_ssl="$PROJECT_ROOT/docker/nginx-ssl.conf"
    cat > "$nginx_ssl" << NGINX
# RTPI Production SSL Proxy — generated for slug: $slug
# Cert path: $DEPLOY_BASE/$slug/

ssl_certificate     $DEPLOY_BASE/$slug/nginx.crt;
ssl_certificate_key $DEPLOY_BASE/$slug/nginx.key;
ssl_session_timeout 1d;
ssl_session_cache   shared:SSL:50m;
ssl_session_tickets off;
ssl_protocols       TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
add_header Strict-Transport-Security "max-age=63072000" always;

# ─── Main RTPI Dashboard ─────────────────────────────────────────────────────
server { listen 80;  server_name $slug.$DOMAIN; return 301 https://\$server_name\$request_uri; }
server {
    listen 443 ssl http2; server_name $slug.$DOMAIN;
    client_max_body_size 900M;
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
    }
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# ─── SysReptor (Reports) ─────────────────────────────────────────────────────
server { listen 80;  server_name $slug-reports.$DOMAIN; return 301 https://\$server_name\$request_uri; }
server {
    listen 443 ssl http2; server_name $slug-reports.$DOMAIN;
    location / {
        proxy_pass http://localhost:7777;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# ─── Empire C2 ───────────────────────────────────────────────────────────────
server { listen 80;  server_name $slug-empire.$DOMAIN; return 301 https://\$server_name\$request_uri; }
server {
    listen 443 ssl http2; server_name $slug-empire.$DOMAIN;
    location / {
        proxy_pass http://localhost:1337;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# ─── Portainer Management ────────────────────────────────────────────────────
server { listen 80;  server_name $slug-mgmt.$DOMAIN; return 301 https://\$server_name\$request_uri; }
server {
    listen 443 ssl http2; server_name $slug-mgmt.$DOMAIN;
    location / {
        proxy_pass https://localhost:9443;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_ssl_verify off;
    }
}

# ─── Kasm Workspaces ─────────────────────────────────────────────────────────
server { listen 80;  server_name $slug-kasm.$DOMAIN; return 301 https://\$server_name\$request_uri; }
server {
    listen 443 ssl http2; server_name $slug-kasm.$DOMAIN;
    location / {
        proxy_pass https://localhost:8443;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_ssl_verify off;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
    log "✅ nginx SSL config written to $nginx_ssl"
    info "  Install: sudo cp $nginx_ssl /etc/nginx/conf.d/rtpi-ssl.conf && sudo nginx -t && sudo systemctl reload nginx"
}

validate_certificates() {
    local slug=$1
    [ -z "$slug" ] && { error "Usage: validate_certificates <slug>"; return 1; }

    local cert_path="$CERT_DIR/live/$slug-services/fullchain.pem"
    [ ! -f "$cert_path" ] && { error "Certificate not found: $cert_path"; return 1; }

    local expiry; expiry=$(openssl x509 -in "$cert_path" -text -noout | grep "Not After" | cut -d: -f2-)
    info "Expiry:$expiry"

    openssl verify -CAfile "$CERT_DIR/live/$slug-services/chain.pem" "$CERT_DIR/live/$slug-services/cert.pem" >/dev/null 2>&1 \
        && log "✅ Certificate chain valid" \
        || { error "❌ Certificate chain invalid"; return 1; }
}

setup_renewal() {
    local slug=$1
    local cron_job="0 0,12 * * * /opt/rtpi/setup/cert_manager.sh deploy $slug >/var/log/rtpi-cert-renewal.log 2>&1"
    if ! crontab -l 2>/dev/null | grep -q "$slug-services"; then
        (crontab -l 2>/dev/null; echo "$cron_job") | crontab -
        log "Renewal cron added (twice daily)"
    else
        log "Renewal cron already present"
    fi
}

main() {
    local action=$1; local slug=$2
    case "$action" in
        install-deps)   check_root; install_dependencies ;;
        generate)       [ -z "$slug" ] && { error "Usage: $0 generate <slug>"; exit 1; }; check_root; create_dns_hooks; generate_certificates "$slug" ;;
        deploy)         [ -z "$slug" ] && { error "Usage: $0 deploy <slug>"; exit 1; };   check_root; deploy_certificates "$slug" ;;
        configure)      [ -z "$slug" ] && { error "Usage: $0 configure <slug>"; exit 1; }; update_service_configs "$slug" ;;
        validate)       [ -z "$slug" ] && { error "Usage: $0 validate <slug>"; exit 1; };  validate_certificates "$slug" ;;
        setup-renewal)  [ -z "$slug" ] && { error "Usage: $0 setup-renewal <slug>"; exit 1; }; check_root; setup_renewal "$slug" ;;
        full-setup)
            [ -z "$slug" ] && { error "Usage: $0 full-setup <slug>"; exit 1; }
            check_root
            install_dependencies
            create_dns_hooks
            generate_certificates "$slug"
            deploy_certificates "$slug"
            update_service_configs "$slug"
            validate_certificates "$slug"
            setup_renewal "$slug"
            ;;
        *)
            echo "Usage: $0 <install-deps|generate|deploy|configure|validate|setup-renewal|full-setup> [slug]"
            exit 1
            ;;
    esac
}

main "$@"
