# v3.4.7 Reverse Engineering — Internal Workflows

**Context:** Standalone nexus-kali usage via `nexus` CLI. No RTPI involved.

---

## Workflow 1: Binary Analysis with Ghidra MCP

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `reverse-engineering/ghidra-headless`, `reverse-engineering/lief-parse`, `reverse-engineering/pefile-analyze`, `reverse-engineering/yara-scan`
**MCP servers:** `ghidra` (GhidraMCP)

```
1. Scope check -> verify binary is authorized for analysis
2. lief-parse: identify binary format (PE/ELF/Mach-O), extract headers, sections, imports/exports
3. pefile-analyze (if PE): detailed PE analysis -- imports, resources, overlay, authenticode
4. yara-scan: run YARA rules against binary for malware family classification
5. Ghidra headless: analyzeHeadless -> auto-analyze binary (disassemble, decompile, identify functions)
6. GhidraMCP: interact with Ghidra analysis via MCP
   - List functions, read decompiled code
   - Rename functions and variables based on analysis
   - Set data types on function parameters
   - Search for specific patterns (strings, byte sequences)
7. Export Ghidra analysis: function list, decompiled C, call graph
8. Results -> /results/$ENGAGEMENT/reverse-engineering/binary-analysis/
```

### Key Outputs
- Binary format identification (PE/ELF/Mach-O metadata)
- YARA classification results (malware family, packer detection)
- Ghidra decompiled source (pseudo-C)
- Function inventory with renamed/annotated functions
- Import/export tables, string references, call graphs

---

## Workflow 2: Dynamic Analysis with Frida

**Skills used:** `reverse-engineering/frida-instrument`, `reverse-engineering/scapy-packets`, `reverse-engineering/tshark-analyze`

```
1. Scope check -> verify target process/application is authorized for instrumentation
2. frida -l enumerate.js -p <pid> -> attach to running process
3. frida-trace -i "recv*" -i "send*" -p <pid> -> trace network-related function calls
4. Custom frida script: hook crypto functions (SSL_read, SSL_write) for TLS interception
5. tshark -i eth0 -f "host <target>" -w capture.pcap -> capture network traffic during analysis
6. scapy: parse and analyze captured packets for protocol-specific data
7. frida script: dump memory regions, hook specific functions, modify return values
8. Results -> /results/$ENGAGEMENT/reverse-engineering/dynamic-analysis/
```

### Key Outputs
- Function call traces (arguments, return values)
- Hooked API call logs (crypto, network, file I/O)
- Memory dumps from target process
- Network traffic capture (PCAP)
- Protocol analysis from packet inspection

---

## Workflow 3: Firmware Extraction & Embedded Analysis

**Skills used:** `reverse-engineering/binwalk-extract`, `reverse-engineering/qemu-emulate`, `reverse-engineering/ghidra-headless`, `reverse-engineering/yara-scan`

```
1. Scope check -> verify firmware image is authorized for analysis
2. binwalk -e firmware.bin -> extract embedded filesystems, compressed archives, embedded binaries
3. binwalk --signature firmware.bin -> identify embedded file types and offsets
4. Identify architecture from extracted ELF headers (ARM, MIPS, etc.)
5. qemu-user-static: emulate extracted binaries for dynamic analysis
   - qemu-arm-static ./extracted-binary -> run ARM binary on x86 host
   - qemu-mips-static ./extracted-binary -> run MIPS binary on x86 host
6. Ghidra headless: analyze extracted binaries with correct processor architecture
7. yara-scan: scan extracted filesystem for known backdoor patterns
8. Results -> /results/$ENGAGEMENT/reverse-engineering/firmware/
```

### Key Outputs
- Extracted filesystem contents
- Embedded binary inventory (architecture, format, entry points)
- Cross-architecture execution output
- Ghidra analysis of embedded binaries
- Backdoor/vulnerability scan results

---

## Workflow 4: Exploit Research & Development

**Skills used:** `reverse-engineering/searchsploit`, `reverse-engineering/payloads-ref`, `reverse-engineering/angr-symbolic`, `reverse-engineering/unicorn-emulate`

```
1. Scope check -> verify target software/version is in engagement scope
2. searchsploit <software> <version> -> search exploit-db for known exploits
3. PayloadsAllTheThings: reference payload patterns for identified vulnerability class
4. angr: symbolic execution on target binary
   - Load binary: proj = angr.Project('./target')
   - Define target state (crash point, interesting function)
   - Explore execution paths to reach vulnerability
   - Extract concrete inputs that trigger the vulnerability
5. unicorn: emulate specific code sections for exploit development
   - Emulate vulnerable function in isolation
   - Test shellcode execution in emulated environment
   - Verify ROP chain viability
6. Results -> /results/$ENGAGEMENT/reverse-engineering/exploit-research/
```

### Key Outputs
- Known exploit inventory (from exploit-db)
- Applicable payload patterns
- Symbolic execution paths to vulnerability
- Concrete proof-of-concept inputs
- Emulated shellcode/ROP chain validation

---

## Workflow 5: Cross-Architecture Emulation & Debugging

**Skills used:** `reverse-engineering/qemu-emulate`, `reverse-engineering/frida-instrument`, `reverse-engineering/tshark-analyze`
**MCP servers:** `ghidra` (for static analysis cross-reference), `binary-analysis` (radare2 backend)

```
1. Scope check -> verify target binary and architecture are in scope
2. Identify target architecture from ELF/PE headers (lief-parse)
3. qemu-user-static setup:
   - ARM: qemu-arm-static -L /usr/arm-linux-gnueabihf/ ./binary
   - MIPS: qemu-mips-static -L /usr/mips-linux-gnu/ ./binary
   - AARCH64: qemu-aarch64-static -L /usr/aarch64-linux-gnu/ ./binary
4. qemu-system emulation (full OS, when userland is insufficient):
   - qemu-system-arm -M virt -kernel zImage -drive file=rootfs.img -nographic
   - qemu-system-mips -M malta -kernel vmlinux -drive file=rootfs.img -nographic
5. frida: attach to qemu-user process for dynamic instrumentation of emulated binary
6. BinaryAnalysisMCPs (radare2): static analysis via MCP alongside dynamic emulation
7. tshark: capture network traffic from emulated system
8. Results -> /results/$ENGAGEMENT/reverse-engineering/cross-arch/
```

### Key Outputs
- Cross-architecture execution results
- Dynamic instrumentation logs from emulated binaries
- Static analysis cross-reference (radare2 via MCP)
- Network behavior from emulated firmware/OS
- Architecture-specific vulnerability notes
