#!/usr/bin/env bash
# Smoke test for the deployed model. Verifies the backend is reachable and that
# the model returns a non-empty completion. Exit non-zero on any failure so it
# can gate a rollout (deployment-plan.md §3.4 / §5).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:11434/v1}"
MODEL="${MODEL:-qwen2.5-coder:14b}"
API_KEY="${API_KEY:-ollama}"

log() { printf '\033[1;34m[test]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

# 1. Reachability
log "Checking backend at ${BASE_URL%/v1} ..."
curl -fsS "${BASE_URL%/v1}/v1/models" >/dev/null 2>&1 \
  || curl -fsS "${BASE_URL%/v1}/api/tags" >/dev/null 2>&1 \
  || fail "Backend not reachable. Start it first (deploy_ollama.sh / deploy_vllm.sh)."

# 2. Completion sanity check (the model card's canonical prompt)
log "Sending canonical prompt ..."
RESP="$(curl -fsS "${BASE_URL}/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "$(cat <<JSON
{
  "model": "${MODEL}",
  "messages": [{"role":"user","content":"Write a Go function that reverses a UTF-8 string. Output only code."}],
  "temperature": 0.2,
  "max_tokens": 256,
  "stream": false
}
JSON
)")" || fail "Request failed."

CONTENT="$(printf '%s' "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["choices"][0]["message"]["content"])' 2>/dev/null || true)"
[[ -n "$CONTENT" ]] || fail "Empty completion. Raw: ${RESP:0:300}"

log "Model responded (${#CONTENT} chars):"
printf '%s\n' "$CONTENT" | head -20
log "PASS"
