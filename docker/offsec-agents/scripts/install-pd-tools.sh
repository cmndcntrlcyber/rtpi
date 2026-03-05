#!/bin/bash
# install-pd-tools.sh — Install all ProjectDiscovery tools into the fuzzing agent container
# Run with: docker exec -u root rtpi-fuzzing-agent bash /opt/scripts/install-pd-tools.sh
# Or copy in: docker cp install-pd-tools.sh rtpi-fuzzing-agent:/tmp/ && docker exec -u root rtpi-fuzzing-agent bash /tmp/install-pd-tools.sh
#
# All binaries go to /opt/tools/bin/ which is volume-mounted and persists across restarts.

set -euo pipefail

TOOLS_BIN="/opt/tools/bin"
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  PD_ARCH="arm64"
else
  PD_ARCH="amd64"
fi

mkdir -p "$TOOLS_BIN"

INSTALLED=0
FAILED=0
SKIPPED=0
FAILED_LIST=""

# install_pd_tool <tool_name> [<github_repo>]
# Downloads pre-built binary from GitHub releases. Falls back to go install.
install_pd_tool() {
  local TOOL="$1"
  local REPO="${2:-projectdiscovery/$TOOL}"
  local CMD_NAME="${3:-$TOOL}"

  if [ -x "$TOOLS_BIN/$CMD_NAME" ]; then
    echo "  [SKIP] $CMD_NAME already installed"
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi

  echo "  [INSTALL] $CMD_NAME from $REPO ..."

  # Get latest version from GitHub API
  local VERSION
  VERSION=$(curl -sf "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4 | sed 's/^v//' 2>/dev/null) || true

  if [ -n "$VERSION" ]; then
    # Try downloading pre-built binary
    local URL="https://github.com/${REPO}/releases/download/v${VERSION}/${CMD_NAME}_${VERSION}_linux_${PD_ARCH}.zip"
    local TMP_DIR="/tmp/pd-install-${CMD_NAME}"
    rm -rf "$TMP_DIR"
    mkdir -p "$TMP_DIR"

    if curl -sfL "$URL" -o "$TMP_DIR/${CMD_NAME}.zip" 2>/dev/null; then
      if unzip -o "$TMP_DIR/${CMD_NAME}.zip" -d "$TMP_DIR" >/dev/null 2>&1; then
        if [ -f "$TMP_DIR/$CMD_NAME" ]; then
          mv "$TMP_DIR/$CMD_NAME" "$TOOLS_BIN/$CMD_NAME"
          chmod +x "$TOOLS_BIN/$CMD_NAME"
          rm -rf "$TMP_DIR"
          echo "    -> Installed $CMD_NAME v$VERSION (binary)"
          INSTALLED=$((INSTALLED + 1))
          return 0
        fi
      fi
    fi

    rm -rf "$TMP_DIR"
    echo "    -> Binary download failed, trying go install..."
  fi

  # Fallback: go install
  if command -v go &>/dev/null; then
    local GO_PKG="github.com/${REPO}/cmd/${CMD_NAME}@latest"
    if su - rtpi-agent -c "export PATH=/usr/local/go/bin:/opt/tools/bin:\$PATH && go install ${GO_PKG}" 2>/dev/null; then
      local GO_BIN="/home/rtpi-agent/go/bin/$CMD_NAME"
      if [ -x "$GO_BIN" ]; then
        cp "$GO_BIN" "$TOOLS_BIN/$CMD_NAME"
        chmod +x "$TOOLS_BIN/$CMD_NAME"
        echo "    -> Installed $CMD_NAME (go install)"
        INSTALLED=$((INSTALLED + 1))
        return 0
      fi
    fi
  fi

  echo "    -> FAILED to install $CMD_NAME"
  FAILED=$((FAILED + 1))
  FAILED_LIST="$FAILED_LIST $CMD_NAME"
  return 1
}

# install_go_tool <tool_name> <go_package>
# For non-PD tools that don't have release binaries in the standard PD format
install_go_tool() {
  local CMD_NAME="$1"
  local GO_PKG="$2"

  if [ -x "$TOOLS_BIN/$CMD_NAME" ]; then
    echo "  [SKIP] $CMD_NAME already installed"
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi

  echo "  [INSTALL] $CMD_NAME via go install ..."

  if su - rtpi-agent -c "export PATH=/usr/local/go/bin:/opt/tools/bin:\$PATH && go install ${GO_PKG}" 2>/dev/null; then
    local GO_BIN="/home/rtpi-agent/go/bin/$CMD_NAME"
    if [ -x "$GO_BIN" ]; then
      cp "$GO_BIN" "$TOOLS_BIN/$CMD_NAME"
      chmod +x "$TOOLS_BIN/$CMD_NAME"
      echo "    -> Installed $CMD_NAME (go install)"
      INSTALLED=$((INSTALLED + 1))
      return 0
    fi
  fi

  echo "    -> FAILED to install $CMD_NAME"
  FAILED=$((FAILED + 1))
  FAILED_LIST="$FAILED_LIST $CMD_NAME"
  return 1
}

echo "============================================="
echo "ProjectDiscovery Tools Installer"
echo "Architecture: $ARCH ($PD_ARCH)"
echo "Target: $TOOLS_BIN"
echo "============================================="
echo ""

# ---- ProjectDiscovery Core Tools ----
echo "[Phase 1] ProjectDiscovery Core Tools"

install_pd_tool pdtm
install_pd_tool nuclei
install_pd_tool httpx
install_pd_tool naabu
install_pd_tool subfinder
install_pd_tool katana
install_pd_tool dnsx
install_pd_tool uncover
install_pd_tool cloudlist
install_pd_tool alterx
install_pd_tool shuffledns
install_pd_tool mapcidr
install_pd_tool tlsx
install_pd_tool cdncheck
install_pd_tool asnmap
install_pd_tool proxify
install_pd_tool notify
install_pd_tool cvemap
# interactsh binary name is interactsh-client
install_pd_tool interactsh projectdiscovery/interactsh interactsh-client

echo ""
echo "[Phase 2] Non-PD Go Tools"

install_go_tool puredns "github.com/d3mondev/puredns/v2@latest"
install_go_tool amass "github.com/owasp-amass/amass/v4/...@latest"

# Copy gobuster from go/bin if it exists but isn't in /opt/tools/bin
if [ ! -x "$TOOLS_BIN/gobuster" ] && [ -x "/home/rtpi-agent/go/bin/gobuster" ]; then
  echo "  [FIX] Copying gobuster from go/bin..."
  cp /home/rtpi-agent/go/bin/gobuster "$TOOLS_BIN/gobuster"
  chmod +x "$TOOLS_BIN/gobuster"
  INSTALLED=$((INSTALLED + 1))
fi

# Copy feroxbuster from cargo/bin if it exists but isn't in /opt/tools/bin
if [ ! -x "$TOOLS_BIN/feroxbuster" ] && [ -x "/home/rtpi-agent/.cargo/bin/feroxbuster" ]; then
  echo "  [FIX] Copying feroxbuster from cargo/bin..."
  cp /home/rtpi-agent/.cargo/bin/feroxbuster "$TOOLS_BIN/feroxbuster"
  chmod +x "$TOOLS_BIN/feroxbuster"
  INSTALLED=$((INSTALLED + 1))
fi

echo ""
echo "[Phase 3] Ownership & Cleanup"

# Fix ownership
chown -R rtpi-agent:rtpi-agent "$TOOLS_BIN"

# Clean up Go module cache to save disk space
echo "  Cleaning Go module cache..."
su - rtpi-agent -c "export PATH=/usr/local/go/bin:\$PATH && go clean -modcache 2>/dev/null" || true

echo ""
echo "============================================="
echo "Installation Summary"
echo "  Installed: $INSTALLED"
echo "  Skipped:   $SKIPPED"
echo "  Failed:    $FAILED"
if [ -n "$FAILED_LIST" ]; then
  echo "  Failed tools:$FAILED_LIST"
fi
echo "============================================="
echo ""

# Final verification
echo "[Verification] Checking all tools..."
ALL_TOOLS="nuclei naabu httpx katana subfinder dnsx shuffledns uncover cloudlist alterx mapcidr tlsx cdncheck asnmap proxify interactsh-client notify cvemap pdtm puredns amass ffuf gobuster feroxbuster anew meg qsreplace unfurl x8"
VERIFY_OK=0
VERIFY_FAIL=0
for tool in $ALL_TOOLS; do
  if [ -x "$TOOLS_BIN/$tool" ]; then
    VER=$("$TOOLS_BIN/$tool" -version 2>&1 | head -1 || echo "ok")
    echo "  [OK] $tool: $VER"
    VERIFY_OK=$((VERIFY_OK + 1))
  else
    echo "  [MISSING] $tool"
    VERIFY_FAIL=$((VERIFY_FAIL + 1))
  fi
done
echo ""
echo "Verified: $VERIFY_OK OK, $VERIFY_FAIL missing"

if [ "$VERIFY_FAIL" -gt 0 ]; then
  exit 1
fi
