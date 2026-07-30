# v3.4.9 C2 Operations — Internal Workflows

**Context:** Standalone nexus-kali usage via `nexus` CLI. No RTPI involved.

---

## Workflow 1: C3 Relay Operations

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `exploit-dev/c3-operations`
**C2 Container:** `rtpi-c3-agent`

```
1. Scope check -> verify target is in engagement scope
2. Container check -> verify rtpi-c3-agent is running and reachable
3. Connect to C3 management API on rtpi-c3-agent
4. Configure relay listener -> select channel type (e.g., Slack, MSSQL, LDAP, UNC)
5. Generate relay payload -> C3 relay binary for target architecture (x64/x86)
6. Deploy relay -> deliver payload to in-scope target via approved method
7. Verify relay callback -> confirm relay registered in C3 gateway
8. Interact with relay network -> issue commands through relay chain
9. Results -> /results/$ENGAGEMENT/exploit-dev/c2/c3/
10. Cleanup -> terminate relay sessions, remove relay binaries from target
11. Post-op verification -> confirm all relays deregistered and no residual artifacts
```

### Notes

- C3 uses relay networks, not direct implant connections. Each relay can chain to other relays, creating covert communication paths.
- Channel types determine how relays communicate (e.g., via Slack API, MSSQL stored procedures, LDAP attributes). Channel selection should match target environment.
- Relay payloads are Windows-specific (.exe or .dll). Linux targets require a different C2 framework.
- All relay activity is logged by the C3 gateway. Export logs to results directory before cleanup.

---

## Workflow 2: Adaptix Engagement

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `exploit-dev/adaptix-operations`
**C2 Container:** `rtpi-adaptix-agent`

```
1. Scope check -> verify target is in engagement scope
2. Container check -> verify rtpi-adaptix-agent is running and reachable
3. Connect to Adaptix web management interface on rtpi-adaptix-agent
4. Authenticate to Adaptix console via API credentials
5. Create listener -> configure listener type, port, and protocol
6. Generate payload -> Adaptix agent binary for target OS and architecture
7. Deploy payload -> deliver agent to in-scope target via approved method
8. Verify callback -> confirm agent registered in Adaptix console
9. Interact via Adaptix console -> execute tasks, run modules, collect output
10. Results -> /results/$ENGAGEMENT/exploit-dev/c2/adaptix/
11. Cleanup -> terminate agent sessions, remove listener, delete agent binaries from target
12. Post-op verification -> confirm all sessions closed and listener removed
```

### Notes

- AdaptixC2 is Go-based with a web management UI. The skill interacts via the Adaptix REST API, not the web UI.
- Adaptix supports multiple listener types and agent formats. Select based on target environment and OPSEC requirements.
- The web management interface runs on a configurable port within the rtpi-adaptix-agent container. Default credentials must be changed per engagement.
- Agent communication supports configurable jitter and sleep intervals for OPSEC.
- Export all session logs and task output to results directory before cleanup.

---

## Workflow 3: Loki Implant Deployment

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `exploit-dev/loki-operations`
**C2 Container:** `rtpi-loki-agent`

```
1. Scope check -> verify target is in engagement scope
2. Container check -> verify rtpi-loki-agent is running and reachable
3. Connect to Loki management interface on rtpi-loki-agent
4. Configure Loki listener -> set bind address, port, and communication protocol
5. Generate lightweight implant -> compile Loki implant for target architecture
6. Deploy implant -> deliver to in-scope target via approved method
7. Verify callback -> confirm implant registered with Loki listener
8. Interact with implant -> execute commands, download/upload files, pivot
9. Results -> /results/$ENGAGEMENT/exploit-dev/c2/loki/
10. Cleanup -> terminate implant sessions, stop listener, remove implant from target
11. Post-op verification -> confirm all implants disconnected and no residual processes
```

### Notes

- Loki is a lightweight C-based implant framework. Implants have a minimal footprint, making them suitable for stealthy operations.
- Loki implants are compiled from C source. The build environment runs inside the rtpi-loki-agent container, not nexus-kali.
- Due to the lightweight nature, Loki implants may lack advanced features found in larger frameworks. Use for scenarios requiring minimal detection surface.
- Implant communication is direct (no relay chaining like C3). Plan network routing accordingly.
- Export all interaction logs and command output to results directory before cleanup.

---

## Common Operational Safety Rules (All Workflows)

1. **Scope is mandatory.** No C2 operation proceeds without a verified scope entry for the target. Re-verify scope if pivoting to new hosts.
2. **Confirmation required.** Payload deployment to any target requires explicit operator confirmation.
3. **Cleanup is not optional.** Every workflow ends with cleanup and post-op verification. Engagement cannot close with active implants.
4. **Log everything.** All C2 interactions, commands issued, and output received must be captured in `/results/$ENGAGEMENT/exploit-dev/c2/`.
5. **One engagement per listener.** Do not reuse C2 listeners across engagements. Create fresh listeners per engagement and tear down after.
