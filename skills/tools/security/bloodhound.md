---
name: BloodHound
description: BloodHound collector for Active Directory reconnaissance and attack
  path visualization using graph theory.
registry: security
tool_id: bloodhound
category: active_directory
tags:
  - active-directory
  - reconnaissance
  - enumeration
  - attack-path
  - bloodhound
  - ldap
  - graphing
mitre_techniques:
  - T1087.002
  - T1482
  - T1069.002
  - T1018
  - T1069.001
summary: "bloodhound-python is the Python-based data collector for BloodHound
  Active Directory analysis. Use it when you have valid domain credentials but
  cannot deploy SharpHound.exe (Windows binary) or need to collect from a Linux
  system. Invoke with: bloodhound-python -u USERNAME -p PASSWORD -d DOMAIN -ns
  NAMESERVER -c COLLECTION_METHOD. Requires valid domain credentials
  (username/password, NTLM hash, or Kerberos ticket). Collection methods: Group,
  LocalAdmin, Session, Trusts, Default (all), DCOnly (no computer connections),
  DCOM, RDP, PSRemote, LoggedOn, Container, ObjectProps, ACL, All. Outputs JSON
  files (computers.json, users.json, groups.json, domains.json, etc.) that must
  be imported into BloodHound GUI (Neo4j backend) for visualization. Specify
  nameserver (-ns) to ensure DNS resolution; use -dc to target specific domain
  controller. Authentication: supports NTLM (--hashes LM:NTLM), Kerberos (-k
  --aesKey or ticket cache), or plaintext password. Not stealthy—generates LDAP
  queries visible to EDR/SIEM. Use --zip to compress output automatically.
  Workers (-w) controls threading for computer enumeration (default 10). Output
  files must be uploaded to BloodHound UI for graph analysis of privilege
  escalation paths, admin relationships, and ACL abuse opportunities."
sources:
  - https://www.blackhillsinfosec.com/bloodhound-data-collection/
  - https://bloodhound.specterops.io/get-started/quickstart/community-edition-quickstart
  - https://www.sans.org/blog/bloodhound-sniffing-out-path-through-windows-domains
  - https://www.kali.org/tools/bloodhound/
  - https://www.pentestpartners.com/security-blog/bloodhound-walkthrough-a-tool-for-many-tradecrafts/
  - https://posts.specterops.io/introducing-bloodhound-cli-7dfaf82e2df8?source=rss----f05f8696e3cc---4
  - https://www.kali.org/tools/bloodhound.py/
  - https://www.redfoxsec.com/blog/bloodhound-cheat-sheet
  - https://bloodhound.specterops.io/get-started/introduction
  - https://blog.reconinfosec.com/audit-active-directory-attack-paths-with-bloodhound
  - https://www.evolvesecurity.com/blog-posts/tools-of-the-trade-tracking-security-misconfigurations-with-bloodhound
  - https://www.ired.team/offensive-security-experiments/active-directory-kerberos-abuse/abusing-active-directory-with-bloodhound-on-kali-linux
generated_at: 2026-05-19T11:26:19.739Z
generated_by: anthropic
source_hash: 529b93204dd46e15e5e81e87e048d0373c550c48690256cd54c3592d5b713150
---

# BloodHound

## Overview

bloodhound-python is a Python-based ingestor for BloodHound, used to enumerate Active Directory information remotely via LDAP queries. It collects data about users, groups, computers, trusts, sessions, ACLs, and privilege relationships, outputting JSON files that are ingested by the BloodHound GUI (a Neo4j graph database application). Unlike SharpHound (Windows C#/.NET collector), bloodhound-python runs on Linux/macOS and does not require code execution on domain-joined systems. It uses LDAP/SMB protocols to gather data and is particularly useful when operating from non-Windows attack platforms or when binary deployment is restricted.

## When to use

Use bloodhound-python when you have valid domain credentials and need to map Active Directory attack paths, privilege relationships, or lateral movement opportunities. Ideal scenarios: operating from Linux/Kali attack box; cannot execute binaries on target Windows hosts; need remote enumeration without dropping files; performing reconnaissance after initial credential compromise; analyzing domain trusts, group memberships, ACLs, or local admin rights. Do NOT use if you lack valid credentials—tool requires authentication. Prefer SharpHound.exe if already on a domain-joined Windows system with execution capability (faster, more session data). Use DCOnly collection method (-c DCOnly) when you want only domain controller data without connecting to every computer (stealthier, faster).

## Authentication & setup

Requires valid domain credentials. Install via: pip install bloodhound or apt install bloodhound.py (Kali). Dependencies: impacket, ldap3, dnspython. Authentication methods: (1) Username/password: -u USER -p PASSWORD; (2) NTLM hash: -u USER --hashes LM:NTLM (can use -no-pass); (3) Kerberos: -k -no-pass (uses cached ticket) or -k --aesKey HEX_KEY; (4) Specify auth method: --auth-method {auto,ntlm,kerberos} (default auto tries Kerberos then NTLM). Always specify: -d DOMAIN (FQDN, e.g., target.local) and -ns NAMESERVER (IP of DNS server/DC, critical for name resolution). Optionally specify -dc DOMAIN_CONTROLLER (hostname) to target specific DC and -gc GLOBAL_CATALOG for GC queries. Credentials must have at least domain user privileges; higher privileges yield more data (e.g., local admin enumeration requires admin rights on targets). Test credentials before running full collection.

## Key commands / parameters

Basic collection: bloodhound-python -u USER -p 'PASS' -d domain.local -ns 10.10.10.10 -c All

Collection methods (-c): Group (group memberships), LocalAdmin (local admin rights), Session (active sessions), Trusts (domain trusts), Default (Group+LocalAdmin+Session+Trusts), DCOnly (domain data only, no computer connections), DCOM, RDP, PSRemote (remote access rights), LoggedOn (logged-on users), Container (OU structure), ObjectProps (object properties), ACL (ACLs/permissions), All (everything except LoggedOn). Combine with commas: -c Group,ACL,ObjectProps

Key flags: -ns NAMESERVER (required for DNS), -dc DC_HOSTNAME (target specific DC), -w WORKERS (threads for computer enum, default 10), --zip (compress output), --exclude-dcs (skip DCs during enumeration), --disable-pooling (disable connection pooling), --computerfile FILE (target specific computers), --dns-tcp (use TCP for DNS), --dns-timeout SECONDS (default 3), --use-ldaps (force LDAPS), --ldap-channel-binding (enable channel binding), -op PREFIX (output file prefix). Use --hashes for pass-the-hash, -k for Kerberos. Verbose: -v.

## Example workflows

1. Basic full collection from Linux:
bloodhound-python -u jdoe -p 'P@ssw0rd!' -d corp.local -ns 192.168.1.10 -c All --zip

2. DCOnly collection (stealth, no computer connections):
bloodhound-python -u svc_account -p 'pass' -d corp.local -ns 192.168.1.10 -c DCOnly

3. Using NTLM hash (pass-the-hash):
bloodhound-python -u administrator --hashes aad3b435b51404eeaad3b435b51404ee:8846f7eaee8fb117ad06bdd830b7586c -d corp.local -ns 192.168.1.10 -c All -no-pass

4. Kerberos authentication:
bloodhound-python -u jdoe -k -no-pass -d corp.local -ns 192.168.1.10 -c All

5. Target specific DC, ACL focus:
bloodhound-python -u jdoe -p 'pass' -d corp.local -dc dc01.corp.local -ns 192.168.1.10 -c ACL,ObjectProps,Group

6. Exclude DCs, limit workers:
bloodhound-python -u jdoe -p 'pass' -d corp.local -ns 192.168.1.10 -c Default --exclude-dcs -w 5

After collection, import resulting JSON files (or .zip) into BloodHound GUI by dragging/dropping onto interface.

## Output format

Outputs multiple JSON files in current directory: users.json (domain users), groups.json (groups and memberships), computers.json (computer objects), domains.json (domain trusts), gpos.json (group policies), ous.json (organizational units), containers.json (containers). Use --zip flag to auto-compress into single .zip archive. File naming: YYYYMMDDHHMMSS_<type>.json or custom prefix with -op. JSON structure is BloodHound-specific schema containing nodes (objects) and edges (relationships). Files must be imported into BloodHound GUI (Neo4j graph database) for visualization and querying. Import: launch BloodHound UI, drag/drop .zip or individual .json files onto interface. Processing may take minutes for large datasets. Once imported, use built-in Cypher queries (Analysis tab) to find attack paths: 'Find Shortest Paths to Domain Admins', 'Find Principals with DCSync Rights', 'Find Computers where Domain Users are Local Admin', etc. No direct CLI output analysis—tool is pure collector.

## Common pitfalls

DNS resolution failure: Always specify -ns NAMESERVER (DC IP). Without it, queries fail silently or incompletely. | Insufficient credentials: Domain user required minimum; local admin enumeration needs admin rights on targets. | Loud operations: Generates many LDAP queries and SMB connections—visible to EDR/SIEM. Not OPSEC-safe for stealth engagements. Use -c DCOnly or limited collection methods to reduce noise. | Firewall/network blocks: Requires LDAP (389/636), SMB (445), DNS (53), and optionally Kerberos (88). Blocked ports = incomplete data. | Impacket version conflicts: Use latest impacket from GitHub for Python 3 compatibility. Old versions cause authentication failures. | Session enumeration accuracy: Sessions require admin rights on target computers; otherwise data is incomplete. | Output file handling: Default output in current directory; ensure write permissions and sufficient disk space. | BloodHound version mismatch: Ensure collector and GUI versions are compatible. Old GUI may not parse new JSON schema. | Kerberos issues: Ensure correct KRB5CCNAME environment variable and valid ticket cache. Clock skew > 5 minutes breaks Kerberos. | No visualization without GUI: bloodhound-python only collects data; must install Neo4j and BloodHound GUI separately for analysis.

## References

https://www.blackhillsinfosec.com/bloodhound-data-collection/
https://www.kali.org/tools/bloodhound.py/
https://www.redfoxsec.com/blog/bloodhound-cheat-sheet
https://www.ired.team/offensive-security-experiments/active-directory-kerberos-abuse/abusing-active-directory-with-bloodhound-on-kali-linux
https://www.sans.org/blog/bloodhound-sniffing-out-path-through-windows-domains
https://bloodhound.specterops.io/get-started/introduction
