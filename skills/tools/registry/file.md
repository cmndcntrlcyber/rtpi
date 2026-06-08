---
name: File
description: Identify file types via magic number and content inspection;
  supports MIME output, symlink dereferencing, and special files.
registry: registry
tool_id: file
category: binary-analysis
tags:
  - file-identification
  - binary-analysis
  - magic-bytes
  - mime-type
  - reconnaissance
  - filetype
  - forensics
mitre_techniques:
  - T1083
  - T1087
  - T1592
summary: "Use file(1) to determine file types when analyzing unknown binaries,
  scripts, or data extracted during red team operations. Invoke as
  '/usr/bin/file [options] <target>' with no required authentication. Key
  options: -i/--mime for machine-parseable MIME types (critical for automation);
  -b for brief output without filenames; -L to follow symlinks; -s to read
  block/character special files (e.g., raw disk partitions); -z to inspect
  compressed file contents; -k to continue checking after first match. Returns
  colon-delimited output: 'filename: description' by default, or 'filename:
  MIME-type; charset=encoding' with -i. Handles executable identification (ELF,
  PE), script detection (shebang parsing), archive formats, encryption
  detection, and encoding. Does NOT execute or modify files; purely static
  analysis via libmagic database (/usr/share/misc/magic). Use -m to specify
  alternate magic files. Expect ASCII descriptions; redirect stderr to catch
  magic database errors. Common pitfall: relying on file extension instead of
  content—file reads magic bytes. For automation pipelines, always use -b -i
  together. On obfuscated or packed binaries, file may report generic 'data'
  requiring deeper tools. Combine with strings, hexdump, or disassemblers for
  complete analysis. Performance: near-instant on local files; slow on network
  mounts or with -z on large archives."
sources:
  - https://www.redbooks.ibm.com/redbooks/pdfs/sg245482.pdf
  - https://www.canto.com/glossary/file-management/
  - https://guides.lib.virginia.edu/RDM/file-management
  - https://www.timevalue.com/sites/default/files/product-download/File-In-Time-Users-Guide.pdf
  - https://www.static.tu.berlin/fileadmin/www/10002444/Dokumente/Forschen_Publizieren/Dissertationsstelle/pdf-guide-202211-en.pdf
  - https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/cc754340(v=ws.11)
  - https://man7.org/linux/man-pages/man1/file.1.html
  - https://www.stat.berkeley.edu/~nolan/stat133/Fall05/lectures/ShellCmds4.pdf
  - https://ss64.com/nt/
  - https://www.codecademy.com/article/command-line-commands
  - https://blog.securelayer7.net/red-teaming-vs-penetration-testing/
  - https://www.redfoxsec.com/blog/red-team-attack-methodology-a-complete-guide-to-adversarial-penetration-testing
generated_at: 2026-05-19T11:21:27.170Z
generated_by: anthropic
source_hash: f86a750afc088df61887d1f716cc5ceca9f66230267a5db0d35956bd89cdac6e
---

# File

## Overview

file(1) is a standard Unix utility that identifies file types by inspecting content rather than relying on extensions. It uses a compiled magic number database (libmagic) to recognize thousands of formats including executables (ELF, PE, Mach-O), scripts (shell, Python, Perl via shebang), archives (tar, zip, gzip), images, documents, encrypted containers, and raw data. Critical for red team reconnaissance when handling dropped files, exfiltrated data, memory dumps, or files with misleading extensions. Version 5.41 included in RTPI at /usr/bin/file.

## When to use

Invoke file during enumeration of compromised hosts to classify unknown binaries before execution risk assessment. Use after downloading files from target networks to detect malware, scripts, or encrypted containers. Essential when triaging memory dumps, disk images, or forensic artifacts. Deploy in automation scripts to filter file types before further processing (e.g., only analyze ELF binaries, skip images). Leverage during privilege escalation hunts to identify SUID binaries by type. Use with -s flag when analyzing raw disk partitions or device files. Critical when validating exfiltrated data formats before transmission to C2 infrastructure.

## Authentication & setup

No authentication required; file operates on local filesystem permissions. Ensure read access to target files (check with ls -l or stat). Runs as invoking user; does not require root unless inspecting protected files or device nodes. Magic database located at /usr/share/misc/magic (compiled as magic.mgc); verify presence with 'ls -lh /usr/share/misc/magic*'. Custom magic files can be specified with -m flag. No network connectivity needed for operation. Sandboxing via libseccomp enabled by default on supported systems; disable with -S if analyzing files causes sandbox violations (rare). No configuration files to manage.

## Key commands / parameters

Basic syntax: 'file [options] <file1> [file2 ...]'. Critical flags: '-i' or '--mime' outputs MIME type and charset (e.g., 'application/x-executable; charset=binary') instead of human description—mandatory for scripting. '-b' or '--brief' omits filename prefix, printing only type. '-L' dereferences symlinks (follows links to analyze target); '-h' does opposite (analyze symlink itself, default if POSIXLY_CORRECT undefined). '-s' or '--special-files' reads block/character special files like /dev/sda1 for filesystem detection. '-z' inspects contents of compressed files (gzip, bzip2, etc.). '-k' or '--keep-going' continues checking for additional matches beyond first hit. '-f <namefile>' reads filenames from file, one per line. '-m <magicfiles>' specifies alternate colon-separated magic database paths. '-n' or '--no-buffer' flushes stdout after each file (useful in pipes). '-0' uses NUL as output separator instead of newline (pairs with find -print0). '-N' suppresses filename padding/alignment. Example combining flags: 'file -b -i /tmp/unknown' returns 'application/x-sharedlib; charset=binary'.

## Example workflows

Identify all binaries in compromised user home: 'find /home/user -type f -print0 | xargs -0 file -i | grep "application/x-executable"'. Classify files before exfiltration: 'for f in /var/www/uploads/*; do file -b -i "$f" >> /tmp/manifest.txt; done'. Detect scripts via shebang: 'file -b script.sh' returns 'Bourne-Again shell script, ASCII text executable'. Check if binary is stripped: 'file ./binary' shows 'ELF 64-bit LSB executable, ... not stripped' or 'stripped'. Analyze raw partition: 'file -s /dev/sdb1' outputs filesystem type. Find encrypted files: 'file * | grep -i "encrypted\|pgp\|openssl"'. Verify download integrity: 'wget http://target/payload; file -b -i payload' confirms expected MIME type. Batch process with MIME output: 'file -i -f filelist.txt > types.csv'. Inspect compressed without extraction: 'file -z archive.tar.gz' shows inner tar format. Detect polyglot files: 'file -k suspicious.jpg' may reveal 'JPEG image data' and 'ZIP archive' simultaneously.

## Output format

Default format: '<filename>: <description>' where description is human-readable (e.g., 'PE32 executable (GUI) Intel 80386, for MS Windows'). With -b, only description printed. With -i, format becomes '<filename>: <MIME-type>; charset=<encoding>' (e.g., 'data.bin: application/octet-stream; charset=binary'). Multiple files produce one line per file. Symlinks show as 'symbolic link to <target>' unless -L used. Errors to stderr: 'cannot open', 'cannot stat'. Special files without -s flag: '<filename>: block special' or 'character special' without content analysis. Compressed file with -z shows nested format: 'archive.gz: gzip compressed data, was "file.tar", ...' Exit codes: 0 on success, 1 on error, 2 on usage error. Output is locale-dependent for descriptions but MIME types are always ASCII. No JSON/XML output; parse with awk/grep. Field separator is ': ' (colon-space). Use --print0 equivalent via -0 for NUL-terminated output when filenames contain colons.

## Common pitfalls

Trusting file extensions instead of content—always verify with file. Packed/obfuscated binaries may return generic 'data' or 'application/octet-stream'; requires unpacking first. File does not detect malicious intent, only format. Magic database false positives on short files with ambiguous headers. Symlink behavior differs based on POSIXLY_CORRECT environment variable; explicitly use -L or -h. Reading special files without -s flag yields no content analysis. Performance degradation with -z on large compressed archives. Custom magic files with -m must be compiled with file(1) tools. File does not execute code or macros; cannot detect runtime behavior. UTF-8/encoding detection is heuristic; charset field may be inaccurate. Network filesystem delays cause timeouts; copy files locally first. Assuming 'text/plain' is safe—may contain shell scripts or code. Confusing -i output: 'charset=binary' does not mean file is an executable, just non-text. File cannot decrypt encrypted containers or analyze password-protected archives.

## References

• https://man7.org/linux/man-pages/man1/file.1.html
• https://ss64.com/nt/
• https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/cc754340(v=ws.11)
• https://www.stat.berkeley.edu/~nolan/stat133/Fall05/lectures/ShellCmds4.pdf
