---
name: Smbclient
description: FTP-like SMB/CIFS client for enumerating shares, transferring
  files, and testing Windows network access from Linux.
registry: registry
tool_id: smbclient
category: enumeration
tags:
  - smb
  - enumeration
  - file-transfer
  - authentication-testing
  - lateral-movement
  - cifs
  - reconnaissance
mitre_techniques:
  - T1021.002
  - T1135
  - T1570
summary: smbclient is an interactive SMB/CIFS client from the Samba suite that
  provides FTP-like access to Windows shares. Use it for share enumeration (-L
  flag), file operations (get/put/mget/mput), and authentication testing (null
  sessions, guest access, credential-based). Invoke as `smbclient -L //host` to
  list shares or `smbclient //host/share -U user%pass` for interactive shell
  access. Supports both interactive mode (commands like ls, cd, get, put) and
  command-line mode (-c flag for scripting). Always escape backslashes in share
  paths (\\host\\share). Default authentication prompts for password unless -N
  (no password) or credentials provided inline. Output is human-readable text;
  parse stderr and exit codes for automation. Critical for lateral movement via
  administrative shares (C$, ADMIN$) and data exfiltration. Watch for
  authentication failures, session timeouts, and ACL restrictions. All transfers
  are binary by default. Can test SMB connectivity, enumerate
  users/shares/permissions, upload/download files, and execute commands on
  remote systems with appropriate privileges.
sources:
  - https://www.samba.org/samba/docs/current/man-html/smbclient.1.html
  - https://medium.com/@ibo1916a/smbclient-command-2803de274e46
  - https://tldp.org/HOWTO/SMB-HOWTO-8.html
  - https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/troubleshoot-smb-guidance
  - https://learn.microsoft.com/en-us/windows-server/storage/file-server/troubleshoot/troubleshooting-smb
  - https://www.oreilly.com/openbook/samba/book/appd.pdf
  - https://github.com/p0dalirius/smbclient-ng
  - https://tools.thehacker.recipes/impacket/examples/smbclient.py
  - https://hackviser.com/tactics/tools/smbclient
  - https://hackviser.com/tactics/pentesting/services/smb
  - https://medium.com/@iffishah89/a-guide-to-smb-enumeration-using-metasploit-and-smbclient-cb5f3dd0dcc9
  - https://github.com/irgoncalves/smbclient_cheatsheet
generated_at: 2026-05-19T11:01:43.672Z
generated_by: anthropic
source_hash: eabc68a2e5b430810fae6dd22640307b6fe516a087fb55015b5f5c8ce1a3349c
---

# Smbclient

## Overview

smbclient is a command-line SMB/CIFS protocol client that enables interaction with Windows file shares from Linux/Unix systems. It mimics FTP client functionality, providing both interactive shell mode for browsing shares and command-line mode for automated operations. Part of the Samba suite (version 4.15.13-Ubuntu in this deployment), it supports authentication testing, share enumeration, file transfer, and remote command execution when permissions allow. The tool is essential for red team operations targeting Windows networks, enabling reconnaissance, lateral movement, and data exfiltration through SMB protocol.

## When to use

Use smbclient during initial reconnaissance to list available shares on target systems (null session or authenticated enumeration). Deploy for authenticated file operations when you have valid credentials and need to upload tools, download sensitive data, or verify share permissions. Essential for testing weak SMB configurations including null sessions, guest access, and misconfigured ACLs. Invoke during lateral movement to access administrative shares (C$, ADMIN$, IPC$) after credential compromise. Use as a diagnostic tool to validate SMB connectivity, protocol version support, and authentication mechanisms before deploying automated attacks. Prefer over mount operations when you need quick, interactive access without persistent filesystem integration.

## Authentication & setup

Authentication is controlled via -U flag: `smbclient //host/share -U [DOMAIN/]username%password`. Omit %password to be prompted interactively (safer for opsec). Use -N flag for null sessions or when no password is required: `smbclient -L //host -N`. For domain authentication, prefix username with domain: `-U DOMAIN/user%pass`. Supports pass-the-hash via --pw-nt-hash flag. The -A flag specifies an authentication file containing credentials (format: username=value, password=value per line). Kerberos authentication available with --kerberos flag. The -W flag sets workgroup/domain. For share enumeration without credentials, try guest access first: `smbclient -L //host -U guest%`. Connection timeout defaults to system settings; use -t to specify custom timeout in seconds. Port defaults to 445; override with -p flag. The -I flag forces connection to specific IP address instead of NetBIOS name resolution.

## Key commands / parameters

Command-line flags: -L //host (list shares), -U user%pass (authenticate), -N (no password), -p port (default 445), -I ip_address (force IP), -m max_protocol (set SMB version), -c 'command' (execute single command), -d debuglevel (0-10 verbosity), -t timeout (seconds), -A authfile (credentials file), -W workgroup, --pw-nt-hash (use NTLM hash). Interactive commands once connected: ls/dir (list files), cd (change directory), lcd (change local directory), get remotefile [localfile] (download), put localfile [remotefile] (upload), mget pattern (download multiple), mput pattern (upload multiple), mkdir/md (create directory), rmdir/rd (remove directory), del/rm (delete file), prompt (toggle interactive prompting), recurse (toggle recursive mode for mget/mput), queue (show print queue), exit/quit (terminate). Use `help` or `?` in interactive mode for full command list. The du command shows disk usage on share. All file transfers are binary mode by default.

## Example workflows

Share enumeration: `smbclient -L //10.0.0.50 -N` (null session) or `smbclient -L //10.0.0.50 -U user%pass` (authenticated). Connect to share: `smbclient //10.0.0.50/C$ -U Administrator%pass` then use interactive commands. Automated file download: `smbclient //host/share -U user%pass -c 'cd sensitive; get passwords.txt'`. Recursive download: connect interactively, then `prompt off; recurse on; mget *`. Upload payload: `smbclient //host/ADMIN$ -U user%pass -c 'put payload.exe'`. Test null session: `smbclient -L //host -N` and look for accessible shares. Domain enumeration: `smbclient -L //dc01.domain.local -U domain/user%pass -W DOMAIN`. Quick connectivity test: `smbclient -L //host -I 10.0.0.50 -U user%pass` to verify SMB service and authentication. Extract data: connect to share, `lcd /tmp/loot`, `prompt off`, `mget *.xlsx`. For scripting: `smbclient //host/share -U user%pass -c 'ls; get file.txt' > output.log 2>&1`.

## Output format

Human-readable text output to stdout. Share enumeration (-L) shows sharename, type (Disk/IPC/Printer), and comment fields in columnar format. Interactive mode displays `smb: \>` prompt with current directory context. File listings show attributes (D for directory, A for archive, H for hidden, S for system, R for read-only), size, and modification date. Error messages go to stderr. Server information includes timezone, domain/workgroup, OS version, and SMB protocol version (e.g., 'OS=[Windows NT 3.51] Server=[NT LAN Manager 3.51]'). Authentication failures return explicit error codes (NT_STATUS_LOGON_FAILURE, NT_STATUS_ACCESS_DENIED). Connection issues show 'Connection to host failed' with reason. Exit codes: 0 for success, non-zero for failure. Parse output by looking for 'Sharename' headers, NT_STATUS codes, and smb: prompts. For automation, redirect stderr and check exit code: `smbclient ... 2>&1 | grep -i 'sharename\|error'`.

## Common pitfalls

Backslash escaping: shell requires `\\host\\share` or wrap in quotes: `"\\host\share"`. Forgetting -N flag for null sessions causes password prompts in scripts. Default transfers are binary; no ASCII mode conversion available. Missing prompt/recurse toggles cause mget/mput to request confirmation for each file. Credential exposure: inline passwords (`user%pass`) appear in process listings and shell history; use -A authfile or interactive prompts instead. Firewall blocking port 445 silently fails; verify with nmap first. SMB version mismatches: older servers may reject modern protocol; use -m SMB2 or -m NT1 to downgrade. Session timeouts during large transfers; increase with -t flag. ACL restrictions: list access doesn't guarantee read/write; test with actual file operations. Domain authentication requires proper workgroup/domain specification (-W flag). IPC$ share is required for RPC operations but shows as accessible even with restricted permissions. Some commands (hardlink, getfacl) require UNIX extensions support. Debug output (-d 3+) is verbose; avoid in production. Null session enumeration often disabled on modern Windows (post-2000); expect STATUS_ACCESS_DENIED.

## References

https://www.samba.org/samba/docs/current/man-html/smbclient.1.html
https://medium.com/@ibo1916a/smbclient-command-2803de274e46
https://tldp.org/HOWTO/SMB-HOWTO-8.html
https://hackviser.com/tactics/tools/smbclient
https://hackviser.com/tactics/pentesting/services/smb
https://github.com/irgoncalves/smbclient_cheatsheet
https://learn.microsoft.com/en-us/windows-server/storage/file-server/troubleshoot/troubleshooting-smb
