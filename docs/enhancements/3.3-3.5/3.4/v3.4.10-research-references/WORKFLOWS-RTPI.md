# v3.4.10 Research References — RTPI Workflows

**Context:** RTPI-Agent invoking nexus-harness exploit-dev skills via MCP.

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
exploit-dev/ skills execute inside nexus-kali
    |
    v
Results -> /results/$ENGAGEMENT/exploit-dev/
    |
    v (read by RTPI)
RTPI Frontend displays results
```

---

## MCP Invocation Pattern

### Example: searchsploit-lookup

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "exploit-dev/searchsploit-lookup",
    "query": "apache 2.4.49",
    "engagement": "ENG-2026-078"
  }
}
```

**Response:**

```json
{
  "status": "success",
  "results": [
    {
      "edb_id": "50383",
      "title": "Apache HTTP Server 2.4.49 - Path Traversal & RCE",
      "platform": "Multiple",
      "type": "webapps",
      "date_published": "2021-10-05",
      "path": "/opt/exploitdb/exploits/multiple/webapps/50383.py"
    },
    {
      "edb_id": "50406",
      "title": "Apache HTTP Server 2.4.50 - Path Traversal & RCE",
      "platform": "Linux",
      "type": "webapps",
      "date_published": "2021-10-07",
      "path": "/opt/exploitdb/exploits/linux/webapps/50406.sh"
    }
  ],
  "output_dir": "/results/ENG-2026-078/exploit-dev/exploits/"
}
```

### Example: payload-reference

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "exploit-dev/payload-reference",
    "category": "SQL Injection",
    "technology": "MySQL",
    "engagement": "ENG-2026-078"
  }
}
```

**Response:**

```json
{
  "status": "success",
  "category": "SQL Injection",
  "technology": "MySQL",
  "payloads": [
    {
      "name": "Union-based extraction",
      "payload": "' UNION SELECT 1,2,3,table_name FROM information_schema.tables--",
      "context": "Requires known column count; adjust UNION columns to match"
    },
    {
      "name": "Error-based extraction",
      "payload": "' AND extractvalue(1,concat(0x7e,(SELECT version())))--",
      "context": "Works when error messages are reflected in response"
    }
  ],
  "reference_path": "PayloadsAllTheThings/SQL Injection/MySQL Injection.md"
}
```

### Example: aflplusplus-fuzz (start campaign)

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "exploit-dev/aflplusplus-fuzz",
    "action": "fuzz",
    "binary": "/targets/pdfparser/pdfparser",
    "corpus": "/targets/pdfparser/samples/",
    "duration": "24h",
    "engagement": "ENG-2026-078"
  }
}
```

**Response:**

```json
{
  "status": "running",
  "campaign_id": "afl-ENG-2026-078-001",
  "estimated_completion": "2026-07-31T14:00:00Z",
  "monitor_endpoint": "/results/ENG-2026-078/exploit-dev/fuzzing/stats/",
  "message": "Fuzzing campaign started. Use action 'status' to poll progress."
}
```

### Example: aflplusplus-fuzz (check status)

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "exploit-dev/aflplusplus-fuzz",
    "action": "status",
    "engagement": "ENG-2026-078"
  }
}
```

**Response:**

```json
{
  "status": "running",
  "campaign_id": "afl-ENG-2026-078-001",
  "runtime": "6h 14m",
  "execs_per_sec": 1382,
  "total_paths": 1047,
  "unique_crashes": 5,
  "unique_hangs": 1,
  "coverage_bitmap": "34.2%",
  "estimated_remaining": "17h 46m"
}
```

---

## RTPI Integration Points

| RTPI Page | Action | nexus-harness Skill | Result Display |
|-----------|--------|---------------------|----------------|
| Exploit Research | Search ExploitDB by CVE or keyword | `exploit-dev/searchsploit-lookup` | Table of matching exploits with EDB-ID, title, platform, and date |
| Exploit Research | View exploit source | `exploit-dev/searchsploit-lookup` (with `--examine` flag) | Syntax-highlighted exploit source code |
| Exploit Research | Copy exploit to engagement | `exploit-dev/searchsploit-lookup` (with `--copy` flag) | Confirmation with file path in results directory |
| Payload Library | Browse payload categories | `exploit-dev/payload-reference` | Category tree with technique descriptions |
| Payload Library | Search payloads by technique and technology | `exploit-dev/payload-reference` | Payload list with context notes and usage instructions |
| Payload Library | Select payload for delivery | `exploit-dev/payload-reference` -> `exploit-dev/payload-delivery` | Payload staged for delivery via downstream skill |
| Fuzzing | Instrument target binary | `exploit-dev/aflplusplus-fuzz` (action: `instrument`) | Instrumented binary confirmation and path |
| Fuzzing | Start fuzzing campaign | `exploit-dev/aflplusplus-fuzz` (action: `fuzz`) | Campaign started confirmation with estimated duration |
| Fuzzing | Monitor campaign progress | `exploit-dev/aflplusplus-fuzz` (action: `status`) | Live stats dashboard (execs/sec, paths, crashes, coverage) |
| Fuzzing | Stop campaign | `exploit-dev/aflplusplus-fuzz` (action: `stop`) | Campaign stopped, partial results preserved |
| Fuzzing | Triage crashes | `exploit-dev/aflplusplus-fuzz` (action: `triage`) | Deduplicated crash list with type, location, and minimized inputs |

---

## Long-Running Campaign Handling

AFL++ fuzzing campaigns are fundamentally different from most nexus-harness skill invocations because they run for hours or days rather than completing in seconds.

### RTPI Considerations

1. **Asynchronous execution:** The `fuzz` action returns immediately with a `campaign_id` and `"status": "running"`. RTPI must not block the UI waiting for campaign completion.

2. **Polling for progress:** RTPI should poll the `status` action at a configurable interval (recommended: every 60 seconds) to update the fuzzing dashboard with current statistics.

3. **Progress display:** The RTPI Fuzzing page should display:
   - Campaign runtime and estimated time remaining
   - Executions per second (performance indicator)
   - Total paths discovered (coverage growth)
   - Unique crashes and hangs (findings count)
   - Coverage bitmap percentage (overall progress metric)

4. **Campaign lifecycle:** RTPI should provide controls for:
   - Starting a new campaign (with binary, corpus, and duration parameters)
   - Stopping a running campaign early
   - Viewing completed campaign results
   - Triggering crash triage on completed campaigns

5. **Resource awareness:** RTPI should display resource usage warnings when a fuzzing campaign is active, as AFL++ consumes significant CPU and memory within the nexus-kali container.

6. **Result persistence:** Fuzzing results persist in `/results/$ENGAGEMENT/exploit-dev/fuzzing/` and remain accessible after the campaign ends. RTPI can display historical campaign results without re-running the skill.
