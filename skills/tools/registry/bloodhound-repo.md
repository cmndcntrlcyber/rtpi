---
name: BloodHound
description: Active Directory graph analysis tool using Neo4j to identify attack
  paths and privilege escalation routes
registry: registry
tool_id: bloodhound-repo
category: active-directory
tags:
  - active-directory
  - graph-analysis
  - privilege-escalation
  - reconnaissance
  - attack-path
  - neo4j
  - sharphound
mitre_techniques:
  - T1087.002
  - T1069.002
  - T1482
  - T1018
  - T1033
summary: "BloodHound visualizes Active Directory trust relationships,
  permissions, and attack paths using graph theory. It consists of collectors
  (SharpHound, BloodHound.py) that enumerate AD and export JSON data, plus a
  Neo4j-backed UI for querying. Use SharpHound.exe on Windows domain-joined
  systems or BloodHound.py from Linux with valid credentials. Collectors
  enumerate users, groups, computers, sessions, ACLs, GPO, trusts, and local
  admin rights. Output is ZIP archives containing JSON files ingested into the
  BloodHound UI. Start Neo4j database (sudo neo4j start), launch BloodHound GUI
  (./BloodHound or bloodhound command), authenticate with Neo4j credentials,
  drag-and-drop collector ZIP files to ingest. Query via built-in Cypher queries
  (domain admins, shortest path to DA, Kerberoastable users, etc.) or write
  custom queries. Collection methods: -c All (comprehensive), -c DCOnly (no host
  connections, stealthier), Session loops for session enumeration over time.
  SharpHound flags: --ExcludeDCs, --ldapusername/--ldappassword for alternate
  creds. BloodHound.py syntax: bloodhound-python -u USER -p PASS -d DOMAIN -ns
  NAMESERVER -c All. Kali installation: apt install bloodhound &&
  bloodhound-setup. Modern deployments use BloodHound Community Edition with
  Docker/CLI wrapper. Watch for EDR/AV detections on SharpHound binaries. Avoid
  noisy full scans; prefer targeted collection or session loops on operational
  engagements."
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
generated_at: 2026-05-19T11:10:10.039Z
generated_by: anthropic
source_hash: b26eb28f5fee4565e6ef860bcd3f3bed0946099223e0a596d8f6826d82fe0ad0
---

# BloodHound

## Overview

BloodHound is an Active Directory security auditing tool that uses graph theory to map hidden trust relationships, permissions, and attack paths. It consists of two components: data collectors (SharpHound for Windows, BloodHound.py for Linux) that enumerate AD objects and relationships, and a Neo4j graph database UI that visualizes the data and enables Cypher queries to identify privilege escalation paths. The tool reveals complex attack vectors like nested group memberships, ACL misconfigurations, GPO abuse, and session-based compromise chains that would be difficult to discover manually. Both red teams and blue teams use BloodHound to understand privilege relationships and eliminate attack surface.

## When to use

Use BloodHound after obtaining initial domain credentials to map the AD environment and identify privilege escalation paths. Ideal for discovering routes to Domain Admin, finding Kerberoastable/AS-REP-roastable accounts, identifying users with DCSync rights, locating high-value targets with active sessions, and uncovering ACL-based privilege escalation (GenericAll, WriteDacl, etc.). Run collectors during internal penetration tests, red team operations, or security assessments of Active Directory environments. Blue teams use BloodHound to audit and harden AD configurations by identifying and remediating risky permissions and relationships before attackers exploit them. The tool is less useful without valid domain credentials or in non-AD environments (though Azure/Entra ID support exists via AzureHound).

## Authentication & setup

BloodHound requires Neo4j database and the BloodHound UI. On Kali: sudo apt install bloodhound && sudo bloodhound-setup to initialize services. Manually: install Neo4j, start with sudo neo4j start, set initial password at http://localhost:7474, then launch BloodHound GUI (./BloodHound binary) and authenticate with Neo4j credentials (default neo4j/neo4j, change on first login). Modern installations use BloodHound CLI: bloodhound-cli install to deploy via Docker Compose. Collectors require valid domain credentials. SharpHound runs on domain-joined Windows systems or with --ldapusername/--ldappassword for alternate credentials. BloodHound.py runs from Linux and requires: -u USERNAME -p PASSWORD -d DOMAIN -ns NAMESERVER (IP of DC). Supports Kerberos auth with -k --kerberos or NTLM hashes with --hashes LM:NTLM. Use runas /netonly on non-domain Windows machines to impersonate domain user context.

## Key commands / parameters

SharpHound.exe -c All: collect all data (Sessions, ACLs, LocalAdmin, Trusts, ObjectProps, Container, GPO, Group, etc.). -c DCOnly: enumerate without connecting to member computers (stealthier). -d DOMAIN: specify target domain. --ExcludeDCs: skip domain controllers during computer enumeration. --ldapusername USER --ldappassword PASS: authenticate with alternate credentials. --Loop --LoopDuration HH:MM:SS --LoopInterval HH:MM:SS: continuous session collection (e.g., every 5 minutes for 2 hours). --OutputDirectory PATH: specify output location. BloodHound.py: bloodhound-python -u USER -p PASS -d DOMAIN -ns NAMESERVER -c All. -c options: Group, LocalAdmin, Session, Trusts, Default, DCOnly, ACL, ObjectProps, All. -dc HOST: specify domain controller. -gc HOST: specify global catalog. -w NUM: worker threads for computer enumeration (default 10). --dns-tcp: use TCP for DNS queries. --auth-method {auto,ntlm,kerberos}: force auth type. --zip: compress output JSON files. Neo4j: sudo neo4j start/stop/restart. BloodHound GUI: ./BloodHound or bloodhound command. Drag-and-drop ZIP files to ingest data.

## Example workflows

1. Windows domain-joined collection: SharpHound.exe -c All --OutputDirectory C:\Temp. Transfer ZIP to analysis machine. 2. Linux-based remote collection: bloodhound-python -u jdoe -p 'P@ss123' -d corp.local -ns 192.168.1.10 -c All. 3. Stealth session enumeration: SharpHound.exe -c Session --Loop --LoopDuration 02:00:00 --LoopInterval 00:05:00 --ExcludeDCs. 4. Non-domain Windows system: runas /netonly /user:corp.local\jdoe "powershell.exe -c '.\SharpHound.exe -c All -d corp.local'". 5. Ingest and analyze: Start Neo4j (sudo neo4j start), launch BloodHound, drag-and-drop collector ZIP. Use built-in queries: Find all Domain Admins, Find Shortest Paths to Domain Admins, Find Kerberoastable Users, Find AS-REP Roastable Users, Find Computers with Unsupported OS, Find High Value Targets. Right-click nodes to mark as owned, find paths from owned principals. Use Analysis tab for statistics (user count, computer count, session count). Export custom Cypher queries for automation. 6. Remediation (blue team): Identify excessive privileges, remove unnecessary admin rights, fix ACL misconfigurations, disable unused accounts.

## Output format

Collectors output ZIP archives containing JSON files: computers.json, users.json, groups.json, domains.json, gpos.json, ous.json, containers.json, sessions.json. Each JSON file contains nodes and edges representing AD objects and relationships. Nodes have properties like name, objectid, distinguishedname, enabled, admincount, hasspn, etc. Edges represent relationships: MemberOf, AdminTo, HasSession, CanRDP, CanPSRemote, GenericAll, WriteDacl, WriteOwner, etc. BloodHound UI ingests these JSON blobs into Neo4j graph database. Query results display as interactive graphs with nodes (users, computers, groups, domains, OUs, GPOs) and edges (permissions, memberships, sessions). Right-click nodes/edges for detailed properties. Export graphs as PNG. Use Cypher query language for custom queries in the Raw Query box. Built-in queries return pre-formatted result sets. Database statistics available in Database Info tab (object counts, edge counts).

## Common pitfalls

EDR/AV often flags SharpHound as malware; create targeted allow-list entries before deployment or use obfuscated builds. Network noise: -c All generates significant LDAP, SMB, and RPC traffic; use -c DCOnly or targeted collection methods on monitored networks. Session data is transient; single collections may miss active admin sessions; use --Loop for session enumeration over time. Credentials required: collectors fail without valid domain credentials; compromised user account is minimum. Neo4j must be running before launching BloodHound GUI; start with sudo neo4j start. First-time Neo4j login requires password change; use neo4j-admin set-initial-password or change via web console. Large environments generate massive datasets; ingestion can take minutes to hours; increase Neo4j heap memory for better performance. SharpHound on non-domain systems requires runas /netonly or --ldapusername/--ldappassword. BloodHound.py DNS resolution issues: explicitly specify -ns NAMESERVER (DC IP). Python collector less comprehensive than SharpHound for session enumeration. Old BloodHound versions incompatible with newer collector formats; match collector and GUI versions. Don't forget to mark compromised users/computers as owned to enable path queries from owned principals.

## References

https://www.blackhillsinfosec.com/bloodhound-data-collection/
https://bloodhound.specterops.io/get-started/quickstart/community-edition-quickstart
https://www.sans.org/blog/bloodhound-sniffing-out-path-through-windows-domains
https://www.kali.org/tools/bloodhound/
https://www.pentestpartners.com/security-blog/bloodhound-walkthrough-a-tool-for-many-tradecrafts/
https://posts.specterops.io/introducing-bloodhound-cli-7dfaf82e2df8
https://www.kali.org/tools/bloodhound.py/
https://www.redfoxsec.com/blog/bloodhound-cheat-sheet
https://bloodhound.specterops.io/get-started/introduction
https://www.ired.team/offensive-security-experiments/active-directory-kerberos-abuse/abusing-active-directory-with-bloodhound-on-kali-linux
