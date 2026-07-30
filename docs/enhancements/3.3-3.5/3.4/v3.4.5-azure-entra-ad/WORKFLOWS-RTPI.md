# v3.4.5 Azure / Entra AD — RTPI Workflows

**Context:** RTPI-Agent invoking nexus-harness active-directory skills via MCP.

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
active-directory/ skills execute inside nexus-kali
    |
    v
Results -> /results/$ENGAGEMENT/active-directory/
    |
    v (read by RTPI)
RTPI Frontend displays results
```

## MCP Invocation Pattern

RTPI invokes nexus-harness skills via MCP tool calls. The nexus-harness MCP server exposes skills as tools.

### Example: Trigger Entra ID Enumeration

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "active-directory/aadinternals",
    "target": "contoso.onmicrosoft.com",
    "engagement": "ENG-2026-055"
  }
}
```

### Example: Trigger M365 Assessment

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "active-directory/scubagear",
    "target": "contoso.onmicrosoft.com",
    "engagement": "ENG-2026-055"
  }
}
```

### Example: Trigger LSASS Credential Extraction

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "active-directory/dumpert",
    "target": "192.168.1.50",
    "engagement": "ENG-2026-055"
  }
}
```

### Example: Trigger AD Lateral Movement Analysis

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "active-directory/linwinpwn",
    "target": "corp.contoso.com",
    "engagement": "ENG-2026-055",
    "options": {
      "mode": "enum"
    }
  }
}
```

## RTPI Integration Points

| RTPI Page | Action | nexus-harness Skill | Result Display |
|-----------|--------|---------------------|----------------|
| Intelligence -> OffSec R&D -> Tool Lab | Run Azure AD enumeration | `active-directory/aadinternals`, `active-directory/entraops` | Tool Lab results tab |
| Intelligence -> OffSec R&D -> Tool Lab | Run M365 compliance assessment | `active-directory/scubagear` | SCuBA report viewer |
| Intelligence -> Frameworks -> MITRE ATT&CK | Map findings to ATT&CK techniques | `active-directory/*` skills | ATT&CK matrix overlay |
| Intelligence -> Reports | Include AD/Entra findings in report | `reporting/engagement-report` | Report builder |
| Intelligence -> OffSec R&D -> Tool Lab | Run credential extraction analysis | `active-directory/dumpert`, `active-directory/dsinternals` | Credential findings view |

## Credential Management

RTPI does not manage AD or Azure credentials. Credentials are configured inside nexus-kali:
- Azure AD / Entra ID: `az login` session, service principal env vars, or AADInternals token cache
- Domain credentials: environment variables (`$USERNAME`, `$PASSWORD`, `$DOMAIN`) or Kerberos ticket cache
- M365 admin: authenticated PowerShell session or cached tokens
- Local admin (for Dumpert): requires SYSTEM or local admin context on the target host

RTPI's role is to trigger the skill and display results -- it never touches or stores credentials.

## Cross-References

- v3.4.1 `cloud/roadrecon` and `cloud/azure-powershell` provide complementary Azure reconnaissance -- RTPI can chain these with v3.4.5 Entra skills
- Existing `active-directory/bloodhound-enum` output feeds into v3.4.5 lateral movement workflows
- `active-directory/certipy-abuse` integrates with Entra certificate-based auth assessment
