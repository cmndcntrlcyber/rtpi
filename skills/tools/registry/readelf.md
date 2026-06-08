---
name: Readelf
description: Display detailed information about ELF (Executable and Linkable
  Format) binaries including headers, sections, symbols, and relocations
registry: registry
tool_id: readelf
category: binary-analysis
tags:
  - binary-analysis
  - elf
  - reverse-engineering
  - forensics
  - symbols
  - headers
  - red-team
mitre_techniques:
  - T1027
  - T1518.001
  - T1082
summary: "readelf is a GNU binutils tool for analyzing ELF format files
  (executables, shared libraries, object files, core dumps). Use it to inspect
  binary structure without requiring BFD library or executing the binary.
  Essential for: understanding binary layout, identifying imported/exported
  symbols, examining dynamic linking dependencies, finding security features
  (PIE, stack canaries, RELRO), locating entry points, mapping sections and
  segments. Invoke with /usr/bin/readelf [options] <file>. Does NOT execute
  code—safe for malware analysis. Key options: -h (ELF header), -S (sections),
  -l (program headers/segments), -s (symbol table), --dyn-syms (dynamic
  symbols), -r (relocations), -d (dynamic section), -n (notes), -a (all
  headers/sections). Version 2.38. Output is human-readable text; parse with
  grep/awk for automation. Use when you need to understand binary structure
  before debugging, identify shared library dependencies for environment
  preparation, verify security mitigations, locate functions for
  hooking/patching, or assess binary capabilities without dynamic analysis
  risk."
sources:
  - https://llvm.org/docs/CommandGuide/llvm-readelf.html
  - https://manpages.ubuntu.com/manpages/bionic/man1/readelf.1.html
  - https://man7.org/linux/man-pages/man1/readelf.1.html
  - https://www.tutorialspoint.com/unix_commands/readelf.htm
  - https://sourceware.org/binutils/docs-2.17/binutils/readelf.html
  - https://www.geeksforgeeks.org/linux-unix/readelf-command-in-linux-with-examples/
  - https://evalian.co.uk/penetration-testing-vs-red-team-testing/
  - https://www.synack.com/knowledge-base/red-teaming-vs-penetration-testing-understanding-the-differences/
  - https://www.offsec.com/blog/red-teaming-vs-pentesting/
  - https://www.rapid7.com/blog/post/2016/06/23/penetration-testing-vs-red-teaming-the-age-old-debate-of-pirates-vs-ninja-continues/
  - https://documents.trendmicro.com/images/TEx/articles/Research_Paper-Red-Team-Tools.pdf
  - https://unam.re/blog/basic-linux-binary-analysis-tips
generated_at: 2026-05-19T11:04:14.253Z
generated_by: anthropic
source_hash: 3b24990830f14970f425622f5cc222323e63345cad309ed13564acc29c654759
---

# Readelf

## Overview

readelf displays low-level format-specific information about ELF (Executable and Linkable Format) files. It is part of GNU binutils and exists independently of the BFD library, making it more robust than objdump when analyzing potentially corrupted binaries. Supports 32-bit and 64-bit ELF files. Primarily used for static binary analysis—it reads file structure without execution. Common in reverse engineering, malware analysis, exploit development, and security auditing workflows.

## When to use

Use readelf when: (1) You need to understand binary structure before dynamic analysis or debugging. (2) Identifying imported functions, exported symbols, or library dependencies (safer than ldd for untrusted binaries). (3) Verifying security features: PIE/PIC (position-independent), stack canaries, RELRO, NX bits. (4) Locating entry points, section addresses, or specific functions for hooking/patching. (5) Examining relocation entries for understanding how the loader modifies the binary. (6) Analyzing malware or suspicious binaries where execution is risky—readelf performs static analysis only. (7) Debugging stripped binaries by examining remaining dynamic symbols. (8) Preparing red team payloads by understanding target binary dependencies and required libraries. Do NOT use for: non-ELF formats (PE/Mach-O), runtime behavior observation (use strace/ltrace), or disassembly (use objdump -d or specialized disassemblers).

## Authentication & setup

No authentication required. Installed by default on most Linux distributions as part of binutils package. If missing: apt install binutils (Debian/Ubuntu), yum install binutils (RHEL/CentOS), or equivalent. Confirm installation: readelf --version. Binary location: /usr/bin/readelf. Requires read permissions on target ELF file. For remote analysis, transfer binary to analysis system or use over SSH. No network connectivity needed—purely local file analysis. Works on any ELF file regardless of architecture (x86, ARM, MIPS, etc.)—readelf parses structure, does not execute code.

## Key commands / parameters

Core options (can combine multiple):

-h, --file-header : Display ELF header (magic bytes, class, entry point, architecture, type)
-S, --sections : List all sections with addresses, sizes, types, attributes
-l, --program-headers, --segments : Show program headers (runtime segments)
-s, --syms, --symbols : Display symbol table (functions, variables)
--dyn-syms : Show dynamic symbol table (imported/exported symbols for shared libraries)
-r, --relocs : Display relocation entries (how loader patches code/data)
-d, --dynamic : Show dynamic section (shared library dependencies, RPATH, etc.)
-n, --notes : Display NOTE segments (build ID, ABI tags)
-V, --version-info : Show symbol versioning information
-a, --all : Equivalent to -h -l -S -s -r -d -n -V (comprehensive output)
-x <section>, --hex-dump=<section> : Hex dump of specific section (by name or index)
-p <section>, --string-dump=<section> : ASCII string dump of section
-A, --arch-specific : Architecture-specific information
-D, --use-dynamic : Use dynamic symbol table instead of static (for stripped binaries)
-W, --wide : Don't truncate output to 80 columns

Common combinations:
readelf -h <file> : Quick header check (architecture, entry point)
readelf -d <file> : List shared library dependencies
readelf -s <file> : Examine symbols before stripping
readelf --dyn-syms <file> : See what stripped binary imports/exports
readelf -a <file> | less : Full analysis

## Example workflows

Workflow 1 - Initial binary reconnaissance:
readelf -h /bin/ls  # Check architecture, entry point, type (DYN/EXEC)
readelf -S /bin/ls  # Identify interesting sections (.text, .data, .rodata, .got, .plt)
readelf -l /bin/ls  # Map which sections load into which segments

Workflow 2 - Identify dependencies for payload staging:
readelf -d /usr/bin/sudo | grep NEEDED  # List required shared libraries
readelf -d /usr/bin/sudo | grep RPATH  # Check for hardcoded library search paths

Workflow 3 - Security feature verification:
readelf -h /bin/target | grep Type  # DYN = PIE enabled, EXEC = fixed address
readelf -l /bin/target | grep GNU_STACK  # Check if stack is executable
readelf -d /bin/target | grep BIND_NOW  # Check for full RELRO

Workflow 4 - Function enumeration for hooking:
readelf --dyn-syms /lib/x86_64-linux-gnu/libc.so.6 | grep system  # Find system() address
readelf -s /usr/bin/target | grep -E 'authenticate|verify|check'  # Locate auth functions

Workflow 5 - Analyzing stripped binary:
readelf --dyn-syms ./malware.elf | grep FUNC  # See imported functions despite stripping
readelf -r ./malware.elf  # Check relocations to understand imports
readelf -n ./malware.elf  # Extract build ID for tracking

Workflow 6 - Entry point location for debugging:
readelf -h ./target | grep Entry  # Get entry point address for breakpoint
readelf -S ./target | grep .init  # Find initialization code section

## Output format

Output is human-readable text with tabular formatting. Structure varies by option:

ELF header (-h): Key-value pairs (Magic, Class, Data, Version, OS/ABI, Type, Machine, Entry point, flags)

Section headers (-S): Table with columns [Nr] Name Type Address Offset Size EntSize Flags Link Info Align

Program headers (-l): Type Offset VirtAddr PhysAddr FileSize MemSize Flags Align, plus section-to-segment mapping

Symbol table (-s): Num Value Size Type Bind Vis Ndx Name

Dynamic section (-d): Tag Type Name/Value pairs (NEEDED, SONAME, RPATH, RUNPATH, FLAGS)

Relocations (-r): Offset Info Type Sym.Value Sym.Name + Addend

Output goes to stdout. Parse with grep, awk, sed for automation:
readelf -d file | grep NEEDED | awk '{print $5}' | tr -d '[]'  # Extract library names
readelf -s file | grep FUNC | awk '{print $8}'  # List function names

No JSON/XML output—text only. For programmatic parsing, consider pyelftools library or combine with text processing. Wide lines may wrap; use -W flag for full output.

## Common pitfalls

1. Confusing static vs dynamic symbols: -s shows compile-time symbols (empty if stripped), --dyn-syms shows runtime imports/exports (preserved even when stripped). Use --dyn-syms for stripped binaries.

2. Running ldd on untrusted binaries: ldd executes code. Use readelf -d instead to safely list dependencies.

3. Assuming all symbols are present: Strip command removes -s symbol table but preserves --dyn-syms. Check both.

4. Misinterpreting Type field: DYN means PIE-enabled (position-independent executable) OR shared library. Check for EXEC type (fixed address). Use file command to distinguish.

5. Ignoring architecture: readelf parses any ELF regardless of host architecture, but addresses/formats differ between 32-bit and 64-bit. Check Class field in header.

6. Overflow on wide output: Default 80-column truncation cuts data. Always use -W for full information or redirect to file.

7. Section vs segment confusion: Sections are link-time constructs (compile/link perspective), segments are runtime constructs (loader perspective). Use -S for sections, -l for segments. Segments contain sections.

8. Expecting disassembly: readelf does NOT disassemble code. Use objdump -d, gdb disassemble, or radare2 for disassembly.

9. Parsing brittle output: readelf output format is stable but text-based. For robust parsing, use libelf or pyelftools in scripts.

10. Forgetting to check notes: Build IDs, stack size limits, and ABI tags live in NOTE segments (-n). Essential for binary attribution and compatibility checks.

## References

• https://llvm.org/docs/CommandGuide/llvm-readelf.html
• https://manpages.ubuntu.com/manpages/bionic/man1/readelf.1.html
• https://man7.org/linux/man-pages/man1/readelf.1.html
• https://sourceware.org/binutils/docs-2.17/binutils/readelf.html
• https://www.geeksforgeeks.org/linux-unix/readelf-command-in-linux-with-examples/
• https://unam.re/blog/basic-linux-binary-analysis-tips
