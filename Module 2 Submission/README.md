# Module 2 Submission — Deploy & Monitor a Fine-Tuned LLM

**LLMED Program · Module 2 Project**
**Author:** cmndcntrlcyber · **Date:** 2026-06-05

This submission documents the deployment and monitoring plan for the fine-tuned model
**[`qwen14b-code-trainer-v6`](https://huggingface.co/cmndcntrlcyber/qwen14b-code-trainer-v6-gguf)**
(Qwen2.5-Coder-14B, GGUF Q4_K_M) as the code / tool-use model inside
**[RTPI — Red Team Portable Infrastructure](https://github.com/cmndcntrlcyber/rtpi)**.

> **One-line summary.** A locally-served, code-specialized 14B model replaces frontier
> APIs for RTPI's agentic offensive-security workflows — keeping sensitive engagement
> data on operator hardware, cutting per-request cost ~6–60×, and running anywhere from
> an Orange Pi NPU to a rack GPU through a single OpenAI/Ollama-compatible contract.

## Contents

| Document | What it is |
|---|---|
| **[deployment-plan.md](deployment-plan.md)** | **The primary deliverable** — the publication with all six mandatory sections (Use Case, Model Selection & Configuration, Deployment Strategy, Cost Analysis, Monitoring & Observability, Security). |
| [model-card.md](model-card.md) | Model card + answers to the "explaining your training decisions" interview questions. |
| [repository-assessment.md](repository-assessment.md) | Self-assessment against the RT repo-assessment and technical-excellence rubrics. |
| [architecture/architecture.md](architecture/architecture.md) | System, request-flow, monitoring, and tier-decision diagrams (Mermaid). |
| [cost-analysis.csv](cost-analysis.csv) | Cost spreadsheet — three deployment scenarios + cost-per-1000-requests. |
| [deploy/](deploy/) | **Runnable deployment + monitoring code** (the "GitHub repository" deliverable). |

## The `deploy/` artifacts

| File | Purpose |
|---|---|
| [deploy/deploy_ollama.sh](deploy/deploy_ollama.sh) | Pull the GGUF from Hugging Face, verify integrity, register with Ollama (default tier). |
| [deploy/deploy_vllm.sh](deploy/deploy_vllm.sh) | Serve under vLLM for high-throughput batching. |
| [deploy/docker-compose.serving.yml](deploy/docker-compose.serving.yml) | Ollama + vLLM + Prometheus + Grafana + DCGM, self-contained. |
| [deploy/client.py](deploy/client.py) | Client with four example request types, error handling, latency timing. |
| [deploy/test_inference.sh](deploy/test_inference.sh) | Smoke test / rollout gate. |
| [deploy/Modelfile](deploy/Modelfile) · [deploy/config.yaml](deploy/config.yaml) · [deploy/.env.example](deploy/.env.example) · [deploy/requirements.txt](deploy/requirements.txt) | Configuration. |
| [deploy/monitoring/](deploy/monitoring/) | Prometheus scrape config + Grafana dashboard. |
| [deploy/LICENSE](deploy/LICENSE) | Apache-2.0 (matches the model license). |

## Quickest path to verify it works
```bash
cd deploy
cp .env.example .env
./deploy_ollama.sh        # pull + register the fine-tuned model in Ollama
./test_inference.sh       # smoke test
python3 client.py         # run the four canonical RTPI request types
```
Full instructions and runbooks: [deploy/README.md](deploy/README.md).

## How this maps to the Module 2 requirements

| Requirement | Satisfied by |
|---|---|
| Publication with 6 sections | [deployment-plan.md](deployment-plan.md) |
| ≥ 1 deployment script | [deploy/deploy_ollama.sh](deploy/deploy_ollama.sh), [deploy/deploy_vllm.sh](deploy/deploy_vllm.sh), [docker-compose.serving.yml](deploy/docker-compose.serving.yml) |
| Client code w/ examples + error handling | [deploy/client.py](deploy/client.py) |
| Documentation (deploy/setup/test) | [deploy/README.md](deploy/README.md) |
| Configuration files | [Modelfile](deploy/Modelfile), [config.yaml](deploy/config.yaml), [.env.example](deploy/.env.example), [requirements.txt](deploy/requirements.txt) |
| Cost analysis + optimization strategies | [deployment-plan.md §4](deployment-plan.md), [cost-analysis.csv](cost-analysis.csv) |
| Monitoring & observability plan | [deployment-plan.md §5](deployment-plan.md), [deploy/monitoring/](deploy/monitoring/) |
| Security considerations | [deployment-plan.md §6](deployment-plan.md) |
| Architecture diagram (optional) | [architecture/architecture.md](architecture/architecture.md) |
| Monitoring dashboard mockup (optional) | [deploy/monitoring/grafana-dashboard.json](deploy/monitoring/grafana-dashboard.json) |
| Repo meets ≥70% Essential | [repository-assessment.md](repository-assessment.md) |

## Links
- **Fine-tuned model:** https://huggingface.co/cmndcntrlcyber/qwen14b-code-trainer-v6-gguf
- **Host application (RTPI):** https://github.com/cmndcntrlcyber/rtpi
- **Training pipeline:** https://github.com/cmndcntrlcyber/code-trainer-offsec-pipeline

> **Licensing:** the parent RTPI repo is licensed **MIT** (root `LICENSE`); this
> submission's `deploy/` artifacts and the fine-tuned model are **Apache-2.0**. Both
> are permissive and compatible for redistribution. See
> [repository-assessment.md §4](repository-assessment.md#4-license--legal).
