---
name: Nbtscan
description: NetBIOS scanner for Windows networks. Queries UDP 137 to enumerate
  NetBIOS names, logged-in users, and MAC addresses.
registry: security
tool_id: nbtscan
category: reconnaissance
tags:
  - netbios
  - reconnaissance
  - network-scanning
  - windows
  - enumeration
  - udp
  - smb
mitre_techniques:
  - T1046
  - T1018
summary: Nbtscan discovers NetBIOS name information from Windows hosts by
  sending status queries to UDP port 137. Use it for rapid network
  reconnaissance to identify live Windows hosts, computer names,
  workgroup/domain membership, logged-in users, and MAC addresses. Invoke with
  IP ranges in CIDR (192.168.1.0/24) or dash notation (192.168.1.10-50). Output
  is line-based by default (IP, DOMAIN\HOSTNAME, username, MAC). Use -f flag for
  full NBT resource record responses showing all registered names with suffixes
  (<00> workstation, <20> file server, <03> messenger, <1D> master browser).
  Tool is UDP-based so extremely fast but provides no authentication; only works
  against Windows systems or Samba. Default timeout is 2 seconds; increase with
  -T for slow/lossy networks. Use -n to skip reverse DNS lookups that may hang.
  No credential handling required—NetBIOS queries are unauthenticated. Prefer
  nbtscan-unixwiz variant (v1.0.35+) over legacy nbtscan for better results.
  Does not perform share enumeration; use smbclient or enum4linux for that.
  Helpful for initial asset discovery, identifying active Windows hosts before
  credential attacks, and mapping network topology in internal engagements.
sources:
  - https://en.kali.tools/?p=1744
  - https://highon.coffee/blog/nbtscan-cheat-sheet/
  - https://man.archlinux.org/man/extra/nbtscan/nbtscan.1.en
  - http://www.unixwiz.net/tools/nbtscan.html
  - https://sectools.org/tool/nbtscan/
  - https://www.kali.org/tools/nbtscan-unixwiz/
  - https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/nbtstat
  - https://www.nuharborsecurity.com/blog/red-teaming-vs-penetration-testing
  - https://www.offsec.com/blog/red-teaming-vs-pentesting/
  - https://www.synack.com/knowledge-base/red-teaming-vs-penetration-testing-understanding-the-differences/
  - https://cloudsecurityalliance.org/articles/penetration-testing-vs-red-teaming
  - https://pentestlab.blog/tag/nbtscan/
generated_at: 2026-05-19T11:23:52.583Z
generated_by: anthropic
source_hash: 026799e91214fac3ab96521f06c21ee87430cb3114ded67e9aec65d7a07996ab
---

# Nbtscan

## Overview

Nbtscan sends NetBIOS status queries (UDP port 137) to IP ranges and parses responses to extract computer names, workgroup/domain names, logged-in usernames, and MAC addresses. It operates via unauthenticated UDP broadcasts, making it extremely fast for surveying large Windows networks. The tool only works against systems running NetBIOS over TCP/IP—primarily Windows hosts and some Samba servers on Unix/Linux. Two main implementations exist: the original by Alla Bezroutchko and nbtscan-unixwiz by Steve Friedl (recommended). The unixwiz variant (v1.0.35+) typically finds more information and is the version shipped with Kali Linux.

## When to use

Deploy nbtscan during the reconnaissance phase when you need to quickly identify live Windows hosts on a subnet without credentials. Use it for initial network mapping in internal penetration tests to discover workgroup/domain membership, enumerate active workstations vs. servers (via NetBIOS suffixes), and correlate IP addresses with hostnames. It is ideal for large IP ranges where speed is critical—nbtscan can survey a /24 in seconds. Use nbtscan before authenticated enumeration (enum4linux, smbclient) to prioritize targets. Note: it only detects systems with NetBIOS enabled; modern hardened Windows environments may disable NetBIOS over TCP/IP. Not suitable for share enumeration or exploitation—use dedicated SMB tools for those tasks.

## Authentication & setup

No authentication or credentials required. Nbtscan sends unauthenticated NetBIOS status queries. The tool binds to a random UDP source port by default; use -p <port> to specify a source port if firewall rules require it. Ensure your source system allows outbound UDP traffic and can receive responses on high ports. Target systems must have NetBIOS over TCP/IP enabled (UDP 137 open). No special privileges needed on the scanning host unless binding to ports <1024. On Kali, nbtscan-unixwiz is pre-installed. For other systems, compile from source (publicly available) or download binaries. No configuration files or API keys required.

## Key commands / parameters

Basic syntax: nbtscan [options] <target>

Target formats:
- Single IP: 192.168.1.50
- CIDR range: 192.168.1.0/24
- Dash range: 192.168.1.10-100
- Hostname: target.local

Key flags:
-f : Show full NBT resource record responses with all registered names and suffixes. Use for single-host deep inspection. Output includes service indicators like <00> (workstation), <20> (file server), <03> (messenger), <1D> (master browser), <1E> (browser elections).
-v : Verbose debugging output (developer-focused, not typically needed).
-V : Display version information.
-n : Disable inverse DNS lookups. Use when DNS is slow/broken to prevent hangs.
-m : Include MAC addresses in output (implied by -f).
-T <seconds> : Set timeout for non-responses (default 2 seconds). Increase for slow/lossy networks.
-t <tries> : Retry each address N times (default 1). Useful for packet-lossy environments.
-w <msecs> : Wait time after each write in milliseconds (default 10). Tune for rate-limiting.
-p <port> : Bind to specific UDP source port (default random).
-O <file> : Write output to file instead of stdout.
-P : Generate Perl hashref output for programmatic parsing.
-H : Add HTTP headers (legacy use case for web-based exploit chains).

## Example workflows

1. Quick subnet scan (default output):
nbtscan 192.168.1.0/24
Output: IP, WORKGROUP\HOSTNAME, USERNAME, MAC per line.

2. Detailed single-host enumeration:
nbtscan -f 192.168.1.50
Shows all NetBIOS names with suffixes. Identify services: <20> indicates file sharing enabled, <1D> indicates domain master browser.

3. Large network scan with retries and custom timeout:
nbtscan -t 2 -T 5 10.0.0.0/16
Retries twice per host, waits 5 seconds for responses. Use for unreliable networks.

4. Scan without DNS lookups (avoid hangs):
nbtscan -n 192.168.10.0/24
Skips reverse DNS, outputs only IP addresses and NetBIOS data.

5. Save results to file:
nbtscan -O results.txt 172.16.0.0/22

6. Identify domain controllers:
nbtscan -f <subnet> | grep '<1C>'
Suffix <1C> indicates domain controller.

7. Find master browsers:
nbtscan -f <subnet> | grep '<1D>'

8. Enumerate logged-in users across network:
nbtscan 192.168.1.0/24 | awk '{print $3}'
Extract third field (username) from default output.

## Output format

Default one-line format:
<IP> <DOMAIN\HOSTNAME> <USERNAME> <MAC>
Example:
192.168.1.105 WORKGROUP\RETROPIE SHARING 00:1A:2B:3C:4D:5E

With -f (full record):
192.168.0.38 WORKGROUP\DOOKOSSEL SHARING
  DOOKOSSEL      <00> UNIQUE Workstation Service
  DOOKOSSEL      <03> UNIQUE Messenger Service
  DOOKOSSEL      <20> UNIQUE File Server Service
  ..__MSBROWSE__.<01> GROUP  Master Browser
  WORKGROUP      <00> GROUP  Domain Name
  WORKGROUP      <1D> UNIQUE Master Browser
  WORKGROUP      <1E> GROUP  Browser Service Elections
  00:00:00:00:00:00 ETHER

NetBIOS suffix meanings:
<00> UNIQUE: Workstation/Server name
<00> GROUP: Domain/Workgroup name
<03> UNIQUE: Messenger service (logged-in user)
<20> UNIQUE: File Server service (SMB shares active)
<1D> UNIQUE: Master Browser
<1E> GROUP: Browser Service Elections
<1C> GROUP: Domain Controllers
<1B> UNIQUE: Domain Master Browser

-P flag outputs Perl hashref format for scripting. Terminating line: 'timeout (normal end of scan)' indicates completion.

## Common pitfalls

1. No results from modern networks: Many hardened Windows environments disable NetBIOS over TCP/IP in favor of pure DNS/LLMNR. If nbtscan returns no hosts but you know Windows systems exist, NetBIOS may be disabled at the network or host level.

2. Firewall blocking: Host or network firewalls may drop UDP 137 queries. ICMP 'Port Unreachable' messages may cause Windows systems to report 'Connection reset by peer'—this is normal, ignore it.

3. Timeouts on slow networks: Default 2-second timeout is too short for WAN or congested links. Use -T 10 or higher and -t 2+ for retries.

4. DNS lookup hangs: Inverse DNS lookups can hang indefinitely on misconfigured networks. Always use -n flag if you see delays.

5. Incomplete MAC addresses: Some systems return 00:00:00:00:00:00 for MAC—this is Samba behavior, not a tool bug.

6. Tool version matters: The original nbtscan finds fewer hosts than nbtscan-unixwiz. Verify you are using nbtscan-unixwiz (check with nbtscan -V).

7. Expecting share enumeration: Nbtscan only queries NetBIOS names via UDP. It does not enumerate SMB shares (TCP 445/139). Use smbclient, smbmap, or enum4linux for share discovery.

8. UDP unreliability: Packet loss means missed hosts. Use -t flag to retry or run multiple passes on critical scans.

9. Interpretation errors: Suffixes are hexadecimal in angle brackets. <20> is file server; <03> with UNIQUE is a logged-in username, not a service. Review suffix table before analysis.

## References

• https://en.kali.tools/?p=1744
• https://highon.coffee/blog/nbtscan-cheat-sheet/
• https://man.archlinux.org/man/extra/nbtscan/nbtscan.1.en
• http://www.unixwiz.net/tools/nbtscan.html
• https://sectools.org/tool/nbtscan/
• https://www.kali.org/tools/nbtscan-unixwiz/
• https://pentestlab.blog/tag/nbtscan/
