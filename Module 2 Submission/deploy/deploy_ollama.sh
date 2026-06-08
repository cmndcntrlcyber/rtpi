#!/usr/bin/env bash
# Deploy qwen14b-code-trainer-v6 to Ollama as the RTPI code/tool-use model.
#
# Tier B (single-GPU, default) deployment from deployment-plan.md §3.4.
# Idempotent: re-running re-verifies and re-registers without duplicating work.
#
# Usage:
#   ./deploy_ollama.sh                 # pull GGUF from HF, register, smoke test
#   MODEL_TAG=qwen2.5-coder:14b ./deploy_ollama.sh
#
# Requires: ollama, and one of {huggingface-cli | curl}. Set HF_TOKEN for private repos.
set -euo pipefail

# ── Config (override via env) ────────────────────────────────────────────────
HF_REPO="${HF_REPO:-cmndcntrlcyber/qwen14b-code-trainer-v6-gguf}"
GGUF_FILE="${GGUF_FILE:-Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf}"
MODEL_TAG="${MODEL_TAG:-qwen2.5-coder:14b}"
WORKDIR="${WORKDIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
EXPECTED_SHA256="${EXPECTED_SHA256:-}"   # optional integrity pin

log() { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }

# ── Preflight ────────────────────────────────────────────────────────────────
command -v ollama >/dev/null 2>&1 || { err "ollama not found. Install: https://ollama.com/download"; exit 1; }

cd "$WORKDIR"
GGUF_PATH="${WORKDIR}/${GGUF_FILE}"

# ── 1. Pull the GGUF from Hugging Face (skip if already present) ──────────────
if [[ -f "$GGUF_PATH" ]]; then
  log "GGUF already present: $GGUF_PATH"
else
  log "Downloading ${HF_REPO}/${GGUF_FILE} ..."
  if command -v huggingface-cli >/dev/null 2>&1; then
    huggingface-cli download "$HF_REPO" "$GGUF_FILE" --local-dir "$WORKDIR" --local-dir-use-symlinks False
  else
    log "huggingface-cli not found; falling back to curl"
    AUTH=(); [[ -n "${HF_TOKEN:-}" ]] && AUTH=(-H "Authorization: Bearer ${HF_TOKEN}")
    curl -fSL "${AUTH[@]}" \
      "https://huggingface.co/${HF_REPO}/resolve/main/${GGUF_FILE}?download=true" \
      -o "$GGUF_PATH"
  fi
fi

# ── 2. Optional integrity verification (supply-chain guard, plan §6.6) ────────
if [[ -n "$EXPECTED_SHA256" ]]; then
  log "Verifying SHA256 ..."
  ACTUAL_SHA256="$(sha256sum "$GGUF_PATH" | awk '{print $1}')"
  if [[ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then
    err "SHA256 mismatch! expected=$EXPECTED_SHA256 actual=$ACTUAL_SHA256"
    err "Refusing to register a model that failed integrity check."
    exit 2
  fi
  log "Integrity OK."
fi

# ── 3. Register with Ollama via the Modelfile ────────────────────────────────
log "Registering model tag '${MODEL_TAG}' with Ollama ..."
ollama create "$MODEL_TAG" -f "${WORKDIR}/Modelfile"

# ── 4. Confirm it loads ──────────────────────────────────────────────────────
log "Verifying model is available ..."
if ollama list | grep -q "${MODEL_TAG%%:*}"; then
  log "SUCCESS: ${MODEL_TAG} is registered."
else
  err "Model not visible in 'ollama list' after create."
  exit 3
fi

log "Next: run ./test_inference.sh to smoke-test, then point RTPI at OLLAMA_HOST."
