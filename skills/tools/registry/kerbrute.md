---
name: Kerbrute
description: Kerberos pre-authentication brute-force tool for Active Directory
  user enumeration and password attacks via port 88.
registry: registry
tool_id: kerbrute
category: active-directory
tags:
  - kerberos
  - active-directory
  - enumeration
  - password-spray
  - bruteforce
  - authentication
  - recon
mitre_techniques:
  - T1110.003
  - T1110.001
  - T1589.002
  - T1078.002
summary: "Kerbrute exploits Kerberos pre-authentication responses to enumerate
  valid AD usernames and test credentials WITHOUT triggering account lockout
  during enumeration (userenum mode only). Use for: (1) username validation from
  wordlists via 'userenum' command — tests thousands of names rapidly without
  failed login attempts; (2) password spraying via 'passwordspray' — tests one
  password against many users (DOES increment failed logins); (3) single-user
  brute-force via 'bruteuser'; (4) credential pair testing via 'bruteforce'.
  Invoke as '/opt/tools/bin/kerbrute <command> -d <domain> [--dc <IP>]
  <input_file>'. Requires either '-d domain.local' or '--dc <IP>' specified; DC
  will be resolved via DNS if not provided. Default 10 threads; adjust with
  '-t'. Enable '--safe' flag to abort on account lockout. Output to file with
  '-o'; verbose mode with '-v' logs failures. Critical: userenum does NOT cause
  lockouts (pre-auth enumeration), but passwordspray/bruteuser/bruteforce DO
  count as failed logins and WILL lock accounts — use '--safe' and respect
  password policies. Expect '[+] VALID USERNAME: user@domain' for successful
  enumeration. Failed pre-auth attempts generate Event ID 4771; TGT requests
  generate 4768. Common workflow: enumerate users first, filter valid names,
  then spray with common passwords. Multi-threaded by default; use '--delay' to
  throttle (forces single thread)."
sources:
  - https://github.com/ropnop/kerbrute
  - https://www.linkedin.com/posts/wojciech-ciemski_detailed-guide-on-kerbrute-activity-7371271194274267136-eU2Z
  - https://www.hackingarticles.in/a-detailed-guide-on-kerbrute/
  - https://www.linkedin.com/posts/nishaasharmaa_a-deailed-guide-on-kerbrute-activity-7332375046973276161-_UH1
  - https://kerbrute.com/
  - https://pkg.go.dev/github.com/0xZDH/kerbrute
  - https://infosecwriteups.com/getting-hands-on-with-kerbrute-practical-ad-enumeration-attack-tactics-107b212d8d60
  - https://www.securonix.com/blog/hunting-kerbrute-analysis-detection-and-mitigation-of-kerberos-attacks-in-active-directory/
  - https://kerbrute.org/
  - https://www.hackingarticles.in/ad-recon-kerberos-username-bruteforce/
generated_at: 2026-05-19T11:19:26.070Z
generated_by: anthropic
source_hash: bfe5756f77b08cdaddbd218369d90fc4d3dfa69804e3fe30d452b0da24534339
---

# Kerbrute

## Overview

Kerbrute is a Go-based tool by Ronnie Flathers (ropnop) that performs Kerberos pre-authentication attacks against Active Directory environments. It communicates directly with the Domain Controller on port 88 to enumerate valid usernames and test credentials. The tool leverages different Kerberos error responses to distinguish valid usernames from invalid ones without triggering account lockout during enumeration phases. Supports four primary attack modes: userenum (username enumeration), passwordspray (one password, many users), bruteuser (one user, many passwords), and bruteforce (username:password combos from file).

## When to use

Use during initial AD reconnaissance to rapidly identify valid user accounts from OSINT-derived wordlists (LinkedIn scrapes, public dumps, common naming conventions). Deploy userenum mode for safe enumeration that does not increment failed login counters. Use passwordspray mode when you have a suspected weak/default password to test across multiple accounts (e.g., 'Welcome2024', 'Summer2024'). Deploy bruteforce mode to validate username:password pairs from credential leaks or breach databases. Use during red team engagements to simulate attacker enumeration tactics. Do NOT use bruteuser mode unless targeting a specific high-value account, as it rapidly triggers lockouts. Always check AD password policy first (lockout threshold, observation window) before password attacks.

## Authentication & setup

No authentication required to run — Kerbrute operates anonymously against Kerberos pre-authentication. Requires network access to the target Domain Controller on TCP/UDP port 88. Specify target domain with '-d domain.local' or explicit DC with '--dc <IP_address>'. If '--dc' not provided, Kerbrute performs DNS SRV lookup for _kerberos._tcp.<domain> to locate KDC. For Linux DCs or case-sensitive realms, use '--linux' flag. Supports SOCKS5 proxying with '--socks 127.0.0.1:1080'. Can force downgraded encryption with '--downgrade' (arcfour-hmac-md5) or specify etype with '--etype' (default: aes128-cts-hmac-sha1-96). No credential files or API keys needed. Ensure bidirectional DNS resolution if using domain name instead of IP.

## Key commands / parameters

Four primary commands:

1. **userenum**: '/opt/tools/bin/kerbrute userenum -d domain.local --dc 10.0.0.1 users.txt'
   - Enumerates valid usernames from wordlist
   - Does NOT trigger account lockout
   - Output: '[+] VALID USERNAME: user@domain.local'

2. **passwordspray**: '/opt/tools/bin/kerbrute passwordspray -d domain.local --dc 10.0.0.1 users.txt Password123'
   - Tests single password against user list
   - DOES count as failed login; respects lockout policy
   - Use '--safe' to abort on first lockout detected

3. **bruteuser**: '/opt/tools/bin/kerbrute bruteuser -d domain.local --dc 10.0.0.1 passwords.txt username'
   - Tests password list against single user
   - High lockout risk; use '--safe' flag

4. **bruteforce**: '/opt/tools/bin/kerbrute bruteforce -d domain.local --dc 10.0.0.1 combos.txt'
   - Tests username:password pairs from file (format: 'user:pass' per line)
   - DOES increment failed logins

Common flags:
- '-d, --domain': Required domain (e.g., contoso.com)
- '--dc': Optional DC IP (otherwise DNS lookup)
- '-t, --threads': Thread count (default 10)
- '-o, --output': Log file path
- '-v, --verbose': Log failures and errors
- '--safe': Abort on account lockout detection
- '--delay': Millisecond delay between attempts (forces single thread)
- '-H, --hash': Use NT hashes instead of passwords (rc4-hmac)
- '--hash-file': Save AS-REP hashes for offline cracking

## Example workflows

**1. Initial user enumeration:**
```
/opt/tools/bin/kerbrute userenum -d corp.local --dc 192.168.1.10 -o valid_users.txt usernames.txt
```
Filter valid users:
```
grep '\[+\] VALID USERNAME' valid_users.txt | awk '{print $7}' | awk -F@ '{print $1}' | sort -u > confirmed_users.txt
```

**2. Password spray with lockout protection:**
```
/opt/tools/bin/kerbrute passwordspray -d corp.local --dc 192.168.1.10 --safe -o spray_results.txt confirmed_users.txt 'Welcome2024'
```

**3. Combo list attack (username=password):**
```
cat confirmed_users.txt | awk '{print $0":"$0}' > combo_list.txt
/opt/tools/bin/kerbrute bruteforce -d corp.local --dc 192.168.1.10 --safe combo_list.txt
```

**4. Throttled enumeration to evade detection:**
```
/opt/tools/bin/kerbrute userenum -d corp.local --dc 192.168.1.10 --delay 500 -t 1 users.txt
```

**5. Capture AS-REP hashes for offline cracking (users without pre-auth):**
```
/opt/tools/bin/kerbrute userenum -d corp.local --dc 192.168.1.10 --hash-file asrep_hashes.txt users.txt
```

**6. Multi-threaded spray across large user base:**
```
/opt/tools/bin/kerbrute passwordspray -d corp.local -t 50 --dc 192.168.1.10 10000_users.txt 'Spring2024!'
```

## Output format

**Console output format:**
- Startup: 'Using KDC(s): <IP>:88'
- Valid user: '[+] VALID USERNAME: username@domain.local'
- Valid credential: '[+] VALID LOGIN: username@domain.local:password'
- Lockout detected: '[!] ACCOUNT LOCKED: username@domain.local'
- AS-REP hash: '[+] username@domain.local has no pre auth required. Dumping hash to capture AS-REP'
- Completion: 'Done! Tested X usernames (or passwords) in Y seconds'

**Log file format (with -o):**
Timestamped entries with same format as console. Use '-v' to include failures and errors.

**AS-REP hash format (--hash-file):**
Standard Hashcat/JtR format: '$krb5asrep$23$user@domain:hash'

**Filtering valid usernames:**
```
grep '\[+\] VALID USERNAME' output.txt | awk -F' ' '{print $7}' | awk -F'@' '{print $1}'
```

**Filtering valid credentials:**
```
grep '\[+\] VALID LOGIN' output.txt | awk '{print $7}'
```

Output includes timing statistics useful for calculating optimal thread count and estimating detection risk.

## Common pitfalls

**Account lockout:** passwordspray, bruteuser, and bruteforce modes ALL count as failed login attempts and WILL lock accounts if exceeding threshold. ALWAYS use '--safe' flag during initial testing. Query AD password policy first: 'net accounts /domain' or 'crackmapexec smb <DC> -u '' -p '' --pass-pol'.

**DNS resolution failures:** If '--dc' not specified, Kerbrute relies on DNS SRV lookups. Ensure DNS can resolve the domain or explicitly provide DC IP. Error: 'Couldn't find any KDCs for realm'.

**Case sensitivity:** Windows AD realms are case-insensitive by default, but Linux KDCs are not. Use '--linux' flag when targeting MIT Kerberos or Samba DCs. Realm will not be auto-uppercased.

**Thread tuning:** Default 10 threads may trigger rate-limiting or IDS alerts. For stealthy operations, reduce threads ('-t 1 or 2') and add delay ('--delay 1000'). Note: setting '--delay' forces single-threaded mode regardless of '-t' value.

**Wordlist quality:** Enumeration success depends on accurate username lists. Build from OSINT (linkedin2username, hunter.io) and respect naming conventions (firstname.lastname, flastname, etc.). Random wordlists yield low hit rates.

**Pre-auth disabled accounts:** Users with 'Do not require Kerberos preauthentication' enabled return different errors. Kerbrute will dump AS-REP hashes for offline cracking; save with '--hash-file'.

**Monitoring blind spots:** While userenum doesn't trigger lockout, it DOES generate Event ID 4768 (TGT Request) and 4771 (Pre-auth Failed) logs. Defenders with SIEM correlation will detect high-volume enumeration. Throttle attempts in production.

**Version confusion:** Multiple Kerbrute forks exist (ropnop/kerbrute, 0xZDH/kerbrute). Verify you're using ropnop's version for documented behavior. Binary invocation is '/opt/tools/bin/kerbrute', not './kerbrute_linux_amd64'.

## References

- https://github.com/ropnop/kerbrute
- https://www.hackingarticles.in/a-detailed-guide-on-kerbrute/
- https://kerbrute.com/
- https://www.linkedin.com/posts/wojciech-ciemski_detailed-guide-on-kerbrute-activity-7371271194274267136-eU2Z
- https://infosecwriteups.com/getting-hands-on-with-kerbrute-practical-ad-enumeration-attack-tactics-107b212d8d60
- https://www.securonix.com/blog/hunting-kerbrute-analysis-detection-and-mitigation-of-kerberos-attacks-in-active-directory/
- https://www.hackingarticles.in/ad-recon-kerberos-username-bruteforce/
- https://pkg.go.dev/github.com/0xZDH/kerbrute
