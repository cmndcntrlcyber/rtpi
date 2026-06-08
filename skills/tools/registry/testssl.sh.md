---
name: Testssl.Sh
description: Command-line tool to check TLS/SSL ciphers, protocols,
  cryptographic flaws, and server configuration on any port.
registry: registry
tool_id: testssl.sh
category: security-scanning
tags:
  - ssl
  - tls
  - security-scanning
  - cipher-testing
  - cryptography
  - vulnerability-detection
  - certificate-validation
mitre_techniques:
  - T1046
  - T1595.002
summary: testssl.sh tests TLS/SSL services on any port for cipher support,
  protocol versions, certificate validity, and cryptographic vulnerabilities.
  Invoke as `/opt/tools/bin/testssl.sh <URI>` or `/opt/tools/bin/testssl.sh
  <host:port>` for non-HTTPS services. Use `-t
  smtp|ftp|imap|pop3|postgres|mysql|ldap|xmpp|telnet` for STARTTLS. Use `-U` for
  all vulnerability checks, `-P` for server preferences, `-S` for
  certificate/server defaults, `-E` for per-protocol cipher enumeration. Use
  `--wide` for detailed cipher output including hex codes. Output is color-coded
  on terminal; use `--quiet` to suppress banner, `--severity` for file output,
  `--jsonfile <file>` or `--csvfile <file>` for machine-readable formats.
  Requires hexdump (mandatory dependency); may require newer OpenSSL for full
  cipher coverage. Tool leaves minimal traces but performs many connection
  attempts; use `--sneaky` and `--ids-friendly` to reduce IDS signatures. Does
  not phone home except for CRL/OCSP checks unless `--phone-out` is specified.
  Best for validating SSL/TLS posture, identifying weak ciphers, and confirming
  vulnerability patching. Always specify URI/host as final argument.
sources:
  - https://www.tecmint.com/testssl-sh-test-tls-ssl-encryption-in-linux-commandline/
  - https://github.com/testssl/testssl.sh
  - https://testssl.sh/doc/testssl.1.html
  - https://manpages.debian.org/testing/testssl.sh/testssl.1.en.html
  - https://testssl.sh/
  - https://pentestreports.com/tool/testssl.sh
  - https://www.darknet.org.uk/2018/10/testssl-sh-test-ssl-security-including-ciphers-protocols-detect-flaws/
  - https://www.blackhillsinfosec.com/testssl-sh-assessing-ssltls-configurations-at-scale/
  - https://blog.cyberadvisors.com/technical-blog/blog/installation-use-of-testssl-sh-tool
  - https://www.kali.org/tools/testssl.sh/
generated_at: 2026-05-19T11:16:39.368Z
generated_by: anthropic
source_hash: b00b896cc2e1c2807987dd89a0b5ccf748d38f3abf744614c39eaf48ae790ef4
---

# Testssl.Sh

## Overview

testssl.sh is a standalone bash script that comprehensively tests TLS/SSL implementations without requiring installation of additional libraries. It probes services for supported cipher suites, protocol versions (SSLv2, SSLv3, TLS 1.0-1.3, SPDY, HTTP/2), checks for known vulnerabilities (BEAST, CRIME, POODLE, Heartbleed, CCS Injection, ROBOT, LUCKY13, etc.), validates certificates, examines server preferences, and simulates various client behaviors. Works on Linux, macOS, FreeBSD, WSL, and MSYS2/Cygwin. Uses a mix of bash socket programming and OpenSSL s_client for maximum accuracy. Outputs color-coded results to terminal or structured formats (JSON, CSV) to files.

## When to use

Use testssl.sh when you need to validate TLS/SSL configuration during external/internal assessments, confirm remediation of SSL/TLS vulnerabilities reported by scanners like Nessus, identify weak or deprecated cipher suites, check certificate validity and chain trust, test non-standard SSL services (SMTP, IMAP, POP3, FTP, databases, LDAP), or assess compliance with security standards. Ideal for bulk testing when combined with `--file` to read targets from a list. Use during red team reconnaissance (T1595.002) to map service encryption posture and identify outdated crypto that may indicate unpatched systems. Run after gaining internal access to assess lateral movement targets. Not for active exploitation—strictly enumeration and configuration assessment.

## Authentication & setup

**Critical dependency**: testssl.sh requires `hexdump` installed on the system. The error message in tool metadata indicates it is missing—install via package manager before use: `apt-get install bsdmainutils` (Debian/Ubuntu) or `yum install util-linux` (RHEL/CentOS). No authentication required for testing remote services. No configuration files needed—tool runs standalone. Ensure `/opt/tools/bin/testssl.sh` is executable. Optional: use `--openssl /path/to/openssl` to specify a custom OpenSSL binary if system version is old (OpenSSL 1.1.1+ recommended for full cipher/TLS 1.3 support). For Docker environments, consider using the official container: `docker run --rm -it ghcr.io/testssl/testssl.sh <target>`. Tool performs DNS lookups by default; disable with `--nodns never` if operating in environments where DNS queries are monitored.

## Key commands / parameters

**Basic scan**: `/opt/tools/bin/testssl.sh <URI>` or `/opt/tools/bin/testssl.sh <host:port>`. URI format: `https://example.com`, `example.com:443`, or `192.168.1.10:8443`.

**STARTTLS protocols**: `-t smtp|ftp|imap|pop3|postgres|mysql|ldap|xmpp|telnet` (e.g., `-t smtp mail.example.com:25`).

**Selective tests**:
- `-e` / `--each-cipher` — test every local cipher individually (slow but thorough)
- `-E` / `--cipher-per-proto` — check ciphers per protocol version
- `-p` / `--protocols` — test TLS/SSL protocol support only
- `-P` / `--server-preference` — show server's cipher preference order
- `-S` / `--server-defaults` — display certificate info and server defaults
- `-U` — test all known vulnerabilities (Heartbleed, CCS, ROBOT, etc.)
- `-4` / `--rc4` — check RC4 cipher support

**Output options**:
- `--quiet` — suppress banner (acknowledges usage terms)
- `--wide` — detailed output with hex codes, key exchange, strength
- `--severity` — add severity ratings to output
- `--jsonfile <file>` — JSON output
- `--csvfile <file>` — CSV output
- `--logfile <file>` — text log

**Stealth/IDS evasion**:
- `--sneaky` — reduce log traces (user-agent, referer)
- `--ids-friendly` — skip checks that trigger IDS signatures

**Batch testing**: `--file <inputfile>` — read targets from file, one per line. Use `--parallel` for concurrent testing (faster but resource-intensive).

**Custom OpenSSL**: `--openssl /usr/bin/openssl` — specify alternative OpenSSL binary.

## Example workflows

**1. Quick vulnerability check of HTTPS service**:
```bash
/opt/tools/bin/testssl.sh -U https://target.com
```
Tests for all known vulnerabilities; review output for HIGH/CRITICAL findings.

**2. Test SMTP STARTTLS on mail server**:
```bash
/opt/tools/bin/testssl.sh -t smtp -S -P mail.company.com:25
```
Checks STARTTLS capability, certificate, and cipher preferences.

**3. Enumerate all ciphers per protocol on internal service**:
```bash
/opt/tools/bin/testssl.sh -E --wide 10.10.10.50:8443
```
Shows which ciphers are available for each TLS version with full details.

**4. Batch test from Nmap scan results** (prepare list first):
```bash
grep -oP '\d+\.\d+\.\d+\.\d+' nmap-https.txt > targets.txt
/opt/tools/bin/testssl.sh --file targets.txt --parallel --jsonfile results.json --quiet
```
Tests multiple targets concurrently, saves JSON for parsing.

**5. Stealthy certificate and protocol check**:
```bash
/opt/tools/bin/testssl.sh --sneaky --ids-friendly -p -S 192.168.5.10:443
```
Minimizes IDS signatures while checking protocols and certificate.

**6. Test database TLS (PostgreSQL)**:
```bash
/opt/tools/bin/testssl.sh -t postgres 10.0.5.20:5432
```
Checks PostgreSQL SSL/TLS configuration.

**7. Export findings for reporting**:
```bash
/opt/tools/bin/testssl.sh -U --severity --csvfile vulns.csv target.com
```
Vulnerability scan with severity ratings in CSV format for Excel/reporting tools.

## Output format

**Terminal output**: Color-coded by severity—green (OK/secure), yellow (warnings/medium), red (vulnerable/insecure). Output organized in sections: service info, protocols, ciphers, server preferences, vulnerabilities, certificate details. Each finding includes description, status, and often CVE references.

**JSON output** (`--jsonfile`): Structured with keys `scanTime`, `clientVersion`, `serverPreferences`, `protocols`, `ciphers`, `vulnerabilities`, `serverDefaults`, `rating`. Each test has `id`, `finding`, `severity`, `cve`, `cwe`. Parse with `jq` for automation: `jq '.vulnerabilities[] | select(.severity=="HIGH")' results.json`.

**CSV output** (`--csvfile`): Columns include hostname, port, finding, severity, CVE. Import into spreadsheets or ticketing systems.

**Log files** (`--logfile`): Plain text, human-readable, color codes stripped. Useful for archival or grepping: `grep -i vulnerable logfile.txt`.

**Exit codes**: 0 on successful completion. Tool focuses on reporting findings, not pass/fail—analyze output for actionable vulnerabilities. Non-zero exit typically indicates tool error (missing dependencies, invalid target), not security findings.

## Common pitfalls

**1. Missing hexdump dependency**: Error message "Fatal error: You need to install hexdump" means bsdmainutils (Debian) or util-linux (RHEL) package is not installed—install before running. **2. Outdated OpenSSL**: System OpenSSL < 1.1.1 will miss TLS 1.3 and modern ciphers; results show "Local problem: No engine or GOST support" or limited cipher lists—use `--openssl` with newer binary or Docker image. **3. Firewall/IDS blocking**: Many connection attempts may trigger rate limiting or IDS blocks—use `--ids-friendly` and `--sneaky`, or test from different source IPs. **4. STARTTLS confusion**: Forgetting `-t <protocol>` for STARTTLS services causes connection failures—always specify protocol for mail, FTP, database servers. **5. Interpreting color output in logs**: Colors don't persist in log files; use `--severity` flag to add textual severity markers. **6. Parallel mode resource exhaustion**: `--parallel` spawns many processes—can overwhelm target or local system; test serially first or limit concurrency. **7. False negatives with `--ssl-native`**: This mode is faster but less accurate, may miss vulnerabilities—avoid unless speed is critical and you accept reduced accuracy. **8. DNS leakage**: Tool performs reverse DNS by default—use `--nodns` in sensitive environments to prevent lookups that reveal testing activity. **9. Certificate transparency lookups**: Some checks query external CT logs unless disabled—review if operational security is a concern. **10. Target requires SNI**: Some virtual hosts need Server Name Indication; tool handles this but ensure you're testing the correct vhost if results seem wrong.

## References

- Official documentation: https://testssl.sh/doc/testssl.1.html
- GitHub repository: https://github.com/testssl/testssl.sh
- Installation guide (Tecmint): https://www.tecmint.com/testssl-sh-test-tls-ssl-encryption-in-linux-commandline/
- Debian man page: https://manpages.debian.org/testing/testssl.sh/testssl.1.en.html
- Black Hills InfoSec tutorial (scale testing): https://www.blackhillsinfosec.com/testssl-sh-assessing-ssltls-configurations-at-scale/
- Kali Linux package info: https://www.kali.org/tools/testssl.sh/
- Pentest reference: https://pentestreports.com/tool/testssl.sh
- Project home: https://testssl.sh/
