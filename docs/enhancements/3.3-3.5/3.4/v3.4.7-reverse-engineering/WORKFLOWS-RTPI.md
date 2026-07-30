# v3.4.7 Reverse Engineering — RTPI Workflows

**Context:** RTPI-Agent invoking nexus-harness reverse-engineering skills via MCP.

---

## Architecture

The reverse-engineering category introduces a layered MCP architecture: RTPI calls nexus-harness via MCP, and nexus-harness itself uses additional MCP servers (GhidraMCP, BinaryAnalysisMCPs, etc.) for AI-assisted binary analysis.

```
RTPI Frontend (GUI)
    |
    v
RTPI Server (Express API)
    |
    v (MCP client call)
nexus-harness (MCP server mode)
    |
    +---> reverse-engineering/ skills execute inside nexus-kali
    |         |
    |         +---> GhidraMCP (MCP server -- Ghidra analysis)
    |         +---> BinaryAnalysisMCPs (MCP server -- radare2/rizin)
    |         +---> x64dbgMCP (MCP server -- Windows debugger, optional)
    |         +---> mcp-windbg (MCP server -- WinDbg, optional)
    |
    v
Results -> /results/$ENGAGEMENT/reverse-engineering/
    |
    v (read by RTPI)
RTPI Frontend displays results
```

### MCP Server Chain

nexus-harness acts as both an MCP server (for RTPI) and an MCP client (for analysis MCP servers). The chain:

```
RTPI  --MCP-->  nexus-harness  --MCP-->  GhidraMCP (Ghidra plugin)
                               --MCP-->  BinaryAnalysisMCPs (radare2/rizin)
                               --MCP-->  x64dbgMCP (x64dbg, Windows only)
                               --MCP-->  mcp-windbg (WinDbg, Windows only)
```

The analysis MCP servers are configured in `.nexus/mcp.json` and managed by nexus-harness. RTPI does not interact with them directly.

---

## MCP Invocation Pattern

RTPI invokes nexus-harness skills via MCP tool calls. nexus-harness internally delegates to analysis MCP servers as needed.

### Example: Trigger Binary Analysis with Ghidra

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "reverse-engineering/ghidra-headless",
    "target": "/samples/malware_sample.exe",
    "engagement": "ENG-2026-070"
  }
}
```

### Example: Trigger Dynamic Analysis with Frida

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "reverse-engineering/frida-instrument",
    "target": "/samples/target_binary",
    "engagement": "ENG-2026-070",
    "options": {
      "script": "hook-crypto.js",
      "pid": 1234
    }
  }
}
```

### Example: Trigger Firmware Extraction

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "reverse-engineering/binwalk-extract",
    "target": "/samples/firmware.bin",
    "engagement": "ENG-2026-070"
  }
}
```

### Example: Trigger Exploit Research

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "reverse-engineering/searchsploit",
    "target": "Apache 2.4.49",
    "engagement": "ENG-2026-070"
  }
}
```

### Example: Trigger Cross-Architecture Emulation

```json
{
  "tool": "nexus_skill",
  "arguments": {
    "skill": "reverse-engineering/qemu-emulate",
    "target": "/samples/arm_binary",
    "engagement": "ENG-2026-070",
    "options": {
      "arch": "arm",
      "mode": "user"
    }
  }
}
```

---

## RTPI Integration Points

| RTPI Page | Action | nexus-harness Skill / MCP Server | Result Display |
|-----------|--------|----------------------------------|----------------|
| Intelligence -> OffSec R&D -> Tool Lab | Analyze binary (static) | `reverse-engineering/ghidra-headless` + GhidraMCP | Decompiled code viewer, function list |
| Intelligence -> OffSec R&D -> Tool Lab | Analyze binary (dynamic) | `reverse-engineering/frida-instrument` | Function trace viewer, hook output |
| Intelligence -> OffSec R&D -> Tool Lab | Extract firmware | `reverse-engineering/binwalk-extract` | Extracted file tree browser |
| Intelligence -> OffSec R&D -> Tool Lab | Search exploits | `reverse-engineering/searchsploit` | Exploit database results |
| Intelligence -> OffSec R&D -> Tool Lab | YARA scan sample | `reverse-engineering/yara-scan` | Classification results |
| Intelligence -> OffSec R&D -> Tool Lab | Emulate cross-arch binary | `reverse-engineering/qemu-emulate` | Emulation output, debug log |
| Intelligence -> Frameworks -> MITRE ATT&CK | Map RE findings to techniques | `reverse-engineering/*` skills | ATT&CK matrix overlay |
| Intelligence -> Reports | Include RE findings in report | `reporting/engagement-report` | Report builder |

---

## Credential Management

RTPI does not manage analysis tool credentials or configurations. All are configured inside nexus-kali:
- Ghidra: runs locally in nexus-kali; no external credentials needed
- frida: frida-server deployed on target device separately
- x64dbg / WinDbg: running on Windows target with MCP plugin; network access configured in `.nexus/mcp.json`
- QEMU: no credentials; firmware images mounted into container

RTPI's role is to trigger the skill and display results -- it never touches or stores tool configurations.

---

## .nexus/mcp.json Additions

The following entries will be added to `.nexus/mcp.json` for the reverse-engineering MCP servers:

```json
{
  "ghidra": {
    "command": "java",
    "args": ["-jar", "/opt/GhidraMCP/build/libs/GhidraMCP.jar"],
    "env": {
      "GHIDRA_INSTALL_DIR": "/opt/ghidra"
    }
  },
  "binary-analysis": {
    "command": "python3",
    "args": ["-m", "binary_analysis_mcps"],
    "env": {
      "R2_PATH": "/usr/bin/radare2"
    }
  },
  "x64dbg": {
    "command": "python3",
    "args": ["-m", "x64dbgmcp", "--host", "WINDOWS_TARGET_IP", "--port", "27042"],
    "disabled": true,
    "note": "Requires x64dbg running on Windows target with MCP plugin"
  },
  "windbg": {
    "command": "python3",
    "args": ["-m", "mcp_windbg", "--host", "WINDOWS_TARGET_IP"],
    "disabled": true,
    "note": "Requires WinDbg running on Windows target with MCP bridge"
  }
}
```

Note: `x64dbg` and `windbg` entries are `disabled: true` by default since they require a Windows target. Enable per-engagement when a Windows debugging target is available.
