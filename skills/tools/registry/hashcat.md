---
name: Hashcat
description: GPU-accelerated password hash cracker supporting 200+ hash types
  and multiple attack modes including dictionary, brute-force, and rule-based.
registry: registry
tool_id: hashcat
category: password-cracking
tags:
  - password-cracking
  - hash-analysis
  - brute-force
  - dictionary-attack
  - gpu-acceleration
  - credential-recovery
  - pentest
mitre_techniques:
  - T1110
  - T1110.002
  - T1552.001
summary: "Hashcat is a high-performance password recovery tool that attempts to
  recover plaintext passwords from cryptographic hashes. Use it during
  authorized penetration tests to validate password strength, audit credential
  security, or simulate credential compromise scenarios. Requires explicit
  permission from system owner before use. Invoke via `/usr/bin/hashcat` with
  minimum required arguments: `-m <hash-type>` (e.g., 1000 for NTLM, 100 for
  SHA1, 0 for MD5), `-a <attack-mode>` (0=dictionary, 3=brute-force/mask,
  6=hybrid wordlist+mask, 7=hybrid mask+wordlist), hash file or literal hash,
  and wordlist/mask. Supports GPU acceleration (CUDA, OpenCL, Metal) for massive
  speed gains. Cracked hashes auto-save to hashcat.pot in working directory
  unless overridden with `-o`. Use `--show` to display already-cracked hashes,
  `--left` for uncracked. Session management via `--session=<name>` and
  `--restore` enables resuming long jobs. Mask mode uses character placeholders:
  `?l`=lowercase, `?u`=uppercase, `?d`=digit, `?s`=special, `?a`=all printable
  ASCII; combine with `--increment` to test variable lengths. Rule-based attacks
  (`-r rules/best64.rule`) apply transformations to wordlist entries (leetspeak,
  case changes, appends). Use `--username` to ignore username prefixes in hash
  files. Expect verbose real-time status showing speed (H/s), progress, ETA, and
  temperature. Monitor with `--runtime=<seconds>` to limit execution time. Use
  `-hh` to list all 200+ supported hash modes. Performance scales with GPU
  capability; CPU-only fallback available but significantly slower. Always
  verify you have written authorization before cracking any hashes not created
  by you."
sources:
  - https://hashcat.net/files/hashcat_user_manual.pdf
  - https://liora.io/en/all-about-hashcat
  - https://www.kali.org/tools/hashcat/
  - https://www.blackhillsinfosec.com/hashcat-cheatsheet/
  - https://www.hypr.com/security-encyclopedia/hashcat
  - https://hashcat.net/wiki/doku.php?id=hashcat
  - https://www.youtube.com/watch?v=EfqJCKWtGiU
  - https://arxiv.org/html/2505.06084v1
  - https://www.bluevoyant.com/knowledge-center/penetration-testing-tools-6-free-tools-you-should-know
  - https://super.cs.uchicago.edu/usable18/crackingtutorial.html
  - https://in.security/2022/06/20/hashcat-pssw0rd-cracking-brute-force-mask-hybrid/
  - https://hashcat.net/wiki/
generated_at: 2026-05-19T10:59:31.412Z
generated_by: anthropic
source_hash: 131935936090722eeb371d2d28b1f43941f5cccdd8541362bb0eec6794834297
---

# Hashcat

## Overview

Hashcat v6.2.5 is a cross-platform password recovery tool that uses CPU and GPU acceleration to crack password hashes. It supports over 200 hash types including NTLM, MD5, SHA family, bcrypt, and application-specific formats. Primary attack modes include dictionary (wordlist), brute-force (mask), combination, and hybrid attacks. Rule engines apply transformations to wordlist entries. GPU acceleration via CUDA, OpenCL, and Metal provides orders-of-magnitude speed improvements over CPU-only cracking. Used in penetration testing, security audits, and Purple Team exercises to identify weak passwords and assess credential security posture.

## When to use

Use hashcat when you need to recover plaintext passwords from captured hashes during authorized penetration tests or security audits. Common scenarios: testing password policy strength, auditing domain credentials after extracting NTDS.dit or SAM hashes, analyzing dumped database password hashes, simulating lateral movement via credential compromise, recovering lost passwords on systems you own or have written permission to test. Do NOT use against hashes you did not create without explicit written authorization from the system owner. Hashcat excels when you have GPU resources available and need high-speed cracking of standard hash algorithms. Choose it over John the Ripper when GPU acceleration and broader hash-type support are priorities.

## Authentication & setup

No authentication required. Hashcat runs as a standalone binary at /usr/bin/hashcat. Verify GPU availability with `hashcat -I` to show backend/device info. For optimal performance, ensure GPU drivers are current (NVIDIA CUDA, AMD ROCm/OpenCL, or Apple Metal). Hashcat will auto-detect available compute devices. Use `--backend-info` or `-I` flag to view detected GPUs/CPUs. Force specific backend with flags like `--backend-ignore-cuda` or `--backend-ignore-opencl` if needed. Select specific devices with `-d <device-num>`. No API keys, credentials, or network access required. Wordlists must be prepared separately; common lists like rockyou.txt are typically pre-installed in /usr/share/wordlists on Kali systems. Place custom wordlists and rule files in accessible directories.

## Key commands / parameters

Minimum invocation: `hashcat -m <hash-type> -a <attack-mode> <hashfile> [wordlist|mask]`

**Critical flags:**
`-m, --hash-type <num>` - Hash algorithm (0=MD5, 100=SHA1, 1000=NTLM, 1800=SHA512(Unix), etc. Use `-hh` for full list)
`-a, --attack-mode <num>` - 0=dictionary, 3=brute-force/mask, 6=hybrid wordlist+mask, 7=hybrid mask+wordlist
`-o, --outfile <file>` - Save cracked hashes to file (default: hashcat.pot)
`--show` - Display already-cracked hashes from potfile
`--left` - Show uncracked hashes
`--username` - Ignore username portion in hashfile (format: user:hash)
`--remove` - Delete hash from input file once cracked
`--force` - Ignore warnings (use cautiously)

**Session management:**
`--session=<name>` - Name session for resuming
`--restore` - Resume previous session
`--runtime=<seconds>` - Abort after X seconds

**Mask attack (mode 3):**
`?l` = lowercase a-z
`?u` = uppercase A-Z
`?d` = digits 0-9
`?s` = special chars
`?a` = all printable ASCII
`--increment` - Start at length 1, increment to mask length

**Rule-based:**
`-r <rulefile>` - Apply transformation rules (e.g., `-r rules/best64.rule`)

**Performance:**
`-d <device-id>` - Select specific GPU/CPU
`-w <1-4>` - Workload profile (1=low, 4=nightmare)
`--hwmon-disable` - Disable temp monitoring
`--hwmon-temp-abort=<degrees>` - Stop if GPU exceeds temp

**Info/debug:**
`-h` - Help
`-hh` - Show all hash modes
`-I` - Show backend/device info
`-b` - Benchmark selected hash mode

## Example workflows

**Dictionary attack on NTLM hashes:**
`hashcat -m 1000 -a 0 ntlm_hashes.txt /usr/share/wordlists/rockyou.txt -o cracked.txt`

**Dictionary + rules (Best64) on SHA1:**
`hashcat -m 100 -a 0 sha1_hashes.txt rockyou.txt -r rules/best64.rule`

**Brute-force 6-char all-ASCII NTLM with increment:**
`hashcat -m 1000 -a 3 ntlm.txt ?a?a?a?a?a?a --increment`

**Brute-force 8-char lowercase-only:**
`hashcat -m 1000 -a 3 hash.txt ?l?l?l?l?l?l?l?l`

**Hybrid: wordlist + 2-digit append:**
`hashcat -m 1000 -a 6 hashes.txt wordlist.txt ?d?d`

**Show already-cracked hashes:**
`hashcat -m 1000 --show ntlm_hashes.txt`

**Show uncracked hashes:**
`hashcat -m 1000 --left ntlm_hashes.txt`

**Resume named session:**
`hashcat --session=mycrack --restore`

**Time-limited run (1 hour):**
`hashcat -m 1000 -a 0 hashes.txt wordlist.txt --runtime=3600`

**Handle username:hash format:**
`hashcat -m 1000 -a 0 --username users_and_hashes.txt wordlist.txt`

**Benchmark NTLM performance:**
`hashcat -b -m 1000`

**Check device info:**
`hashcat -I`

## Output format

Real-time status displays: session name, status (running/paused/cracked), hash type, attack mode, speed (H/s or KH/s), progress percentage, remaining candidates, time started, ETA, recovered hashes count, GPU temperature/utilization. Press 's' during execution to force status update. Upon cracking, hashcat shows plaintext immediately in terminal. Cracked hashes persist in hashcat.pot (default) or specified outfile with format `hash:plaintext` (format customizable via `--outfile-format`). Use `--show` against original hashfile to display all previously cracked entries. Potfile is cumulative across sessions. Verbose output includes GPU utilization, temperature warnings, and kernel compilation status. Errors/warnings appear for malformed hashes, unsupported platforms, or overheating GPUs. Session auto-saves progress; interrupted jobs resume with `--restore`. Final summary shows total cracked count, time elapsed, and recovery rate.

## Common pitfalls

**Legal/authorization:** Never run against hashes without explicit written permission. Unauthorized use is illegal and unethical. Always verify scope before testing.

**Hash format issues:** Ensure hashes match expected format for mode. Use `--username` if file contains `user:hash` format. Malformed hashes cause parsing errors. Validate hash type with `-hh` and example hashes.

**Performance:** CPU-only mode is 10-100x slower than GPU. Verify GPU detected with `-I`. Older/unsupported GPUs may require `--force` but run slower. Overheating GPUs throttle performance; monitor with `--hwmon-temp-abort`.

**Wordlist paths:** Relative paths may fail; use absolute paths for wordlists outside current directory. Verify wordlist exists and is readable.

**Mask length:** Brute-force becomes computationally infeasible above 8-9 characters. Use `--increment` to avoid testing only exact length. Calculate keyspace before starting long jobs.

**Session management:** Not naming sessions makes resuming difficult. Use `--session=<name>` for any long-running job. Potfile collisions possible if running multiple instances; specify unique `-o` files.

**Rule files:** Rule syntax errors cause silent failures. Test rules on small hash sets first. Rules path must be correct; default location is `rules/` subdirectory.

**Resource limits:** Large wordlists or complex masks may exhaust memory. Monitor system resources. Use `--runtime` to prevent infinite jobs.

**Binary selection:** Ensure using correct binary for architecture (32/64-bit, CPU/GPU variant). On some systems, hashcat.bin vs hashcat-cli64.bin matters.

**Potfile confusion:** `--show` displays cracks from potfile, not from current run. Use `--left` to see what remains uncracked. Clear potfile if retesting same hashes.

## References

• https://hashcat.net/files/hashcat_user_manual.pdf
• https://hashcat.net/wiki/doku.php?id=hashcat
• https://www.kali.org/tools/hashcat/
• https://www.blackhillsinfosec.com/hashcat-cheatsheet/
• https://in.security/2022/06/20/hashcat-pssw0rd-cracking-brute-force-mask-hybrid/
• https://super.cs.uchicago.edu/usable18/crackingtutorial.html
• https://liora.io/en/all-about-hashcat
• https://www.hypr.com/security-encyclopedia/hashcat
