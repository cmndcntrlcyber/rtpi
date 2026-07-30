# v3.4.3 SAST & SCA — RTPI Workflows

**Context:** RTPI-Agent invoking nexus-harness SAST/SCA skills via MCP.

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
sast-sca/ skills execute inside nexus-kali
    |
    v
Results → /results/$ENGAGEMENT/sast-sca/
    |
    v (read by RTPI)
RTPI Frontend displays results
```

## MCP Invocation Pattern

RTPI invokes nexus-harness skills via MCP tool calls. The nexus-harness MCP server exposes skills as tools.

### Example: Trigger Multi-Language SAST Scan

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "sast-sca/semgrep-scan",
    "target": "/target/repo",
    "engagement": "ENG-2026-044",
    "options": {
      "config": "auto",
      "severity": "WARNING,ERROR"
    }
  }
}
```

### Example: Trigger Container Image Scan

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "sast-sca/trivy-scan",
    "target": "registry.example.com/app:v2.1.0",
    "engagement": "ENG-2026-044",
    "options": {
      "scan_type": "image",
      "scanners": "vuln,misconfig,secret",
      "format": "json"
    }
  }
}
```

### Example: Trigger SSL/TLS Assessment

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "sast-sca/testssl-scan",
    "target": "target.example.com:443",
    "engagement": "ENG-2026-044"
  }
}
```

## RTPI Integration Points

| RTPI Page | Action | nexus-harness Skill | Result Display |
|-----------|--------|---------------------|----------------|
| Intelligence → OffSec R&D → Tool Lab | Run SAST/SCA tool comparison | `sast-sca/*` skills | Tool Lab results tab |
| Intelligence → Frameworks → CWE | Map SAST findings to CWE entries | `sast-sca/semgrep-scan`, `sast-sca/bandit-scan` | CWE findings view |
| Intelligence → Frameworks → OWASP Top 10 | Map dependency vulns to OWASP categories | `sast-sca/trivy-scan`, `sast-sca/snyk-audit` | OWASP mapping view |
| Intelligence → Reports | Include SAST/SCA findings in report | `reporting/engagement-report` | Report builder |

## API Key and Credential Management

RTPI does not manage SAST/SCA credentials or API tokens. Tokens are configured inside nexus-kali:
- Snyk: `SNYK_TOKEN` env var mounted into nexus-kali
- Vulnerability databases: network access from nexus-kali (NVD, OSV, GitHub Advisory)
- Target source code: mounted at `/target/repo` or cloned inside nexus-kali
- Container images: pulled inside nexus-kali or loaded from tarball

RTPI's role is to trigger the skill and display structured results — it never touches API tokens or source code directly.
