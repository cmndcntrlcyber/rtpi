---
name: Checksec
description: Bash script that identifies binary hardening features (PIE, RELRO,
  NX, canaries, FORTIFY_SOURCE) and kernel security options on Linux systems.
registry: registry
tool_id: checksec
category: binary-analysis
tags:
  - binary-analysis
  - hardening
  - exploitation-prep
  - reconnaissance
  - elf
  - kernel-security
  - defense-evasion
mitre_techniques:
  - T1592.002
summary: "Checksec identifies compile-time security mitigations in Linux
  binaries and kernel configurations. Use it during reconnaissance to enumerate
  exploit mitigations before crafting payloads. Invoke with --file={path} for
  single binaries, --dir={path} for recursive checks, --proc={pid} for running
  processes, --proc-all for system-wide process enumeration, --proc-libs={pid}
  for library checks, or --kernel for kernel security features. Output formats:
  cli (default, color-coded), json, csv, xml via --output= or --format= (must be
  first flag). Key checks: RELRO (GOT overwrite protection), Stack Canary (stack
  smashing detection), NX (non-executable stack), PIE (position-independent
  executable for ASLR), RPATH/RUNPATH (insecure library paths), Fortify Source
  (bounds checking), and kernel configs (SELinux, GRSecurity, stack protector).
  When PIE=disabled or No Canary, exploitation is easier. No NX enables
  shellcode execution. RPATH/RUNPATH indicate potential library injection
  vectors. Kernel checks reveal system-wide ASLR, usercopy hardening, and
  mandatory access controls. Use --fortify-file={path} or --fortify-proc={pid}
  to identify fortifiable functions and which are already protected. Tool
  depends on readelf and kernel config access; may fail on
  embedded/cross-compiled targets without GNU binutils. Combine with process
  enumeration (--proc-all) to map attack surface. Output should inform exploit
  technique selection and payload construction."
sources:
  - https://github.com/slimm609/checksec
  - https://man.archlinux.org/man/extra/checksec/checksec.1.en
  - https://slimm609.github.io/checksec/
  - https://opensource.com/article/21/6/linux-checksec
  - https://manpages.ubuntu.com/manpages/focal/man1/checksec.1.html
  - https://medium.com/@slimm609/checksec-d4131dff0fca
  - https://www.mitnicksecurity.com/blog/red-team-testing-vs.-penetration-testing
  - https://www.ibm.com/think/topics/red-teaming
  - https://www.halock.com/red-team-test/
  - https://www.infosecinstitute.com/resources/penetration-testing/red-team-operations-best-practices/
  - https://www.linkedin.com/posts/trail-of-bits_new-tool-release-checksec-anywhere-read-activity-7394713175557865473-3TIc
  - https://www.ittc.ku.edu/~kulkarni/CARS/papers/22_ISPEC_Koyel.pdf
generated_at: 2026-05-19T11:18:52.095Z
generated_by: anthropic
source_hash: eebbd201c0d3d712dde23b85203a7ff17850494cd3240ddb36c885571aa67f64
---

# Checksec

## Overview

Checksec is a bash script (2111 lines) that surveys security mitigations in ELF binaries and Linux kernel configurations. It analyzes compile-time hardening features including Position Independent Executable (PIE), RELocation Read-Only (RELRO), non-executable stack (NX), stack canaries, FORTIFY_SOURCE, and identifies dangerous RPATH/RUNPATH settings. For kernels, it checks SELinux, GRSecurity, stack protector configs, and memory restrictions. Originally written by Tobias Klein in 2011, now maintained by slimm609. Single-file script readable for understanding exact system commands used. Primary use case is runtime checking of system configuration; also works offline against cross-compiled filesystems with limitations.

## When to use

Use checksec during reconnaissance phase before exploitation to enumerate binary defenses and inform payload construction. Essential when: (1) Identifying which exploits are viable against a target binary—No NX enables shellcode injection, disabled PIE allows hardcoded addresses, missing canaries simplify buffer overflows. (2) Conducting system-wide attack surface mapping with --proc-all to find least-protected processes. (3) Analyzing custom or proprietary binaries from a target environment. (4) Checking kernel hardening before privilege escalation attempts—disabled SMEP/SMAP, missing SELinux, or no usercopy hardening widen kernel exploit options. (5) Auditing libraries loaded by high-value processes (--proc-libs) for vulnerable dependencies. (6) Validating RPATH/RUNPATH for library injection opportunities. Do not use on non-Linux systems (Mach-O/PE not supported by this version), or when stealth is critical—process/file access generates audit logs.

## Authentication & setup

No authentication required. Installed at /usr/local/bin/checksec. Requires: (1) Read access to target binaries or /proc filesystem. (2) GNU binutils (readelf) for binary analysis—may be absent on embedded targets, limiting functionality. (3) Access to /boot/config-* or /proc/config.gz for kernel checks; root often required for full kernel analysis. (4) Terminal with terminfo database; warning '_curses.error: setupterm: could not find terminfo database' indicates terminal capability issues but does not prevent execution. On RPM systems: 'sudo dnf install checksec'. On Debian: 'sudo apt install checksec'. Can also download directly from GitHub releases and verify with OpenSSL: 'openssl dgst -sha256 -verify checksec.pub -signature checksec.sig checksec'. For cross-compiled/offline analysis, mount or access target filesystem and point checksec at binaries within it—no runtime execution needed on target.

## Key commands / parameters

--file={absolute_path} : Check single binary for all security features. Returns RELRO (Partial/Full/None), Stack Canary (found/not found), NX (enabled/disabled), PIE (enabled/disabled/DSO), RPATH, RUNPATH, Symbols, FORTIFY status, fortified/fortifiable function counts.

--dir={directory} : Recursively check all executables in directory tree.

--proc={process_name_or_pid} : Check security features of running process by name or PID.

--proc-all : Enumerate all running processes with their security features—high-value for attack surface mapping.

--proc-libs={pid} : Check security features of all libraries loaded by a process—identifies vulnerable dependencies.

--kernel[={config_path}] : Check kernel security options from running kernel or specified config file. Reports CONFIG_HARDENED_USERCOPY, CONFIG_FORTIFY_SOURCE, CONFIG_STRICT_KERNEL_RWX, CONFIG_VMAP_STACK, CONFIG_SECURITY_SELINUX, GRSecurity features.

--fortify-file={path} : Identify which functions in binary are fortifiable and which are already fortified.

--fortify-proc={pid} : Same as fortify-file but for running process.

--output={format} or --format={format} : cli (default, color-coded), csv, xml, json. MUST be first argument if used.

--extended : Extended output with additional details.

--debug : Debug-level output for troubleshooting.

--version : Show version.

--update or --upgrade : Check for signed updates from source.

## Example workflows

1. RECON: Identify least-protected binaries on compromised system:
   checksec --proc-all --output json > /tmp/procs.json
   # Parse JSON for 'pie: no', 'canary: no', 'nx: disabled' to prioritize exploitation targets

2. PRE-EXPLOIT: Analyze target binary before crafting exploit:
   checksec --file=/opt/vulnerable_app/bin/service
   # If PIE=no, use static addresses; if NX=disabled, inject shellcode; if No Canary, overflow freely

3. PRIVILEGE ESCALATION PREP: Survey kernel hardening:
   checksec --kernel --output json
   # Check for disabled SMEP, SMAP, KASLR, usercopy hardening before using kernel exploits

4. LIBRARY INJECTION RECON: Find RPATH/RUNPATH vulnerabilities:
   checksec --dir=/usr/local/bin --output csv | grep -E 'RPATH|RUNPATH'
   # Binaries with RPATH/RUNPATH may load libraries from attacker-controlled paths

5. PROCESS DEPENDENCY ANALYSIS: Map shared library attack surface:
   checksec --proc-libs=1234
   # Identify unprotected libraries in high-privilege process for exploitation or hooking

6. OFFLINE ANALYSIS: Check binaries exfiltrated from target:
   checksec --file=/mnt/extracted_fs/bin/proprietary_service
   # Analyze without alerting target's runtime defenses

7. FORTIFICATION ANALYSIS: Identify unprotected dangerous functions:
   checksec --fortify-file=/usr/sbin/target_daemon
   # Low fortified/fortifiable ratio suggests vulnerable strcpy, memcpy, sprintf calls

## Output format

CLI (default): Human-readable table with color coding. Green=enabled/good, Red=disabled/bad, Yellow=partial. Columns: RELRO, STACK CANARY, NX, PIE, RPATH, RUNPATH, Symbols, FORTIFY, Fortified count, Fortifiable count, FILE path.

JSON (--output json): Array of objects. Binary checks return single object with boolean/string fields: 'relro' (Full/Partial/No), 'canary' (yes/no), 'nx' (yes/no), 'pie' (yes/no/dso), 'rpath' (yes/no), 'runpath' (yes/no), 'symbols' (yes/no), 'fortify_source' (yes/no), 'fortified' (integer), 'fortifiable' (integer), 'filename' (string). Kernel checks return array of objects: 'name' (CONFIG_*), 'desc' (description), 'type' (Kernel Config), 'value' (Enabled/Disabled/Not Set). Process checks include PID fields.

CSV (--output csv): Comma-delimited with header row, same fields as CLI table. Machine-parseable for bulk analysis.

XML (--output xml): Root element with child elements per check, attributes for each security feature. Includes encoding declaration and version.

Kernel output includes: GRSecurity status, PaX flags, SELinux state, kernel address display restriction, dmesg restrictions, kptr restrictions, module loading controls, usercopy hardening, and various CONFIG_SECURITY_* and CONFIG_HARDENED_* options.

## Common pitfalls

1. MISSING DEPENDENCIES: Checksec requires readelf from binutils. On embedded/busybox systems, binary checks fail silently or partially. Verify 'readelf --version' before relying on output.

2. PERMISSION ERRORS: Kernel checks and some /proc access require root. Running as low-privilege user returns incomplete data—'Permission Denied' warnings indicate missing checks. Escalate or accept partial results.

3. FLAG ORDERING: --output/--format MUST be first argument or it is ignored. 'checksec --file=X --output json' fails; use 'checksec --output json --file=X'.

4. TERMINAL ERRORS: '_curses.error: setupterm: could not find terminfo database' warning appears when TERM variable is unset or terminal type unknown. Non-fatal but may break color output. Set TERM=xterm or use --output json to avoid.

5. FALSE POSITIVES ON PIE: Shared libraries (.so) always show PIE enabled (DSO); this is expected, not a security feature of the library itself. Focus on executables.

6. PARTIAL RELRO MISINTERPRETATION: 'Partial RELRO' still allows GOT overwrite attacks. Only 'Full RELRO' (BIND_NOW) prevents them. Partial is better than none but exploitable.

7. FORTIFY OVER-RELIANCE: FORTIFY_SOURCE only protects functions where size is known at compile-time. 'Fortifiable' count shows maximum; 'Fortified' shows actual. Gap does not always indicate vulnerability—may be compile-time indeterminate.

8. CROSS-ARCHITECTURE ANALYSIS: Checksec assumes host-native binutils. Analyzing ARM binaries on x64 may fail or misreport. Use architecture-appropriate toolchain or qemu-user for accurate results.

9. KERNEL CONFIG UNAVAILABLE: If /proc/config.gz and /boot/config-* are absent, --kernel returns empty or errors. Embedded/hardened systems often hide configs. Request from system owner or extract from kernel image.

10. STEALTH CONCERNS: --proc-all and --proc-libs read /proc extensively, generating audit events on monitored systems. Not OPSEC-safe for covert red team operations. Use sparingly or offline against exfiltrated data.

## References

• https://github.com/slimm609/checksec
• https://man.archlinux.org/man/extra/checksec/checksec.1.en
• https://slimm609.github.io/checksec/
• https://opensource.com/article/21/6/linux-checksec
• https://manpages.ubuntu.com/manpages/focal/man1/checksec.1.html
• https://medium.com/@slimm609/checksec-d4131dff0fca
• https://www.ittc.ku.edu/~kulkarni/CARS/papers/22_ISPEC_Koyel.pdf
