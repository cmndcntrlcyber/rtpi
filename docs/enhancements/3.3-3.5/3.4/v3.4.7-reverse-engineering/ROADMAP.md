# v3.4.7 — Reverse Engineering Skills + MCP Servers

**Priority:** P3
**Status:** Dockerfile Updated, Skills Pending
**Skill Category:** `skills/offense/reverse-engineering/` (new) + MCP server additions to `.nexus/mcp.json`
**Tools:** 20 + 4 MCP servers
**Parent:** [v3.4 Tool Catalogue](../v3.4.md)

---

## Objective

Create a new `reverse-engineering/` skill category in nexus-harness covering binary analysis, dynamic instrumentation, firmware extraction, exploit research, cross-architecture emulation, and fuzzing. Additionally, add 4 MCP servers (GhidraMCP, BinaryAnalysisMCPs, x64dbgMCP, mcp-windbg) to `.nexus/mcp.json` for AI-assisted reverse engineering via the MCP protocol. All skills operate standalone inside nexus-kali -- independent of RTPI.

---

## MCP Server Inventory

| # | MCP Server | Purpose | Install Method | mcp.json Key |
|---|------------|---------|----------------|--------------|
| 1 | GhidraMCP | Ghidra reverse engineering via MCP (decompile, analyze, rename, retype) | git clone LaurieWired/GhidraMCP + Ghidra plugin | `ghidra` |
| 2 | BinaryAnalysisMCPs | Multiple binary analysis MCP integrations (radare2, rizin, Binary Ninja) | git clone ant4g0nist/BinaryAnalysisMCPs + pip | `binary-analysis` |
| 3 | x64dbgMCP | x64dbg debugger control via MCP (breakpoints, step, memory read/write) | git clone mrexodia/x64dbgMCP + x64dbg plugin | `x64dbg` |
| 4 | mcp-windbg | WinDbg debugger control via MCP (kernel/user-mode debugging) | git clone psolyca/mcp-windbg + pip | `windbg` |

---

## Tool Inventory

| # | Tool | Purpose | Install Method | Skill Name |
|---|------|---------|----------------|------------|
| 5 | Ghidra headless | NSA reverse engineering suite (headless analysis mode) | binary download (v11.2.1, ghidra-sre.org) | `reverse-engineering/ghidra-headless` |
| 6 | angr | Symbolic execution and binary analysis framework | pip install angr | `reverse-engineering/angr-symbolic` |
| 7 | frida / frida-tools | Dynamic instrumentation toolkit (hook, trace, modify) | pip install frida frida-tools | `reverse-engineering/frida-instrument` |
| 8 | yara-python | YARA rule matching for malware classification | pip install yara-python | `reverse-engineering/yara-scan` |
| 9 | unicorn | Lightweight CPU emulator (ARM, x86, MIPS, etc.) | pip install unicorn | `reverse-engineering/unicorn-emulate` |
| 10 | pefile | Windows PE file parser and analyzer | pip install pefile | `reverse-engineering/pefile-analyze` |
| 11 | lief | Cross-platform binary format parser (PE, ELF, Mach-O) | pip install lief | `reverse-engineering/lief-parse` |
| 12 | binwalk | Firmware extraction and binary analysis | apt install binwalk | `reverse-engineering/binwalk-extract` |
| 13 | scapy | Packet crafting, sniffing, and protocol analysis | pip install scapy | `reverse-engineering/scapy-packets` |
| 14 | qemu-user-static / qemu-system-arm / qemu-system-mips | Cross-architecture emulation (ARM, MIPS, etc.) | apt install qemu-user-static qemu-system-arm qemu-system-mips | `reverse-engineering/qemu-emulate` |
| 15 | wireshark / tshark | Network capture analysis and protocol dissection | apt install wireshark tshark | `reverse-engineering/tshark-analyze` |
| 16 | exploitdb / searchsploit | Exploit database search and reference | git clone gitlab.com/exploit-database/exploitdb | `reverse-engineering/searchsploit` |
| 17 | PayloadsAllTheThings | Payload reference and cheat sheets | git clone swisskyrepo/PayloadsAllTheThings | `reverse-engineering/payloads-ref` |
| 18 | oss-fuzz-gen | Google OSS-Fuzz harness generator (LLM-assisted) | git clone google/oss-fuzz-gen + pip | `reverse-engineering/oss-fuzz-gen` |
| 19 | winafl | Windows AFL-based coverage-guided fuzzer | git clone googleprojectzero/winafl (compile) | `reverse-engineering/winafl-fuzz` |
| 20 | Jackalope | Coverage-guided binary fuzzer (Windows/macOS) | git clone googleprojectzero/Jackalope (compile) | `reverse-engineering/jackalope-fuzz` |

### Maldev Container Extras (from nexus-kali maldev profile)
- jaegis-RAVERSE, ACEshark, and related malware development tools
- These are available in the maldev container variant, not the base nexus-kali image

---

## Skill Structure

Each skill follows the nexus-harness offense skill pattern:

```
skills/offense/reverse-engineering/<skill-name>/
  SKILL.md          # YAML frontmatter + workflow sections
```

Standard sections per SKILL.md:
1. Scope Check (verify binary/firmware/target is authorized for analysis)
2. Quick Workflow (common one-liner usage)
3. Technique Sections (detailed usage patterns)
4. Output Handling (results -> `/results/$ENGAGEMENT/reverse-engineering/`)
5. Pitfalls (memory requirements, architecture mismatches, AV interference)
6. Verification (confirm tool ran, output is valid)

---

## Acceptance Criteria

- [ ] 20 SKILL.md files created under `skills/offense/reverse-engineering/`
- [ ] 4 MCP server entries added to `.nexus/mcp.json`
- [ ] Each skill works standalone via `nexus` CLI inside nexus-kali
- [x] All tools installed in nexus-kali image (`docker/Dockerfile` updated 2026-07-30 — ghidra, frida, yara, binwalk, scapy, qemu-user-static, wireshark/tshark, searchsploit via kali-linux-everything; angr, unicorn, pefile, lief via pip; PayloadsAllTheThings, oss-fuzz-gen, GhidraMCP via git clone)
- [ ] Results output to `/results/$ENGAGEMENT/reverse-engineering/<tool>/`
- [ ] MCP server connectivity tests pass (GhidraMCP, BinaryAnalysisMCPs respond to MCP handshake)
- [ ] Ghidra headless mode verified working without GUI (analyzeHeadless script)
- [ ] Cross-architecture emulation tested: ARM and MIPS binaries run under qemu-user-static
- [ ] frida attaches to target processes inside nexus-kali container
- [ ] Skills reference MITRE ATT&CK techniques where applicable (Execution TA0002, Defense Evasion TA0005, Discovery TA0007)
- [ ] x64dbg and WinDbg MCP servers documented as Windows-only (require Windows target or VM)

---

## Nexus-Kali Image Requirements

### pip (single layer)
```
angr frida frida-tools yara-python unicorn pefile lief scapy oss-fuzz-gen
```

### apt
```
binwalk qemu-user-static qemu-system-arm qemu-system-mips wireshark tshark openjdk-17-jdk
```

### Binary downloads
```
Ghidra 11.2.1 (ghidra-sre.org, requires JDK 17+)
```

### git clone (all into /opt/)
```
LaurieWired/GhidraMCP
ant4g0nist/BinaryAnalysisMCPs
mrexodia/x64dbgMCP
psolyca/mcp-windbg
gitlab.com/exploit-database/exploitdb
swisskyrepo/PayloadsAllTheThings
google/oss-fuzz-gen
googleprojectzero/winafl
googleprojectzero/Jackalope
```

### Compile from source (build stage)
```
winafl (cmake + Visual Studio or MinGW cross-compile)
Jackalope (cmake)
```

### MCP server runtime requirements
```
GhidraMCP: Ghidra running with GhidraMCP plugin loaded (Java process)
BinaryAnalysisMCPs: Python process, radare2/rizin installed
x64dbgMCP: x64dbg running on Windows target with MCP plugin
mcp-windbg: WinDbg running on Windows target with MCP bridge
```

### Runtime Prerequisites (not baked into image)
- Target binaries/firmware for analysis (mounted or copied into container)
- Windows VM or host (for x64dbg and WinDbg MCP servers)
- Sufficient RAM for angr symbolic execution (recommend 8GB+ for complex binaries)
- frida-server on target device (for remote instrumentation)

---

## Dependencies

- No existing `reverse-engineering/` skills -- this is a new category
- Ghidra MCP server depends on Ghidra being installed and running
- BinaryAnalysisMCPs depends on radare2 (already in nexus-kali base image)
- x64dbgMCP and mcp-windbg require Windows -- document as optional/conditional
- scapy overlaps with existing `recon/` packet-related workflows -- cross-reference
- exploitdb/searchsploit complements existing vulnerability research workflows
- PayloadsAllTheThings is a reference resource, not an executable tool -- skill provides search/lookup interface

---

## Risks

| Risk | Mitigation |
|------|------------|
| Ghidra headless memory consumption | Document JVM heap settings (-Xmx); recommend 4GB+ per analysis |
| angr path explosion on complex binaries | Skills include timeout and constraint guidance; document when to use concrete vs. symbolic |
| frida detection by anti-tampering | Document OPSEC considerations; note frida-gadget injection as alternative |
| QEMU performance for system emulation | Prefer qemu-user-static for userland binaries; system emulation only when needed |
| winafl/Jackalope Windows-only compilation | Cross-compile in Docker or document Windows build requirements |
| MCP server protocol version drift | Pin MCP server versions; test against nexus-harness MCP protocol version |
| x64dbg/WinDbg MCP require Windows host | Clearly document as optional; provide alternative Linux-native debugging workflows |
| Large image size (Ghidra + QEMU + tools) | Layer optimization; consider separate reverse-engineering image variant |
