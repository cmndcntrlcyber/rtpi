---
name: Enum4linux
description: Perl wrapper for Samba tools (smbclient, rpclient, net, nmblookup)
  that enumerates users, shares, groups, and policies from Windows/Samba over
  SMB.
registry: registry
tool_id: enum4linux
category: enumeration
tags:
  - enumeration
  - smb
  - windows
  - samba
  - rid-cycling
  - netbios
  - active-directory
  - reconnaissance
mitre_techniques:
  - T1046
  - T1087.001
  - T1087.002
  - T1135
  - T1201
summary: "Use enum4linux against Windows and Samba hosts exposing SMB (ports
  139/445) to enumerate users, shares, groups, password policies, and OS
  details. Invoke with `enum4linux -a <target>` for comprehensive enumeration.
  Add `-u <username> -p <password>` when you have credentials; omit for
  null-session or anonymous enumeration. The tool performs RID cycling (`-r` or
  `-R <range>`) to discover users even when RestrictAnonymous is enabled.
  Typical red team workflow: run `-a` scan, extract usernames for
  Kerbrute/GetNPUsers, identify writable shares, note password policy for spray
  planning. Output is plaintext with clear section headers. Works best on older
  Windows (2000-2012) and misconfigured Samba; modern hardened Active Directory
  often blocks null sessions. Depends on Samba package (smbclient, rpclient,
  net, nmblookup). Common failures: 'NT_STATUS_ACCESS_DENIED' (no null session),
  empty results (firewall/SMB disabled), or timeouts (wrong IP/network).
  Prioritize targets with SMB open and domain controllers (ports
  53/88/389/636/3268). Chain results into CrackMapExec, Impacket tools, or
  password attacks."
sources:
  - https://hackviser.com/tactics/tools/enum4linux
  - https://labs.portcullis.co.uk/tools/enum4linux/
  - https://www.kali.org/tools/enum4linux/
  - https://notes.benheater.com/books/active-directory/page/enum4linux
  - http://chousensha.github.io/blog/2017/06/19/enum4linux-kali-linux-tools
  - https://highon.coffee/blog/enum4linux-cheat-sheet/
  - https://www.linkedin.com/posts/rakesh-joshi-119302215_enum4linux-is-a-powerful-and-widely-used-activity-7337329574336237568-CLq-
  - https://infosecwriteups.com/red-team-recon-write-up-smb-ad-enumeration-with-enum4linux-ca92c593b1f6
generated_at: 2026-05-19T11:07:44.997Z
generated_by: anthropic
source_hash: 7538ba25351fcae0cc9286e01619d52a7d4d04ea2aa10a2a61383f7a58723162
---

# Enum4linux

## Overview

enum4linux v0.8.9–1.3.10 is a Perl script that wraps Samba utilities to replicate functionality of the legacy Windows enum.exe tool. It queries SMB and RPC services on Windows and Samba systems to extract users, groups, shares, domain/workgroup names, password policies, OS information, and more. It attempts anonymous/null-session enumeration by default and supports authenticated enumeration when credentials are provided. Core capabilities include RID cycling (enumerating users by iterating Relative Identifiers), LSA policy retrieval, share enumeration, password policy extraction, and printer information gathering.

## When to use

Deploy enum4linux during the reconnaissance phase when you identify SMB services (TCP 139/445) on target hosts. It is particularly valuable against domain controllers (identifiable by open ports 53, 88, 135, 139, 389, 445, 464, 593, 636, 3268, 3269), file servers, and older Windows systems (2000, XP, 2003, 2008). Use it when you need to: enumerate domain users without credentials; identify shares and access levels; gather password policy for spray attack planning; perform RID cycling when standard SAMR queries are restricted; map group memberships and privilege levels; fingerprint OS and service pack versions. It is most effective on systems with RestrictAnonymous set to 0 (Windows default pre-2003) or misconfigured Samba shares. Works via proxychains for pivoting.

## Authentication & setup

enum4linux is pre-installed on Kali, Parrot, and BlackArch. Depends on the Samba package (smbclient, rpclient, net, nmblookup); install with `apt install samba samba-common-bin` if missing. No configuration file required. For unauthenticated enumeration, invoke directly against target IP. For authenticated enumeration, supply credentials with `-u <username> -p <password>`. Username defaults to empty string (null session). Password defaults to empty string. Use domain\username format for domain accounts if needed. Tool does not support Kerberos authentication or pass-the-hash directly; use smbclient or CrackMapExec for those scenarios. Can be chained with proxychains: `proxychains -q enum4linux -u user -p pass -a <DC_IP>`.

## Key commands / parameters

`enum4linux <target>` performs basic enumeration. `-a` does all simple enumeration (users, shares, groups, password policy, RID cycling, OS info, naming info, printer info); use this as default. `-U` enumerates users. `-M` enumerates machines. `-S` enumerates shares. `-G` enumerates groups and members. `-P` retrieves password policy. `-d` provides detailed output for user and share enumeration. `-r` performs RID cycling with default range (500-550, 1000-1050). `-R <range>` specifies custom RID range, e.g., `-R 500-5000`. `-K <n>` keeps cycling RIDs until n consecutive failures (use against DCs). `-o` retrieves OS information. `-i` enumerates printers. `-n` performs nmblookup (NetBIOS names). `-l` attempts limited LDAP enumeration on port 389 (DCs only). `-s <file>` performs dictionary-based share name brute-forcing. `-u <user>` specifies username. `-p <pass>` specifies password. `-v` verbose mode shows underlying Samba commands. `-h` displays help.

## Example workflows

**Initial recon**: `enum4linux -a 192.168.1.10` performs full enumeration, outputs users, shares, groups, password policy, OS info. Parse output for usernames and feed to Kerbrute or Impacket GetNPUsers.py for AS-REP roasting. **Authenticated scan**: `enum4linux -u administrator -p P@ssw0rd -a 10.10.10.10` pulls full user list regardless of RestrictAnonymous setting. **RID cycling deep dive**: `enum4linux -R 500-2000 192.168.1.10` enumerates users in extended RID range; useful when user list is truncated. **Share access check**: After `-S` identifies shares, test access with `smbclient //192.168.1.10/ShareName -N` (null session) or `smbclient //192.168.1.10/ShareName -U username%password`. **Password spray prep**: Extract password policy with `-P`, note minimum length and lockout threshold, then use CrackMapExec or Spray toolkit with discovered usernames. **Pivoting**: `proxychains -q enum4linux -u svc-admin -p pass123 -a 172.16.10.5` through compromised host.

## Output format

Plaintext output with ASCII art banner and clearly demarcated sections: Target Information (IP, RID range, credentials used), Workgroup/Domain name, OS Information (OS version, domain, server name), User enumeration (username, RID in hex and decimal), Share enumeration (share name, type, comment), Group enumeration (group name, RID, members), Password policy (min length, history, complexity, lockout threshold, lockout duration), RID cycling results (RID → username mappings). Successful queries prefixed with '[+]', errors with '[-]', warnings with '[!]'. Status codes like 'NT_STATUS_ACCESS_DENIED' or 'NT_STATUS_LOGON_FAILURE' indicate permission issues. Empty sections mean query failed or no data returned. Parse usernames from lines like 'user:[username] rid:[0x3e8]'. Shares appear as 'Sharename | Type | Comment'. Password policy values are labeled clearly. Save output with `enum4linux -a <target> > enum4linux_output.txt` for post-processing.

## Common pitfalls

**NT_STATUS_ACCESS_DENIED**: Null session disabled (RestrictAnonymous=1 or higher); requires credentials via `-u`/`-p` or different attack vector. **Empty results**: Firewall blocking SMB ports, SMB disabled, or incorrect IP. Verify with `nmap -p 139,445 <target>`. **Timeouts**: Network issue, wrong subnet, or host down. Check routing/VPN. **Incomplete user lists**: Default RID range may miss users; expand with `-R 500-5000` or `-K 100`. **Modern Windows hardening**: Post-2012 Windows and domain-hardened environments often block anonymous SAMR queries; authenticated enumeration or Bloodhound preferred. **Credential format**: Use plain username, not domain\username, unless specifically needed; tool may not parse backslashes correctly. **Dependency errors**: 'smbclient not found' means Samba not installed; fix with `apt install samba-common-bin`. **False negatives on shares**: `-S` may miss shares; try dictionary attack with `-s /usr/share/wordlists/smbshares.txt`. **Verbose spam**: `-v` generates excessive output; use sparingly. **Proxy issues**: proxychains can cause timeouts; increase timeout in proxychains.conf. **Misinterpreting policy**: Lockout threshold 0 means no lockout; safe for password spraying.

## References

• https://hackviser.com/tactics/tools/enum4linux
• https://labs.portcullis.co.uk/tools/enum4linux/
• https://www.kali.org/tools/enum4linux/
• https://notes.benheater.com/books/active-directory/page/enum4linux
• http://chousensha.github.io/blog/2017/06/19/enum4linux-kali-linux-tools
• https://highon.coffee/blog/enum4linux-cheat-sheet/
• https://infosecwriteups.com/red-team-recon-write-up-smb-ad-enumeration-with-enum4linux-ca92c593b1f6
