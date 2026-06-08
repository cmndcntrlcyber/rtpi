# Model Card & Training-Decision Reflections

**Model:** [`cmndcntrlcyber/qwen14b-code-trainer-v6-gguf`](https://huggingface.co/cmndcntrlcyber/qwen14b-code-trainer-v6-gguf)

This document accompanies the [deployment plan](deployment-plan.md). Part 1 is a concise model card. Part 2 answers the **"Explaining Your Training Decisions"** interview questions from the LLMED curriculum, since the deployment plan must rest on defensible training choices.

---

## Part 1 — Model Card

| Field | Value |
|---|---|
| Name | `qwen14b-code-trainer-v6-gguf` |
| Base model | `Qwen/Qwen2.5-Coder-14B-Instruct` (14B, Qwen2 arch) |
| Method | Supervised fine-tuning of a LoRA adapter (`qwen14b-code-trainer-v6-aggressive`), merged into the base, then GGUF-quantized |
| Specialization | Offensive-security code generation + tool-calling for the RTPI platform |
| Quantization | GGUF Q4_K_M (~9 GB); Q5_K_M / Q8_0 / F16 available via `launch_convert.py` |
| Validation | `eval_loss = 0.4724` on a 3,265-row held-out split |
| Context | 4096 tokens |
| License | Apache-2.0 |
| Intended use | Local inference (Ollama, llama.cpp, vLLM, LM Studio) as RTPI's `qwen2.5-coder:14b` role |
| Out of scope | Safety-critical use, non-code tasks, any public-facing endpoint (no safety tuning) |
| Training code | [`code-trainer-offsec-pipeline`](https://github.com/cmndcntrlcyber/code-trainer-offsec-pipeline) |
| Reproduce conversion | `python -m src.phase5_deployment.scripts.launch_convert --config src/config/v6_config.yaml --wait` (~$2 on `a100-large`) |

### Intended-use detail
The model is consumed machine-to-machine by RTPI agents for: Nuclei/template generation, BBOT artifact triage, exploit/code scaffolding, and structured tool calls. It is **not** a chat assistant and is **not** safety-tuned; it is safe to operate only inside an authorized red-team platform behind RBAC and human review (see deployment plan §6).

---

## Part 2 — Explaining the Training Decisions

### Dataset & task selection

**What is original here vs. existing tooling?**
The base model, LoRA/QLoRA machinery, and llama.cpp quantization are existing, well-understood tools. The original contribution is the **domain dataset and the pipeline** (`code-trainer-offsec-pipeline`) that curates offensive-security code/tool-use examples and the integration that makes the result a drop-in role inside RTPI. I do not claim novelty in the architecture — only in the data curation, the eval harness, and the deployment integration.

**Why fine-tune instead of prompt-engineering or RAG?**
The platform needs *consistent output structure* for machine parsing — valid tool-call syntax, valid Nuclei YAML, deterministic triage formatting. Prompt engineering gets close but drifts across turns; RAG helps with *knowledge* recall but not with *output-shape* reliability. Fine-tuning is the right tool when you need the model to reliably produce a *form*, not just recall a fact. (RAG is still used at the application layer for knowledge; the two are complementary.)

**Dataset choice & scaling implications.**
The adapter was trained toward the RTPI offensive-code domain with a 3,265-row validation split. The dataset is intentionally domain-narrow; scaling it further would mean broadening tool/vendor coverage. Bias consideration: an offensive-code dataset can over-fit to specific tool versions and idioms — mitigated by keeping the base model's general coding ability (see catastrophic forgetting below) and by treating the model as a *suggestion engine* behind validation, never as an autonomous executor.

### Baseline & evaluation

**Baseline and metric.** The base `Qwen2.5-Coder-14B-Instruct` is the baseline. The headline metric is held-out `eval_loss` (0.4724), complemented by task-level checks: tool-call parse-success rate and spot review of generated templates/code. Loss alone is insufficient, which is why deployment monitoring (plan §5) tracks **tool-call validity** as the real production-quality signal.

**Generalization beyond the test set.** The eval split measures in-distribution loss; it does *not* guarantee performance on novel targets. That gap is closed in production by the `ToolCallParseRateLow` monitor (plan §5.4) — a regression in real-user queries shows up as falling parse-success even when offline loss looks fine.

**Failure modes the metric misses.** Plausible-but-wrong code, outdated tool flags, and over-confident exploit suggestions. These are caught by human-in-the-loop review and schema validation at the `agent-tool-connector` boundary, not by loss.

### Technical implementation

**LoRA / QLoRA trade-off.** LoRA (adapter) was chosen to keep training cheap and the base model intact — the adapter is small, swappable, and re-mergeable. This directly enables the deployment story: the adapter is merged then quantized, so inference has zero LoRA overhead. The trade-off is slightly less expressive capacity than full fine-tuning, which is acceptable for a structure-shaping objective.

**Catastrophic-forgetting mitigation.** Using a low-rank adapter over a strong coder base (rather than full-parameter fine-tuning) preserves general coding ability; the merge keeps the base weights dominant. The role binding also hedges this — general reasoning still routes to `qwen3:14b`, so even if the coder model narrows, the platform's general path is unaffected.

**Experiment tracking.** Conversion/quantization is reproducible from a pinned config (`v6_config.yaml`) and a single command, with cost (~$2) and code repo documented on the model card — this is what makes the deployment auditable.

### Production & deployment concerns

**Where does it break under load?** A single GPU saturates at ~1–2 concurrent streams (Q4_K_M). The mitigation is documented in plan §3.3 (vLLM continuous batching for Tier C) and §5.4 (`InferenceLatencyHigh` runbook).

**Scaling to a larger model / cost.** Going to a 32B+ coder would need ≥ 24 GB VRAM even quantized, breaking portability and raising cost ~2–4× (plan §4). The 14B-Q4 point was chosen precisely to stay on one consumer GPU / NPU.

**Safety & incorrect output.** The model has no safety tuning (inherited). This is mitigated structurally, not by the model: RBAC, allow-listed tool schemas, authorized-scope enforcement, and human review (plan §6.4). Publishing it publicly without those guards would be the real risk — hence the explicit out-of-scope statement.

### Reflection & iteration

**Resource constraints / simplifications.** Shipped a single Q4_K_M quant to keep the deployment lean; higher-quality quants are available but opt-in. Kept context at 4096 to bound VRAM.

**Deployment risks & mitigation.** (1) Sensitive-prompt egress → local-first + air-gap + fallback alert. (2) Model-quality regression → parse-rate monitor + versioned rollback. (3) GPU OOM → quant + auto-unload + OOM alert. All three are wired into plan §5–§6.

**What I'd change next time.** Ship an instrumented eval set that runs in CI against each new quant, and add a small safety/refusal layer at the application boundary so the model can be considered for less-trusted contexts.
