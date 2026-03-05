#!/bin/bash
# verify-pd-tools.sh — Verify and repair ProjectDiscovery tools on container startup
# Called from mcp-entrypoint.sh to handle stale Docker volume mounts.
# If tools are missing from /opt/tools/bin/, re-installs them.

TOOLS_BIN="/opt/tools/bin"
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  PD_ARCH="arm64"
else
  PD_ARCH="amd64"
fi

# Core PD tools that must be present
REQUIRED_PD_TOOLS="nuclei naabu httpx katana subfinder dnsx shuffledns uncover cloudlist alterx mapcidr tlsx cdncheck asnmap proxify interactsh-client notify cvemap pdtm"
REQUIRED_OTHER="ffuf gobuster feroxbuster anew meg qsreplace unfurl x8"

MISSING=""
for tool in $REQUIRED_PD_TOOLS $REQUIRED_OTHER; do
  if [ ! -x "$TOOLS_BIN/$tool" ]; then
    MISSING="$MISSING $tool"
  fi
done

if [ -z "$MISSING" ]; then
  echo "[verify-pd-tools] All tools present"
  exit 0
fi

echo "[verify-pd-tools] Missing tools:$MISSING"
echo "[verify-pd-tools] Attempting repair..."

REPAIRED=0
for tool in $MISSING; do
  # Skip non-PD tools (they need cargo/go and take too long for startup)
  case "$tool" in
    feroxbuster|x8) continue ;;
  esac

  # Try downloading pre-built PD binary
  REPO="projectdiscovery/$tool"
  CMD_NAME="$tool"
  case "$tool" in
    interactsh-client) REPO="projectdiscovery/interactsh"; CMD_NAME="interactsh-client" ;;
    puredns) REPO="d3mondev/puredns" ;;
    amass) REPO="owasp-amass/amass" ;;
    ffuf) REPO="ffuf/ffuf" ;;
    gobuster) REPO="OJ/gobuster" ;;
    anew) REPO="tomnomnom/anew" ;;
    meg) REPO="tomnomnom/meg" ;;
    qsreplace) REPO="tomnomnom/qsreplace" ;;
    unfurl) REPO="tomnomnom/unfurl" ;;
  esac

  VERSION=$(curl -sf --max-time 10 "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4 | sed 's/^v//' 2>/dev/null) || true

  if [ -n "$VERSION" ]; then
    URL="https://github.com/${REPO}/releases/download/v${VERSION}/${CMD_NAME}_${VERSION}_linux_${PD_ARCH}.zip"
    TMP="/tmp/pd-verify-${CMD_NAME}"
    rm -rf "$TMP" && mkdir -p "$TMP"

    if curl -sfL --max-time 60 "$URL" -o "$TMP/${CMD_NAME}.zip" 2>/dev/null && \
       unzip -o "$TMP/${CMD_NAME}.zip" -d "$TMP" >/dev/null 2>&1 && \
       [ -f "$TMP/$CMD_NAME" ]; then
      mv "$TMP/$CMD_NAME" "$TOOLS_BIN/$CMD_NAME"
      chmod +x "$TOOLS_BIN/$CMD_NAME"
      REPAIRED=$((REPAIRED + 1))
      echo "[verify-pd-tools] Repaired: $CMD_NAME v$VERSION"
    fi
    rm -rf "$TMP"
  fi
done

echo "[verify-pd-tools] Repaired $REPAIRED tools"
