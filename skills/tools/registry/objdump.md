---
name: Objdump
description: "Display information from object files: disassemble, inspect
  headers, sections, symbols, and relocations for reverse engineering."
registry: registry
tool_id: objdump
category: reverse-engineering
tags:
  - reverse-engineering
  - disassembly
  - binary-analysis
  - elf
  - static-analysis
  - debugging
  - assembly
mitre_techniques:
  - T1140
  - T1622
summary: objdump is a binary analysis utility for extracting information from
  ELF and other object file formats. Use it to disassemble executable sections
  (-d) or all sections (-D), display file/section/program headers (-f, -h, -p,
  -x), dump raw section contents (-s), inspect symbol tables (-t, -T), and view
  relocations (-r, -R). Invoke with at least one operational flag; output is
  human-readable text to stdout. Combine -d with -S to interleave source code if
  debug symbols are present. Use -j to filter by section name, --start-address
  and --stop-address to limit disassembly ranges. For large binaries, scope your
  query or output will be excessive. Does NOT modify files; strictly read-only.
  Common in malware analysis, exploit development, and understanding stripped
  binaries. Expects valid object files; corrupted or packed binaries may produce
  incomplete or misleading output.
sources:
  - https://www.infosecinstitute.com/resources/secure-coding/how-to-use-the-objdump-tool-with-x86/
  - https://www.geeksforgeeks.org/linux-unix/objdump-command-in-linux-with-examples/
  - https://llvm.org/docs/CommandGuide/llvm-objdump.html
  - https://man7.org/linux/man-pages/man1/objdump.1.html
  - https://tuttlem.github.io/2015/01/12/a-simple-example-with-gcc-and-objdump.html
  - https://developer.arm.com/documentation/107976/22-1-0/llvm-objdump-reference
  - https://ccrma.stanford.edu/planetccrma/man/man1/avr-objdump.1.html
  - https://man.archlinux.org/man/llvm-objdump.1.en
  - https://www.redfoxsec.com/blog/red-team-attack-methodology-a-complete-guide-to-adversarial-penetration-testing
  - https://www.picussecurity.com/resource/glossary/what-are-red-team-tools
  - https://www.picussecurity.com/resource/blog/techniques-tactics-procedures-utilized-by-fireeye-red-team-tools
  - https://specterops.io/training/red-team-operations/
generated_at: 2026-05-19T10:58:07.312Z
generated_by: anthropic
source_hash: 72065b50fd20ebc96e83b84b41804f9182ada5fefbc8e1e5e5cfabc94f570af4
---

# Objdump

## Overview

objdump (GNU Binutils, version 2.38) displays information from object files including executables, shared libraries, and .o files. It supports multiple architectures and formats (ELF, PE/COFF, Mach-O, a.out). Core capabilities: disassembly to assembly language, header inspection, symbol table enumeration, relocation entry display, and raw section dumping. It is a static analysis tool; it does not execute code. objdump is foundational for reverse engineering, vulnerability research, and understanding compiled binaries when source is unavailable.

## When to use

Use objdump when you need to reverse engineer a binary, analyze malware samples, verify compiler output, inspect shellcode, understand control flow, locate entry points, examine PLT/GOT for hooking opportunities, audit stripped binaries, or extract .text/.rodata/.data sections. Invoke during initial triage of unknown executables, when developing exploits that require precise instruction offsets, or when correlating disassembly with dynamic analysis from gdb or strace. Prefer objdump over IDA/Ghidra for quick command-line workflows, scripting, or when GUI tools are unavailable in a containerized/SSH environment. Do NOT use on non-executable files (e.g., images, documents) or when you need decompilation to higher-level pseudocode.

## Authentication & setup

No authentication or setup required. objdump is pre-installed in most Linux distributions and RTPI. Verify availability with `which objdump` or `objdump --version`. Requires read access to target files; sudo is NOT needed unless file permissions block access. For cross-architecture analysis, ensure the correct objdump variant is installed (e.g., arm-linux-gnueabi-objdump for ARM binaries). No configuration files or environment variables are required. Works offline; no network connectivity needed.

## Key commands / parameters

At least one operational flag is mandatory:

-d, --disassemble: Disassemble executable sections only (.text). Most common for analyzing compiled programs.

-D, --disassemble-all: Disassemble all sections including data. Use when .text boundaries are unclear or for comprehensive analysis.

-S, --source: Intermix source code with disassembly if compiled with -g. Useful for correlating assembly with original C/C++.

-f, --file-headers: Display file header (architecture, entry point, format). Quick triage.

-h, --section-headers: List section names, sizes, VMA, LMA, offsets. Essential for understanding binary layout.

-x, --all-headers: Equivalent to -a -f -h -p -r -t. Comprehensive header dump.

-t, --syms: Print symbol table. Identifies functions, global variables. Less useful on stripped binaries.

-T, --dynamic-syms: Print dynamic symbol table (imported/exported functions). Critical for shared library analysis.

-r, --reloc: Display static relocation entries.

-R, --dynamic-reloc: Display dynamic relocations (GOT, PLT). Key for exploit development.

-s, --full-contents: Hex dump all section contents. Large output; scope with -j.

-j <name>, --section=<name>: Limit output to specified section (e.g., -j .text).

--start-address=<addr>, --stop-address=<addr>: Restrict disassembly to address range. Use hex (0x...) or decimal.

-C, --demangle: Demangle C++ symbol names for readability.

-M intel: Use Intel syntax instead of AT&T (x86/x64 only). Add as -M intel after other flags.

--no-show-raw-insn: Omit hex instruction bytes from disassembly output.

-l, --line-numbers: Show source filename:line if debug info present.

-g, --debugging: Display debugging information.

--help: Full option list.

## Example workflows

1. Quick disassembly of executable sections:
   objdump -d /bin/ls | less

2. Disassemble with Intel syntax:
   objdump -d -M intel ./malware.elf

3. Disassemble specific function by address range:
   objdump -d --start-address=0x401000 --stop-address=0x401100 ./target

4. Inspect headers and sections:
   objdump -x ./binary | grep -E 'NEEDED|RPATH|entry'

5. Dump .rodata section (strings, constants):
   objdump -s -j .rodata ./binary

6. List imported functions (dynamic symbols):
   objdump -T /lib/x86_64-linux-gnu/libc.so.6 | grep ' puts'

7. Disassemble all sections including data:
   objdump -D ./shellcode.o

8. Interleave source (if compiled with -g):
   objdump -d -S ./debug_binary

9. Display relocations for GOT/PLT analysis:
   objdump -R ./vulnerable_binary | grep strcpy

10. Extract symbol table from non-stripped binary:
    objdump -t ./binary | grep ' F .text'

11. Combine header inspection and disassembly:
    objdump -f -h -d ./suspicious_elf > analysis.txt

12. Analyze cross-architecture binary:
    arm-linux-gnueabi-objdump -d ./arm_binary

## Output format

Output is plain text sent to stdout. Disassembly format: address, hex bytes, mnemonic, operands. Example:

  401000:       55                      push   %rbp
  401001:       48 89 e5                mov    %rsp,%rbp

Headers are human-readable tables with fixed-width columns. Section headers show Idx, Name, Size, VMA, LMA, File off, Algn, Flags. Symbol tables list Value, Type, Bind, Vis, Ndx, Name. Relocation entries show OFFSET, TYPE, VALUE. Raw section dumps (-s) are hex+ASCII. Output can be large (multi-MB for big binaries); redirect to file or pipe to less/grep. No machine-parseable format by default; consider readelf or llvm-objdump --json (if available) for structured output. Errors (invalid format, missing file) print to stderr and return non-zero exit code.

## Common pitfalls

1. Forgetting mandatory flag: objdump without -d, -D, -h, etc. prints usage and exits. Always specify at least one operational flag.

2. Overwhelming output: objdump -D on large binaries produces millions of lines. Use -j <section>, --start-address, --stop-address, or redirect to file.

3. Stripped binaries: -t shows minimal symbols. Use -T for dynamic symbols or reconstruct manually.

4. AT&T vs Intel syntax confusion: Default is AT&T (src, dest). Add -M intel for Intel syntax (dest, src). Only affects x86/x64.

5. Misinterpreting data as code: -D disassembles everything, including .data, .rodata. Instructions in data sections are usually garbage.

6. Cross-architecture analysis: objdump defaults to host architecture. Use architecture-specific variant (e.g., aarch64-linux-gnu-objdump) or specify -m <arch>.

7. Assuming source availability: -S only works if binary was compiled with -g and debug symbols are present. Stripped or release builds produce no source intermixing.

8. Ignoring ASLR/PIE: Addresses shown are file offsets or load addresses without ASLR. Runtime addresses differ; correlate with /proc/<pid>/maps or gdb.

9. Over-reliance on objdump alone: objdump is static. Packed, obfuscated, or self-modifying code requires dynamic analysis (gdb, PIN, Frida).

10. Permission errors: objdump fails silently if file is unreadable. Check with ls -l and adjust permissions or use sudo if necessary.

11. Non-standard formats: objdump may not support proprietary or exotic formats. Verify with file <binary> first.

12. Piping errors: Large output can break pipes. Use objdump ... 2>&1 | less or redirect stderr explicitly.

## References

• https://www.infosecinstitute.com/resources/secure-coding/how-to-use-the-objdump-tool-with-x86/
• https://www.geeksforgeeks.org/linux-unix/objdump-command-in-linux-with-examples/
• https://man7.org/linux/man-pages/man1/objdump.1.html
• https://tuttlem.github.io/2015/01/12/a-simple-example-with-gcc-and-objdump.html
• https://llvm.org/docs/CommandGuide/llvm-objdump.html
• https://ccrma.stanford.edu/planetccrma/man/man1/avr-objdump.1.html
