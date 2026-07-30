# v3.4.9 — C2 Operations Skills

**Priority:** P3
**Status:** Planning
**Skill Category:** `skills/offense/exploit-dev/` (expand existing `c2-framework` skill)
**Tools:** 3 C2 frameworks + 1 MCP integration
**Parent:** [v3.4 Tool Catalogue](../v3.4.md)

---

## Objective

Create operational skills for the three retained C2 runtime containers (C3, AdaptixC2, Loki) and add BloodHound-MCP-AI as an MCP server integration. Unlike other v3.4 categories where tools are installed into nexus-kali, these C2 frameworks already run as separate Docker containers. The new skills teach nexus-harness how to operate them remotely via their APIs and management interfaces. BloodHound-MCP-AI is not a skill — it is an MCP server configuration in `.nexus/mcp.json` that enriches existing Active Directory skills with AI-driven graph analysis.

---

## Tool Inventory

| # | Tool | Purpose | Runtime Container | Skill Name |
|---|------|---------|-------------------|------------|
| 1 | C3 (ReversecLabs) | Windows-focused C2 using relay networks | `rtpi-c3-agent` | `exploit-dev/c3-operations` |
| 2 | AdaptixC2 | Modern Go-based C2 with web management interface | `rtpi-adaptix-agent` | `exploit-dev/adaptix-operations` |
| 3 | Loki | Lightweight C-based implant framework | `rtpi-loki-agent` | `exploit-dev/loki-operations` |
| 4 | BloodHound-MCP-AI | BloodHound with MCP AI integration for AD graph analysis | N/A (MCP server) | MCP config in `.nexus/mcp.json` |

---

## Architecture

Unlike other skill categories where nexus-harness executes tools installed inside nexus-kali, C2 operations skills control **external containers** via their APIs. The skill runs inside nexus-harness but communicates outward to the retained C2 container.

```
nexus-harness (skill execution)
    |
    v (API / management interface)
Retained C2 Container (e.g., rtpi-c3-agent)
    |
    v (C2 channel)
Target environment (in-scope)
    |
    v
Results -> /results/$ENGAGEMENT/exploit-dev/c2/
```

### Key Architectural Differences from Other Categories

| Aspect | Standard Skills (e.g., cloud/) | C2 Operations Skills |
|--------|-------------------------------|---------------------|
| Tool location | Installed in nexus-kali | Runs in separate container |
| Execution model | Skill invokes tool binary directly | Skill calls C2 container API |
| Network path | nexus-kali -> target | nexus-harness -> C2 container -> target |
| Lifecycle | Tool starts/stops per invocation | C2 container is long-running |
| State | Stateless per run | Stateful (listeners, sessions, implants persist) |

### BloodHound-MCP-AI Integration

BloodHound-MCP-AI is not operated through a skill. It is configured as an MCP server in `.nexus/mcp.json`, making its capabilities available to any skill that queries Active Directory attack paths. It enriches skills like `active-directory/bloodhound-enum` and `active-directory/ad-enum` with AI-driven graph analysis.

```
nexus-harness (any AD skill)
    |
    v (MCP tool call)
BloodHound-MCP-AI (MCP server)
    |
    v (Neo4j queries)
BloodHound CE database
```

---

## Skill Structure

Each C2 operations skill follows the nexus-harness offense skill pattern but includes C2-specific sections:

```
skills/offense/exploit-dev/<skill-name>/
  SKILL.md          # YAML frontmatter + workflow sections
```

Standard sections per SKILL.md:
1. Scope Check (`$TARGET` must be in scope — **mandatory before any C2 deployment**)
2. Container Connectivity (verify C2 container is reachable)
3. Listener Setup (configure listener on the C2 container)
4. Payload Generation (generate implant/relay/agent payload)
5. Deployment (deliver payload to in-scope target)
6. Interaction (interact with established sessions)
7. Cleanup (tear down listeners, remove implants, sanitize logs)
8. Output Handling (results -> `/results/$ENGAGEMENT/exploit-dev/c2/`)
9. Operational Safety (containment checks, scope re-verification)

---

## Acceptance Criteria

- [ ] 3 SKILL.md files created under `skills/offense/exploit-dev/` (c3-operations, adaptix-operations, loki-operations)
- [ ] BloodHound-MCP-AI configuration added to `.nexus/mcp.json`
- [ ] Each skill verifies C2 container reachability before operations
- [ ] All skills enforce scope check before listener setup or payload deployment
- [ ] Skills require explicit confirmation before deploying payloads to targets
- [ ] Cleanup procedures documented and enforced in every skill workflow
- [ ] Results output to `/results/$ENGAGEMENT/exploit-dev/c2/<framework>/`
- [ ] Skills reference MITRE ATT&CK techniques: Command and Control (TA0011), Execution (TA0002)
- [ ] Existing `exploit-dev/c2-framework` skill updated to reference new framework-specific skills

---

## Nexus-Kali Image Requirements

The C2 frameworks do **NOT** need to be installed in the nexus-kali image. They run as separate, retained Docker containers:

- `rtpi-c3-agent` — C3 runtime
- `rtpi-adaptix-agent` — AdaptixC2 runtime
- `rtpi-loki-agent` — Loki runtime

### What IS needed in nexus-kali

- Network connectivity to the C2 containers (Docker network or host networking)
- API client utilities (curl, python3 requests) — already present in nexus-kali base
- BloodHound-MCP-AI requires network access to BloodHound CE Neo4j instance

### Runtime Prerequisites (not baked into image)

- C2 containers must be running (`docker compose up` for the relevant service)
- C2 management credentials (API keys, admin passwords) configured per engagement
- Docker network connectivity between nexus-kali and C2 containers
- BloodHound CE instance with populated data (for BloodHound-MCP-AI)
- Neo4j credentials for BloodHound database access

---

## Dependencies

- Existing skill: `exploit-dev/c2-framework` — generic C2 reference skill; new skills provide framework-specific operational workflows
- Existing skill: `active-directory/bloodhound-enum` — enriched by BloodHound-MCP-AI MCP server
- Retained containers: `rtpi-c3-agent`, `rtpi-adaptix-agent`, `rtpi-loki-agent` must remain in Docker Compose configuration
- Scope guard must validate targets before any C2 deployment action

---

## Risks

| Risk | Mitigation |
|------|------------|
| C2 payload deployed to out-of-scope target | Mandatory scope check before every deployment; skills refuse to proceed without verified scope entry |
| C2 session persists after engagement ends | Cleanup workflow is a required skill section; engagement teardown procedure documented |
| C2 container compromised or misused | Containers run in isolated Docker network; API access requires authentication |
| Lateral movement beyond authorized scope | Skills re-verify scope at each interaction step, not just initial deployment |
| C2 traffic detected by target defenses | Skills include OPSEC guidance (traffic profiling, jitter, encryption) per framework |
| BloodHound data from wrong engagement | BloodHound-MCP-AI queries scoped to engagement-specific Neo4j database |
| Accidental C2 infrastructure exposure | Listeners bind to internal Docker network by default; external exposure requires explicit configuration |
| Stale implants left on target systems | Post-engagement checklist includes implant removal verification with evidence |
