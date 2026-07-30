# v3.4.2 LLM Security — Internal Workflows

**Context:** Standalone nexus-kali usage via `nexus` CLI. No RTPI involved.

---

## Workflow 1: LLM Red Team Assessment

**Trigger:** `/engage` with LLM target or manual invocation
**Skills used:** `llm-security/garak-scan`, `llm-security/promptfoo-eval`, `llm-security/deepteam-redteam`

```
1. Scope check → verify LLM endpoint/API is in engagement scope
2. garak --model-type openai --model-name target-model --probes all
   → automated vulnerability probing (injection, exfiltration, jailbreak)
   → /results/$ENGAGEMENT/llm-security/garak/
3. promptfoo eval -c redteam-config.yaml
   → structured prompt injection and output handling tests
   → /results/$ENGAGEMENT/llm-security/promptfoo/
4. deepteam red-team --target target-endpoint
   → adversarial attack generation and testing
   → /results/$ENGAGEMENT/llm-security/deepteam/
5. Consolidate findings by OWASP LLM category → engagement-report
```

## Workflow 2: LLM Evaluation (Quality + Safety)

**Skills used:** `llm-security/deepeval-test`, `llm-security/promptfoo-eval`

```
1. deepeval test run --test-file safety-tests.py
   → hallucination, toxicity, bias, coherence metrics
   → /results/$ENGAGEMENT/llm-security/deepeval/
2. promptfoo eval -c eval-config.yaml
   → correctness, relevance, safety benchmarks
   → /results/$ENGAGEMENT/llm-security/promptfoo/
3. Aggregate scores → quality report
```

## Workflow 3: Model Supply Chain Audit

**Skills used:** `llm-security/modelscan-audit`, `llm-security/pker-analyze`, `llm-security/pickora-analyze`

```
1. modelscan scan -p /path/to/model.pkl
   → detect pickle deserialization attacks, code injection in model files
2. pker -i suspicious.pkl -o analysis.json
   → analyze pickle bytecode for malicious operations
3. pickora analyze suspicious.pkl
   → Rust-based pickle format analysis
4. Results → /results/$ENGAGEMENT/llm-security/model-audit/
```

## Workflow 4: Mobile AI App Reverse Engineering

**Skills used:** `llm-security/jadx-decompile`, `llm-security/dex2jar-convert`

```
1. d2j-dex2jar target.apk → convert DEX to JAR
2. jadx -d output/ target.apk → decompile APK to Java source
3. grep -r "api_key\|model_name\|endpoint" output/
   → identify hardcoded API keys, model endpoints, prompt templates
4. Results → /results/$ENGAGEMENT/llm-security/mobile-re/
```

## Workflow 5: Prompt Library Research

**Skills used:** `llm-security/prompt-library`

```
1. Browse /opt/tools/Prompts/ for red team prompt templates
2. Select relevant prompts for target LLM type
3. Customize prompts for engagement scope
4. Feed into garak or promptfoo as custom test cases
```
