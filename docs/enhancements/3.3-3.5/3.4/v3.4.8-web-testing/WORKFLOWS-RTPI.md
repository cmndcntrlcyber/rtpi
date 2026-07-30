# v3.4.8 Web Testing — RTPI Workflows

**Context:** RTPI-Agent invoking nexus-harness web testing skills via MCP.

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
web/ skills execute inside nexus-kali
    |
    v
Results -> /results/$ENGAGEMENT/web/
    |
    v (read by RTPI)
RTPI Frontend displays results
```

## MCP Invocation Pattern

RTPI invokes nexus-harness skills via MCP tool calls. The nexus-harness MCP server exposes skills as tools.

### Example: Trigger Wapiti Vulnerability Scan

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "web/wapiti-scan",
    "target": "https://app.example.com",
    "engagement": "ENG-2026-078"
  }
}
```

### Example: Trigger API Security Scan

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "web/apicheck-scan",
    "target": "https://api.example.com",
    "engagement": "ENG-2026-078",
    "options": {
      "openapi_spec": "/results/ENG-2026-078/web/mitmproxy/openapi-spec.yaml"
    }
  }
}
```

### Example: Trigger GraphQL Fingerprinting

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "web/graphw00f-fingerprint",
    "target": "https://app.example.com/graphql",
    "engagement": "ENG-2026-078"
  }
}
```

## RTPI Integration Points

| RTPI Page | Action | nexus-harness Skill | Result Display |
|-----------|--------|---------------------|----------------|
| Intelligence -> OffSec R&D -> Tool Lab | Run web vulnerability scan | `web/wapiti-scan` | Tool Lab results tab |
| Intelligence -> OffSec R&D -> Tool Lab | Run API security tests | `web/apicheck-scan`, `web/astra-api` | Tool Lab results tab |
| Intelligence -> OffSec R&D -> Tool Lab | Fingerprint GraphQL server | `web/graphw00f-fingerprint` | Tool Lab results tab |
| Intelligence -> OffSec R&D -> Tool Lab | Extract OpenAPI spec from captures | `web/mitmproxy2swagger-extract` | Tool Lab results tab |
| Intelligence -> Frameworks -> OWASP | Map findings to OWASP Top 10 | `web/wapiti-scan`, `web/astra-api` | Framework compliance view |
| Intelligence -> Reports | Include web testing findings in report | `reporting/engagement-report` | Report builder |

## Proxy Session Management

RTPI does not manage mitmproxy sessions. The `web/mitmproxy-intercept` skill runs entirely inside nexus-kali:
- mitmproxy is started and stopped within the nexus-kali container
- Traffic captures are stored at `/results/$ENGAGEMENT/web/mitmproxy/`
- RTPI can trigger `web/mitmproxy2swagger-extract` to convert existing captures to OpenAPI specs
- RTPI reads the generated OpenAPI spec and scan results — it never manages the proxy process directly

## Credential Management

RTPI does not manage web application credentials. Authentication is configured inside nexus-kali:
- API tokens/keys: environment variables or files mounted into nexus-kali
- Session cookies: captured during mitmproxy interception within nexus-kali
- Login credentials for authenticated scans (Astra): passed via skill arguments, never stored by RTPI

RTPI's role is to trigger the skill and display results — it never touches or stores application credentials.
