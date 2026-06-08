# Deployment Artifacts — `qwen14b-code-trainer-v6`

Runnable deployment + monitoring code for the Module 2 submission. This satisfies
the "GitHub repository" deliverable: deployment scripts, client code, configuration,
and documentation. See [`../deployment-plan.md`](../deployment-plan.md) for the full plan.

## Contents
| File | Purpose |
|---|---|
| `deploy_ollama.sh` | Pull the GGUF from Hugging Face, verify integrity, register with Ollama (Tier B, default) |
| `deploy_vllm.sh` | Serve under vLLM for high-throughput batching (Tier C) |
| `docker-compose.serving.yml` | Self-contained Ollama + vLLM + Prometheus + Grafana + DCGM stack |
| `Modelfile` | Ollama model definition (template, params, system prompt) |
| `client.py` | Client with 4 example request types, error handling, latency timing |
| `test_inference.sh` | Smoke test / rollout gate |
| `config.yaml` | Serving configuration (single source of truth) |
| `.env.example` | Environment template |
| `requirements.txt` | Pinned client dependencies |
| `monitoring/` | Prometheus scrape config + Grafana dashboard |
| `LICENSE` | Apache-2.0 (matches the model license) |

## Prerequisites
- **Tier B (default):** an NVIDIA GPU with ≥ 12 GB VRAM, Docker (or a host `ollama`), ~10 GB disk for the GGUF.
- **CPU fallback:** works without a GPU (slower); set `n_gpu_layers: 0`.
- Python 3.9+ for `client.py` (stdlib only; `requirements.txt` is optional).

## Quick start (Ollama, Tier B)

```bash
# 0. Configure
cp .env.example .env            # edit if needed

# 1a. Option A — host Ollama already installed
./deploy_ollama.sh              # pulls GGUF, registers tag qwen2.5-coder:14b

# 1b. Option B — containerized
docker compose -f docker-compose.serving.yml up -d ollama
docker exec -it m2-ollama bash -lc 'cd /work && ollama create qwen2.5-coder:14b -f Modelfile'

# 2. Smoke test
./test_inference.sh

# 3. Exercise all example request types
python3 client.py

# 4. (optional) bring up monitoring
docker compose -f docker-compose.serving.yml --profile monitoring up -d
#   Grafana  -> http://localhost:3000  (import monitoring/grafana-dashboard.json)
#   Prometheus -> http://localhost:9090
```

## High-throughput (vLLM, Tier C)

```bash
VLLM_MODEL=cmndcntrlcyber/qwen14b-code-trainer-v6 ./deploy_vllm.sh
# then point the client at it:
BASE_URL=http://localhost:18000/v1 python3 client.py
```

## Wiring into RTPI
The model registers under the tag `qwen2.5-coder:14b`, which is exactly the
code/tool-use role RTPI already expects. No application changes are needed —
RTPI reads `OLLAMA_HOST=http://localhost:11434` (or `VLLM_BASE_URL` with
`RTPI_INFERENCE_PROVIDER=vllm`). See parent repo `.env.example`.

## Testing instructions
- `./test_inference.sh` — fails non-zero if the backend is unreachable or returns an empty completion (usable as a CI/rollout gate).
- `python3 client.py` — runs the four canonical request types and reports pass/fail + latency.
- `python3 client.py --prompt "..."` — ad-hoc single prompt.

## Runbooks
Operator actions for the alerts defined in [`../deployment-plan.md` §5.4](../deployment-plan.md#54-alerting-strategy--runbooks):

### `InferenceLatencyHigh` (p95 first-token > 8 s)
1. Check GPU saturation: `nvidia-smi` or Grafana "GPU Utilization & VRAM" panel.
2. If VRAM/compute saturated under concurrency → lower `OLLAMA_NUM_PARALLEL`, or move to vLLM (Tier C) for batching.
3. If context is large → cap `num_ctx` / `max_output_tokens` in `config.yaml`.

### `InferenceDown` (health failing / unhealthy)
1. `container-healer` (parent repo systemd timer) auto-restarts. Confirm with `docker ps`.
2. If it restart-loops, read `docker logs m2-ollama` (or `m2-vllm`).
3. Common cause = VRAM OOM → reduce `OLLAMA_MAX_LOADED_MODELS` or drop to Q4.
4. Corrupt GGUF → re-pull: `rm *.gguf && ./deploy_ollama.sh` (set `EXPECTED_SHA256` to pin integrity).

### `GPUMemoryNearOOM` (VRAM > 92%)
1. Lower `OLLAMA_MAX_LOADED_MODELS` (don't co-load reasoning + coder).
2. Shorten context window; switch to a smaller quant if needed.

### `ToolCallParseRateLow` (model-quality regression)
1. Confirm the correct model tag/version is deployed (`ollama list`).
2. Re-run the offline eval set; compare to `eval_loss = 0.4724` baseline.
3. If regressed, roll back to the prior model version (re-register previous GGUF).

### `FallbackToCloudSpike` (local-served ratio < 90%)
1. **Treat as security-relevant** — sensitive prompts must not leak to cloud.
2. In air-gap mode (`AIR_GAP_MODE=true`) cloud is disabled, so this surfaces as errors, not egress — fix the local backend first.
3. Investigate the local backend (`InferenceDown` runbook) before re-enabling any cloud fallback.
