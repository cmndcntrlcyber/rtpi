---
name: Strings
description: Extract printable ASCII/Unicode strings from binary files,
  executables, memory dumps, or other non-text data for reconnaissance and
  analysis.
registry: registry
tool_id: strings
category: reverse-engineering
tags:
  - reverse-engineering
  - binary-analysis
  - forensics
  - reconnaissance
  - strings-extraction
  - malware-analysis
  - file-analysis
mitre_techniques:
  - T1027
  - T1140
  - T1552.001
summary: "Use strings to extract human-readable text from binaries, executables,
  memory dumps, firmware images, network captures, or unknown file formats.
  Invoke with `/usr/bin/strings [options] <file>` to dump sequences of printable
  characters (default: ≥4 chars). Essential for initial recon of unknown
  binaries to reveal hardcoded credentials, URLs, file paths, function names,
  configuration parameters, error messages, and embedded metadata. Default
  behavior scans loadable/initialized sections only; use `-a/--all` to scan
  entire file. Combine with `-e <encoding>` to detect Unicode (use `-e s` for
  7-bit, `-e S` for 8-bit, `-e l` for 16-bit little-endian, `-e b` for 16-bit
  big-endian). Add `-t x` or `--radix=x` for hex offsets (critical for
  correlating with hex editors or memory addresses). Use `-n <length>` to adjust
  minimum string length (default 4). Output is line-delimited ASCII to stdout;
  pipe through grep, sort, or uniq for filtering. Strings uses primitive pattern
  matching—expect noise and false positives. Most valuable in early-stage
  analysis: identifying packer signatures, crypto library references,
  interesting API calls, C2 domains, internal paths, or debug symbols. Combine
  with file, hexdump, and objdump for comprehensive static analysis. No
  authentication required; operates on local files only."
sources:
  - https://www.strings.ie/blog/beginners-guide-to-strings/
  - https://man7.org/linux/man-pages/man1/strings.1.html
  - https://en.wikipedia.org/wiki/String_(computer_science)
  - https://www.w3schools.com/c/c_strings.php
  - https://www.stringsbymail.com/pages/string-filter-guide-66.html?srsltid=AfmBOorB8CnguRCFhF-tkFVyn5otdw6kDMOjhX3g6wuVh43pd-xKCdpP
  - https://www.sciencedirect.com/topics/computer-science/string-command
  - https://www.youtube.com/watch?v=6uX_25PQV5A
  - https://stackoverflow.com/questions/35370166/what-are-the-arguments-i-can-use-with-strings-command-line-tool
  - https://www.nushell.sh/book/working_with_strings.html
  - https://www.cycognito.com/learn/red-teaming/red-teaming-vs-pentesting/
  - https://evalian.co.uk/penetration-testing-vs-red-team-testing/
  - https://www.offsec.com/blog/red-teaming-vs-pentesting/
generated_at: 2026-05-19T11:20:18.163Z
generated_by: anthropic
source_hash: 4d42045267eac4bc1bb9b588b1163a3ae6b7ddc15cbcfa2dfbd06831db676442
---

# Strings

## Overview

strings is a GNU binutils utility that extracts printable character sequences from binary files. It scans files for sequences of displayable ASCII or Unicode characters (default minimum 4 chars) followed by unprintable characters, outputting them line-by-line. Originally designed for object files and executables, it works on any file type: packed malware, memory dumps, disk images, network packet captures, firmware blobs, or corrupted documents. The tool uses primitive pattern matching and produces raw output without context—valuable for quick reconnaissance but requiring manual triage. Version 2.38 is part of standard Linux distributions and runs without dependencies.

## When to use

Deploy strings for initial binary reconnaissance when file type is unknown or file header analysis fails. Essential workflows: (1) triaging malware samples to extract C2 domains, IPs, file paths, registry keys before dynamic analysis; (2) searching firmware images for hardcoded credentials, URLs, or configuration strings; (3) recovering metadata from corrupted or obfuscated files; (4) extracting error messages and debug strings to identify libraries, compilers, or original source paths; (5) hunting for embedded scripts, SQL queries, or command-line syntax in compiled binaries; (6) analyzing memory dumps for sensitive data leakage (passwords, tokens, keys). Use early in reverse-engineering workflow before committing to full disassembly. Particularly effective when combined with grep for pattern matching (e.g., `strings -a binary | grep -iE '(password|api[_-]?key|token)'`). Not suitable for precise code analysis—use disassemblers (Ghidra, IDA, radare2) for that.

## Authentication & setup

No authentication, configuration, or setup required. Tool is pre-installed at `/usr/bin/strings` on most Linux distributions as part of binutils package. Operates entirely on local files with standard file system permissions—requires read access to target file only. No network connectivity needed. No state files or configuration directories. For processing files owned by other users or system binaries, may require sudo/root privileges depending on file permissions. No licensing or activation. Works offline. Portable across architectures. Can process stdin when no file argument provided (e.g., `cat binary | strings`). For analysis of files on remote systems, transfer file locally first or use over SSH (e.g., `ssh user@target 'strings /path/to/binary'`).

## Key commands / parameters

Core invocation: `/usr/bin/strings [options] <file>`

**Critical flags for red team use:**
- `-a, --all` — Scan entire file regardless of sections; default behavior only scans loadable/initialized sections in object files. Always use for unknown binaries or when initial run produces sparse output.
- `-n <num>, --bytes=<num>` — Minimum string length (default 4). Increase (e.g., `-n 8`) to reduce noise; decrease (e.g., `-n 3`) to catch short identifiers or variable names.
- `-e <encoding>, --encoding=<encoding>` — Character encoding: `s`=7-bit ASCII (default), `S`=8-bit ASCII, `b`=16-bit big-endian, `l`=16-bit little-endian (Windows Unicode), `B`=32-bit big-endian, `L`=32-bit little-endian. Use `-e l` for Windows binaries to catch UTF-16 strings.
- `-t <radix>, --radix=<radix>` — Print offset of string: `o`=octal, `x`=hex, `d`=decimal. Use `-t x` for hex offsets to correlate with hex editors or memory addresses during deeper analysis.
- `-f, --print-file-name` — Prefix each string with filename; useful when processing multiple files.
- `-o` — Alias for `-t o` (octal offsets); legacy option.

**Examples:**
`strings -a suspicious.exe` — extract all strings
`strings -a -n 8 firmware.bin` — min length 8
`strings -e l -a malware.dll` — UTF-16LE (Windows)
`strings -t x -a binary | grep -i password` — hex offsets + grep
`strings -a -f *.dat | grep 'http'` — scan multiple files for URLs

## Example workflows

**Workflow 1: Malware triage for C2 infrastructure**
```
strings -a -e l suspicious.exe | grep -iE '(http|https|ftp|tcp|udp|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})' | sort -u > c2_candidates.txt
```
Extract all strings including Unicode, filter for URLs/IPs, deduplicate.

**Workflow 2: Credential hunting in firmware**
```
strings -a -n 6 firmware.bin | grep -iE '(password|passwd|pwd|user|admin|root|key|secret|token)' > creds.txt
```
Search for common credential-related keywords with min length 6.

**Workflow 3: Binary fingerprinting via compiler/library strings**
```
strings -a binary.elf | grep -E '(GCC|GLIBC|Clang|MSVC|OpenSSL|libcrypto)'
```
Identify build environment and linked libraries for profiling.

**Workflow 4: Memory dump analysis with offsets**
```
strings -a -t x memdump.dmp | grep -i 'authorization: bearer' > tokens_with_offsets.txt
```
Locate authentication tokens with hex offsets for further memory analysis.

**Workflow 5: Multi-encoding scan of packed executable**
```
for enc in s S l b; do strings -a -e $enc packed.exe >> all_strings.txt; done
sort -u all_strings.txt | grep -vE '^[^a-zA-Z0-9]{4,}$' > filtered.txt
```
Extract strings in all encodings, deduplicate, filter non-alphanumeric garbage.

## Output format

Outputs line-delimited ASCII text to stdout, one string per line. No headers, footers, or metadata by default. Each line contains one extracted string sequence. When `-t` or `--radix` used, each line prefixed with offset (octal/hex/decimal) followed by whitespace, then string. When `-f` used, each line prefixed with filename followed by colon. String sequences are terminated at control characters (newline, carriage return, null byte) but not tab. No escape sequences or quoting—output is raw. Binary nulls and control chars are suppressed. Encoding affects interpretation (ASCII vs UTF-16 etc) but output is always ASCII-printable. Typical output volume: hundreds to millions of lines for large binaries. Redirect to file for analysis. Pipe to grep/awk/sed for filtering. Use `| less` for interactive review. No JSON, XML, or structured formats—postprocessing required for integration into toolchains. Exit code: 0 on success, non-zero on error (file not found, permission denied).

## Common pitfalls

**1. Default scanning misses data sections:** Without `-a`, strings only scans loadable sections in object files; many interesting strings may reside in uninitialized or non-loadable regions. Always use `-a` unless you specifically want section-filtered results.

**2. Missing Unicode strings in Windows binaries:** Default 7-bit ASCII encoding misses UTF-16LE strings common in Windows executables. Always run `-e l` scan for Windows targets or use multi-encoding loop.

**3. False positives and noise:** Primitive algorithm produces massive output including binary artifacts that happen to match printable ASCII ranges. Expect junk—filter aggressively with grep, awk, or post-processing scripts. Random data can look like valid strings.

**4. Obfuscation defeats strings:** Encrypted, base64-encoded, XOR'd, or dynamically constructed strings are invisible to strings. Tool only finds plaintext character sequences. Packed/encrypted malware requires unpacking first.

**5. No context for found strings:** Strings provides no information about where string is used, what function references it, or its semantic meaning. Must correlate with disassembly or hex editor using offsets (`-t x`).

**6. Performance on large files:** Scanning multi-gigabyte memory dumps or disk images is I/O intensive and slow. Consider splitting files or using parallel processing (GNU parallel).

**7. Minimum length too low creates noise:** Default 4-char minimum catches many false positives. Adjust `-n` based on target—increase for cleaner output, decrease only when hunting short identifiers.

**8. Output volume overwhelming:** Large binaries produce megabytes of string output. Always redirect to file and use grep/filtering rather than reviewing raw output.

## References

- https://man7.org/linux/man-pages/man1/strings.1.html
- https://www.sciencedirect.com/topics/computer-science/string-command
- https://stackoverflow.com/questions/35370166/what-are-the-arguments-i-can-use-with-strings-command-line-tool
