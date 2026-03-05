#!/usr/bin/env bash
# Bootstrap Claude Code global settings on a new host.
# Run once after installing Claude Code: ./scripts/claude-setup.sh
#
# Safe to re-run — merges with existing settings, never overwrites.
set -euo pipefail

CLAUDE_DIR="$HOME/.claude"
SETTINGS="$CLAUDE_DIR/settings.json"

mkdir -p "$CLAUDE_DIR"

# --- Global settings ---
# If settings.json exists, merge our keys in (preserving user additions).
# If it doesn't exist, create it from scratch.
if command -v jq &>/dev/null; then
  # jq available — proper JSON merge
  DESIRED=$(cat <<'JSON'
{
  "model": "sonnet",
  "permissions": {
    "allow": [
      "Bash(grep:*)",
      "Bash(test:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(wc:*)",
      "Bash(diff:*)",
      "Bash(sort:*)",
      "Bash(which:*)"
    ]
  }
}
JSON
  )

  if [ -f "$SETTINGS" ]; then
    # Deep merge: existing settings take precedence for scalar values,
    # arrays are unioned (deduplicated).
    EXISTING=$(cat "$SETTINGS")
    MERGED=$(echo "$EXISTING" "$DESIRED" | jq -s '
      def union_arrays: [.[]] | unique;
      .[0] as $existing | .[1] as $desired |
      ($desired * $existing) |
      .permissions.allow = ([$existing.permissions.allow // [], $desired.permissions.allow // []] | flatten | unique)
    ')
    echo "$MERGED" > "$SETTINGS"
    echo "[ok] Merged settings into $SETTINGS"
  else
    echo "$DESIRED" > "$SETTINGS"
    echo "[ok] Created $SETTINGS"
  fi
else
  # No jq — write only if file is missing or effectively empty
  if [ ! -f "$SETTINGS" ] || [ "$(wc -c < "$SETTINGS")" -lt 10 ]; then
    cat > "$SETTINGS" <<'JSON'
{
  "model": "sonnet",
  "permissions": {
    "allow": [
      "Bash(grep:*)",
      "Bash(test:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(wc:*)",
      "Bash(diff:*)",
      "Bash(sort:*)",
      "Bash(which:*)"
    ]
  }
}
JSON
    echo "[ok] Created $SETTINGS"
  else
    echo "[skip] $SETTINGS already exists and jq is not installed for safe merge."
    echo "       Install jq (apt install jq / brew install jq) and re-run, or edit manually."
  fi
fi

# --- Verify project-level config ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

MISSING=0
for f in ".claudeignore" "CLAUDE.md" ".claude/settings.local.json" \
         ".claude/rules/rust.md" ".claude/rules/docker.md" \
         ".claude/rules/proto.md" ".claude/rules/detection.md" \
         ".claude/skills/architecture/SKILL.md" ".claude/skills/stack/SKILL.md" \
         ".claude/skills/roadmap/SKILL.md" ".claude/skills/cross-compile/SKILL.md"; do
  if [ ! -f "$PROJECT_DIR/$f" ]; then
    echo "[warn] Missing project file: $f"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -eq 0 ]; then
  echo "[ok] All project-level Claude Code config files present."
else
  echo "[warn] $MISSING project files missing — did you pull the latest from git?"
fi

echo ""
echo "Done. Start a new Claude Code session to pick up changes."
echo "Verify with: /cost (token usage) and /model (should show sonnet)"
