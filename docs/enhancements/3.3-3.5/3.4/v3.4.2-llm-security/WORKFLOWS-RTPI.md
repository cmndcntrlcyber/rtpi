# v3.4.2 LLM Security — RTPI Workflows

**Context:** RTPI-Agent invoking nexus-harness LLM security skills via MCP.

---

## Architecture

```
RTPI Frontend (GUI)
    |
    v
RTPI Server (Express API)
    |
    v (MCP client call)
nexus-harness (MCP server mode)
    |
    v
llm-security/ skills execute inside nexus-kali
    |
    v
Results → /results/$ENGAGEMENT/llm-security/
    |
    v (read by RTPI)
RTPI Frontend displays results
```

## MCP Invocation Pattern

### Example: Trigger LLM Red Team Assessment

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "llm-security/garak-scan",
    "target": "https://api.target.com/v1/chat",
    "engagement": "ENG-2026-043",
    "options": {
      "model_type": "openai",
      "probes": "all"
    }
  }
}
```

### Example: Trigger Model Supply Chain Audit

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "llm-security/modelscan-audit",
    "target": "/shared/models/target-model.pkl",
    "engagement": "ENG-2026-043"
  }
}
```

## RTPI Integration Points

| RTPI Page | Action | nexus-harness Skill | Result Display |
|-----------|--------|---------------------|----------------|
| Intelligence → Frameworks → OWASP LLM | Run LLM Top 10 assessment | `llm-security/garak-scan` + `promptfoo-eval` | OWASP LLM findings view |
| Intelligence → Frameworks → ATLAS | Map findings to ATLAS techniques | `llm-security/deepteam-redteam` | ATLAS technique mapping |
| Intelligence → OffSec R&D → Tool Lab | Compare LLM testing tools | `llm-security/*` skills | Tool Lab comparison |
| Intelligence → OffSec R&D → Research Projects | LLM vulnerability research | `llm-security/prompt-library` | Research project notes |
| Intelligence → Reports | Include LLM findings in report | `reporting/engagement-report` | Report builder |

## API Key Management

RTPI does not manage LLM API keys. Keys are configured inside nexus-kali:
- OpenAI: `OPENAI_API_KEY` env var
- Anthropic: `ANTHROPIC_API_KEY` env var
- Ollama: Local endpoint (no key needed)
- HuggingFace: `HF_TOKEN` env var
- Custom: Configured per-tool in `~/.promptfoo/`, `~/.garak/`

RTPI triggers the skill and displays structured results — it never touches API keys.
