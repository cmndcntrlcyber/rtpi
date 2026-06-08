---
name: Hydra
description: Fast network logon cracker supporting SSH, FTP, HTTP(S), and other
  protocols via parallel brute-force and dictionary attacks
registry: registry
tool_id: hydra
category: password-cracking
tags:
  - password-cracking
  - brute-force
  - credential-access
  - network-authentication
  - dictionary-attack
  - hydra
mitre_techniques:
  - T1110.001
  - T1110.003
summary: "Hydra (THC-Hydra) performs parallelized brute-force authentication
  attacks against network services. Invoke as `/usr/bin/hydra [options]
  [service://target[:PORT]]`. Core pattern: specify username(s) with `-l USER`
  or `-L FILE`, passwords with `-p PASS` or `-P FILE`, control parallelism with
  `-t TASKS` (default 16, tune per protocol—SSH typically 4-6, FTP higher). Use
  `-e nsr` to test null/same-as-login/reverse-login passwords. Protocols: ssh,
  ftp, http[s]-{get|post}-form, smb, rdp, telnet, pop3, imap, and 50+ others.
  For HTTP forms, syntax is `http-post-form` with three colon-separated fields:
  path, POST body with `^USER^` and `^PASS^` placeholders, and failure string
  (e.g., `F=incorrect`). Session management: `-R` restores crashed sessions, `-o
  FILE` logs valid credentials. Always use `-s PORT` for non-standard ports. Add
  `-V` or `-vV` for verbose output showing each attempt. Use `-f` to stop after
  first valid credential per host. SSL/TLS: prepend protocol with `-S` flag
  (e.g., `https-post-form`) or use explicit service names. Generates significant
  auth traffic—expect account lockouts, IDS/IPS alerts, and log flooding. Legal
  use requires explicit written authorization. Combine with `pw-inspector` to
  filter wordlists. Exit codes: 0=success (creds found), non-zero=failure."
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
generated_at: 2026-05-19T11:09:58.127Z
generated_by: anthropic
source_hash: 3134d009e1b9cea76698b1b030ecf9c4f675dd9e1eca7b96c864b45eff9a0d67
---

# Hydra

## Overview

Hydra v9.2 is a network authentication cracker supporting 50+ protocols including SSH, FTP, HTTP(S) form-based auth, SMB, RDP, Telnet, SMTP, and databases. It performs parallelized dictionary and brute-force attacks by replaying login attempts with credential lists. Designed for authorized penetration testing to identify weak passwords and authentication misconfigurations. Originally developed by van Hauser/THC. The tool generates login attempts against live services, making it inherently detectable.

## When to use

Use Hydra during authorized penetration tests when: (1) Nmap or service enumeration reveals authentication endpoints (SSH on 22, FTP on 21, web login forms, RDP on 3389). (2) Testing password policy enforcement and account lockout mechanisms. (3) Validating whether default/weak credentials exist post-deployment. (4) Assessing exposure to credential stuffing with breach data. (5) Auditing whether services properly rate-limit authentication attempts. Do NOT use without explicit written authorization from asset owner. Ideal after reconnaissance phase, before post-exploitation. Complements tools like Medusa, Ncrack. Prefer Hydra for protocol diversity and speed; prefer John/Hashcat for offline hash cracking.

## Authentication & setup

No authentication required to run Hydra itself—it is the attacker. Target services require credentials you are testing. Pre-requisites: (1) Wordlists in plaintext, one credential per line (common paths: `/usr/share/wordlists/rockyou.txt`, `/usr/share/wordlists/metasploit/unix_passwords.txt`). (2) Target IP/hostname and confirmed service/port (verify with Nmap first). (3) For HTTP forms: intercept a failed login with Burp/browser DevTools to extract POST parameters, path, and failure indicator text. No config files needed. Hydra reads from command line only. Use `hydra-wizard` for interactive guided setup if unfamiliar with syntax. Tool is pre-installed on Kali Linux at `/usr/bin/hydra`. For custom builds, protocols are modular; ensure required libraries (libssh, libssl) are present.

## Key commands / parameters

Core syntax: `hydra [OPTIONS] [service://]target[:PORT][/OPT]`

**Target specification:**
`-l LOGIN` = single username
`-L FILE` = username list
`-p PASS` = single password
`-P FILE` = password list
`-C FILE` = colon-separated user:pass pairs (format `user:password`)
`-e nsr` = test (n)ull password, (s)ame-as-login, (r)everse login

**Performance:**
`-t TASKS` = parallel tasks (default 16; use 4-6 for SSH, up to 64 for HTTP)
`-w TIME` / `-W TIME` = response wait timeout / connect timeout (seconds)
`-f` = exit after first valid credential found per host
`-F` = exit after first valid credential across all hosts

**Protocol/connection:**
`-s PORT` = target port (overrides default)
`-S` = use SSL/TLS
`-m MODULE_OPT` = module-specific options (e.g., HTTP path)

**Output:**
`-o FILE` = write found credentials to file
`-b FORMAT` = output format (text, json, jsonv1)
`-v/-V` = verbose (show attempts) / very verbose
`-d` = debug mode

**Session:**
`-R` = restore previous aborted session
`-I` = ignore existing restore file

**HTTP form example:**
`http-post-form "/login.php:username=^USER^&password=^PASS^:F=incorrect"` where F= indicates failure string in response.

**Common services:** `ssh://`, `ftp://`, `http-get-form`, `http-post-form`, `https-post-form`, `smb://`, `rdp://`, `mysql://`, `postgres://`

## Example workflows

**SSH brute-force (single user, wordlist):**
`hydra -l root -P /usr/share/wordlists/metasploit/unix_passwords.txt -t 4 ssh://192.168.1.10`

**FTP with username list:**
`hydra -L users.txt -P passwords.txt -t 16 ftp://10.0.0.5`

**HTTP POST form (WordPress admin):**
`hydra -l admin -P /usr/share/wordlists/rockyou.txt -t 10 192.168.1.20 http-post-form "/wp-login.php:log=^USER^&pwd=^PASS^&wp-submit=Log+In:F=incorrect"`

**HTTPS form with SSL:**
`hydra -l administrator -P passes.txt -s 443 -S 10.10.10.50 https-post-form "/auth:user=^USER^&pass=^PASS^:F=Invalid"`

**Test null/same/reverse passwords:**
`hydra -L userlist.txt -e nsr ssh://target.com`

**Colon-separated pairs (credential stuffing):**
`hydra -C breached_creds.txt ftp://192.168.1.100`

**RDP with custom port:**
`hydra -l Administrator -P passwords.txt -s 3390 rdp://10.0.5.20`

**Session restore after crash:**
`hydra -R`

**Stop after first valid credential:**
`hydra -l user -P wordlist.txt -f ssh://target`

**Multi-target from file:**
`hydra -L users.txt -P passes.txt -M targets.txt ssh`

## Output format

**Real-time stdout:** Shows service, port, protocol, and progress. With `-v`, displays each attempt: `[ATTEMPT] target:22 ssh - login "user" password "pass123"`. Success: `[22][ssh] host: 192.168.1.10   login: root   password: toor`. **Summary:** Prints statistics on completion: total attempts, time elapsed, valid credentials found. **File output (`-o`):** Plain text, one credential per line: `[PORT][PROTOCOL] host: IP   login: USER   password: PASS`. **Exit codes:** 0 = at least one credential found, 1 = no credentials found, 2+ = error (connection, syntax). **Session files:** `.restore` file auto-created in working directory for crash recovery with `-R`. **Verbose modes:** `-v` shows login:password pairs tested; `-vV` adds server responses. **Debugging (`-d`):** Dumps protocol-level exchanges. **Logs on target:** Each attempt generates auth failure in target system logs (e.g., `/var/log/auth.log` for SSH, Event Viewer Security log on Windows, application logs for HTTP). Expect massive log volume and potential lockouts.

## Common pitfalls

**Account lockout:** Many environments lock accounts after 3-10 failed attempts. Use `-t 1` with delays or test lockout thresholds first. Monitor target logs or use small wordlists initially. **Rate limiting / IPS blocks:** Firewalls and intrusion prevention systems detect rapid auth attempts. Hydra may get IP-banned mid-attack. Use `-w` delays or distributed attacks (risky/noisy). **Protocol mismatch:** Ensure service is actually running—`ssh://` on FTP port fails silently. Verify with Nmap first. **HTTP form syntax errors:** Incorrect POST parameter names, wrong failure string (use `F=text` not `S=success` unless intentional), missing URL encoding. Capture real login with Burp to confirm. **Thread overload:** `-t 64` on SSH causes connection exhaustion and false negatives; stay at 4-6. FTP/HTTP can handle more. **SSL/TLS confusion:** Forgetting `-S` flag or using `http://` instead of `https-post-form` for encrypted services. **Wordlist encoding issues:** Non-ASCII characters in wordlists may cause skips or crashes. Use UTF-8 or ASCII-clean lists. **Legal exposure:** Running Hydra without authorization is illegal in most jurisdictions (CFAA in US, Computer Misuse Act in UK). Always obtain written consent and rules of engagement. **Session restore overwrites:** Starting new attack without `-I` waits 10 seconds for restore confirmation. **Log flooding on target:** Generates thousands of auth failures—may trigger SOC alerts, disk space issues on target, or service degradation.

## References

• https://www.kali.org/tools/hydra/
• https://liora.io/en/everything-about-brute-force-attack
• https://www.youtube.com/watch?v=lTyVksdhddY
• https://hydra.cc/docs/intro/ (Note: different tool—Facebook Hydra framework, not THC-Hydra)
• https://cimss.ssec.wisc.edu/dbs/Indonesia2011/Day2/HYDRA_Commands.pdf (Note: different tool—satellite imagery HYDRA)
