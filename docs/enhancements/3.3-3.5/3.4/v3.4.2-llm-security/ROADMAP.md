# v3.4.2 — LLM Security Skills

**Priority:** P1
**Status:** Complete
**Skill Category:** `skills/offense/llm-security/` (new)
**Tools:** 10
**Parent:** [v3.4 Tool Catalogue](../v3.4.md)

---

## Objective

Create a new `llm-security/` skill category in nexus-harness for AI/ML red teaming, LLM vulnerability scanning, model security analysis, and mobile app reverse engineering related to AI systems. This is an entirely new category — nexus-harness currently has zero coverage despite `hunt/hunt-llm-ai` existing as a methodology-only skill.

---

## Tool Inventory

| # | Tool | Purpose | Install Method | Skill Name |
|---|------|---------|----------------|------------|
| 1 | Promptfoo | LLM testing, evaluation, and red teaming framework | git clone + npm build | `llm-security/promptfoo-eval` |
| 2 | DeepEval | LLM evaluation with metrics (hallucination, toxicity, bias) | pip | `llm-security/deepeval-test` |
| 3 | DeepTeam | LLM red teaming — adversarial attack generation | pip -e (from source) | `llm-security/deepteam-redteam` |
| 4 | Garak | NVIDIA LLM vulnerability scanner (probing, injection, exfiltration) | git clone + pip -e | `llm-security/garak-scan` |
| 5 | ModelScan | Model serialization attack detection (pickle, HDF5, SavedModel) | pip | `llm-security/modelscan-audit` |
| 6 | Pker | Python pickle format analyzer and converter (Go) | git clone + go build | `llm-security/pker-analyze` |
| 7 | Pickora | Pickle format analyzer (Rust) | git clone + cargo build | `llm-security/pickora-analyze` |
| 8 | Prompts | Red team prompt collection and reference library | git clone | `llm-security/prompt-library` |
| 9 | JADX | APK/DEX decompiler for mobile AI app analysis | binary download | `llm-security/jadx-decompile` |
| 10 | dex2jar | DEX to JAR converter for Android AI app analysis | binary download (v2.4) | `llm-security/dex2jar-convert` |

---

## Skill Structure

Each skill follows the nexus-harness offense skill pattern. LLM-specific additions:

1. **Model Target Configuration** — skills accept model endpoints (API URL, model name) or local model paths
2. **Attack Categories** — skills reference OWASP LLM Top 10 and MITRE ATLAS techniques
3. **Output Format** — JSON-structured findings with severity, category, and reproducibility scores
4. **Safety Guardrails** — skills include guidance on responsible testing (rate limiting, no data exfiltration of real user data)

---

## Acceptance Criteria

- [x] 10 SKILL.md files created under `skills/offense/llm-security/`
- [x] Each skill works standalone via `nexus` CLI inside nexus-kali (frontmatter validated: name, description, allowed-tools present on all 10 skills)
- [x] All 10 tools installed in nexus-kali image (`docker/Dockerfile` updated 2026-07-30)
- [x] Results output to `/results/$ENGAGEMENT/llm-security/<tool>/`
- [x] Skills cross-reference OWASP LLM Top 10 categories (LLM01–LLM10)
- [x] Skills cross-reference MITRE ATLAS techniques where applicable
- [x] `hunt/hunt-llm-ai` skill updated to reference all 10 `llm-security/` tool skills (2026-07-30)

---

## Nexus-Kali Image Requirements

### pip
```
deepeval garak modelscan
```

### npm
```
promptfoo
```

### git clone + build
```
github.com/confident-ai/deepteam (pip install -e)
github.com/EddieIvan01/pker (go build)
github.com/splitline/Pickora (cargo build)
github.com/sneakerhax/Prompts (reference only)
```

### Binary downloads
```
JADX (skylot/jadx GitHub release, latest)
dex2jar (pxb1988/dex2jar v2.4)
```

### Runtime Prerequisites
- LLM API endpoints (OpenAI, Anthropic, Ollama, HuggingFace, or custom)
- API keys for target LLM providers
- Promptfoo config (`~/.promptfoo/`)
- Garak config (`~/.garak/`)

---

## OWASP LLM Top 10 Coverage Matrix

| OWASP LLM Category | Primary Tool | Skill |
|---------------------|-------------|-------|
| LLM01: Prompt Injection | Garak, Promptfoo | `garak-scan`, `promptfoo-eval` |
| LLM02: Insecure Output Handling | Promptfoo, DeepEval | `promptfoo-eval`, `deepeval-test` |
| LLM03: Training Data Poisoning | ModelScan | `modelscan-audit` |
| LLM04: Model Denial of Service | Garak | `garak-scan` |
| LLM05: Supply Chain Vulnerabilities | ModelScan, Pker, Pickora | `modelscan-audit`, `pker-analyze`, `pickora-analyze` |
| LLM06: Sensitive Information Disclosure | Garak, Promptfoo | `garak-scan`, `promptfoo-eval` |
| LLM07: Insecure Plugin Design | Manual (via Promptfoo custom tests) | `promptfoo-eval` |
| LLM08: Excessive Agency | DeepTeam, Promptfoo | `deepteam-redteam`, `promptfoo-eval` |
| LLM09: Overreliance | DeepEval (hallucination metrics) | `deepeval-test` |
| LLM10: Model Theft | JADX, dex2jar (mobile app RE) | `jadx-decompile`, `dex2jar-convert` |

---

## Dependencies

- Existing skill: `hunt/hunt-llm-ai` — update to reference new tool skills
- MITRE ATLAS framework data (from RTPI Intelligence → Frameworks page)
- OWASP LLM Top 10 reference (from RTPI Intelligence → Frameworks page)

---

## Risks

| Risk | Mitigation |
|------|------------|
| LLM API costs during red teaming | Skills include cost estimation guidance and --max-requests flags |
| Rate limiting by LLM providers | Skills include backoff/retry logic recommendations |
| Responsible disclosure for discovered vulnerabilities | Skills include disclosure guidance and finding classification |
| Garak dependency complexity (maturin, Rust bindings) | Pre-build in nexus-kali image; verify with `garak --help` |
