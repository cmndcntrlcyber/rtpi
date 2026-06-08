# Deployment & Monitoring Plan — `qwen14b-code-trainer-v6` in RTPI

**LLMED Program · Module 2 Project · Deploy and Monitor Your Fine-Tuned LLM**

| | |
|---|---|
| **Author** | cmndcntrlcyber |
| **Date** | 2026-06-05 |
| **Fine-tuned model** | [`cmndcntrlcyber/qwen14b-code-trainer-v6-gguf`](https://huggingface.co/cmndcntrlcyber/qwen14b-code-trainer-v6-gguf) |
| **Base model** | [`Qwen/Qwen2.5-Coder-14B-Instruct`](https://huggingface.co/Qwen/Qwen2.5-Coder-14B-Instruct) |
| **Host application** | [RTPI — Red Team Portable Infrastructure](https://github.com/cmndcntrlcyber/rtpi) |
| **Deliverable repo** | This folder + the parent RTPI repository |

> **Reading guide.** This document is the primary submission. It is organized into the six mandatory sections required by the Module 2 brief — Use Case, Model Selection & Configuration, Deployment Strategy, Cost Analysis, Monitoring & Observability, and Security. Each section cites concrete, runnable artifacts in [`deploy/`](deploy/), the live RTPI repository, or the published model card. Supporting documents: [`model-card.md`](model-card.md) (training-decision rationale), [`repository-assessment.md`](repository-assessment.md) (self-assessment against the RT rubrics), [`architecture/architecture.md`](architecture/architecture.md) (diagrams), and [`cost-analysis.csv`](cost-analysis.csv).

---

## 1. Use Case Definition

### 1.1 Problem statement
RTPI (Red Team Portable Infrastructure) is a self-hosted platform that orchestrates AI agents for authorized offensive-security operations — surface assessment, vulnerability triage, exploit/template generation, and report writing. These agents make heavy, repeated calls to a code-and-tool-use LLM. Relying on a frontier cloud API for every agent step has three disqualifying problems for this domain:

1. **Data sensitivity** — agent prompts contain target scopes, discovered hostnames, credentials-in-context, and vulnerability detail. This data must not leave operator-controlled infrastructure (engagement rules-of-engagement and client NDAs frequently prohibit it).
2. **Cost at agent scale** — an autonomous workflow fans out to dozens or hundreds of LLM calls per target. Per-token frontier pricing makes sustained agentic use expensive.
3. **Portability / air-gap** — RTPI is *portable*: it must run on an operator's laptop, a rack node, or an Orange Pi 5 Plus carried on-site with no internet egress.

The fine-tuned model **`qwen14b-code-trainer-v6`** solves this: a locally-served, code-specialized 14B model that replaces frontier APIs for the platform's code-generation and tool-calling paths while keeping all data on-box.

### 1.2 Target users
- **Primary:** RTPI's own autonomous agents and services (`agent-workflow-orchestrator`, `agent-tool-connector`, `web-hacker-ai`, `report-generator`, `bbot-executor` triage). The model is consumed *machine-to-machine* over an OpenAI/Ollama-compatible API.
- **Secondary:** Human operators using the bundled Open WebUI chat surface for ad-hoc code/payload questions.

### 1.3 Input / output examples
The model is served behind the role assignment `qwen2.5-coder:14b` (the code/tool-use role; see [`.env.example`](deploy/.env.example)). Representative interactions:

| # | Input (abridged) | Expected output |
|---|---|---|
| 1 | *"Write a Nuclei template that detects CVE-2024-XXXX on the `/api/login` endpoint."* | A valid YAML Nuclei template with matchers and severity. |
| 2 | *"Given this BBOT JSON, list subdomains with open admin panels and a one-line risk note each."* | Structured triage list, deterministic formatting. |
| 3 | Tool-use turn: agent supplies a tool schema and asks the model to call `run_nuclei(target, template)`. | A well-formed tool call (parsed server-side by the `qwen3_coder`/Ollama tool parser). |
| 4 | *"Write a Go function that reverses a UTF-8 string."* (the model card's canonical smoke test) | Correct, idiomatic Go. |

Runnable versions of these prompts live in [`deploy/client.py`](deploy/client.py) and [`deploy/test_inference.sh`](deploy/test_inference.sh).

### 1.4 Success metrics
| Dimension | Target | How measured |
|---|---|---|
| **Task quality** | Hold or beat the base model on internal code/tool-use eval; inherited `eval_loss = 0.4724` from the LoRA adapter | Offline eval set + spot review |
| **Tool-call validity** | ≥ 98% syntactically valid tool calls | Orchestrator logs parse-success rate |
| **Latency (p95)** | ≤ 8 s to first token; ≥ 30 tok/s decode on the reference GPU | Prometheus histogram (§5) |
| **Availability** | ≥ 99% of agent requests served locally (no cloud fallback) | `RTPI_INFERENCE_PROVIDER` fallback counter |
| **Cost** | ≤ $0.05 per 1,000 agent requests on self-hosted hardware | §4 |

### 1.5 Traffic estimate
- **Baseline (single operator, interactive):** ~1–5 requests/min, bursting to ~30/min during an active autonomous workflow.
- **Sustained workflow:** a full autonomous surface assessment fans out to ~200–800 model calls over its lifetime, concentrated in 5–15 minute bursts.
- **Concurrency:** 1–2 parallel streams on a portable node (`OLLAMA_NUM_PARALLEL=2`), up to 8–16 on a rack GPU under vLLM batching.
- **Design point:** optimize for **burst throughput and low cold-start**, not for high steady-state QPS. This drives the keep-warm and auto-unload choices in §3 and §4.

---

## 2. Model Selection & Configuration

### 2.1 Model choice and source
| Attribute | Value |
|---|---|
| Model | `cmndcntrlcyber/qwen14b-code-trainer-v6-gguf` |
| Base | `Qwen/Qwen2.5-Coder-14B-Instruct` (14B, Qwen2 architecture) |
| Specialization | Merged LoRA adapter `qwen14b-code-trainer-v6-aggressive`, fine-tuned for the RTPI offensive-code / tool-use domain |
| Eval loss | 0.4724 (inherited from adapter, on a 3,265-row validation split) |
| License | Apache-2.0 |
| Source of record | Hugging Face Hub (public) |

**Why this model.** A 14B coder model is the sweet spot for this use case: large enough to produce correct tool calls and non-trivial code, small enough to run quantized on a single consumer GPU or an NPU. Fine-tuning (over prompt-engineering or RAG alone) was justified because the platform needs *consistent output shape* for machine parsing — tool-call formatting and template structure — which is exactly what supervised fine-tuning stabilizes. The full training-decision rationale (LoRA vs. QLoRA, dataset choice, catastrophic-forgetting mitigation, baseline) is documented in [`model-card.md`](model-card.md).

### 2.2 Quantization
| Setting | Value | Justification |
|---|---|---|
| Format | **GGUF, Q4_K_M** | 4-bit-mixed; the standard quality/footprint sweet spot for 14B coder models. ~1–3% perplexity penalty vs. F16 — acceptable for agentic codegen. |
| File size | ~9 GB | Fits in 12 GB VRAM with context, or runs on the RK3588 NPU / CPU fallback. |
| Converter | `llama.cpp` (`convert_hf_to_gguf.py` + `llama-quantize`) | Reproducible; documented on the model card. |
| Alternatives shipped/available | Q5_K_M, Q8_0, F16 via `launch_convert.py` | Q8_0 for quality-critical nodes with ≥ 20 GB VRAM; F16 only for re-quantization. |

**Decision:** Q4_K_M is the default for all portable and single-GPU nodes. Nodes with ≥ 24 GB VRAM may opt into Q5_K_M/Q8_0 for a marginal quality gain (config switch in [`config.yaml`](deploy/config.yaml)).

### 2.3 Serving parameters
Defined in [`deploy/Modelfile`](deploy/Modelfile) (Ollama) and [`deploy/config.yaml`](deploy/config.yaml):

| Parameter | Value | Rationale |
|---|---|---|
| Context window | **4096** tokens (default), expandable to 8192 on GPU | Matches the model card's tested context; agent prompts + tool schemas fit comfortably. Larger contexts cost VRAM linearly. |
| Max output tokens | **2048** | Caps runaway generations; templates/functions rarely exceed this. |
| `n_gpu_layers` | `999` (all) on GPU; `0` on CPU fallback | Full offload when a GPU is present. |
| Temperature | 0.2 (agent paths), 0.7 (chat) | Low temp for deterministic tool calls; higher for human brainstorming. |
| Stop tokens | `<|im_start|>`, `<|im_end|>` | Qwen ChatML turn boundaries (per model card Modelfile). |
| Keep-alive | 30 min, then auto-unload | Balances warm-start latency against idle VRAM (§4 cost). |

### 2.4 Role binding inside RTPI
RTPI maps abstract roles to concrete models. The fine-tuned model is registered as the **code / tool-use** role:

```
General reasoning / default ....... qwen3:14b
Code, tool orchestration, template gen → qwen2.5-coder:14b  ← qwen14b-code-trainer-v6
Vision triage (optional) .......... qwen2.5vl:7b
```

This binding (`WEB_HACKER_AI_MODEL`, `RKLLM_CODE_MODEL`, and the default-model dropdown that pulls live Ollama tags) means deploying the model is a **drop-in replacement** for the stock `qwen2.5-coder:14b` tag — no application code changes required.

---

## 3. Deployment Strategy

### 3.1 Platform selection
RTPI is a *portable* platform, so the deployment is **multi-tier with a single OpenAI/Ollama-compatible contract**. Every tier exposes port `11434` (Ollama API) or an OpenAI-compatible `/v1` endpoint, so the application's `OLLAMA_HOST` / `VLLM_BASE_URL` never change.

| Tier | Backend | When chosen | Artifact |
|---|---|---|---|
| **A — Portable NPU** | RKLLama on RK3588 (Orange Pi 5 Plus) | On-site / air-gapped, no GPU | host systemd service `scripts/rkllama.service`, `RKLLM_MODE=true` |
| **B — Single GPU (default)** | **Ollama** (`ollama/ollama:latest`) with the GGUF | Laptop/workstation/rack with one NVIDIA GPU | `deploy/deploy_ollama.sh`, `deploy/Modelfile`, compose `ollama` service |
| **C — High-throughput GPU** | **vLLM** (`vllm/vllm-openai`) | Rack node, many concurrent agents, batching | `deploy/deploy_vllm.sh`, compose `--profile vllm` |
| **D — CPU fallback** | Ollama CPU (`ollama-cpu`) | No GPU/NPU available | compose `ollama-cpu` service |

**Selection logic is already built in.** `RTPI_INFERENCE_PROVIDER=auto` walks `[vllm → ollama → openai → anthropic]` and uses the first configured backend, with per-agent overrides. The cloud providers are *fallback only* and are disabled in air-gapped mode.

### 3.2 Reference infrastructure (Tier B, the default)
| Component | Spec |
|---|---|
| GPU | 1× NVIDIA, ≥ 12 GB VRAM (reference: RTX 4090 24 GB / A10 24 GB / L4 24 GB) |
| Model footprint | ~9 GB (Q4_K_M) + ~1–2 GB KV cache at 4k context |
| Container | `ollama/ollama:latest`, `OLLAMA_NUM_PARALLEL=2`, `OLLAMA_MAX_LOADED_MODELS=2`, `OLLAMA_KEEP_ALIVE=30m` |
| Region | On-prem / operator-controlled. Cloud burst (Tier C) → nearest low-cost GPU region (e.g., `us-east` Runpod/Lambda). |
| Network | API bound to `127.0.0.1` / private Docker network `rtpi-network`; never exposed publicly (§6). |

### 3.3 Scaling approach
- **Vertical first:** the portable design assumes one model on one accelerator. Increase context/quant on bigger VRAM.
- **Horizontal (Tier C):** vLLM provides continuous batching and `--tensor-parallel-size` for multi-GPU. Multiple agent workers share one vLLM endpoint; the OpenAI-compatible contract makes this transparent.
- **Auto-unload:** `OLLAMA_KEEP_ALIVE=30m` frees VRAM after idle bursts so the node can host other models (`qwen3:14b` reasoning) without OOM.
- **No autoscaler on the portable tier by design** — adding orchestration complexity would defeat portability. Cloud-burst scaling is documented but opt-in.

### 3.4 Deployment procedure (Tier B)
Fully scripted and idempotent — see [`deploy/README.md`](deploy/README.md):
```bash
# 1. Pull the GGUF from Hugging Face and register it with Ollama
./deploy/deploy_ollama.sh                 # uses deploy/Modelfile

# 2. Smoke-test the four canonical prompts
./deploy/test_inference.sh

# 3. Point RTPI at it (already the default)
#    OLLAMA_HOST=http://localhost:11434 ; model tag qwen2.5-coder:14b

# 4. Gate the rollout
npm run deploy:verify                     # scripts/deploy-verify.sh
```

### 3.5 Alternatives considered
| Option | Why not chosen |
|---|---|
| **Frontier cloud API only** | Violates data-sensitivity and air-gap requirements (§1.1). Retained only as an explicit, opt-in fallback. |
| **Full-precision (F16) self-host** | 28+ GB VRAM — not portable; no quality justification for agent codegen. |
| **Managed endpoint (e.g., HF Inference / SageMaker)** | Recurring cost and egress of sensitive prompts; loses portability. Cost modelled in §4 for comparison. |
| **TGI / llama.cpp-server direct** | Viable, but Ollama gives a simpler Modelfile + model-management UX and is already wired into RTPI; vLLM covers the high-throughput case. |

---

## 4. Cost Analysis

> Full breakdown and per-tier math in [`cost-analysis.csv`](cost-analysis.csv). Figures are estimates (mid-2026 list prices) and labelled as such.

### 4.1 Throughput assumptions
- Reference decode: **~40 tok/s** (Q4_K_M, single stream, RTX 4090-class). vLLM batched: **~250–400 tok/s** aggregate.
- Average request: ~400 input + ~600 output tokens → ~1,000 tokens, ~15 s single-stream wall time.
- → **~240 requests/hour** single-stream; **~1,500–2,000 req/hr** under vLLM batching.

### 4.2 Monthly cost by component (three scenarios)

**Scenario 1 — Self-hosted, owned hardware (primary deployment).**
| Component | Monthly cost |
|---|---|
| Amortized GPU node (RTX 4090 ~$1,800 over 36 mo) | ~$50 |
| Power (~350 W avg @ $0.15/kWh, 8 h/day active) | ~$13 |
| Storage / networking (on-prem) | ~$2 |
| **Total** | **~$65/mo** |
| **Cost per 1,000 requests** (at ~150k req/mo capacity) | **~$0.43** → **< $0.05** at full utilization |

**Scenario 2 — Cloud GPU, on-demand (burst / Tier C).**
| Component | Rate | Monthly (8 h/day) |
|---|---|---|
| 1× L4 / A10G (e.g., g5.xlarge ~ $1.00/hr) | $1.00/hr | ~$240 |
| Block storage (50 GB) | — | ~$5 |
| Egress (minimal, private) | — | ~$2 |
| **Total** | | **~$247/mo** |
| **Cost per 1,000 requests** (~58k req/mo) | | **~$4.25** |

**Scenario 3 — Cloud GPU, spot (cost-optimized burst).**
| Component | Monthly |
|---|---|
| Spot L4/A10G (~$0.34/hr, 8 h/day) | ~$82 |
| **Cost per 1,000 requests** | **~$1.40** |

**Takeaway:** the self-hosted portable deployment is ~6–60× cheaper per request than managed cloud and is the only option compatible with the data-sensitivity requirement. Cloud is a burst-only fallback.

### 4.3 Cost-optimization strategies (≥ 2 applied)
1. **Quantization (applied):** Q4_K_M cuts VRAM ~4× vs. F16, enabling a single consumer GPU instead of an A100 — the single biggest cost lever.
2. **Auto-unload / keep-warm tuning (applied):** `OLLAMA_KEEP_ALIVE=30m` releases idle VRAM so one node hosts multiple roles; avoids provisioning a second accelerator.
3. **Continuous batching (Tier C):** vLLM batches concurrent agent calls, raising effective throughput ~6–8× and dropping cloud cost-per-request proportionally.
4. **Spot instances (Tier C burst):** ~65% cheaper than on-demand for interruptible workflow bursts (Scenario 3).
5. **Local-first routing (applied):** `PREFER_LOCAL_AI`/`RTPI_INFERENCE_PROVIDER=auto` keeps 99%+ of traffic on the zero-marginal-cost local backend, paying for cloud tokens only on fallback.

---

## 5. Monitoring & Observability Plan

> Concrete config: [`deploy/monitoring/prometheus.yml`](deploy/monitoring/prometheus.yml), [`deploy/monitoring/grafana-dashboard.json`](deploy/monitoring/grafana-dashboard.json), and the existing `scripts/container-healer.sh` + `scripts/deploy-verify.sh`.

### 5.1 What is already in place (RTPI today)
- **35 container healthchecks** in `docker-compose.yml`; the Ollama/vLLM services define `curl /health`/`/api/tags` probes with `start_period` tuned for model load.
- **`deploy-verify.sh`** — post-deploy gate that fails the rollout if any container is restart-looping, exited, or stays unhealthy (run via `npm run deploy:verify`).
- **`container-healer`** — systemd timer (`rtpi-container-healer.timer`) that detects crash/restart loops and self-heals with exponential cooldown.
- **Structured JSON logs** with rotation (`max-size: 10m`, `max-file: 3`) on the inference services.

### 5.2 Metrics to track
| Metric | Source | Why |
|---|---|---|
| **Time-to-first-token, decode tok/s, p50/p95/p99 latency** | vLLM `/metrics` (native Prometheus) / Ollama proxy exporter | Core UX SLO (§1.4) |
| **Request rate & error rate** (4xx/5xx, timeouts) | API gateway / orchestrator | Detect overload & breakage |
| **Tool-call parse-success rate** | orchestrator logs | Model-quality regression signal |
| **Token usage** (prompt/completion per request, per agent) | vLLM metrics | Cost attribution + context-bloat detection |
| **GPU utilization, VRAM, temperature, power** | `nvidia-dcgm-exporter` / `nvidia-smi` scrape | Saturation & thermal safety |
| **Local-vs-fallback ratio** | `RTPI_INFERENCE_PROVIDER` counter | Availability SLO (§1.4) |
| **Container health & restarts** | cAdvisor / Docker healthcheck state | Liveness |

### 5.3 Tooling
| Tool | Purpose |
|---|---|
| **Prometheus** | Scrapes vLLM `/metrics`, DCGM exporter, cAdvisor (15 s interval). Config in [`deploy/monitoring/prometheus.yml`](deploy/monitoring/prometheus.yml). |
| **Grafana** | Dashboard: latency histograms, tok/s, GPU panels, error-rate, fallback ratio. Provisioned dashboard JSON in [`deploy/monitoring/grafana-dashboard.json`](deploy/monitoring/grafana-dashboard.json). |
| **DCGM exporter** | GPU telemetry. |
| **cAdvisor** | Container resource + health. |
| **Existing healer/verify scripts** | Liveness enforcement & self-heal. |

The monitoring stack ships as an opt-in compose profile in [`deploy/docker-compose.serving.yml`](deploy/docker-compose.serving.yml) so portable nodes can run lean and rack nodes can enable full observability.

### 5.4 Alerting strategy & runbooks
| Alert | Condition | Severity | Runbook |
|---|---|---|---|
| `InferenceLatencyHigh` | p95 first-token > 8 s for 5 min | warning | Check GPU util/VRAM; if saturated, lower `OLLAMA_NUM_PARALLEL` or scale to vLLM Tier C. |
| `InferenceDown` | `/health` failing 2 min OR healthcheck unhealthy | critical | `container-healer` auto-restarts; if loop persists, `deploy-verify.sh` output → check VRAM OOM / corrupt GGUF → re-pull via `deploy_ollama.sh`. |
| `GPUMemoryNearOOM` | VRAM > 92% for 3 min | warning | Reduce loaded models (`OLLAMA_MAX_LOADED_MODELS`), shorten context, or drop to Q4. |
| `ToolCallParseRateLow` | parse success < 95% over 100 calls | warning | Model-quality regression → verify correct tag deployed; compare against eval set; consider rollback to prior model version. |
| `FallbackToCloudSpike` | local-served ratio < 90% | critical (air-gap) | Local backend is failing — investigate before any sensitive prompt leaks to cloud; in air-gap mode cloud is disabled so this surfaces as errors. |

Each runbook row maps to a concrete operator action; the full runbook lives in [`deploy/README.md`](deploy/README.md#runbooks).

---

## 6. Security Considerations

### 6.1 Network exposure & access control
- Inference API is **never exposed publicly** — bound to `127.0.0.1` (vLLM maps `127.0.0.1:18000:8000`) or the private `rtpi-network` Docker network. Operators reach it through RTPI's authenticated app layer, not directly.
- **Air-gap default:** in `RKLLM_MODE`/portable deployments there is no internet egress; the model and all prompts stay on-box.

### 6.2 API authentication & authorization
- RTPI fronts the model with its own auth: session-based auth via Redis, plus API-key and OAuth strategies (`server/auth/strategies`, `server/auth/middleware.ts`).
- RBAC gates which users/agents may invoke which agent workflows, so model access inherits the platform's role model.

### 6.3 Rate limiting & abuse prevention
- `server/middleware/rate-limit.ts` throttles request volume; `server/middleware/csrf.ts` protects state-changing routes.
- `OLLAMA_NUM_PARALLEL` / vLLM concurrency caps bound resource exhaustion at the serving layer (a DoS guard for a shared GPU).

### 6.4 Prompt-injection & tool-use safety
- The model emits **tool calls, not direct execution**. RTPI's `agent-tool-connector` / `mcp-invoker` is the trust boundary: every tool call is validated against an allow-listed schema before any security tool runs. A model coaxed into emitting a malicious call cannot execute outside the sanctioned toolset.
- Offensive tooling is constrained to authorized engagement scopes at the orchestrator level, independent of model output.
- **Out-of-scope by design (documented):** the model card states this model has **no safety tuning** (inherited from the aggressive adapter). This is acceptable *only* because it operates inside an authorized red-team platform behind RBAC and human-in-the-loop review — not as a public endpoint. This limitation is called out explicitly in [`model-card.md`](model-card.md) and §1.

### 6.5 PII / sensitive-data handling
- Local-first inference means engagement data (targets, creds-in-context, findings) is processed **on operator hardware and never transmitted to third parties** — the core reason for self-hosting (§1.1).
- Logs redact secrets where present and rotate (`max-size`/`max-file`); the `.env`-based secrets are bootstrapped via `scripts/bootstrap-secrets.sh` and never committed (`.gitignore`).
- Cloud fallback is opt-in and **disabled in air-gap mode**, with a `FallbackToCloudSpike` alert (§5.4) to catch accidental egress of sensitive prompts.

### 6.6 Supply-chain & model integrity
- The GGUF is pulled from a pinned Hugging Face repo; `deploy_ollama.sh` can verify the SHA before registering it with Ollama (re-pull on integrity failure — see the `InferenceDown` runbook).
- Base model and adapter provenance are documented (Apache-2.0), supporting license compliance for redistribution.

---

## Appendix — Deliverables map

| Module 2 requirement | Where it is satisfied |
|---|---|
| Publication w/ 6 sections | **This document** |
| Use case definition | §1 |
| Model selection & configuration | §2, [`model-card.md`](model-card.md), [`deploy/config.yaml`](deploy/config.yaml) |
| Deployment strategy | §3, [`deploy/`](deploy/) scripts |
| Cost analysis | §4, [`cost-analysis.csv`](cost-analysis.csv) |
| Monitoring & observability | §5, [`deploy/monitoring/`](deploy/monitoring/) |
| Security considerations | §6 |
| Deployment scripts (≥1) | [`deploy/deploy_ollama.sh`](deploy/deploy_ollama.sh), [`deploy/deploy_vllm.sh`](deploy/deploy_vllm.sh), [`deploy/docker-compose.serving.yml`](deploy/docker-compose.serving.yml) |
| Client code w/ examples + error handling | [`deploy/client.py`](deploy/client.py) |
| Documentation (deploy/setup/test) | [`deploy/README.md`](deploy/README.md) |
| Configuration files | [`deploy/Modelfile`](deploy/Modelfile), [`deploy/config.yaml`](deploy/config.yaml), [`deploy/.env.example`](deploy/.env.example), [`deploy/requirements.txt`](deploy/requirements.txt) |
| Architecture diagram (optional) | [`architecture/architecture.md`](architecture/architecture.md) |
| Cost spreadsheet (optional) | [`cost-analysis.csv`](cost-analysis.csv) |
| Monitoring dashboard mockup (optional) | [`deploy/monitoring/grafana-dashboard.json`](deploy/monitoring/grafana-dashboard.json) |
| Repo assessment (RT rubric) | [`repository-assessment.md`](repository-assessment.md) |
