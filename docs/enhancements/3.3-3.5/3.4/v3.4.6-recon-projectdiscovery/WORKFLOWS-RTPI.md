# v3.4.6 Recon & ProjectDiscovery — RTPI Workflows

**Context:** RTPI-Agent invoking nexus-harness recon skills via MCP.

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
recon/ skills execute inside nexus-kali
    |
    v
Results -> /results/$ENGAGEMENT/recon/
    |
    v (read by RTPI)
RTPI Frontend displays results
```

## MCP Invocation Pattern

RTPI invokes nexus-harness skills via MCP tool calls. The nexus-harness MCP server exposes skills as tools.

### Example: Trigger ASN/CIDR Mapping

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "recon/asnmap",
    "target": "target.com",
    "engagement": "ENG-2026-060"
  }
}
```

### Example: Trigger Parameter Discovery

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "recon/arjun-params",
    "target": "https://target.com/api/v1/search",
    "engagement": "ENG-2026-060"
  }
}
```

### Example: Trigger Full Recon Pipeline

```json
{
  "tool": "nexus_workflow",
  "arguments": {
    "workflow": "full-recon-pipeline",
    "target": "target.com",
    "engagement": "ENG-2026-060",
    "skills": [
      "recon/asnmap",
      "recon/mapcidr",
      "recon/alterx-wordlist",
      "recon/subdomain-enum",
      "recon/tlsx-certs",
      "recon/cdncheck",
      "recon/gau",
      "recon/waybackurls"
    ]
  }
}
```

### Example: Trigger CVE Intelligence Lookup

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "recon/cvemap",
    "target": "CVE-2024-21887",
    "engagement": "ENG-2026-060"
  }
}
```

## RTPI Integration Points

| RTPI Page | Action | nexus-harness Skill | Result Display |
|-----------|--------|---------------------|----------------|
| Intelligence -> OffSec R&D -> Tool Lab | Run recon pipeline | `recon/asnmap`, `recon/mapcidr`, `recon/tlsx-certs`, `recon/cdncheck` | Fingerprinting results tab |
| Intelligence -> OffSec R&D -> Tool Lab | Run parameter discovery | `recon/arjun-params`, `recon/x8-params`, `recon/paramspider` | Parameter inventory view |
| Intelligence -> OffSec R&D -> Tool Lab | Run URL archive mining | `recon/gau`, `recon/waybackurls` | URL archive browser |
| Intelligence -> Frameworks -> CVE/EPSS | CVE intelligence lookup | `recon/cvemap` | CVE detail view with EPSS scores |
| Intelligence -> Reports | Include recon findings in report | `reporting/engagement-report` | Report builder |
| Intelligence -> OffSec R&D -> Tool Lab | Start OOB listener | `recon/interactsh` | Live interaction monitor |

## Credential Management

RTPI does not manage API keys or cloud credentials. Keys are configured inside nexus-kali:
- ProjectDiscovery Cloud Platform: `PDCP_API_KEY` environment variable
- Shodan: `SHODAN_API_KEY` environment variable (for asnmap enrichment)
- Cloud providers (for cloudlist): AWS/GCP/Azure credentials per cloud provider conventions
- Notification tokens (for notify): provider config file at `~/.config/notify/provider-config.yaml`

RTPI's role is to trigger the skill and display results -- it never touches or stores API keys.

## Tool Chaining

Many v3.4.6 tools are designed to pipe output between each other. RTPI can invoke chained workflows where nexus-harness orchestrates the pipeline internally:

```
asnmap -> mapcidr -> nmap-scan (existing) -> tlsx -> cdncheck
alterx -> subdomain-enum (existing) -> httpx (existing)
gau + waybackurls -> anew (dedup) -> unfurl (extract params) -> arjun/x8 (validate)
```

RTPI triggers the workflow; nexus-harness manages the tool chaining and intermediate data.
