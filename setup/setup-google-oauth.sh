#!/usr/bin/env bash
# setup-google-oauth.sh
# Programmatically prepares a Google Cloud project for "Sign in with Google",
# semi-automatically creates a Web-application OAuth 2.0 Client ID,
# and writes CLIENT_ID / CLIENT_SECRET / CALLBACK_URL into a project .env file.
#
# Why "semi-automatic"? As of May 2026, Google does not expose any public API
# or gcloud command that creates a standard "Web application" OAuth 2.0 client
# with an editable redirect URI. The IAP OAuth Admin API was deprecated
# 2025-01-22 and is scheduled for shutdown 2026-03-19; the IAM Workforce
# OAuth API only produces clients usable with IAP/Workforce federation.
# The Cloud Console UI is the only supported creation path; this script
# automates everything around that single click.
#
# Usage:
#   ./setup-google-oauth.sh \
#       --domain https://app.example.com \
#       [--project my-gcp-project] \
#       [--env-file ./path/to/.env] \
#       [--display-name "MyApp Production"] \
#       [--client-id <id> --client-secret <secret>]   # fully non-interactive
#
# Env vars (alternative to flags):
#   PRODUCTION_DOMAIN, GCP_PROJECT, ENV_FILE, OAUTH_DISPLAY_NAME,
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
#
set -euo pipefail

# ---------- defaults ----------
DOMAIN="${PRODUCTION_DOMAIN:-}"
PROJECT="${GCP_PROJECT:-}"
ENV_FILE="${ENV_FILE:-}"
DISPLAY_NAME="${OAUTH_DISPLAY_NAME:-Web App OAuth Client}"
CALLBACK_PATH="/api/v1/auth/google/callback"
CLIENT_ID_IN="${GOOGLE_CLIENT_ID:-}"
CLIENT_SECRET_IN="${GOOGLE_CLIENT_SECRET:-}"

# ---------- arg parsing ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)         DOMAIN="$2"; shift 2 ;;
    --project)        PROJECT="$2"; shift 2 ;;
    --env-file)       ENV_FILE="$2"; shift 2 ;;
    --display-name)   DISPLAY_NAME="$2"; shift 2 ;;
    --callback-path)  CALLBACK_PATH="$2"; shift 2 ;;
    --client-id)      CLIENT_ID_IN="$2"; shift 2 ;;
    --client-secret)  CLIENT_SECRET_IN="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }
die()    { red "ERROR: $*"; exit 1; }

# ---------- Step 1: prerequisites ----------
bold "[1/6] Checking prerequisites"
command -v gcloud >/dev/null || die "gcloud CLI not installed. See https://cloud.google.com/sdk/docs/install"

ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || true)"
[[ -n "$ACTIVE_ACCOUNT" && "$ACTIVE_ACCOUNT" != "(unset)" ]] \
  || die "gcloud is not authenticated. Run: gcloud auth login"
green "  ✓ gcloud authenticated as: $ACTIVE_ACCOUNT"

if [[ -z "$PROJECT" ]]; then
  PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
fi
[[ -n "$PROJECT" && "$PROJECT" != "(unset)" ]] \
  || die "No project specified. Pass --project <id> or run: gcloud config set project <id>"
green "  ✓ Using project: $PROJECT"
gcloud config set project "$PROJECT" >/dev/null

# Domain prompt if missing
if [[ -z "$DOMAIN" ]]; then
  read -r -p "Production domain (e.g. https://app.example.com): " DOMAIN
fi
# Normalize: strip trailing slash, ensure scheme
DOMAIN="${DOMAIN%/}"
[[ "$DOMAIN" =~ ^https?:// ]] || DOMAIN="https://$DOMAIN"
CALLBACK_URL="${DOMAIN}${CALLBACK_PATH}"
green "  ✓ Callback URL will be: $CALLBACK_URL"

# ---------- Step 2: enable APIs ----------
bold "[2/6] Enabling required APIs"
# iap.googleapis.com is needed for the (legacy) brand creation;
# iamcredentials is harmless and useful for downstream tasks.
for api in iap.googleapis.com iamcredentials.googleapis.com; do
  if gcloud services list --enabled --filter="config.name=$api" --format="value(config.name)" \
       | grep -qx "$api"; then
    green "  ✓ $api already enabled"
  else
    yellow "  → Enabling $api ..."
    gcloud services enable "$api"
  fi
done

# ---------- Step 3: ensure an OAuth brand (consent screen) exists ----------
bold "[3/6] Checking OAuth consent screen (brand)"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
BRAND_LIST_OUT="$(gcloud alpha iap oauth-brands list --format='value(name)' 2>/dev/null || true)"

if [[ -z "$BRAND_LIST_OUT" ]]; then
  yellow "  → No brand found."
  yellow "    The IAP OAuth Admin API is deprecated (2025-01-22) and shuts down 2026-03-19."
  yellow "    Please configure the OAuth consent screen manually (one-time, ~30 seconds):"
  yellow "      https://console.cloud.google.com/auth/overview?project=$PROJECT"
  read -r -p "    Press <Enter> after you have completed 'Get started' on the Branding page..."
else
  green "  ✓ Brand exists: $BRAND_LIST_OUT"
fi

# ---------- Step 4: create the OAuth Web application client ----------
bold "[4/6] Creating Web Application OAuth 2.0 Client"

# If credentials were passed in (e.g. CI/restore from secret manager), skip UI.
if [[ -n "$CLIENT_ID_IN" && -n "$CLIENT_SECRET_IN" ]]; then
  CLIENT_ID="$CLIENT_ID_IN"
  CLIENT_SECRET="$CLIENT_SECRET_IN"
  green "  ✓ Using credentials supplied via flags / env"
else
  # Deep-link to the Cloud Console "Create OAuth client" form.
  # The Console UI honors these query params on the credentials page.
  CREATE_URL="https://console.cloud.google.com/auth/clients/create?project=${PROJECT}"
  echo
  bold "  Opening browser to create the OAuth Web client."
  echo "  In the form that appears, choose:"
  echo "    • Application type: Web application"
  echo "    • Name:             $DISPLAY_NAME"
  echo "    • Authorized redirect URIs: $CALLBACK_URL"
  echo "    • Authorized JavaScript origins: $DOMAIN"
  echo
  echo "  Then click CREATE and either:"
  echo "    (a) Click DOWNLOAD JSON  (the script will auto-detect it in ~/Downloads), or"
  echo "    (b) Copy the Client ID and Client secret and paste them when prompted."
  echo

  # Cross-platform open
  if command -v xdg-open >/dev/null;     then xdg-open "$CREATE_URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null;       then open "$CREATE_URL" >/dev/null 2>&1 &
  elif command -v cmd.exe >/dev/null;    then cmd.exe /c start "" "$CREATE_URL" >/dev/null 2>&1 &
  else
    echo "  Could not auto-open a browser. Visit:  $CREATE_URL"
  fi

  # Try to auto-detect a freshly downloaded client_secret_*.json (60s window)
  DOWNLOADS_DIR="${HOME}/Downloads"
  CLIENT_ID=""
  CLIENT_SECRET=""
  if [[ -d "$DOWNLOADS_DIR" ]]; then
    yellow "  Watching ${DOWNLOADS_DIR} for a new client_secret_*.json (60s)..."
    BEFORE="$(ls -1 "$DOWNLOADS_DIR"/client_secret_*.json 2>/dev/null || true)"
    for _ in $(seq 1 60); do
      sleep 1
      AFTER="$(ls -1 "$DOWNLOADS_DIR"/client_secret_*.json 2>/dev/null || true)"
      NEW_FILE="$(comm -13 <(echo "$BEFORE") <(echo "$AFTER") | tail -n1 || true)"
      if [[ -n "$NEW_FILE" && -f "$NEW_FILE" ]]; then
        green "  ✓ Detected $NEW_FILE"
        if command -v jq >/dev/null; then
          CLIENT_ID="$(jq -r '.web.client_id'      "$NEW_FILE")"
          CLIENT_SECRET="$(jq -r '.web.client_secret' "$NEW_FILE")"
        else
          # Pure-bash fallback (handles flat JSON only; jq strongly recommended)
          CLIENT_ID="$(grep -o '"client_id"[^,]*' "$NEW_FILE" | head -1 | cut -d'"' -f4)"
          CLIENT_SECRET="$(grep -o '"client_secret"[^,]*' "$NEW_FILE" | head -1 | cut -d'"' -f4)"
        fi
        break
      fi
    done
  fi

  # Fall back to manual paste
  if [[ -z "$CLIENT_ID" || -z "$CLIENT_SECRET" ]]; then
    echo
    read -r -p "  Paste Client ID:     " CLIENT_ID
    read -r -s -p "  Paste Client Secret: " CLIENT_SECRET; echo
  fi
fi

[[ -n "$CLIENT_ID" && -n "$CLIENT_SECRET" ]] \
  || die "Did not receive both Client ID and Client Secret."

# Light sanity check
[[ "$CLIENT_ID" == *.apps.googleusercontent.com ]] \
  || yellow "  ⚠ Client ID does not end in .apps.googleusercontent.com — double-check it."

# ---------- Step 5: locate the .env file ----------
bold "[5/6] Locating .env file"
find_env_file() {
  if [[ -n "$ENV_FILE" ]]; then
    [[ -f "$ENV_FILE" ]] && { echo "$ENV_FILE"; return 0; }
    return 1
  fi
  local d
  d="$(pwd)"
  while [[ "$d" != "/" ]]; do
    if [[ -f "$d/.env" ]]; then echo "$d/.env"; return 0; fi
    d="$(dirname "$d")"
  done
  return 1
}
ENV_PATH="$(find_env_file)" \
  || die "Could not find a .env file. Pass --env-file <path>."
green "  ✓ Found: $ENV_PATH"

# ---------- Step 6: backup + rewrite ----------
bold "[6/6] Updating .env"
TS="$(date +%Y%m%d-%H%M%S)"
cp -p "$ENV_PATH" "${ENV_PATH}.bak.${TS}"
green "  ✓ Backup written: ${ENV_PATH}.bak.${TS}"

# Use a Python-free, sed-portable approach. Each rule:
#   - Matches an *optionally* commented line for the key
#   - Replaces the entire line with the uncommented, real value
#   - Works whether the line is currently commented or already uncommented
update_line() {
  local key="$1" value="$2" file="$3"
  # Escape special chars for sed replacement
  local esc; esc="$(printf '%s' "$value" | sed -e 's/[\/&|]/\\&/g')"
  if grep -qE "^[[:space:]]*#?[[:space:]]*${key}=" "$file"; then
    # Portable in-place edit (works on GNU sed and BSD/macOS sed)
    if sed --version >/dev/null 2>&1; then
      sed -i -E "s|^[[:space:]]*#?[[:space:]]*${key}=.*|${key}=${esc}|" "$file"
    else
      sed -i '' -E "s|^[[:space:]]*#?[[:space:]]*${key}=.*|${key}=${esc}|" "$file"
    fi
  else
    # Key not present at all — append
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

update_line "GOOGLE_CLIENT_ID"     "$CLIENT_ID"     "$ENV_PATH"
update_line "GOOGLE_CLIENT_SECRET" "$CLIENT_SECRET" "$ENV_PATH"
update_line "GOOGLE_CALLBACK_URL"  "$CALLBACK_URL"  "$ENV_PATH"

green "  ✓ Updated GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL"
echo
bold "Done."
echo "  Project:      $PROJECT"
echo "  Client ID:    $CLIENT_ID"
echo "  Callback URL: $CALLBACK_URL"
echo "  .env file:    $ENV_PATH (backup: ${ENV_PATH}.bak.${TS})"
echo
yellow "Next steps:"
echo "  1. If you used DOWNLOAD JSON, securely delete it:"
echo "       shred -u ~/Downloads/client_secret_*.json   (Linux)"
echo "       rm -P ~/Downloads/client_secret_*.json      (macOS)"
echo "  2. Store the secret in Secret Manager for production:"
echo "       gcloud secrets create google-oauth-client-secret --data-file=- <<< \"\$GOOGLE_CLIENT_SECRET\""
echo "  3. If your consent screen User Type is 'External' and Publishing status is 'Testing',"
echo "     refresh tokens expire in 7 days. Submit for verification before going live."
