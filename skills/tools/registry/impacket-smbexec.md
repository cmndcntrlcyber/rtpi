---
name: Impacket Smbexec
description: Execute commands on remote Windows hosts via SMB by creating
  temporary services; similar to PsExec but does not write binaries to disk.
registry: registry
tool_id: impacket-smbexec
category: post-exploitation
tags:
  - post-exploitation
  - lateral-movement
  - smb
  - remote-execution
  - windows
  - impacket
  - credential-access
mitre_techniques:
  - T1021
  - T1021.002
  - T1569
  - T1569.002
  - T1059.003
summary: "impacket-smbexec provides semi-interactive remote command execution on
  Windows targets via SMB. Use when you have valid admin credentials (password,
  hash, or Kerberos ticket) and need to execute commands remotely without
  writing service binaries to disk. Unlike psexec.py, smbexec creates a
  temporary service for each command that writes output to a file (default:
  C$\\__output) and executes commands via cmd.exe wrapped in batch scripts
  (default: execute.bat). Requires SMB (TCP 445) access, administrative
  privileges, and Service Control Manager (SCM) permissions. Invoke:
  impacket-smbexec [domain/]user[:password]@target [command]. Authentication
  options: cleartext password, -hashes LM:NTLM for pass-the-hash, or -k -no-pass
  for Kerberos. Key flags: -service-name (set service name, default random),
  -share (output share, default C$), -mode (SERVER mode writes output to local
  SMB server instead of remote C$), -shell-type (cmd or powershell wrapper).
  Default creates service named 'BTOBTO'. Artifacts left on target: temporary
  service creation events (Event ID 7045), __output file, execute.bat.
  Stealthier than psexec but noisier than wmiexec. Each command creates/deletes
  a service, generating Windows Event Logs. Output retrieved via SMB share
  access. Watch for: cmd.exe spawned by services.exe with '/Q /c echo ^> 2^>&1',
  service creation under non-standard names, rapid service start/stop cycles,
  access to C$ or custom shares."
sources:
  - https://www.cybertriage.com/blog/dfir-breakdown-impacket-remote-execution-activity-smbexec/
  - https://tools.thehacker.recipes/impacket/examples/smbexec.py
  - https://research.splunk.com/endpoint/bb3c1bac-6bdf-4aa0-8dc9-068b8b712a76/
  - https://www.blackhillsinfosec.com/impacket-cheatsheet/
  - https://research.splunk.com/endpoint/c1238942-2715-41ee-b371-0475da48029c/
  - https://redcanary.com/threat-detection-report/threats/impacket/
  - https://u0041.co/posts/articals/smbexec-analysis/
  - https://www.kali.org/tools/impacket-scripts/
  - https://guardsix.com/blog/the-impacket-arsenal-a-deep-dive-into-impacket-remote-code-execution-tools
  - https://reliaquest.com/blog/exploring-impacket-abuse/
  - https://www.extrahop.com/blog/how-to-detect-impackets-hidden-lateral-movement-east-west
  - https://www.threatlocker.com/blog/top-post-exploitation-tools-threat-actors-use
generated_at: 2026-05-19T11:11:21.253Z
generated_by: anthropic
source_hash: 678ae7de54183c5caa65b1aa28f659295e71f2915ba5a91eae3b6b3b0564c1d8
---

# Impacket Smbexec

## Overview

impacket-smbexec is a Python-based Impacket tool that executes commands on remote Windows systems via SMB by creating and running temporary services. Unlike psexec.py, it does not upload service binaries to the target disk, making it somewhat stealthier. It uses the Windows Service Control Manager (SCM) to create a service for each command, executes it via cmd.exe, writes output to a file on a network share (default C$\__output), retrieves the output via SMB, and deletes the service. This provides a semi-interactive shell experience. The tool is widely used by penetration testers for legitimate assessments and by threat actors (including APT28, APT29, BlackCat/ALPHV ransomware) for lateral movement.

## When to use

Use smbexec when you need remote command execution on Windows targets and you have valid administrative credentials (password, NTLM hash, or Kerberos ticket). Prefer this over psexec.py when you want to avoid writing service executables to disk, though it is noisier than wmiexec.py due to service creation events. Ideal for: lateral movement after credential compromise, executing commands on multiple hosts with the same credentials, situations where WMI is blocked but SMB/SCM is accessible. Requires: administrative privileges on target, SMB (TCP 445) reachable, Service Control Manager accessible, user allowed to remotely create/start/delete services (default for local admins). Not suitable when you need full interactive sessions (use RDP or other methods) or when service creation events will trigger alerts.

## Authentication & setup

Authentication methods: (1) Cleartext credentials: impacket-smbexec domain/user:password@target, (2) Pass-the-hash: impacket-smbexec domain/user@target -hashes LMHASH:NTLM (LM hash optional, use format :NTLM if not available), (3) Kerberos: impacket-smbexec domain/user@target -k -no-pass (requires valid TGT in KRB5CCNAME environment variable). For Kerberos: first obtain TGT using impacket-getTGT, set export KRB5CCNAME=/path/to/ticket.ccache, then invoke with -k -no-pass flags. Target can be IP address or hostname (hostname required for Kerberos). Domain prefix is optional for local accounts. No additional setup required on target beyond existing Windows services and SMB access. The tool will authenticate, create a temporary service, execute commands, and clean up automatically.

## Key commands / parameters

Basic syntax: impacket-smbexec [domain/]user[:password]@target [command]

Key flags:
-hashes [LM:]NTLM - Pass-the-hash authentication
-k - Use Kerberos authentication
-no-pass - Do not prompt for password (use with -k or -hashes)
-service-name NAME - Specify service name instead of random (default: random, hardcoded in source as 'BTOBTO')
-share SHARE - Network share for output (default: C$)
-mode SERVER - Run local SMB server; target writes output to attacker's share instead of remote C$
-shell-type {cmd|powershell} - Wrapper for commands; cmd uses cmd.exe directly, powershell wraps commands in PowerShell (default: cmd)
-dc-ip IP - Domain controller IP for authentication
-target-ip IP - Target IP if using hostname
-codec CODEC - Output encoding (default: system default)

If no command is provided, drops into semi-interactive shell. Type commands at prompt; type 'exit' to quit. Each command creates a new service execution cycle.

## Example workflows

1. Basic execution with password:
   impacket-smbexec CORP/administrator:P@ssw0rd@192.168.1.50
   (drops to interactive shell)

2. Single command with pass-the-hash:
   impacket-smbexec CORP/admin@dc01.corp.local -hashes :8846f7eaee8fb117ad06bdd830b7586c whoami

3. Kerberos authentication:
   impacket-getTGT CORP/user:password
   export KRB5CCNAME=user.ccache
   impacket-smbexec CORP/user@target.corp.local -k -no-pass

4. Custom service name and share:
   impacket-smbexec admin@10.0.0.5 -hashes :abc123... -service-name UpdateSvc -share ADMIN$

5. Server mode (output written to attacker's local SMB share):
   impacket-smbexec user:pass@target -mode SERVER

6. PowerShell wrapper:
   impacket-smbexec admin@target -hashes :hash -shell-type powershell
   (commands wrapped in PowerShell; useful for PowerShell-specific cmdlets)

## Output format

Interactive shell presents a prompt showing current directory. Output from each command is displayed in the terminal after execution completes. Under the hood: smbexec creates execute.bat containing the full command, runs it as a service, redirects output to __output file on the specified share (default C$\__output), retrieves the file via SMB, displays contents, and deletes both files. On-disk artifacts during execution: (1) Service creation (visible in Event ID 7045 with ImagePath containing 'cmd.exe /Q /c echo cd' pattern), (2) execute.bat in C:\Windows\Temp or specified share, (3) __output in specified share. Command-line patterns visible in logs: 'cmd.exe /Q /c echo cd ^> \\127.0.0.1\C$\__output 2^>^&1'. All output is text-based; binary output may be corrupted. Encoding issues possible with non-ASCII characters.

## Common pitfalls

1. Service creation triggers Windows Event ID 7045 and is highly visible to EDR/SIEM; expect detection in monitored environments. 2. Default service name 'BTOBTO' and file names '__output', 'execute.bat' are well-known IOCs; customize with -service-name and modify share if needed. 3. Requires administrative privileges; fails with access denied if user lacks SCM permissions. 4. Each command creates a new service, making multiple commands noisy; consider batching commands or using other methods for high-volume operations. 5. Output files may persist if tool crashes or connection is interrupted; manually clean C$\__output and service remnants. 6. SMB signing and port 445 filtering will block execution; verify SMB connectivity first. 7. Antivirus may quarantine execute.bat or block cmd.exe service execution; test in target environment. 8. Large output may be truncated or slow to retrieve; for bulk data exfiltration, use other methods. 9. Interactive shell is semi-interactive only; no tab completion, command history, or job control. 10. Kerberos authentication requires correct DNS resolution and time sync; use -target-ip if DNS fails.

## References

• https://www.cybertriage.com/blog/dfir-breakdown-impacket-remote-execution-activity-smbexec/
• https://tools.thehacker.recipes/impacket/examples/smbexec.py
• https://research.splunk.com/endpoint/bb3c1bac-6bdf-4aa0-8dc9-068b8b712a76/
• https://www.blackhillsinfosec.com/impacket-cheatsheet/
• https://redcanary.com/threat-detection-report/threats/impacket/
• https://u0041.co/posts/articals/smbexec-analysis/
• https://guardsix.com/blog/the-impacket-arsenal-a-deep-dive-into-impacket-remote-code-execution-tools
• https://reliaquest.com/blog/exploring-impacket-abuse/
• https://www.extrahop.com/blog/how-to-detect-impackets-hidden-lateral-movement-east-west
• https://www.threatlocker.com/blog/top-post-exploitation-tools-threat-actors-use
