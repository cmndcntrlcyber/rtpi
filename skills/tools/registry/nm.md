---
name: Nm
description: List symbols from object files, executables, and libraries to
  analyze imports, exports, and function/variable definitions.
registry: registry
tool_id: nm
category: reverse-engineering
tags:
  - binary-analysis
  - reverse-engineering
  - symbols
  - elf
  - static-analysis
  - reconnaissance
  - binary-inspection
mitre_techniques:
  - T1592.002
  - T1592
  - T1082
summary: "Use nm to enumerate symbols in binaries, shared libraries (.so),
  object files (.o), and static archives (.a). Invoke as 'nm <file>' for default
  output; no setup required. Primary use cases: identifying exported/imported
  functions, finding undefined dependencies, verifying symbol visibility, and
  mapping code structure. Output is three columns: address (hex by default),
  type (uppercase=global, lowercase=local), name. Key types: T/t=text/code,
  U=undefined, B/b=BSS uninitialized data, D/d=initialized data. Critical flags:
  -D for dynamic symbols only (shared libraries), -u for undefined symbols
  (missing dependencies), -C to demangle C++ names, -g for external/exported
  only, --defined-only to hide undefined. Use -A when processing multiple files
  to prepend filenames. Default sorts alphabetically; -n sorts by address, -v by
  value, -p disables sorting. Hexadecimal values shown with -x. For scripting
  use -P for portable output. Watch for: stripped binaries show no symbols,
  static archives require per-object inspection, C++ requires -C for
  readability. Combine with grep to locate specific symbols. Undefined symbols
  (U) indicate external dependencies requiring other libraries at link/runtime."
sources:
  - https://www.howtoforge.com/linux-nm-command/
  - https://www.nmdfa.state.nm.us/wp-content/uploads/2022/08/NM-End-User-Training-Guide-08.2022.pdf
  - https://www.ibm.com/docs/ssw_aix_72/n_commands/nm.html
  - https://man7.org/linux/man-pages/man1/nm.1.html
  - https://web.ped.nm.gov/bureaus/curriculum-instruction/new-mexico-instructional-scope-nmis/
  - https://networkmanager.dev/docs/api/latest/nmcli.html
  - https://stackoverflow.com/questions/43766408/how-to-read-nm-commands-what-does-nm-options-t-and-u-undefined-mean
  - https://www.cif.iastate.edu/files/inline-files/VNMRJ%20command%20and%20parameter%20reference.pdf
  - https://www.nuharborsecurity.com/blog/red-teaming-vs-penetration-testing
  - https://blog.invgate.com/red-team-scenarios-methodology-and-examples
  - https://www.cycognito.com/learn/red-teaming/red-teaming-vs-pentesting/
  - https://wesecureapp.com/blog/red-team-assessment-versus-penetration-testing/
generated_at: 2026-05-19T11:22:14.069Z
generated_by: anthropic
source_hash: ac7726d8f740baa214baade0dcc00ad563048652d8c9efa0f5e60f1271b5e46d
---

# Nm

## Overview

nm is a GNU binary utility that extracts and displays symbol table information from ELF object files, executables, shared libraries, and archives. It reveals function names, global variables, their memory addresses, types (code, data, undefined), and scope (local vs. global). Essential for reverse engineering, dependency analysis, ABI research, and understanding binary structure without execution.

## When to use

Use nm during reconnaissance of compiled binaries when you need to: map exported API surface of libraries; identify undefined symbols that reveal runtime dependencies; verify presence/absence of specific functions before dynamic analysis; understand code organization and entry points; detect stripped vs. non-stripped binaries; analyze static archives (.a) for included object files; find C++ mangled names and demangle them; confirm symbol visibility (global vs. local); prepare target list for hooking/instrumentation; validate compiler flags (position-independent code, etc.). Run before disassembly to prioritize high-value functions. Use on captured binaries, firmware extracts, or malware samples.

## Authentication & setup

No authentication or setup required. nm is a standard GNU binutils component installed at /usr/bin/nm on most Linux systems. Operates entirely offline on local files. Requires read permission on target binary. No network activity. No configuration files. Works on: ELF executables, .so shared objects, .o object files, .a static archives. Does not work on: stripped binaries (limited output), running processes (use /proc/pid/maps instead), Windows PE files (use objdump or platform-specific tools).

## Key commands / parameters

Basic: 'nm <binary>' lists all symbols. Flags: -D/--dynamic = show dynamic symbols only (critical for .so files). -u = undefined symbols only (find missing dependencies). -C/--demangle = demangle C++ names to readable form. -g/--extern-only = external/global symbols only (exported API). --defined-only = omit undefined symbols. -n/-v/--numeric-sort = sort by address instead of name. -p/--no-sort = preserve symbol table order. -r/--reverse-sort = reverse sort direction. -A/-o/--print-file-name = prepend filename (required for multiple files). -a/--debug-syms = include debugger symbols. -S/--print-size = show symbol size. -l/--line-numbers = show source filename/line (if debug info present). -f <format>/--format= = bsd (default), sysv, posix output formats. -P/--portability = portable format for scripts. -t <radix> = output format: d=decimal, x=hex, o=octal. --no-demangle = keep mangled names.

## Example workflows

Identify exported functions in library: 'nm -D --defined-only /lib/x86_64-linux-gnu/libc.so.6 | grep " T "' (shows defined text symbols). Find undefined dependencies: 'nm -u target_binary' reveals functions that must be resolved at runtime. Locate specific function: 'nm target | grep -i password' searches for password-related symbols. Analyze static archive contents: 'nm libexample.a' shows all object files and their symbols. Demangle C++ binary: 'nm -C libstdc++.so.6 | less' makes names readable. Compare symbol tables: 'nm -n binary1 > sym1.txt; nm -n binary2 > sym2.txt; diff sym1.txt sym2.txt' finds differences. Extract function addresses for hooking: 'nm -n --defined-only target | awk ''/T.*target_func/ {print $1}'' gets hex address. Check for security functions: 'nm binary | grep -E "stack_chk|canary|fortify"' detects hardening.

## Output format

Default format is three columns per line: [address] [type] [name]. Address is hex by default (8 or 16 digits), dashes (--------) for undefined symbols. Type is single character: uppercase=global, lowercase=local. Common types: T/t=code in .text section, U=undefined (external reference), D/d=initialized data, B/b=uninitialized BSS data, R/r=read-only data, W/w=weak symbol, A=absolute (not changed by linking), N=debug symbol, ?=unknown. Name is symbol identifier (mangled for C++). With -A flag: 'filename: address type name'. With -P flag (portable): 'name type value size' space-delimited. With -S flag adds size column after type. No output for completely stripped binaries. Archives show object file names as headers before their symbols.

## Common pitfalls

Stripped binaries yield little/no output—check with 'file <binary>' first; if 'stripped' appears, symbol table is removed. Forgetting -D on shared libraries shows static symbols instead of dynamic exports. C++ symbols are unreadable without -C (mangling like _ZN3std2io5stdio6_printE). Undefined symbols (U) are normal—they resolve at link/runtime, not errors unless actual linking fails. Large binaries produce massive output—pipe to grep, less, or redirect to file. Archives (.a) show all contained .o files; filter with grep or inspect specific .o after extraction. Position-independent executables (PIE) may show addresses as offsets from base. Symbol presence doesn't guarantee execution—check for dead code. Some compilers hide symbols; compare nm output to dynamic analysis findings. Case-sensitive search required; symbols may be CamelCase or snake_case.

## References

• https://www.howtoforge.com/linux-nm-command/
• https://www.ibm.com/docs/ssw_aix_72/n_commands/nm.html
• https://man7.org/linux/man-pages/man1/nm.1.html
• https://stackoverflow.com/questions/43766408/how-to-read-nm-commands-what-does-nm-options-t-and-u-undefined-mean
