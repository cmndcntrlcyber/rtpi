#!/usr/bin/env bash
# Deploy qwen14b-code-trainer-v6 under vLLM (Tier C: high-throughput GPU).
# OpenAI-compatible endpoint with continuous batching — deployment-plan.md §3.1/§3.3.
#
# vLLM serves the merged FP16/HF weights (not GGUF). For the GGUF, use Ollama
# (deploy_ollama.sh). Point VLLM_MODEL at the merged HF repo or a local path.
#
# Usage:
#   ./deploy_vllm.sh                                  # docker run
#   VLLM_MODEL=cmndcntrlcyber/qwen14b-code-trainer-v6 ./deploy_vllm.sh
set -euo pipefail

VLLM_MODEL="${VLLM_MODEL:-cmndcntrlcyber/qwen14b-code-trainer-v6}"
PORT="${PORT:-18000}"            # host port -> container 8000 (localhost only)
MAX_LEN="${MAX_LEN:-8192}"
IMAGE="${IMAGE:-vllm/vllm-openai:latest}"
CONTAINER="${CONTAINER:-rtpi-vllm-coder}"

log() { printf '\033[1;34m[vllm]\033[0m %s\n' "$*"; }

command -v docker >/dev/null 2>&1 || { echo "docker required" >&2; exit 1; }

log "Starting vLLM for ${VLLM_MODEL} on 127.0.0.1:${PORT} ..."
docker run -d --rm \
  --name "$CONTAINER" \
  --gpus all \
  -p "127.0.0.1:${PORT}:8000" \
  -v "${HF_HOME:-$HOME/.cache/huggingface}:/root/.cache/huggingface" \
  ${HF_TOKEN:+-e HF_TOKEN="$HF_TOKEN"} \
  "$IMAGE" \
  --model "$VLLM_MODEL" \
  --port 8000 \
  --tensor-parallel-size "${TP_SIZE:-1}" \
  --max-model-len "$MAX_LEN" \
  --enable-auto-tool-choice \
  --tool-call-parser hermes

log "Waiting for health ..."
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    log "vLLM healthy at http://127.0.0.1:${PORT}/v1"
    log "Set VLLM_BASE_URL=http://127.0.0.1:${PORT} and RTPI_INFERENCE_PROVIDER=vllm"
    exit 0
  fi
  sleep 5
done

echo "vLLM did not become healthy in time; check 'docker logs ${CONTAINER}'" >&2
exit 3
