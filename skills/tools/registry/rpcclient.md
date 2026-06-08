---
name: Rpcclient
description: MS-RPC client for enumerating Windows domain users, groups, shares,
  and policies over SMB without requiring admin privileges.
registry: registry
tool_id: rpcclient
category: enumeration
tags:
  - enumeration
  - smb
  - rpc
  - active-directory
  - windows
  - domain
  - samba
mitre_techniques:
  - T1087.002
  - T1069.002
  - T1018
  - T1135
  - T1201
summary: 'rpcclient is a Samba tool for executing MS-RPC calls against Windows
  targets, primarily used for Active Directory and SMB enumeration. Use it when
  you need to enumerate domain users, groups, shares, privileges, or password
  policies without triggering command-line logging (unlike net.exe). It supports
  null sessions (-U "" -N) for unauthenticated enumeration or authenticated
  sessions (-U username). Common commands: enumdomusers (list users with RIDs),
  enumdomgroups (domain groups), queryuser <RID> (detailed user info),
  querydispinfo (all user details), lsaenumsid (SIDs), lookupnames <name>
  (resolve name to SID), srvinfo (OS version), querydominfo (domain policy),
  netshareenum (shares). Invoke interactively (rpcclient -U user target) or with
  -c for single commands. Default port is 139; can specify -p 445. Works through
  SOCKS proxies (proxychains) to bypass endpoint logging. Output is
  semi-structured text; parse RIDs and SIDs for further queries. Watch for: null
  session restrictions (common on modern Windows), account lockouts with bad
  credentials, noisy enumeration patterns. Always test authentication before
  full enumeration runs.'
sources:
  - https://hackviser.com/tactics/tools/rpcclient
  - https://www.scribd.com/document/888050763/Domain-Enumeration-With-Rpc-client
  - https://www.samba.org/samba/docs/current/man-html/rpcclient.1.html
  - https://www.samba.org/samba/docs/4.17/man-html/rpcclient.1.html
  - https://rokibulroni.com/books/active-directory-enumeration-rcp-client
  - https://github.com/McL0vinn/Smbclient_Rpcclient_commands
  - https://www.hackingarticles.in/active-directory-enumeration-rpcclient/
  - https://www.ired.team/offensive-security/enumeration-and-discovery/enumerating-windows-domains-using-rpcclient-through-socksproxy-bypassing-command-line-logging
  - https://www.offsec.com/blog/red-teaming-vs-pentesting/
generated_at: 2026-05-19T11:20:10.080Z
generated_by: anthropic
source_hash: 40e8398bd32123e8d1252f1787a030e0a2d74049ae32cd0c6d0059bbb12f74f4
---

# Rpcclient

## Overview

rpcclient is a command-line MS-RPC client from the Samba suite (v4.15.13-Ubuntu in RTPI). It executes remote procedure calls over SMB (ports 139/445) to enumerate and manipulate Windows resources. Primary value: extracting domain users, groups, shares, privileges, and password policies from Windows systems and domain controllers without admin rights. Operates in interactive shell mode or single-command mode (-c). Output is text-based, not structured formats like JSON.

## When to use

Use rpcclient during initial AD enumeration when you have valid credentials or suspect null session access. Preferred over net.exe commands because it avoids Windows command-line logging (Sysmon Event ID 1, PowerShell logging). Ideal for:
- Enumerating domain users and RIDs before password spraying
- Mapping group memberships and organizational structure
- Discovering network shares and their properties
- Extracting password policies (min length, lockout thresholds)
- Querying specific user attributes (description fields often contain passwords)
- SID-to-name and name-to-SID resolution
- Operating through SOCKS proxies to reach internal targets

Do NOT use if: target has SMB disabled, you need stealthy enumeration (rpcclient generates multiple RPC connections), or you require machine-readable output (prefer ldapsearch, BloodHound, or PowerView for those cases).

## Authentication & setup

Basic syntax: rpcclient [options] <target>

Authentication methods:
1. Null session (unauthenticated): rpcclient -U "" -N <target>
   - Works only if target allows anonymous SMB/RPC (rare on modern Windows)
2. Username + prompt: rpcclient -U username <target>
   - Will prompt for password interactively
3. Username + password: rpcclient -U username%password <target>
   - Inline password (visible in process list; avoid if logged)
4. Domain user: rpcclient -U DOMAIN\username <target> or rpcclient -U username -W DOMAIN <target>
5. Credential file: rpcclient -A /path/to/credfile <target>
   - File format: username=value / password=value
6. Kerberos: --use-kerberos=required --use-krb5-ccache=/path/to/ticket.ccache

Common flags:
-p <port>: Specify port (default 139; use 445 for SMB over TCP)
-W <workgroup>: Set workgroup/domain
-c '<command>': Execute single command and exit (for scripting)
-N: No password (for null sessions)
--client-protection=sign|encrypt|off: Set RPC auth level

Through proxies: proxychains rpcclient -U user <target>

## Key commands / parameters

Core enumeration commands (run at rpcclient $> prompt):

User enumeration:
- enumdomusers: List all domain users with RIDs
- queryuser <RID>: Detailed info for specific user (RID from enumdomusers)
- querydispinfo: Extended info for all users (includes full names, descriptions)
- lookupnames <username>: Resolve username to SID

Group enumeration:
- enumdomgroups: List domain groups with RIDs
- enumalsgroups builtin|domain: List alias groups
- querygroupmem <RID>: List members of specific group
- querygroup <RID>: Group details

System/domain info:
- srvinfo: Server OS version and info
- querydominfo: Domain password policy, lockout settings
- lsaenumsid: Enumerate SIDs
- lookupsids <SID>: Resolve SID to name
- enumprivs: List available privileges (shows user's rights)

Share enumeration:
- netshareenum: List network shares
- netshareenumall: List all shares including hidden

User/group manipulation (if privileged):
- createdomuser <username>: Create domain user
- deletedomuser <username>: Delete user
- chgpasswd <user> <old> <new>: Change password
- createdomgroup <groupname>: Create group

Utility:
- help: List all commands
- ?: Command help

## Example workflows

Workflow 1: Null session enumeration
rpcclient -U "" -N 10.0.0.5
rpcclient $> srvinfo
rpcclient $> enumdomusers
rpcclient $> querydispinfo
rpcclient $> querydominfo
rpcclient $> netshareenum
rpcclient $> exit

Workflow 2: Authenticated full domain enum
rpcclient -U CORP\lowpriv%P@ssw0rd 192.168.1.10
rpcclient $> enumdomusers
(note RIDs, e.g., user:[admin] rid:[0x1f4])
rpcclient $> queryuser 0x1f4
rpcclient $> enumdomgroups
rpcclient $> querygroupmem 0x200
rpcclient $> lookupnames Administrator
rpcclient $> enumprivs

Workflow 3: Single-command scripted enum
rpcclient -U user%pass -c enumdomusers 10.0.0.5 > users.txt
rpcclient -U user%pass -c querydispinfo 10.0.0.5 > userdetails.txt
rpcclient -U user%pass -c "querydominfo" 10.0.0.5

Workflow 4: Through SOCKS proxy (Cobalt Strike)
(After: socks 7777 in CS)
proxychains rpcclient -U spotless 10.0.0.6
rpcclient $> enumdomusers
rpcclient $> queryuser spotless

Workflow 5: User creation (if admin)
rpcclient -U Administrator%pass 10.0.0.5
rpcclient $> createdomuser hacker
rpcclient $> lookupnames hacker
rpcclient $> chgpasswd hacker "" NewP@ss123

## Output format

rpcclient outputs semi-structured text, not JSON or CSV. Parse manually or with scripts.

Typical formats:

enumdomusers:
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
(Extract usernames and hex RIDs; convert RID to decimal for queryuser)

queryuser <RID>:
User Name   :   administrator
Full Name   :   
Home Drive  :   
Dir Drive   :   
Profile Path:   
Logon Script:   
Description :   Built-in account for administering
Workstations:   
Comment     :   
(Multi-line key-value pairs; watch Description field for passwords)

querydispinfo:
index: 0x2 RID: 0x1f5 acb: 0x00000215 Account: Guest Name: (null) Desc: Built-in account
(Space-delimited; requires regex parsing)

querydominfo:
min_password_length: 7
password_properties: 0x00000001 (DOMAIN_PASSWORD_COMPLEX)
max_password_age: 41 days
min_password_age: 1 days
(Parse for password policy enforcement)

netshareenum:
netname: ADMIN$
remark: Remote Admin
path:   C:\Windows
password:
(Share name and comment/description)

RIDs are in hex (0x1f4 = 500 decimal). For scripting, pipe output to grep/awk or parse with Python.

## Common pitfalls

1. Null sessions disabled: Modern Windows (10/2016+) blocks anonymous RPC by default. You will see NT_STATUS_ACCESS_DENIED. Solution: use valid credentials.

2. Account lockout: Repeated failed auth attempts trigger lockouts. Always verify credentials with a single safe command (srvinfo) before running full enumeration.

3. Port confusion: Default is 139 (SMB over NetBIOS); many environments require -p 445 (SMB over TCP). Test both if connection fails.

4. Password in command line: rpcclient -U user%pass exposes password in process list and shell history. Use -A <credfile> or interactive prompt for OpSec.

5. Noisy enumeration: rpcclient generates many RPC connections visible in Windows event logs (4624, 4672, 5145). Not stealthy; assume detection in monitored environments.

6. RID format: enumdomusers returns hex RIDs (0x1f4); queryuser requires the same format. Do not convert to decimal.

7. Interactive mode quirks: Some commands (createdomuser, chgpasswd) may fail silently. Check with lookupnames or queryuser to verify actions.

8. Proxy timeouts: Through proxychains/SOCKS, long-running commands may timeout. Use -c for single commands or reduce enumeration scope.

9. Workgroup vs domain: For domain targets, specify -W DOMAIN or DOMAIN\user. Omitting this may cause authentication to fail or enumerate local accounts instead of domain.

10. Output parsing: Output format varies by command and Samba version. Test parsing logic before automation.

## References

• https://hackviser.com/tactics/tools/rpcclient
• https://www.samba.org/samba/docs/current/man-html/rpcclient.1.html
• https://www.hackingarticles.in/active-directory-enumeration-rpcclient/
• https://www.ired.team/offensive-security/enumeration-and-discovery/enumerating-windows-domains-using-rpcclient-through-socksproxy-bypassing-command-line-logging
• https://github.com/McL0vinn/Smbclient_Rpcclient_commands
• https://www.scribd.com/document/888050763/Domain-Enumeration-With-Rpc-client
• https://rokibulroni.com/books/active-directory-enumeration-rcp-client
