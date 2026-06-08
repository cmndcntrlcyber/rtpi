---
name: Hydra
description: Fast network logon cracker supporting numerous protocols for
  brute-force password attacks against SSH, FTP, HTTP, and other services.
registry: security
tool_id: hydra
category: password_cracking
tags:
  - password-cracking
  - brute-force
  - network-authentication
  - credential-testing
  - dictionary-attack
  - protocol-testing
mitre_techniques:
  - T1110.001
  - T1110.003
  - T1078
summary: "Hydra performs parallelized brute-force attacks against network
  authentication services. Invoke with `hydra [options]
  [service://target[:PORT]]`. Core workflow: specify target (-l username or -L
  userlist), passwords (-p password or -P wordlist), protocol (ssh, ftp,
  http-post-form, etc.), and parallelism (-t threads). Use for credential
  validation during authorized penetration tests. Supports 50+ protocols
  including SSH, FTP, HTTP(S), RDP, SMB, Telnet. Key flags: -l/-L
  (username/list), -p/-P (password/list), -t (threads, default 16), -s (port),
  -e nsr (test null/same-as-login/reversed), -f (stop on first success), -V/-v
  (verbose), -o (output file). HTTP forms require detailed syntax specifying URL
  path and failure strings. Always verify authorization before use; generates
  significant authentication logs. Tool is loud and easily detected by IDS/IPS.
  Session restore via -R flag. Performance depends on target rate-limiting and
  network latency. Not stealthy—use only when authorized and detection is
  acceptable."
sources:
  - https://hydra.canada.ca/HyDRA_Web_User_Guide_Final_6Sept2016.pdf
  - https://www.kali.org/tools/hydra/
  - https://hydra.cc/docs/intro/
  - https://liora.io/en/everything-about-brute-force-attack
  - https://www.youtube.com/shorts/TdfitR1ZJ1Q
  - https://hydra.cc/docs/advanced/hydra-command-line-flags/
  - https://cimss.ssec.wisc.edu/dbs/Indonesia2011/Day2/HYDRA_Commands.pdf
  - https://www.creatis.insa-lyon.fr/newsletter/2023_01_04/pdfs/club_dev_hydra.pdf
  - https://hydra.cc/docs/advanced/override_grammar/basic/
  - https://mit-ll-responsible-ai.github.io/hydra-zen/tutorials/add_cli.html
  - https://hydracybersecurity.io/red-team
  - https://www.youtube.com/watch?v=lTyVksdhddY
generated_at: 2026-05-19T11:26:15.500Z
generated_by: anthropic
source_hash: 7dece3928402074b9c27231b3753dd5f725782cf090954b1ec88257b2bb6acdf
---

# Hydra

## Overview

Hydra (THC-Hydra) is a parallelized network authentication cracker supporting 50+ protocols. It performs dictionary and brute-force attacks against login services by automating credential testing across SSH, FTP, HTTP POST/GET forms, SMB, RDP, Telnet, and others. Version 9.2 includes core protocols and multi-threading capabilities. Designed for penetration testers and security professionals to validate password strength during authorized assessments. Generates high volumes of authentication attempts—detectable by monitoring systems.

## When to use

Use Hydra during authorized penetration tests or red team engagements to test authentication controls and identify weak credentials. Ideal when you have discovered services via reconnaissance (nmap, service enumeration) and need to validate credential security. Use when wordlists or username/password combinations are available. Appropriate for testing account lockout policies, monitoring/alerting effectiveness, and password policy compliance. Do NOT use without explicit written authorization—generates logs and triggers alerts. Best suited for scenarios where detection is acceptable or you're testing blue team response capabilities.

## Authentication & setup

No authentication or API keys required to run Hydra—it is the authentication testing tool itself. Hydra is pre-installed on Kali Linux and similar security distributions. Requires network connectivity to target services. No configuration files needed for basic usage. Ensure you have: (1) explicit written authorization for the target systems, (2) wordlists for usernames/passwords (common locations: /usr/share/wordlists/metasploit/, /usr/share/wordlists/rockyou.txt), (3) knowledge of target service type and port. Optional: hydra-wizard utility provides interactive setup for building commands. Verify target service is running and accessible before launching attacks. Consider network bandwidth and target rate-limiting when setting thread counts.

## Key commands / parameters

Basic syntax: `hydra [OPTIONS] [service://target[:PORT][/OPT]]`

Core options:
-l USERNAME : single username
-L FILE : username list file
-p PASSWORD : single password
-P FILE : password list file
-C FILE : colon-separated username:password pairs
-e nsr : test (n)ull passwords, (s)ame-as-login, (r)eversed login
-t TASKS : parallel threads (default 16; use 4-6 for SSH to avoid lockouts)
-s PORT : custom port
-f / -F : stop on first success (per host / globally)
-V / -v : verbose output showing each attempt
-o FILE : write results to file
-w / -W TIME : wait time between attempts / per connect
-S : use SSL/TLS
-R : restore previous session
-I : ignore existing restore file
-M FILE : target list file

Protocol examples:
ssh://192.168.1.10
ftp://target.com:2121
http-post-form://site.com/login.php:username=^USER^&password=^PASS^:F=incorrect

HTTP forms require format: path:parameters:failure_string where ^USER^ and ^PASS^ are placeholders, F= denotes failure string in response.

## Example workflows

Basic SSH attack with username list and password list:
`hydra -L users.txt -P passwords.txt -t 4 ssh://192.168.1.123`

Single user SSH with common passwords, verbose output:
`hydra -l root -P /usr/share/wordlists/metasploit/unix_passwords.txt -t 6 -V ssh://192.168.1.123`

FTP with null/same-as-login testing:
`hydra -L users.txt -e nsr -t 8 ftp://10.0.0.5`

HTTP POST form attack (login page):
`hydra -l admin -P wordlist.txt 192.168.1.100 http-post-form "/login.php:username=^USER^&password=^PASS^:F=Login failed" -V`

SSL-enabled service on custom port:
`hydra -l admin -P pass.txt -s 8443 -S https-get://target.com`

Multiple targets with output file:
`hydra -L users.txt -P pass.txt -M targets.txt -o results.txt ssh`

Resume interrupted session:
`hydra -R`

Stopping on first valid credential:
`hydra -l admin -P wordlist.txt -f ssh://target.com`

Test username:password pairs from file:
`hydra -C creds.txt ssh://192.168.1.50`

## Output format

Hydra outputs real-time status to stdout showing:
- Version banner and syntax confirmation
- [DATA] lines showing task distribution and attempt statistics
- [STATUS] progress updates with attempts/second
- [ATTEMPT] individual tries when using -V verbose mode
- [PORT][PROTOCOL] successful credentials in format: host: TARGET login: USER password: PASS
- Summary statistics on completion

Successful credentials clearly marked and can be written to file with -o flag. Output format:
[22][ssh] host: 192.168.1.123   login: root   password: toor

Verbose mode (-V) shows each attempt:
[ATTEMPT] target 192.168.1.123 - login "admin" - pass "password123" - 45 of 1003

Session state automatically saved to .restore file for resumption after crashes/interruptions. Errors like connection refused, timeouts, or authentication failures displayed inline. No structured output format (JSON/XML)—use -o for parseable results or redirect stdout.

## Common pitfalls

LEGAL: Using Hydra without explicit written authorization is illegal. Verify scope and authorization documents before every engagement.

DETECTION: Hydra is extremely loud. Generates massive authentication logs, triggers IDS/IPS alerts, and causes account lockouts. Not suitable for stealthy operations.

ACCOUNT LOCKOUT: High thread counts (-t) against services with lockout policies will lock accounts. Use -t 4-6 for SSH, -t 1-4 for services with aggressive lockout. Test lockout thresholds first.

RATE LIMITING: Targets may rate-limit connections causing false negatives. Use -w flag to add delays between attempts. Monitor for timeouts.

HTTP FORMS: Incorrect syntax for http-post-form/http-get-form is common. Must capture exact parameter names, use ^USER^/^PASS^ placeholders correctly, and identify accurate failure strings (F=) or success strings (S=). Test manually first.

FALSE NEGATIVES: Network issues, service restarts, or inconsistent responses cause missed valid credentials. Verify connectivity and service stability.

WORDLIST SIZE: Massive wordlists without filtering waste time. Pre-filter with pw-inspector or use targeted lists based on password policy reconnaissance.

NETWORK NOISE: Can saturate network connections or overwhelm target services causing DoS conditions. Monitor target availability during attacks.

LOG FORENSICS: Attackers and defenders both use Hydra. Failed attempts create audit trails in /var/log/auth.log (Linux SSH), Windows Event Logs (RDP/SMB), application logs (FTP/HTTP). Review logs post-engagement to verify detection.

## References

• https://www.kali.org/tools/hydra/
• https://liora.io/en/everything-about-brute-force-attack
• https://www.youtube.com/watch?v=lTyVksdhddY
