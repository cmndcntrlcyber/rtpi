---
name: BloodHound (Python)
description: Python-based Active Directory data collector for BloodHound.
  Enumerates AD relationships, trust paths, and attack vectors from remote
  systems.
registry: security
tool_id: bloodhound-python
category: active-directory
tags:
  - active-directory
  - enumeration
  - bloodhound
  - reconnaissance
  - graph-analysis
  - privilege-escalation
  - ldap
mitre_techniques:
  - T1087.002
  - T1069.002
  - T1482
  - T1018
  - T1201
summary: "bloodhound-python is a remote AD data collector that queries domain
  controllers over LDAP/DNS to enumerate users, groups, computers, sessions,
  trusts, ACLs, and privilege relationships. Use it when you have valid domain
  credentials but no shell access on domain-joined Windows systems, or when
  operating from Linux/non-domain-joined hosts. It requires at least one valid
  domain account (username + password, or NTLM hash, or Kerberos ticket). Output
  is JSON files ready for import into the BloodHound graph UI. Common collection
  methods: 'Group', 'LocalAdmin', 'Session', 'Trusts', 'Default' (all previous),
  'ACL', 'ObjectProps', 'Container', 'All'. Use '-c All' for comprehensive
  enumeration. Authentication supports NTLM, Kerberos, or pass-the-hash via
  --hashes. Specify domain controller with -dc, nameserver with -ns (typically
  the DC IP). Use --zip to compress output. Not stealthy—generates significant
  LDAP traffic and DNS queries. Stealth-conscious alternatives include
  SharpHound from compromised endpoints with looping/throttling options. Typical
  workflow: authenticate with low-privilege account, collect all data, upload
  JSON to BloodHound UI, query for privilege escalation paths to Domain Admins
  or high-value targets. Watch for: DNS resolution failures (use -ns to specify
  DC), Kerberos clock skew (use --dns-tcp if UDP fails), channel binding
  enforcement (use --ldap-channel-binding), missing LDAPS support (use
  --use-ldaps if required by policy). Requires network line-of-sight to DC and
  DNS. Does not exploit—only enumerates."
sources:
  - https://www.kali.org/tools/bloodhound.py/
  - https://www.pentestpartners.com/security-blog/bloodhound-walkthrough-a-tool-for-many-tradecrafts/
  - https://www.blackhillsinfosec.com/bloodhound-data-collection/
  - https://www.youtube.com/watch?v=RhdhLwZHZmU
  - https://www.evolvesecurity.com/blog-posts/tools-of-the-trade-tracking-security-misconfigurations-with-bloodhound
  - https://posts.specterops.io/introducing-bloodhound-cli-7dfaf82e2df8?source=rss----f05f8696e3cc---4
  - https://dev.to/adamkatora/setting-up-and-using-bloodhound-in-kali-linux-23pg
  - https://www.thehacker.recipes/a-d/recon/bloodhound
  - https://cybersectools.com/compare/bloodhound-vs-red-teaming-toolkit
  - https://www.redfoxsec.com/blog/bloodhound-cheat-sheet
  - https://bloodhound.specterops.io/get-started/introduction
  - https://www.linkedin.com/posts/joas-antonio-dos-santos_github-cybersecurityupawesome-active-directory-pentest-tools-activity-7337674504728408065-sw4S
generated_at: 2026-05-19T11:27:37.584Z
generated_by: anthropic
source_hash: 5993fc93c23fc1f6e8aa37c492a6c12eced99fed793a019b8a816d7b465bf8db
---

# BloodHound (Python)

## Overview

bloodhound-python is the Python-based data ingestor for BloodHound, an Active Directory attack path analysis tool. It remotely queries domain controllers via LDAP, DNS, SMB, and RPC protocols to enumerate users, groups, computers, sessions, GPOs, OUs, trusts, ACLs, and privilege relationships. The tool produces JSON files containing graph data that BloodHound's Neo4j-backed UI visualizes as nodes and edges, revealing transitive trust relationships, privilege escalation paths, and misconfigurations. Unlike SharpHound (the C#/.NET collector), bloodhound-python runs from any OS with Python and works without executing code on target Windows systems. It is particularly useful during the reconnaissance phase of penetration tests when you have credentials but limited shell access.

## When to use

Use bloodhound-python when you have valid domain credentials but operate from a non-Windows system (Kali, Ubuntu, macOS) or cannot execute binaries on domain-joined endpoints. It is ideal for initial AD reconnaissance after obtaining a single user account via phishing, password spraying, or credential reuse. Use it when remote LDAP/SMB enumeration is permitted by network segmentation but on-host execution is blocked or monitored. Choose bloodhound-python over SharpHound when you need rapid collection without touching disk on target endpoints, or when working from external VPN/Citrix sessions with limited privileges. Do not use if you need stealthy enumeration—bloodhound-python generates significant network traffic. Prefer SharpHound with --Stealth or looping options when operating from a compromised domain-joined host and need to evade behavioral detection. Use after obtaining credentials from tools like Responder, Impacket ntlmrelayx, or Kerbrute.

## Authentication & setup

Requires valid domain credentials in one of these forms: username + password, NTLM hash (LM:NTLM format), or Kerberos AES key. Install via 'pip install bloodhound' or clone from GitHub and run 'python setup.py install'. Dependencies: impacket, ldap3, dnspython. For Python 3.x, use latest impacket from GitHub. Authentication flags: -u USERNAME -p PASSWORD for cleartext, --hashes LM:NTLM for pass-the-hash, -k -aesKey HEX for Kerberos, -no-pass with -k for ticketed Kerberos auth (requires valid TGT in environment). Use --auth-method {auto,ntlm,kerberos} to force protocol; 'auto' attempts Kerberos with NTLM fallback. Specify domain with -d DOMAIN.LOCAL and domain controller with -dc DC01.DOMAIN.LOCAL. Use -ns to override DNS server (typically the DC IP address). If corporate policy enforces LDAP signing/channel binding, add --ldap-channel-binding. If LDAPS is required, add --use-ldaps. Test connectivity before full collection: 'bloodhound-python -d domain.local -u user -p pass -dc dc01.domain.local -ns 10.0.0.1 -c Group' (smallest collection method).

## Key commands / parameters

Core syntax: bloodhound-python -d DOMAIN -u USER -p PASS -ns NAMESERVER -c COLLECTIONMETHOD

-c / --collectionmethod: Comma-separated list. Methods: 'Group' (group memberships), 'LocalAdmin' (local admin rights), 'Session' (active sessions), 'Trusts' (domain/forest trusts), 'ACL' (access control lists), 'ObjectProps' (object properties), 'Container' (OU/container structure), 'Default' (Group+LocalAdmin+Session+Trusts), 'DCOnly' (no SMB/RPC calls, LDAP only), 'All' (comprehensive). Use 'All' for full enumeration.

-d DOMAIN: Target domain (e.g., corp.local)
-u USERNAME: Domain user account
-p PASSWORD: Cleartext password
--hashes LM:NTLM: Pass-the-hash (e.g., --hashes :32ed87bdb5fdc5e9cba88547376818d4)
-k: Use Kerberos authentication
-aesKey HEX: Kerberos AES key (128 or 256 bit)
--auth-method {auto,ntlm,kerberos}: Force auth protocol
-ns NAMESERVER: DNS server IP (usually DC)
-dc HOSTNAME: Domain controller FQDN
-gc HOSTNAME: Global catalog server override
-w WORKERS: Thread count for enumeration (default 10)
--exclude-dcs: Skip domain controllers during computer enumeration
--zip: Compress JSON output into archive
--dns-tcp: Use TCP for DNS queries instead of UDP
--dns-timeout SECONDS: DNS query timeout (default 3)
--computerfile FILE: Allowlist of computer FQDNs to enumerate
--use-ldaps: Force LDAPS (port 636)
--ldap-channel-binding: Enable LDAP channel binding
-op PREFIX: Prefix for output filenames
--disable-autogc: Disable automatic global catalog selection

## Example workflows

Basic collection with password:
blockhound-python -d corp.local -u jdoe -p 'P@ssw0rd!' -ns 10.10.10.10 -c All

Pass-the-hash collection:
blockhound-python -d corp.local -u administrator --hashes :32ed87bdb5fdc5e9cba88547376818d4 -ns 10.10.10.10 -c All

Kerberos auth with ticket:
export KRB5CCNAME=/tmp/jdoe.ccache
blockhound-python -d corp.local -u jdoe -k -no-pass -ns 10.10.10.10 -c All

Stealthy LDAP-only collection (no SMB):
blockhound-python -d corp.local -u jdoe -p 'P@ssw0rd!' -ns 10.10.10.10 -dc dc01.corp.local -c DCOnly

Targeted enumeration with output compression:
blockhound-python -d corp.local -u jdoe -p 'P@ssw0rd!' -ns 10.10.10.10 -c Group,ACL,ObjectProps --zip -op corp_recon

Multithreaded collection with DNS over TCP:
blockhound-python -d corp.local -u jdoe -p 'P@ssw0rd!' -ns 10.10.10.10 -c All -w 20 --dns-tcp --dns-timeout 5

Collection from limited allowlist:
blockhound-python -d corp.local -u jdoe -p 'P@ssw0rd!' -ns 10.10.10.10 -c All --computerfile targets.txt

Secure collection with LDAPS and channel binding:
blockhound-python -d corp.local -u jdoe -p 'P@ssw0rd!' -ns 10.10.10.10 -c All --use-ldaps --ldap-channel-binding

After collection, upload JSON files to BloodHound UI: open BloodHound web interface, click Upload Data, select all generated *_*.json files. Query attack paths using prebuilt queries (e.g., 'Find Shortest Paths to Domain Admins') or custom Cypher queries.

## Output format

Outputs multiple JSON files in current working directory, one per object type: {timestamp}_users.json, {timestamp}_groups.json, {timestamp}_computers.json, {timestamp}_domains.json, {timestamp}_gpos.json, {timestamp}_ous.json, {timestamp}_containers.json. Each file contains graph nodes and edges in BloodHound's schema format. Use --zip flag to generate single compressed archive. JSON structure includes: 'data' array of objects with 'Properties' (name, distinguished name, domain, SID, enabled status, password metadata) and relationships like 'MemberOf', 'AdminTo', 'HasSession', 'AllowedToDelegate', 'WriteDacl', 'GenericAll', etc. Files are ready for direct import into BloodHound UI via drag-and-drop or upload button. Use -op PREFIX to control output filename prefix. Typical file sizes: 100KB-50MB per file depending on domain size. Large environments (>10k users) may produce 100MB+ total. Do not parse JSON manually—use BloodHound UI for visualization and Neo4j Cypher queries for programmatic analysis. JSON schema documented at bloodhound.specterops.io.

## Common pitfalls

DNS resolution failures: If tool cannot resolve domain, use -ns to explicitly specify DC IP address and -dc for DC hostname. Kerberos clock skew: Ensure attacking system's clock is within 5 minutes of domain controller time; use ntpdate or similar. Authentication failures with pass-the-hash: Verify NTLM hash format is :NTLMhash (colon prefix, no LM hash needed for modern domains). Empty or incomplete results: Session collection requires SMB access to computer objects—firewalls often block SMB (445/tcp). LocalAdmin collection requires RPC access. Use -c DCOnly if only LDAP (389/tcp) is accessible. Timeout errors: Increase --dns-timeout or use --dns-tcp if UDP DNS is unreliable. Large domains may time out—reduce -w worker count to avoid overwhelming DC. LDAP channel binding errors: Add --ldap-channel-binding if target enforces it (returns 'strongerAuthRequired' errors). Missing LDAPS: If port 636 is required by policy but not available, collection fails—verify LDAPS cert is valid or use --use-ldaps flag. Global catalog issues: If tool cannot auto-select GC, use --disable-autogc and manually specify -gc. Permission denied on computers: Low-privilege users cannot enumerate local admins on hardened systems—expected behavior, not a bug. Upload failures to BloodHound UI: Ensure Neo4j database is running and credentials match UI login. Detection risk: Tool generates thousands of LDAP queries, DNS lookups, and SMB connections—highly visible to SIEM, EDR, and IDS. Use rate limiting or SharpHound's stealth options if operational security matters. Python version conflicts: Tool originally Python 2, now supports Python 3—verify dependencies installed for correct interpreter version.

## References

• https://www.kali.org/tools/bloodhound.py/
• https://www.pentestpartners.com/security-blog/bloodhound-walkthrough-a-tool-for-many-tradecrafts/
• https://www.blackhillsinfosec.com/bloodhound-data-collection/
• https://www.evolvesecurity.com/blog-posts/tools-of-the-trade-tracking-security-misconfigurations-with-bloodhound
• https://dev.to/adamkatora/setting-up-and-using-bloodhound-in-kali-linux-23pg
• https://www.thehacker.recipes/a-d/recon/bloodhound
• https://www.redfoxsec.com/blog/bloodhound-cheat-sheet
• https://bloodhound.specterops.io/get-started/introduction
