# v3.4.9 C2 Operations — RTPI Workflows

**Context:** RTPI-Agent invoking nexus-harness C2 operations skills via MCP.

---

## Architecture

Unlike standard skill categories where the skill executes a tool inside nexus-kali, C2 operations skills act as a bridge between RTPI and the retained C2 containers. The skill itself runs in nexus-harness but communicates outward to the C2 container's API.

```
RTPI Frontend (GUI)
    |
    v
RTPI Server (Express API)
    |
    v (MCP client call)
nexus-harness (MCP server mode)
    |
    v (skill execution)
exploit-dev/c2 skill
    |
    v (API / management call)
Retained C2 Container (rtpi-c3-agent / rtpi-adaptix-agent / rtpi-loki-agent)
    |
    v (C2 channel to target)
Target environment (in-scope)
    |
    v
Results -> /results/$ENGAGEMENT/exploit-dev/c2/<framework>/
    |
    v (read by RTPI)
RTPI Frontend displays results
```

### Key Difference from Other Categories

```
Standard skill (e.g., cloud/):         C2 operations skill:

nexus-harness                          nexus-harness
    |                                      |
    v                                      v
tool runs INSIDE nexus-kali            skill talks to EXTERNAL container
    |                                      |
    v                                      v
target                                 C2 container -> target
```

---

## MCP Invocation Pattern

RTPI invokes nexus-harness C2 operations skills via MCP tool calls. Each call targets a specific C2 framework and operation.

### Example: C3 Relay Setup

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "exploit-dev/c3-operations",
    "action": "setup-listener",
    "channel_type": "Slack",
    "target": "10.10.14.50",
    "engagement": "ENG-2026-087"
  }
}
```

### Example: C3 Payload Generation

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "exploit-dev/c3-operations",
    "action": "generate-payload",
    "arch": "x64",
    "format": "exe",
    "engagement": "ENG-2026-087"
  }
}
```

### Example: Adaptix Listener Creation

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "exploit-dev/adaptix-operations",
    "action": "create-listener",
    "protocol": "https",
    "port": 443,
    "target": "192.168.1.0/24",
    "engagement": "ENG-2026-087"
  }
}
```

### Example: Adaptix Session Interaction

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "exploit-dev/adaptix-operations",
    "action": "interact",
    "session_id": "adaptix-session-001",
    "command": "whoami",
    "engagement": "ENG-2026-087"
  }
}
```

### Example: Loki Implant Deployment

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "exploit-dev/loki-operations",
    "action": "deploy-implant",
    "target": "10.10.14.75",
    "arch": "x64",
    "engagement": "ENG-2026-087"
  }
}
```

### Example: C2 Cleanup

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "exploit-dev/c3-operations",
    "action": "cleanup",
    "engagement": "ENG-2026-087"
  }
}
```

---

## RTPI Integration Points

| RTPI Page | Action | nexus-harness Skill | Result Display |
|-----------|--------|---------------------|----------------|
| Intelligence -> OffSec R&D -> Tool Lab | Set up C2 listener | `exploit-dev/c3-operations`, `exploit-dev/adaptix-operations`, `exploit-dev/loki-operations` | C2 status panel |
| Intelligence -> OffSec R&D -> Tool Lab | Generate C2 payload | `exploit-dev/c3-operations`, `exploit-dev/adaptix-operations`, `exploit-dev/loki-operations` | Payload download link |
| Intelligence -> OffSec R&D -> Tool Lab | Interact with C2 session | `exploit-dev/c3-operations`, `exploit-dev/adaptix-operations`, `exploit-dev/loki-operations` | Session console output |
| Intelligence -> OffSec R&D -> Tool Lab | Cleanup C2 engagement | `exploit-dev/c3-operations`, `exploit-dev/adaptix-operations`, `exploit-dev/loki-operations` | Cleanup confirmation |
| Intelligence -> Frameworks -> MITRE ATT&CK | Map C2 activity to TA0011 | `exploit-dev/*-operations` | ATT&CK technique view |
| Intelligence -> Reports | Include C2 findings in report | `reporting/engagement-report` | Report builder |

---

## BloodHound-MCP-AI Integration

BloodHound-MCP-AI is **not** accessed through a nexus-harness skill. It is configured as an MCP server in `.nexus/mcp.json` and is available directly to any MCP client — including RTPI.

### Access Pattern

```
RTPI Frontend (GUI)
    |
    v
RTPI Server (Express API)
    |
    v (MCP client call — direct to BloodHound-MCP-AI)
BloodHound-MCP-AI (MCP server)
    |
    v (Neo4j Cypher queries)
BloodHound CE database
    |
    v
AI-enriched AD attack path analysis
    |
    v (returned to RTPI)
RTPI Frontend displays results
```

### MCP Configuration Example (`.nexus/mcp.json`)

```json
{
  "mcpServers": {
    "bloodhound-mcp-ai": {
      "command": "python",
      "args": ["-m", "bloodhound_mcp_ai"],
      "env": {
        "NEO4J_URI": "bolt://bloodhound-neo4j:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "${BLOODHOUND_NEO4J_PASSWORD}"
      }
    }
  }
}
```

### Usage Context

BloodHound-MCP-AI enriches existing Active Directory skills (`active-directory/bloodhound-enum`, `active-directory/ad-enum`, `active-directory/kerberoasting`) by providing AI-driven analysis of BloodHound graph data. It does not replace those skills — it augments them with natural language querying of AD attack paths.

---

## Operational Safety

RTPI enforces additional safety controls for C2 operations that go beyond standard skill invocations:

### Scope Enforcement

- RTPI verifies target is in the engagement scope **before** forwarding any C2 skill invocation to nexus-harness.
- Nexus-harness performs its own scope check as a second layer of verification.
- Scope checks occur at listener setup, payload generation, and deployment — not just at initial invocation.

### Confirmation Gates

- **Listener creation** requires operator confirmation in the RTPI GUI before the MCP call is sent.
- **Payload deployment** requires operator confirmation with target details displayed for review.
- **Session interaction** with destructive commands (file deletion, persistence installation) requires additional confirmation.
- Cleanup operations do not require confirmation — they are always permitted.

### Audit Trail

- All C2 MCP invocations are logged by RTPI with timestamp, operator, engagement, and action.
- C2 session activity is captured in `/results/$ENGAGEMENT/exploit-dev/c2/<framework>/` and linked in RTPI's engagement timeline.
- Engagement closure in RTPI triggers a mandatory cleanup check: RTPI queries each C2 skill for active sessions and blocks closure if any remain.

### Container Isolation

- C2 containers run on an isolated Docker network. RTPI does not expose C2 management interfaces to the public network.
- API credentials for C2 containers are scoped per engagement and rotated at engagement close.
- RTPI does not store C2 credentials — they are passed through to nexus-harness via environment variables at invocation time.
