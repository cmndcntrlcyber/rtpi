#!/bin/bash
# Kasm Database SSL Certificate Generator
# This script generates self-signed certificates for the kasm-db container
# if they don't already exist.

CERT_DIR="${CERT_DIR:-/certs}"
CERT_FILE="${CERT_DIR}/db_server.crt"
KEY_FILE="${CERT_DIR}/db_server.key"

# Create cert directory if it doesn't exist
mkdir -p "${CERT_DIR}"

# Check if certificates already exist
if [ -f "${CERT_FILE}" ] && [ -f "${KEY_FILE}" ]; then
    echo "Certificates already exist, skipping generation"
    exit 0
fi

echo "Generating self-signed SSL certificates for Kasm DB..."

# Generate self-signed certificate (valid for 365 days)
openssl req -new -x509 -days 365 -nodes \
    -out "${CERT_FILE}" \
    -keyout "${KEY_FILE}" \
    -subj "/C=US/ST=State/L=City/O=RTPI/OU=Kasm/CN=kasm-db"

# Set proper permissions
chmod 600 "${KEY_FILE}"
chmod 644 "${CERT_FILE}"

# If running as root, change ownership to postgres user (UID 70 in alpine)
if [ "$(id -u)" = "0" ]; then
    chown 70:70 "${CERT_FILE}" "${KEY_FILE}" 2>/dev/null || true
fi

echo "Certificates generated successfully:"
echo "  Certificate: ${CERT_FILE}"
echo "  Key: ${KEY_FILE}"
