---
name: Hashcat
description: GPU-accelerated password cracking tool supporting 200+ hash types
  and multiple attack modes for credential security testing.
registry: security
tool_id: hashcat
category: password_cracking
tags:
  - password-cracking
  - hash-analysis
  - credential-testing
  - gpu-acceleration
  - brute-force
  - dictionary-attack
  - pentesting
mitre_techniques:
  - T1110
  - T1110.002
  - T1555
summary: "Hashcat is the primary tool for password hash cracking in authorized
  penetration tests and security audits. Use it when you have extracted password
  hashes (NTLM, MD5, SHA-family, etc.) from compromised systems and need to
  recover plaintext credentials for lateral movement or privilege escalation
  testing. Invoke with minimum four arguments: -m (hash type), -a (attack mode),
  hash file, and wordlist/mask. Hash type (-m) must match the algorithm (e.g.,
  -m 1000 for NTLM, -m 0 for MD5). Attack modes: 0=dictionary,
  3=brute-force/mask, 6=hybrid wordlist+mask, 7=hybrid mask+wordlist. GPU
  acceleration provides massive speed improvements over CPU-only cracking.
  Cracked passwords write to hashcat.pot by default; use -o to specify custom
  outfile. Use --show to display already-cracked hashes, --left for uncracked.
  Session management: --session=name to label runs, --restore to resume
  interrupted sessions, --runtime=X to limit execution time. Hash files contain
  one hash per line; use --username if format is username:hash. Masks use
  placeholders (?l=lowercase, ?u=uppercase, ?d=digit, ?s=special, ?a=all). Rules
  files in Rules/ directory apply transformations to wordlist entries. Common
  wordlists: rockyou.txt for leaked passwords. Expect high GPU utilization and
  heat generation during operation. Status display shows progress, speed (H/s),
  temperature, and ETA. Press 's' during execution to force status update, 'p'
  to pause, 'r' to resume, 'b' to bypass current attack. Performance depends
  heavily on hash complexity (unsalted MD5/NTLM cracks faster than
  bcrypt/PBKDF2). Legal use requires explicit written authorization from system
  owner. Use only on hashes you own or are authorized to test in scope-defined
  engagements."
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
  - https://dev.to/bhavikgoplani/hashcat-vs-john-the-ripper-a-comparative-benchmarking-of-password-cracking-tools-26a4
  - https://super.cs.uchicago.edu/usable18/crackingtutorial.html
  - https://hashcat.net/wiki/
generated_at: 2026-05-19T11:26:10.454Z
generated_by: anthropic
source_hash: e25e39b68bf3951b154d1f45ce5106ec0a4b80a9a9b7365c73199c016a39d5ca
---

# Hashcat

## Overview

Hashcat v6.2.5 is a cross-platform password recovery tool that leverages CPU and GPU acceleration to crack password hashes at high speed. Supports 200+ hash algorithms including NTLM, LM, MD4/5, SHA-family, bcrypt, and application-specific formats. Operates by generating password candidates via multiple attack modes, hashing them with the target algorithm, and comparing against provided hashes. GPU parallelization provides orders of magnitude faster cracking than CPU-only tools. Widely used in penetration testing, red team operations, security audits, and password policy assessment. Open-source and available on Windows, macOS, and Linux.

## When to use

Use hashcat when you have obtained password hashes during authorized security assessments and need to recover plaintext credentials. Common scenarios: (1) Cracking NTLM hashes dumped from ntds.dit after domain controller compromise to escalate privileges or move laterally. (2) Analyzing hashes from LSASS memory dumps, /etc/shadow files, or application databases. (3) Testing password policy strength by measuring crack rates against corporate credential stores. (4) Recovering passwords from hash captures during wireless assessments (WPA/WPA2). (5) Forensic analysis of encrypted containers or password-protected files. Do NOT use without explicit written authorization from system owner. Use is restricted to personal, non-commercial, legal purposes or authorized penetration testing engagements within defined scope. Prefer hashcat over John the Ripper when GPU acceleration is available or when dealing with modern hash types requiring high throughput.

## Authentication & setup

No authentication required. Hashcat is a standalone binary. Verify GPU drivers are installed for hardware acceleration: CUDA drivers for NVIDIA GPUs, OpenCL for AMD GPUs, or Metal for Apple Silicon. Check backend availability with --backend-info or -I flag. Use --backend-ignore-cuda, --backend-ignore-opencl, --backend-ignore-hip, or --backend-ignore-metal to disable specific backends if needed. Select specific devices with -d (e.g., -d 1,2 for first two GPUs). No network connectivity required. Expects hash file as input (one hash per line, or username:hash format with --username flag). Pre-installed wordlists typically in /usr/share/wordlists (Kali Linux) or download separately (rockyou.txt common). Rules files included in Rules/ directory. Examples directory contains sample hash files (A0.M0.hash) and corresponding plaintext (A0.M0.word) for testing. Monitor GPU temperature with --hwmon-temp-abort=100 to prevent overheating.

## Key commands / parameters

Minimum syntax: hashcat -m <hash_type> -a <attack_mode> <hashfile> <wordlist|mask>

Critical flags:
-m, --hash-type: Specify algorithm (e.g., 0=MD5, 1000=NTLM, 1800=SHA512crypt, 3200=bcrypt). Use -hh to list all 200+ supported types.
-a, --attack-mode: 0=straight/dictionary, 3=brute-force/mask, 6=hybrid wordlist+mask, 7=hybrid mask+wordlist, 1=combinator.
-o, --outfile: Write cracked passwords to specified file instead of hashcat.pot.
--show: Display already-cracked hashes from potfile without re-running attack.
--left: Show hashes not yet cracked.
--username: Parse username:hash format and ignore usernames.
--remove: Delete hashes from input file once cracked.
--session=name: Label session for later restoration.
--restore: Resume previously saved session.
--runtime=X: Abort after X seconds.
--force: Ignore warnings (use cautiously).
-r, --rules-file: Apply rule transformations from file.
-d, --backend-devices: Select specific GPU devices (comma-separated).
--hwmon-disable: Disable temperature monitoring.
--hwmon-temp-abort=X: Stop if GPU reaches X degrees Celsius.
-b: Run benchmark mode.
--quiet: Suppress output.
--increment: Increment mask length (for brute-force).
--increment-min/max: Set mask length range.

Mask characters (attack mode 3):
?l = lowercase (abcd...)
?u = uppercase (ABCD...)
?d = digits (0123456789)
?s = special (!@#$...)
?a = all printable ASCII
?b = all 0x00-0xFF

Interactive keys during execution:
s = force status display
p = pause
r = resume
b = bypass current mask/attack
q = quit

## Example workflows

1. Dictionary attack against NTLM hashes:
hashcat -m 1000 -a 0 ntlm_hashes.txt /usr/share/wordlists/rockyou.txt -o cracked.txt

2. Brute-force 6-character all-ASCII passwords on MD5:
hashcat -m 0 -a 3 md5_hashes.txt ?a?a?a?a?a?a

3. Dictionary attack with rule transformations:
hashcat -m 1000 -a 0 hashes.txt wordlist.txt -r rules/best64.rule

4. Show already-cracked hashes without re-running:
hashcat -m 1000 hashes.txt --show

5. Hybrid attack (wordlist + 2-digit suffix):
hashcat -m 0 -a 6 hashes.txt wordlist.txt ?d?d

6. Resume interrupted session:
hashcat --session=mysession --restore

7. Incremental mask attack (4-8 lowercase chars):
hashcat -m 1000 -a 3 hashes.txt ?l?l?l?l --increment --increment-min=4 --increment-max=8

8. Combinator attack (join two wordlists):
hashcat -m 0 -a 1 hashes.txt wordlist1.txt wordlist2.txt

9. Hash file with usernames (format user:hash):
hashcat -m 1000 -a 0 user_hash.txt wordlist.txt --username

10. Time-limited run (30 minutes max):
hashcat -m 1000 -a 0 hashes.txt wordlist.txt --runtime=1800

11. Benchmark GPU performance:
hashcat -b -m 1000

## Output format

Default output writes to hashcat.pot in format: hash:plaintext (one per line). Custom output with -o flag. Use --outfile-format to control output structure (1=hash:plain, 2=plain, 3=hex_plain, etc.). Screen output shows real-time status: session name, status (running/paused), hash type, attack mode, progress percentage, recovered count, rejected count, restore point, candidates tested, speed (H/s or kH/s), hardware utilization, and temperature. During execution, status updates at intervals (configure with --status-timer). On completion, displays summary: total hashes, cracked count, time started/stopped, and speed metrics. Use --show to query potfile for specific hashfile: displays cracked hashes in format hash:plaintext. Use --left to see uncracked hashes only. JSON output available with --outfile-json flag. Speed measured in hashes/second (H/s), thousands (kH/s), millions (MH/s), billions (GH/s), or trillions (TH/s) depending on performance. Temperature, fan speed, and GPU utilization displayed when hardware monitoring enabled. Progress percentage estimates completion based on keyspace size and current speed.

## Common pitfalls

Hash type mismatch: Incorrect -m value causes no matches even with correct password. Use hash identification tools or -hh to verify supported types. Line length exceptions: Hash file formatting errors (extra whitespace, wrong delimiters) cause parsing failures. Ensure one hash per line, no trailing characters. GPU driver issues: Missing or outdated CUDA/OpenCL drivers prevent GPU acceleration, defaulting to slow CPU mode. Verify with --backend-info before large jobs. Overheating: Extended GPU operation at 100% utilization can overheat hardware. Use --hwmon-temp-abort=100 and ensure adequate cooling. Insufficient keyspace: Brute-force masks too large (e.g., ?a?a?a?a?a?a?a?a) create infeasible keyspaces taking years. Start with realistic mask lengths based on password policy. Wordlist encoding: Non-ASCII characters in wordlists may require --hex-wordlist flag. Rule syntax errors: Invalid or incompatible rule files cause silent failures or crashes. Test rules on small hash sets first. Session interruption: Killing hashcat without graceful shutdown loses progress unless --session used. Always name important sessions. Potfile confusion: hashcat.pot accumulates all historical cracks; use --show with specific hashfile to filter. Legal exposure: Using hashcat on unauthorized hashes is illegal. Ensure written authorization and defined scope before engagement. Salted hashes: Many modern algorithms (bcrypt, scrypt, PBKDF2) intentionally slow cracking; expect drastically reduced speeds compared to unsalted MD5/NTLM. Performance expectations: Weak algorithms (MD5, NTLM) crack at GH/s rates; strong algorithms (bcrypt) may only achieve kH/s. Adjust strategy accordingly.

## References

• https://hashcat.net/files/hashcat_user_manual.pdf
• https://hashcat.net/wiki/doku.php?id=hashcat
• https://www.kali.org/tools/hashcat/
• https://www.blackhillsinfosec.com/hashcat-cheatsheet/
• https://liora.io/en/all-about-hashcat
• https://super.cs.uchicago.edu/usable18/crackingtutorial.html
• https://dev.to/bhavikgoplani/hashcat-vs-john-the-ripper-a-comparative-benchmarking-of-password-cracking-tools-26a4
• https://www.hypr.com/security-encyclopedia/hashcat
• https://www.bluevoyant.com/knowledge-center/penetration-testing-tools-6-free-tools-you-should-know
