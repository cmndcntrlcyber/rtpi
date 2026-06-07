---
name: Ldapsearch
description: Query and enumerate LDAP directories (Active Directory) using
  filters, credentials, and scope control to extract user, group, and
  configuration data.
registry: registry
tool_id: ldapsearch
category: active-directory
tags:
  - ldap
  - active-directory
  - enumeration
  - reconnaissance
  - directory-services
  - authentication
  - domain
mitre_techniques:
  - T1087.002
  - T1069.002
  - T1018
  - T1482
summary: "ldapsearch is the primary tool for querying LDAP directories including
  Active Directory. Use when you have domain credentials (or anonymous bind is
  allowed) and need to enumerate users, groups, computers, trusts, or
  configuration. Invoke with `-x` for simple auth, `-H ldap://HOST` or `-H
  ldaps://HOST:636` for target, `-D BINDDN` for identity (supports
  CN=user,DC=domain,DC=com or user@domain.com formats), `-W` to prompt for
  password (or `-w PASSWORD` inline), `-b BASEDN` for search base (e.g.,
  DC=domain,DC=com), `-s {base|one|sub|subordinates}` for scope (default: sub),
  and LDAP filter in parentheses. Common filters: `(objectClass=user)`,
  `(objectClass=group)`, `(sAMAccountName=username)`, `(adminCount=1)` for
  privileged accounts, `(objectClass=computer)`. Specify attributes at end to
  limit output (default: all user-readable attributes; use `+` for operational
  attributes like createTimestamp, pwdLastSet). Returns LDIF format to stdout.
  Port 389 for LDAP, 636 for LDAPS, 3268/3269 for Global Catalog in AD.
  Anonymous bind often works with `-x -b BASEDN` (no -D/-W). Supports Kerberos
  with `-Y GSSAPI`. Use with proxychains/SOCKS or layer-3 tunnel from
  compromised host to reach internal DCs. Combine with grep/awk for parsing.
  Watch for timeouts on large queries; add size/time limits with `-z` and `-l`.
  LDAPS strongly preferred to avoid credential sniffing and MITM downgrade
  attacks. Always test scope and filter before broad queries to avoid
  detection/logs."
sources:
  - https://docs.oracle.com/cd/E19199-01/816-6400-10/lsearch.html
  - https://docs.redhat.com/en/documentation/red_hat_directory_server/11/html/administration_guide/examples-of-common-ldapsearches
  - https://docs.ldap.com/ldap-sdk/docs/tool-usages/ldapsearch.html
  - https://devconnected.com/how-to-search-ldap-using-ldapsearch-examples/
  - https://notes.benheater.com/books/active-directory/page/ldapsearch
  - https://serverfault.com/questions/514870/how-do-i-authenticate-with-ldap-via-the-command-line
  - https://medium.com/@0xTurki/abusing-ldap-in-red-teaming-how-it-fuels-active-directory-recon-and-discovery-90e81d29914f
  - https://www.mdsec.co.uk/2024/02/active-directory-enumeration-for-red-teams/
  - https://medium.com/@gokulg.me/introduction-92199491c808
  - https://hackviser.com/tactics/pentesting/services/ldap
  - https://hacktricks.wiki/en/network-services-pentesting/pentesting-ldap.html
  - https://tylersguides.com/guides/search-active-directory-ldapsearch/
generated_at: 2026-05-19T11:05:14.668Z
generated_by: anthropic
source_hash: 0411375199a65f2b913157ef4b380911e00a0960ab121f5e861ca88e83f2f1e4
---

# Ldapsearch

## Overview

ldapsearch (version 2.5.20) queries LDAP directory services, primarily used against Microsoft Active Directory domain controllers. It performs authenticated or anonymous searches using LDAP protocol (TCP 389) or LDAPS/SSL (TCP 636), supports Active Directory Global Catalog queries (3268/3269), and returns results in LDIF text format. The tool binds to the directory, executes searches from a specified base DN with configurable scope, applies attribute filters, and outputs distinguished names plus requested attributes.

## When to use

Use ldapsearch when you have identified a domain controller (ports 88/Kerberos, 389/LDAP, 636/LDAPS, 3268-3269/GC open) and possess valid domain credentials or suspect anonymous bind is enabled. Primary scenarios: enumerate all domain users and groups to identify targets; locate privileged accounts (adminCount=1, Domain Admins membership); map organizational units and trust relationships; extract user attributes (email, group membership, lastLogon, password policies); identify service accounts and SPNs; retrieve domain and forest configuration from cn=config or rootDSE; find computers and servers for lateral movement planning; discover misconfigurations and weak access controls. Deploy from compromised domain-joined host via SOCKS proxy (proxychains) or layer-3 tunnel (ligolo-ng) to pivot internally. More stealthy than SMB/RPC enumeration tools and provides comprehensive directory data in single queries.

## Authentication & setup

Authentication requires `-x` (simple bind, not SASL), `-H ldap://DC-IP` or `-H ldaps://DC-IP:636` for target, `-D` for bind DN, and `-W` (prompt) or `-w PASSWORD` (inline, avoid in prod). Bind DN formats: Distinguished Name `CN=admin,DC=contoso,DC=org`, UserPrincipalName `admin@contoso.org`, or sAMAccountName `contoso.org\admin`. Example authenticated bind: `ldapsearch -x -H ldap://10.0.0.1 -D 'user@domain.com' -W -b 'DC=domain,DC=com'`. For Kerberos auth use `-Y GSSAPI` instead of -D/-W. Anonymous bind: omit -D and -W, use only `ldapsearch -x -H ldap://DC-IP -b 'DC=domain,DC=com' '(objectClass=*)'`. LDAPS (port 636) strongly recommended to prevent credential sniffing and MITM attacks; configure TLS_REQCERT in /etc/ldap/ldap.conf if needed. Search base (-b) identifies starting point in directory tree (typically DC=domain,DC=com for root domain). Test connectivity with rootDSE query: `ldapsearch -x -H ldap://DC-IP -s base namingContexts`. From Linux host, ensure ldap-utils package installed; from compromised Windows host use proxychains or tunnel to route traffic.

## Key commands / parameters

`-x`: Use simple authentication instead of SASL (required for AD password auth). `-H ldap://HOST` or `-H ldaps://HOST:636`: Target LDAP server URI. `-D BINDDN`: Bind identity; supports CN= format, UPN (user@domain.com), or DOMAIN\user. `-W`: Prompt for password securely. `-w PASSWORD`: Inline password (visible in process list). `-b BASEDN`: Search base/starting point, e.g., `DC=contoso,DC=org` or `CN=Users,DC=contoso,DC=org`. `-s {base|one|sub|subordinates}`: Scope - base (only base object), one (immediate children), sub (entire subtree, default), subordinates (subtree excluding base). `FILTER`: LDAP search filter in parentheses, e.g., `(objectClass=user)`, `(sAMAccountName=jdoe)`, `(adminCount=1)`, `(memberOf=CN=Domain Admins,CN=Users,DC=domain,DC=com)`. Boolean operators: `(&(filter1)(filter2))` (AND), `(|(filter1)(filter2))` (OR), `(!(filter))` (NOT). `ATTRIBUTES`: Space-separated list of attributes to return; omit for all user-readable attributes; `+` returns operational attributes; `""` returns all standard attributes when combined with operational attribute names. `-z SIZE`: Max number of entries to return. `-l TIMELIMIT`: Time limit in seconds. `-n`: No-op/dry-run mode with `-v` for verbose testing. `-o ldif-wrap=no`: Disable line wrapping in LDIF output. `-Y GSSAPI`: Use Kerberos authentication. `-f FILE`: Read filters from file (one per line).

## Example workflows

Enumerate all users: `ldapsearch -x -H ldap://10.0.0.5 -D 'admin@contoso.org' -W -b 'DC=contoso,DC=org' '(objectClass=user)' sAMAccountName mail memberOf`. Find Domain Admins: `ldapsearch -x -H ldaps://dc.corp.local:636 -D 'CORP\jdoe' -w 'Pass123' -b 'DC=corp,DC=local' '(memberOf=CN=Domain Admins,CN=Users,DC=corp,DC=local)' cn distinguishedName`. Locate privileged accounts: `ldapsearch -x -H ldap://192.168.1.10 -D 'user@domain.com' -W -b 'DC=domain,DC=com' '(&(objectClass=user)(adminCount=1))' cn sAMAccountName`. Enumerate all groups: `ldapsearch -x -H ldap://dc-ip -D 'admin@domain.com' -W -b 'DC=domain,DC=com' '(objectClass=group)' cn member`. List all computers: `ldapsearch -x -H ldap://dc-ip -D 'user@domain.com' -W -b 'DC=domain,DC=com' '(objectClass=computer)' cn dNSHostName operatingSystem`. Retrieve domain configuration: `ldapsearch -x -H ldap://dc-ip -D 'admin@domain.com' -W -b 'CN=Configuration,DC=domain,DC=com' -s base`. Get user's group memberships: `ldapsearch -x -H ldap://dc-ip -D 'admin@domain.com' -W -b 'DC=domain,DC=com' '(sAMAccountName=jdoe)' memberOf`. Anonymous enumeration test: `ldapsearch -x -H ldap://dc-ip -b 'DC=domain,DC=com' '(objectClass=*)' | head -50`. Retrieve operational attributes (password policy, last logon): `ldapsearch -x -H ldap://dc-ip -D 'admin@domain.com' -W -b 'DC=domain,DC=com' '(sAMAccountName=jdoe)' pwdLastSet lastLogon badPasswordTime +`. Use with proxychains: `proxychains ldapsearch -x -H ldap://10.10.10.5 -D 'user@domain.local' -W -b 'DC=domain,DC=local' '(objectClass=user)'`.

## Output format

Returns LDIF (LDAP Data Interchange Format) text to stdout. Each entry begins with `dn: DISTINGUISHED_NAME` followed by attribute: value pairs. Multi-valued attributes appear on separate lines. Long lines wrap at 76 characters by default (disable with `-o ldif-wrap=no`). Base64-encoded values shown as `attribute:: BASE64STRING`. Empty result returns only search metadata (numEntries: 0). Example output: `dn: CN=John Doe,OU=Users,DC=corp,DC=com
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: user
cn: John Doe
sAMAccountName: jdoe
userPrincipalName: jdoe@corp.com
memberOf: CN=Domain Admins,CN=Users,DC=corp,DC=com`. Ends with search summary: `# search result
search: 2
result: 0 Success

# numResponses: 15
# numEntries: 14`. Parse with grep, awk, or sed; filter for specific attributes with grep -E. Redirect to file for offline analysis. Errors print to stderr (connection failures, auth errors, invalid filter syntax).

## Common pitfalls

Using LDAP (port 389) instead of LDAPS (636) exposes credentials to network sniffing and enables MITM downgrade attacks; always prefer LDAPS in production environments. Forgetting `-x` flag results in SASL bind attempts that fail against typical AD simple bind configs. Incorrect bind DN format causes authentication failures; verify domain structure and test with rootDSE query first. Overly broad searches `(objectClass=*)` on large directories cause timeouts, excessive logs, and potential detection; limit scope with `-s one` or specific filters. Not specifying attributes returns all readable data, creating huge output; always list required attributes. Anonymous bind attempts without testing may trigger account lockouts or alerts. Inline passwords with `-w` visible in process lists and shell history; use `-W` for prompts or read from secure file. Missing `-b` defaults to null base DN, returning minimal results. Filter syntax errors (missing parentheses, wrong operators) silently return zero results. Large result sets truncated by server-side limits; check numEntries vs actual results and use `-z` for client-side limiting. TLS certificate validation failures with LDAPS require `-o tls_reqcert=never` or proper CA cert configuration. Forgetting to escape special characters in filters (parentheses, asterisks, backslashes). Not testing scope and base DN before broad enumeration queries. Some operational attributes require explicit request with `+` or attribute names; won't appear by default.

## References

https://docs.oracle.com/cd/E19199-01/816-6400-10/lsearch.html
https://docs.redhat.com/en/documentation/red_hat_directory_server/11/html/administration_guide/examples-of-common-ldapsearches
https://docs.ldap.com/ldap-sdk/docs/tool-usages/ldapsearch.html
https://devconnected.com/how-to-search-ldap-using-ldapsearch-examples/
https://notes.benheater.com/books/active-directory/page/ldapsearch
https://serverfault.com/questions/514870/how-do-i-authenticate-with-ldap-via-the-command-line
https://medium.com/@0xTurki/abusing-ldap-in-red-teaming-how-it-fuels-active-directory-recon-and-discovery-90e81d29914f
https://www.mdsec.co.uk/2024/02/active-directory-enumeration-for-red-teams/
https://medium.com/@gokulg.me/introduction-92199491c808
https://hackviser.com/tactics/pentesting/services/ldap
https://hacktricks.wiki/en/network-services-pentesting/pentesting-ldap.html
https://tylersguides.com/guides/search-active-directory-ldapsearch/
