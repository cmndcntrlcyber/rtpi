# Tool Validation Troubleshooting Report

**Date**: 2026-02-17
**Scope**: All 62 tools in the Tool Registry
**Result**: 35 validated, 27 failing

---

## Validation Lifecycle

Every tool in the registry progresses through this status sequence:

```
discovered  -->  untested  -->  tested  -->  validated
    |                |             |
    |                |             +--> (tests ran, issues found)
    |                +--> (registered, awaiting first test run)
    +--> (binary located by discovery scan)
```

| Status | Meaning | Color |
|--------|---------|-------|
| **discovered** | Binary located in container by discovery scan | blue |
| **untested** | Registered in DB but no validation tests executed yet | yellow |
| **tested** | Validation ran but one or more tests failed | orange |
| **validated** | All tests passed (help command, exit code, output verified) | green |

---

## Root Cause Summary

| Category | Count | Root Cause |
|----------|-------|------------|
| OCI runtime error in binaryPath | 7 | Discovery stored error message as path |
| Binary not at registered path | 8 | Tool not installed or path changed |
| Wrong binary path in DB | 3 | Tool exists but at different location |
| Container restarting | 3 | Container crash loop prevents exec |
| Dependency / runtime issue | 2 | Missing Python package or wrong httpx variant |
| Stale validation (tool works) | 3 | Tests ran before Docker exec fix was applied |
| Missing TOOL_HELP_CONFIG entry | 1 | No help config for `az` CLI |

---

## Category 1: OCI Runtime Error in binaryPath

**Root cause**: The tool discovery service ran `which <tool>` inside agent containers, but the exec used `/home/rtpi-tools` as the working directory. Agent containers use `/home/rtpi-agent` instead. The OCI error message was captured and stored as the `binaryPath` field.

**Error string**: `OCI runtime exec failed: exec failed: unable to start container process: chdir to cwd ("/home/rtpi-tools") set in config.json failed: no such file or directory`

| Tool | Container | Status | Resolution |
|------|-----------|--------|------------|
| crackmapexec | rtpi-empire-agent | discovered | Superseded by NetExec (nxc); remove or remap |
| impacket-smbexec | rtpi-empire-agent | discovered | Re-run discovery with correct workDir |
| joomscan | rtpi-framework-agent | discovered | Re-run discovery with correct workDir |
| ps-empire | rtpi-empire-agent | discovered | C2 framework server, not a CLI tool; skip validation |
| r2 | rtpi-maldev-agent | discovered | Re-run discovery with correct workDir |
| radare2 | rtpi-maldev-agent | discovered | Re-run discovery with correct workDir |
| wafw00f | rtpi-framework-agent | discovered | Re-run discovery with correct workDir |

**Fix**: Update `tool-connector-agent.ts` discovery to specify `workDir: '/tmp'` or `/home/rtpi-agent` when running `which` in agent containers.

---

## Category 2: Binary Not at Registered Path

**Root cause**: The `binaryPath` in the database points to a location that does not exist in the container. The tool may have been in a previous container image, or was never installed in that container.

| Tool | Container | DB Path | Exists? | Resolution |
|------|-----------|---------|---------|------------|
| amass | rtpi-framework-agent | /usr/bin/amass | No | Not installed; add to Dockerfile |
| subfinder | rtpi-framework-agent | /usr/bin/subfinder | No | Not installed; add to Dockerfile |
| dnsx | rtpi-framework-agent | /usr/bin/dnsx | No | Not installed; add to Dockerfile |
| katana | rtpi-framework-agent | /usr/bin/katana | No | Not installed; add to Dockerfile |
| nxc | rtpi-empire-agent | /usr/bin/nxc | No | Python source at /opt/tools/NetExec/; needs `pip install .` to create binary |
| dalfox | rtpi-burp-agent | /usr/bin/dalfox | No | Go source at /opt/tools/dalfox/; needs `go build` to create binary |
| impacket-secretsdump | rtpi-empire-agent | /usr/bin/impacket-secretsdump | No | Impacket 0.13.0 installed as lib, scripts not in PATH |
| impacket-psexec | rtpi-empire-agent | /usr/bin/impacket-psexec | No | Same as above |
| testssl.sh | rtpi-research-agent | /usr/bin/testssl.sh | No | Not installed; only axiom module ref found |

**Fix**: Either install these tools in the correct containers or update their `installStatus` to `'failed'` and `validationStatus` to `'untested'`.

---

## Category 3: Wrong Binary Path in DB

**Root cause**: The tool IS installed in the container, but at a different path than what's recorded in the `binaryPath` field.

| Tool | Container | DB Path (wrong) | Actual Path | Resolution |
|------|-----------|----------------|-------------|------------|
| freeze | rtpi-empire-agent | /usr/bin/freeze | /opt/tools/Freeze/freeze | Update binaryPath |
| scarecrow | rtpi-empire-agent | /usr/bin/scarecrow | /opt/tools/ScareCrow/scarecrow | Update binaryPath |
| nikto | rtpi-research-agent | /usr/bin/nikto | /opt/tools/nikto/program/nikto.pl | Update binaryPath; needs `perl` prefix |

**Fix**: Update `binaryPath` in the database to the correct path. For nikto, the command is `perl /opt/tools/nikto/program/nikto.pl`.

---

## Category 4: Container Restarting

**Root cause**: The Docker container is in a crash-restart loop, so `dockerExecutor.exec()` fails.

| Tool | Container | Container Status | Resolution |
|------|-----------|-----------------|------------|
| feroxbuster | rtpi-fuzzing-agent | Restarting (0) | Fix container health; feroxbuster at /home/rtpi-agent/.cargo/bin/feroxbuster |
| dalfox | rtpi-burp-agent | Restarting (0) | Fix container health; dalfox at /usr/bin/dalfox |
| zmap | rtpi-fuzzing-agent | Restarting (0) | Same container as feroxbuster |

**Fix**: Investigate and fix the container crash loop. Once stable, re-run validation.

---

## Category 5: Dependency / Runtime Issue

**Root cause**: The binary exists but fails to run due to missing dependencies or wrong variant.

| Tool | Container | Issue | Resolution |
|------|-----------|-------|------------|
| httpx | rtpi-research-agent | Python httpx CLI, not Go ProjectDiscovery httpx. Outputs: "Make sure you've installed everything with: pip install 'httpx[cli]'" | Install Go httpx or run `pip install 'httpx[cli]'` |
| evil-winrm | rtpi-empire-agent | Ruby gem wrapper at /usr/local/bin/evil-winrm. Runs with exit 0 but produces no visible help output on `-h` | May output to stderr; verify with `evil-winrm --help 2>&1`; add verify string for Ruby banner |

---

## Category 6: Stale Validation (Tool Actually Works)

**Root cause**: These tools pass the help command test correctly, but their `validationStatus` is still `'failed'` from validation runs that happened before the tool-tester was fixed to use Docker exec. Re-running validation will fix them.

| Tool | Container | Help Command | Exit Code | Output Verified | Resolution |
|------|-----------|-------------|-----------|-----------------|------------|
| searchsploit | rtpi-research-agent | `searchsploit -h` | 2 (correct) | "Usage: searchsploit" | Re-validate |
| masscan | rtpi-research-agent | `masscan --help` | 0 | "MASSCAN is a fast port scanner" | Re-validate |
| whatweb | rtpi-framework-agent | `whatweb --help` | 0 | ASCII art banner | Re-validate; add to TOOL_HELP_CONFIG |

---

## Category 7: Missing TOOL_HELP_CONFIG Entry

**Root cause**: The tool's `toolId` is not in the `TOOL_HELP_CONFIG` map in `tool-tester.ts`, so it falls back to `DEFAULT_HELP_CONFIG` (`--help`, exit codes `[0, 1]`, verify string `''`). This may fail if the tool uses a different help flag or exit code.

| Tool | Container | Default Used | Issue | Resolution |
|------|-----------|-------------|-------|------------|
| az | rtpi-azure-ad-agent | `--help` / [0,1] / '' | Works with `--help`, exit 0, outputs "Group\n az" | Add to TOOL_HELP_CONFIG with verifyString: 'az' |
| whatweb | rtpi-framework-agent | `--help` / [0,1] / '' | Works but needs specific verifyString | Add `whatweb: { helpFlag: '--help', exitCodes: [0], verifyString: 'WhatWeb' }` |
| freeze | rtpi-empire-agent | `--help` / [0,1] / '' | Path wrong (see Category 3) | Fix path first, then add TOOL_HELP_CONFIG entry |
| scarecrow | rtpi-empire-agent | `--help` / [0,1] / '' | Path wrong (see Category 3) | Fix path first, then add TOOL_HELP_CONFIG entry |

---

## Complete Tool Inventory

### Validated (35 tools)

| Tool | Container | Binary Path |
|------|-----------|-------------|
| bbot | rtpi-tools | /usr/local/bin/bbot |
| bloodhound-python | rtpi-azure-ad-agent | /usr/local/bin/bloodhound-python |
| checksec | rtpi-maldev-agent | /usr/local/bin/checksec |
| cmsmap | rtpi-framework-agent | /usr/local/bin/cmsmap |
| dirsearch | rtpi-research-agent | /usr/local/bin/dirsearch |
| droopescan | rtpi-framework-agent | /usr/local/bin/droopescan |
| enum4linux | rtpi-azure-ad-agent | /usr/local/bin/enum4linux |
| ffuf | rtpi-fuzzing-agent | /opt/tools/bin/ffuf |
| file | rtpi-maldev-agent | /usr/bin/file |
| gau | rtpi-burp-agent | /opt/tools/bin/gau |
| gobuster | rtpi-tools | /usr/local/bin/gobuster |
| gospider | rtpi-burp-agent | /opt/tools/bin/gospider |
| grype | rtpi-framework-agent | /opt/tools/bin/grype |
| hakrawler | rtpi-burp-agent | /opt/tools/bin/hakrawler |
| kerbrute | rtpi-azure-ad-agent | /home/rtpi-agent/go/bin/kerbrute |
| ldapsearch | rtpi-azure-ad-agent | /usr/bin/ldapsearch |
| mitmproxy | rtpi-burp-agent | /usr/local/bin/mitmproxy |
| msfconsole | rtpi-tools | /usr/bin/msfconsole |
| nm | rtpi-maldev-agent | /usr/bin/nm |
| nmap | rtpi-research-agent | /usr/bin/nmap |
| nuclei | rtpi-tools | /usr/local/bin/nuclei |
| objdump | rtpi-maldev-agent | /usr/bin/objdump |
| proxychains | rtpi-burp-agent | /usr/bin/proxychains |
| qsreplace | rtpi-burp-agent | /opt/tools/bin/qsreplace |
| readelf | rtpi-maldev-agent | /usr/bin/readelf |
| roadrecon | rtpi-azure-ad-agent | /usr/local/bin/roadrecon |
| rpcclient | rtpi-azure-ad-agent | /usr/bin/rpcclient |
| smbclient | rtpi-azure-ad-agent | /usr/bin/smbclient |
| strings | rtpi-maldev-agent | /usr/bin/strings |
| trivy | rtpi-framework-agent | /opt/tools/bin/trivy |
| unfurl | rtpi-burp-agent | /opt/tools/bin/unfurl |
| waybackurls | rtpi-burp-agent | /opt/tools/bin/waybackurls |
| wfuzz | rtpi-fuzzing-agent | /usr/local/bin/wfuzz |
| wpscan | rtpi-framework-agent | /usr/local/bin/wpscan |
| x8 | rtpi-fuzzing-agent | /opt/tools/bin/x8 |

### Failed (27 tools)

| # | Tool | Container | Root Cause | Category |
|---|------|-----------|------------|----------|
| 1 | amass | rtpi-framework-agent | Binary not installed | 2 |
| 2 | az | rtpi-azure-ad-agent | Missing TOOL_HELP_CONFIG entry | 7 |
| 3 | crackmapexec | rtpi-empire-agent | OCI error in binaryPath | 1 |
| 4 | dalfox | rtpi-burp-agent | Container restarting | 4 |
| 5 | dnsx | rtpi-framework-agent | Binary not installed | 2 |
| 6 | evil-winrm | rtpi-empire-agent | Ruby gem, no stdout on -h | 5 |
| 7 | feroxbuster | rtpi-fuzzing-agent | Container restarting | 4 |
| 8 | freeze | rtpi-empire-agent | Wrong path; actual: /opt/tools/Freeze/freeze | 3 |
| 9 | httpx | rtpi-research-agent | Python httpx, not Go httpx | 5 |
| 10 | impacket-psexec | rtpi-empire-agent | Scripts not in PATH | 2 |
| 11 | impacket-secretsdump | rtpi-empire-agent | Scripts not in PATH | 2 |
| 12 | impacket-smbexec | rtpi-empire-agent | OCI error in binaryPath | 1 |
| 13 | joomscan | rtpi-framework-agent | OCI error in binaryPath | 1 |
| 14 | katana | rtpi-framework-agent | Binary not installed | 2 |
| 15 | masscan | rtpi-research-agent | Stale validation (works) | 6 |
| 16 | nikto | rtpi-research-agent | Wrong path; actual: /opt/tools/nikto/program/nikto.pl | 3 |
| 17 | nxc | rtpi-empire-agent | Source exists but no binary in PATH | 2 |
| 18 | ps-empire | rtpi-empire-agent | OCI error; C2 server, not CLI | 1 |
| 19 | r2 | rtpi-maldev-agent | OCI error in binaryPath | 1 |
| 20 | radare2 | rtpi-maldev-agent | OCI error in binaryPath | 1 |
| 21 | scarecrow | rtpi-empire-agent | Wrong path; actual: /opt/tools/ScareCrow/scarecrow | 3 |
| 22 | searchsploit | rtpi-research-agent | Stale validation (works) | 6 |
| 23 | subfinder | rtpi-framework-agent | Binary not installed | 2 |
| 24 | testssl.sh | rtpi-research-agent | Binary not installed | 2 |
| 25 | wafw00f | rtpi-framework-agent | OCI error in binaryPath | 1 |
| 26 | whatweb | rtpi-framework-agent | Stale validation; missing TOOL_HELP_CONFIG | 6+7 |
| 27 | zmap | rtpi-fuzzing-agent | Container restarting | 4 |

---

## Recommended Actions

### Immediate (no container changes needed)

1. ~~**Re-validate stale tools** (searchsploit, masscan, whatweb) via `POST /api/v1/tools/registry/:id/test`~~ — Pending: run `POST /api/v1/tools/registry/:id/test` for each
2. ~~**Fix wrong binaryPaths** in DB for freeze, scarecrow, nikto~~ — **DONE**: Added to `/registry/cleanup` endpoint `KNOWN_PATHS` map
3. ~~**Add missing TOOL_HELP_CONFIG entries** for az, whatweb, freeze, scarecrow~~ — **DONE**: Added entries for az, whatweb, freeze, scarecrow, dalfox, zmap, wafw00f, joomscan, r2, radare2
4. ~~**Clean OCI error binaryPaths** via the `/registry/cleanup` endpoint~~ — **DONE**: Endpoint now detects and clears/corrects OCI error binaryPaths

### Short-term (container fixes needed)

5. **Fix rtpi-fuzzing-agent crash loop** to unblock feroxbuster, zmap
6. **Fix rtpi-burp-agent crash loop** to unblock dalfox
7. **Install ProjectDiscovery tools** in rtpi-framework-agent: amass, subfinder, dnsx, katana
8. **Fix impacket PATH** in rtpi-empire-agent so scripts are in `/usr/local/bin/`
9. **Install nxc binary** in rtpi-empire-agent (pip install netexec or create wrapper script)

### Medium-term (architecture) — COMPLETED

10. ~~**Fix discovery service workDir**~~ — **DONE**: docker-executor.ts defaults to `WorkingDir: '/tmp'`
11. ~~**Update validation status lifecycle**~~ — **DONE**: schema, types, tool-registry-manager, tool-tester, tool-connector-agent, ToolRegistry.tsx all updated to discovered/untested/tested/validated
12. ~~**Add container health pre-check**~~ — **DONE**: docker-executor.ts checks `containerInfo.State.Running` before exec; tool-tester catches and reports "container not running"

---

## Code Changes Applied

| File | Change |
|------|--------|
| `server/api/v1/tools.ts` | Enhanced `/registry/cleanup` to fix OCI binaryPaths, wrong paths (KNOWN_PATHS), and set baseCommand overrides (nikto → `perl ...`) |
| `server/api/v1/tools.ts` | Execute-docker splits baseCommand on spaces for interpreter prefixes |
| `server/services/tool-tester.ts` | Added TOOL_HELP_CONFIG for: az, whatweb, freeze, scarecrow, dalfox, zmap, wafw00f, joomscan, r2, radare2 |
| `server/services/tool-tester.ts` | `runAllTests()` uses `config.baseCommand` when available (nikto perl prefix) |
| `server/services/tool-tester.ts` | `testSyntax()` splits binaryPath on spaces for interpreter prefixes |
| `server/services/tool-tester.ts` | `quickHealthCheck()` uses `config.baseCommand` when available |
