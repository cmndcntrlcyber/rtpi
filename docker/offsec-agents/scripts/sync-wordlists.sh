#!/bin/bash
# Sync wordlists from Cloudflare R2 to /opt/wordlists/
# Uses AWS CLI with S3-compatible endpoint
# Called by mcp-entrypoint.sh at container startup

set -euo pipefail

if [ -z "${R2_ENDPOINT:-}" ] || [ -z "${R2_ACCESS_KEY_ID:-}" ]; then
    echo "[wordlist-sync] R2 credentials not configured, skipping wordlist sync"
    exit 0
fi

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
export AWS_DEFAULT_REGION="auto"

BUCKET="s3://${R2_BUCKET_NAME:-wordlist-storag}"

# Only sync if wordlists directory is empty or forced
if [ "$(ls -A /opt/wordlists/ 2>/dev/null)" ] && [ "${FORCE_WORDLIST_SYNC:-false}" != "true" ]; then
    echo "[wordlist-sync] Wordlists already present, skipping sync (set FORCE_WORDLIST_SYNC=true to override)"
    exit 0
fi

mkdir -p /opt/wordlists

echo "[wordlist-sync] Syncing wordlists from R2 bucket: ${R2_BUCKET_NAME:-wordlist-storag}..."
aws s3 sync "$BUCKET" /opt/wordlists/ \
    --endpoint-url "$R2_ENDPOINT" \
    --no-progress \
    --only-show-errors

echo "[wordlist-sync] Wordlist sync complete"
