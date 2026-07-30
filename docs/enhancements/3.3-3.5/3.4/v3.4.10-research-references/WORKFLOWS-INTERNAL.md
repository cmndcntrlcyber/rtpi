# v3.4.10 Research References — Internal Workflows

**Context:** Standalone nexus-kali usage via `nexus` CLI. No RTPI involved.

---

## Workflow 1: Exploit Research with searchsploit

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `exploit-dev/searchsploit-lookup`, `exploit-dev/custom-exploit`

```
1. Scope check -> verify target software/service is in engagement scope
2. Search by CVE:
   searchsploit --cve 2024-XXXXX
3. Search by software name and version:
   searchsploit apache 2.4.49
4. Examine exploit details:
   searchsploit -x /path/to/exploit.py
5. Copy exploit to engagement working directory:
   searchsploit -m 50383 -> /results/$ENGAGEMENT/exploit-dev/exploits/
6. Cross-reference with existing nuclei templates:
   - Check if a nuclei template already covers this CVE
   - If yes, note template ID for potential recon-phase detection
   - If no, exploit source may inform a custom nuclei template
7. Adapt exploit for target environment:
   - Review exploit source for hardcoded values (IP, port, path)
   - Modify parameters to match target
   - Hand off to custom-exploit skill for final preparation and execution
8. Log search queries and selected exploits to engagement results
```

### Example Session

```bash
# Operator searches for Apache path traversal exploits
nexus skill exploit-dev/searchsploit-lookup \
  --query "apache 2.4.49 path traversal" \
  --engagement ENG-2026-078

# Skill returns:
# EDB-ID  | Title                                    | Platform
# 50383   | Apache 2.4.49 - Path Traversal & RCE     | Multiple
# 50406   | Apache 2.4.50 - Path Traversal (CVE-...)  | Linux

# Operator copies exploit for review
nexus skill exploit-dev/searchsploit-lookup \
  --copy 50383 \
  --engagement ENG-2026-078

# Exploit source copied to /results/ENG-2026-078/exploit-dev/exploits/50383.py
# Operator proceeds with custom-exploit skill to adapt and deploy
```

---

## Workflow 2: Payload Selection for Engagement

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `exploit-dev/payload-reference`, `exploit-dev/payload-delivery`, `exploit-dev/msfvenom-payloads`

```
1. Scope check -> verify target technology is in engagement scope
2. Identify target technology stack:
   - Web application framework (PHP, Java, Node.js, etc.)
   - Operating system (Linux, Windows)
   - Specific service or protocol
3. Query PayloadsAllTheThings by technique category:
   - SQL Injection, XXE, SSRF, SSTI, Command Injection, etc.
   - Privilege escalation (Linux/Windows)
   - Reverse shells by language
4. Review returned payloads:
   - Read technique description and context
   - Identify applicable payloads for target environment
   - Note any prerequisites or dependencies
5. Select and adapt payload:
   - Substitute target-specific values (IP, port, path, encoding)
   - Choose encoding/obfuscation if evasion is required
6. Feed payload into downstream skill:
   - payload-delivery skill for direct delivery
   - msfvenom-payloads skill if msfvenom generation is preferred
   - custom-exploit skill if payload is part of a larger exploit chain
7. Log payload selection rationale to engagement results
```

### Example Session

```bash
# Operator needs SSTI payloads for a Jinja2 target
nexus skill exploit-dev/payload-reference \
  --category "Server Side Template Injection" \
  --technology "Jinja2" \
  --engagement ENG-2026-078

# Skill returns:
# Category: Server Side Template Injection / Jinja2
#
# Detection payloads:
#   {{7*7}}  ->  49
#   {{config}}  ->  application config dump
#
# RCE payloads:
#   {{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
#   ...
#
# Reference: PayloadsAllTheThings/Server Side Template Injection/README.md

# Operator selects RCE payload and hands off to payload-delivery
nexus skill exploit-dev/payload-delivery \
  --payload-file /results/ENG-2026-078/exploit-dev/payloads/ssti-jinja2-rce.txt \
  --target https://target.example.com/search \
  --engagement ENG-2026-078
```

---

## Workflow 3: Coverage-Guided Fuzzing Campaign

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `exploit-dev/aflplusplus-fuzz`, `exploit-dev/buffer-overflow`

```
1. Scope check -> verify target binary is in engagement scope
2. Identify target binary and input format:
   - Determine input type (file, stdin, network)
   - Locate or obtain source code if available
   - Identify any required libraries or dependencies
3. Instrument target with AFL++ compilers:
   - Source available: recompile with afl-cc / afl-c++
     CC=afl-cc CXX=afl-c++ ./configure && make
   - Source unavailable: use QEMU mode (afl-fuzz -Q) or
     Unicorn mode for binary-only fuzzing
4. Prepare seed corpus:
   - Gather valid input samples for the target
   - Minimize corpus with afl-cmin
   - Place seeds in /results/$ENGAGEMENT/exploit-dev/fuzzing/corpus/
5. Launch fuzzing campaign:
   afl-fuzz -i corpus/ -o findings/ -m none -t 1000 -- ./target_binary @@
   - Set resource limits (CPU time, memory, disk)
   - Configure campaign duration (default: 24h, configurable)
6. Monitor campaign progress:
   - Track executions/sec, paths found, crashes, hangs
   - afl-whatsup for multi-core campaign status
   - Log periodic stats to engagement results
7. Triage crashes:
   - Deduplicate with afl-cmin on crash directory
   - Minimize crash inputs with afl-tmin
   - Classify crash types (SEGV, SIGABRT, SIGFPE, etc.)
   - Identify unique crash signatures
8. Report findings:
   - Unique crashes -> /results/$ENGAGEMENT/exploit-dev/fuzzing/crashes/
   - Coverage statistics -> /results/$ENGAGEMENT/exploit-dev/fuzzing/stats/
   - Crash analysis summaries -> /results/$ENGAGEMENT/exploit-dev/fuzzing/reports/
9. Hand off confirmed crashes to buffer-overflow skill for detailed analysis
   - Provide crash input, target binary, and crash metadata
   - buffer-overflow skill performs root cause analysis
```

### Example Session

```bash
# Operator instruments a PDF parser for fuzzing
nexus skill exploit-dev/aflplusplus-fuzz \
  --action instrument \
  --source-dir /targets/pdfparser/ \
  --engagement ENG-2026-078

# Target compiled with AFL++ instrumentation
# Binary at /results/ENG-2026-078/exploit-dev/fuzzing/bin/pdfparser

# Operator starts fuzzing campaign with sample PDFs as corpus
nexus skill exploit-dev/aflplusplus-fuzz \
  --action fuzz \
  --binary /results/ENG-2026-078/exploit-dev/fuzzing/bin/pdfparser \
  --corpus /targets/pdfparser/samples/ \
  --duration 12h \
  --engagement ENG-2026-078

# Campaign runs for 12 hours, operator checks status
nexus skill exploit-dev/aflplusplus-fuzz \
  --action status \
  --engagement ENG-2026-078

# Status:
# Runtime: 4h 23m | Execs/sec: 1,247 | Paths: 892 | Crashes: 7 | Hangs: 2

# After campaign completes, triage crashes
nexus skill exploit-dev/aflplusplus-fuzz \
  --action triage \
  --engagement ENG-2026-078

# Triage results:
# 7 total crashes -> 3 unique crash signatures
# Crash 1: SEGV in parse_xref() - heap buffer overflow
# Crash 2: SIGABRT in decompress_stream() - assertion failure
# Crash 3: SEGV in render_page() - null pointer dereference
#
# Minimized crash inputs saved to:
# /results/ENG-2026-078/exploit-dev/fuzzing/crashes/
```
