# v3.4.1 Cloud Security — RTPI Workflows

**Context:** RTPI-Agent invoking nexus-harness cloud skills via MCP.

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
cloud/ skills execute inside nexus-kali
    |
    v
Results → /results/$ENGAGEMENT/cloud/
    |
    v (read by RTPI)
RTPI Frontend displays results
```

## MCP Invocation Pattern

RTPI invokes nexus-harness skills via MCP tool calls. The nexus-harness MCP server exposes skills as tools.

### Example: Trigger AWS Security Audit

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "cloud/scoutsuite-audit",
    "target": "AWS_ACCOUNT_123456789",
    "engagement": "ENG-2026-042"
  }
}
```

### Example: Trigger IAM Analysis

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "cloud/cloudsplaining",
    "target": "arn:aws:iam::123456789:policy/TargetPolicy",
    "engagement": "ENG-2026-042"
  }
}
```

## RTPI Integration Points

| RTPI Page | Action | nexus-harness Skill | Result Display |
|-----------|--------|---------------------|----------------|
| Intelligence → OffSec R&D → Tool Lab | Run cloud tool comparison | `cloud/*` skills | Tool Lab results tab |
| Intelligence → Frameworks → CIS Controls | Run CIS compliance scan | `cloud/prowler-audit` | Framework compliance view |
| Intelligence → Reports | Include cloud findings in report | `reporting/engagement-report` | Report builder |

## Credential Management

RTPI does not manage cloud credentials. Credentials are configured inside nexus-kali:
- AWS: `~/.aws/credentials` or environment variables mounted into nexus-kali
- GCP: Service account JSON mounted at `/secrets/gcp-sa.json`
- Azure: `az login` session or service principal env vars

RTPI's role is to trigger the skill and display results — it never touches or stores cloud credentials.
