#!/bin/sh
# Self-signed cert generator for the kasm-proxy nginx.
# POSIX sh — runs in alpine without bash. Idempotent: skips if certs exist.

set -e

CERT_DIR="${CERT_DIR:-/certs}"
CN="${KASM_SERVER_HOSTNAME:-localhost}"
CERT_FILE="${CERT_DIR}/kasm_nginx.crt"
KEY_FILE="${CERT_DIR}/kasm_nginx.key"

mkdir -p "${CERT_DIR}"

if [ -f "${CERT_FILE}" ] && [ -f "${KEY_FILE}" ]; then
    echo "Proxy certificates already exist, skipping generation"
    exit 0
fi

echo "Generating self-signed proxy certificate for CN=${CN}..."

openssl req -new -x509 -days 365 -nodes \
    -out "${CERT_FILE}" \
    -keyout "${KEY_FILE}" \
    -subj "/C=US/ST=State/L=City/O=RTPI/OU=Kasm/CN=${CN}" \
    -addext "subjectAltName=DNS:${CN},DNS:localhost,IP:127.0.0.1"

chmod 644 "${CERT_FILE}"
chmod 600 "${KEY_FILE}"

echo "Proxy certificates generated:"
echo "  ${CERT_FILE}"
echo "  ${KEY_FILE}"
