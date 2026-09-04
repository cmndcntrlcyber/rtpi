#!/bin/bash

# RTPI Cloudflare Origin CA Certificate Manager
# Issues a single multi-SAN certificate signed by Cloudflare's Origin CA via the
# /certificates endpoint (15-year validity by default). Trusted only by
# Cloudflare's edge — use with the Cloudflare proxy in front of this origin
# (SSL/TLS encryption mode: Full (Strict)).
#
# Reuses setup/services.manifest as the single source of truth for hostnames
# and writes to the same /opt/rtpi/certs/<slug>/ layout as cert_manager.sh, so
# the existing docker/nginx-ssl.conf and build.sh wiring work unchanged.
#
# Usage:
#   sudo ./setup/origin_cert_manager.sh full-setup <slug> [profiles]
#   sudo ./setup/origin_cert_manager.sh generate  <slug> [profiles]
#   sudo ./setup/origin_cert_manager.sh deploy    <slug>
#   ./setup/origin_cert_manager.sh validate <slug>
#
# Required env (load via build.sh's `source .env`):
#   CF_DOMAIN                         apex domain (e.g. onoiroi.us)
#   CLOUDFLARE_API_USER_SERVICE_KEY   Origin CA Key from Cloudflare dashboard
#                                     (My Profile → API Tokens → Origin CA Key,
#                                     format starts with `v1.0-`). NOT a
#                                     regular API token.
# Optional env:
#   RTPI_ORIGIN_CA_VALIDITY_DAYS      7|30|90|365|730|1095|5475 (default 5475)
#   RTPI_ORIGIN_CA_KEY_TYPE           origin-rsa|origin-ecc (default origin-rsa)

set -e

DOMAIN="${CF_DOMAIN:?CF_DOMAIN must be set (export it or source .env first)}"
ORIGIN_KEY="${CLOUDFLARE_API_USER_SERVICE_KEY:?CLOUDFLARE_API_USER_SERVICE_KEY must be set (Cloudflare Origin CA Key, not a regular API token)}"
VALIDITY="${RTPI_ORIGIN_CA_VALIDITY_DAYS:-5475}"
REQUEST_TYPE="${RTPI_ORIGIN_CA_KEY_TYPE:-origin-rsa}"

DEPLOY_BASE="/opt/rtpi/certs"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MANIFEST_PATH="$SCRIPT_DIR/services.manifest"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/services_manifest.sh"

CF_API="https://api.cloudflare.com/client/v4/certificates"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()   { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ORIGIN-CA: $1${NC}"; }
warn()  { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ORIGIN-CA WARNING: $1${NC}"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ORIGIN-CA ERROR: $1${NC}"; }
info()  { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] ORIGIN-CA INFO: $1${NC}"; }

check_root() { [ "$EUID" -ne 0 ] && { error "Must run as root"; exit 1; } }

# ─── Validity allow-list (Cloudflare rejects anything else) ─────────────────
validate_inputs() {
    case "$VALIDITY" in
        7|30|90|365|730|1095|5475) ;;
        *) error "RTPI_ORIGIN_CA_VALIDITY_DAYS must be one of: 7, 30, 90, 365, 730, 1095, 5475 (got: $VALIDITY)"; exit 1 ;;
    esac
    case "$REQUEST_TYPE" in
        origin-rsa|origin-ecc) ;;
        *) error "RTPI_ORIGIN_CA_KEY_TYPE must be origin-rsa or origin-ecc (got: $REQUEST_TYPE)"; exit 1 ;;
    esac
    command -v openssl >/dev/null || { error "openssl not installed"; exit 1; }
    command -v jq      >/dev/null || { error "jq not installed (apt install jq)"; exit 1; }
    command -v curl    >/dev/null || { error "curl not installed"; exit 1; }
}

# ─── Hostname list from the manifest ────────────────────────────────────────
collect_hostnames() {
    local slug=$1 profiles=$2
    local m_suffix m_gate m_upstream m_ws m_tls
    while IFS='|' read -r m_suffix m_gate m_upstream m_ws m_tls; do
        echo "${slug}${m_suffix}.${DOMAIN}"
    done < <(iterate_manifest "$MANIFEST_PATH" "$profiles")
}

# ─── Generate RSA key + CSR for the given hostnames ─────────────────────────
# Note: Cloudflare uses the JSON `hostnames` array as the cert SAN list and
# ignores SANs in the CSR. We still embed them in the CSR for completeness
# (some downstream tools display them).
generate_csr() {
    local slug=$1 work_dir=$2
    shift 2
    local hostnames=("$@")

    mkdir -p "$work_dir"
    chmod 700 "$work_dir"

    local primary="${hostnames[0]}"
    local san_lines=""
    local i=1
    for h in "${hostnames[@]}"; do
        san_lines+="DNS.$i = $h"$'\n'
        i=$((i+1))
    done

    cat > "$work_dir/openssl.cnf" << CNF
[ req ]
default_bits       = ${RTPI_ORIGIN_CA_RSA_BITS:-2048}
distinguished_name = req_dn
req_extensions     = req_ext
prompt             = no

[ req_dn ]
CN = ${primary}
O  = RTPI
OU = Origin CA Certificate

[ req_ext ]
subjectAltName = @alt_names

[ alt_names ]
${san_lines}
CNF

    if [ "$REQUEST_TYPE" = "origin-ecc" ]; then
        openssl ecparam -genkey -name prime256v1 -out "$work_dir/origin.key"
    else
        openssl genrsa -out "$work_dir/origin.key" "${RTPI_ORIGIN_CA_RSA_BITS:-2048}"
    fi
    chmod 600 "$work_dir/origin.key"

    openssl req -new \
        -key "$work_dir/origin.key" \
        -config "$work_dir/openssl.cnf" \
        -out "$work_dir/origin.csr"

    log "CSR generated: $work_dir/origin.csr ($primary + $((${#hostnames[@]} - 1)) SAN(s))"
}

# ─── POST the CSR to Cloudflare Origin CA ───────────────────────────────────
request_certificate() {
    local work_dir=$1
    shift
    local hostnames=("$@")

    local csr_pem; csr_pem=$(cat "$work_dir/origin.csr")
    local payload
    payload=$(jq -n \
        --arg csr "$csr_pem" \
        --argjson hostnames "$(printf '%s\n' "${hostnames[@]}" | jq -R . | jq -s .)" \
        --arg request_type "$REQUEST_TYPE" \
        --argjson requested_validity "$VALIDITY" \
        '{csr: $csr, hostnames: $hostnames, request_type: $request_type, requested_validity: $requested_validity}')

    log "Requesting cert from $CF_API (validity=${VALIDITY}d, type=${REQUEST_TYPE}, hosts=${#hostnames[@]})"

    local response
    response=$(curl -fsS -X POST "$CF_API" \
        -H 'Content-Type: application/json' \
        -H "X-Auth-User-Service-Key: $ORIGIN_KEY" \
        --data "$payload")

    local success; success=$(echo "$response" | jq -r '.success')
    if [ "$success" != "true" ]; then
        error "Cloudflare API rejected the request:"
        echo "$response" | jq -r '.errors[]? | "  [\(.code)] \(.message)"' >&2 || echo "$response" >&2
        return 1
    fi

    echo "$response" | jq -r '.result.certificate' > "$work_dir/origin.crt"
    echo "$response" | jq -r '.result.id'         > "$work_dir/origin.id"
    echo "$response" | jq -r '.result.expires_on' > "$work_dir/origin.expires"

    [ -s "$work_dir/origin.crt" ] || { error "Empty certificate in response"; return 1; }
    log "Certificate issued (id: $(cat "$work_dir/origin.id"), expires: $(cat "$work_dir/origin.expires"))"
}

generate() {
    local slug=$1 profiles=$2
    [ -z "$slug" ] && { error "Usage: generate <slug> [profiles]"; return 1; }
    validate_inputs

    local work_dir="$DEPLOY_BASE/$slug/origin-ca"
    local hostnames=()
    mapfile -t hostnames < <(collect_hostnames "$slug" "$profiles")
    [ "${#hostnames[@]}" -eq 0 ] && { error "No hostnames produced from manifest (slug=$slug, profiles=$profiles)"; return 1; }
    [ "${#hostnames[@]}" -gt 100 ] && { error "Cloudflare Origin CA allows max 100 hostnames per cert (got ${#hostnames[@]})"; return 1; }

    log "Hostnames (${#hostnames[@]}):"
    printf '  - %s\n' "${hostnames[@]}"

    generate_csr "$slug" "$work_dir" "${hostnames[@]}"
    request_certificate "$work_dir" "${hostnames[@]}"
    log "✅ Generated. Run: $0 deploy $slug"
}

deploy() {
    local slug=$1
    [ -z "$slug" ] && { error "Usage: deploy <slug>"; return 1; }
    local work_dir="$DEPLOY_BASE/$slug/origin-ca"
    local deploy_dir="$DEPLOY_BASE/$slug"

    [ -f "$work_dir/origin.crt" ] || { error "Cert not found: $work_dir/origin.crt (run generate first)"; return 1; }
    [ -f "$work_dir/origin.key" ] || { error "Key not found:  $work_dir/origin.key";  return 1; }

    install -m 644 "$work_dir/origin.crt" "$deploy_dir/nginx.crt"
    install -m 600 "$work_dir/origin.key" "$deploy_dir/nginx.key"
    install -m 644 "$work_dir/origin.crt" "$deploy_dir/fullchain.pem"
    install -m 644 "$work_dir/origin.crt" "$deploy_dir/cert.pem"
    install -m 600 "$work_dir/origin.key" "$deploy_dir/privkey.pem"
    chown -R root:root "$deploy_dir"

    log "✅ Deployed to $deploy_dir (nginx.crt, nginx.key, fullchain.pem, cert.pem, privkey.pem)"
    info "Expires: $(cat "$work_dir/origin.expires" 2>/dev/null || echo unknown)"
    info "Cloudflare requires SSL/TLS mode = Full (Strict) for this cert to be trusted at the edge."
}

validate() {
    local slug=$1
    [ -z "$slug" ] && { error "Usage: validate <slug>"; return 1; }
    local cert="$DEPLOY_BASE/$slug/nginx.crt"
    [ -f "$cert" ] || { error "Cert not deployed yet: $cert"; return 1; }

    local subject issuer not_after sans
    subject=$(openssl x509 -in "$cert" -noout -subject)
    issuer=$( openssl x509 -in "$cert" -noout -issuer)
    not_after=$(openssl x509 -in "$cert" -noout -enddate)
    sans=$(openssl x509 -in "$cert" -noout -ext subjectAltName 2>/dev/null | tail -n +2 | tr -d ' ')

    info "$subject"
    info "$issuer"
    info "$not_after"
    info "SANs: ${sans:-none}"

    case "$issuer" in
        *"Cloudflare"*) log "✅ Issued by Cloudflare Origin CA";;
        *)              warn "Issuer does not look like Cloudflare — check the cert source";;
    esac
}

main() {
    local action=$1; local slug=$2; local profiles=${3:-"sysreptor management"}
    case "$action" in
        generate)   check_root; generate "$slug" "$profiles" ;;
        deploy)     check_root; deploy   "$slug" ;;
        validate)               validate "$slug" ;;
        full-setup)
            [ -z "$slug" ] && { error "Usage: $0 full-setup <slug> [profiles]"; exit 1; }
            check_root
            generate "$slug" "$profiles"
            deploy   "$slug"
            validate "$slug"
            ;;
        *)
            echo "Usage: $0 <generate|deploy|validate|full-setup> <slug> [profiles]"
            exit 1
            ;;
    esac
}

main "$@"
