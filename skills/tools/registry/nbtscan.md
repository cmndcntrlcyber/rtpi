---
name: Nbtscan
description: NetBIOS name scanner for Windows networks; discovers computer
  names, logged-in users, and MAC addresses from UDP port 137.
registry: registry
tool_id: nbtscan
category: reconnaissance
tags:
  - netbios
  - reconnaissance
  - windows
  - network-scanning
  - enumeration
  - active-directory
  - smb
mitre_techniques:
  - T1018
  - T1087.002
  - T1016
summary: nbtscan sends NetBIOS status queries (UDP 137) to IP ranges and returns
  computer names, workgroups, logged-in users, and MAC addresses. Use during
  initial reconnaissance of Windows networks to rapidly enumerate live NetBIOS
  hosts. Invoke with IP ranges in CIDR notation (192.168.1.0/24) or octet ranges
  (192.168.1.1-254). Expect one-line-per-host output showing IP,
  WORKGROUP\HOSTNAME, logged-in user, and MAC. Add -f for full NBT resource
  record responses with service suffixes (<00>=workstation, <03>=messenger,
  <20>=file server, <1D>=master browser). Targets respond only if NetBIOS over
  TCP/IP (NBT-NS) is enabled; modern Windows 10/11 may disable this by default.
  Does NOT detect shares (use smbclient/enum4linux for that). Non-Windows hosts
  and those with NetBIOS disabled return no response. Use -v for verbose output,
  -n to skip reverse DNS lookups (prevents hangs), -t for retry attempts on
  lossy networks, -w to tune inter-packet delay. Output is plain text, parseable
  but not structured; -P generates Perl hashref format for scripting. Timeouts
  are normal and indicate non-NetBIOS hosts or network boundaries. This tool is
  fast and UDP-based; it does not establish TCP connections. Combine with nmap
  -sU --script nbstat.nse for corroboration.
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
generated_at: 2026-05-19T10:59:25.207Z
generated_by: anthropic
source_hash: 6299e8bec95e3b92567e948a2a5e7c524830ddac813984ac4c1321d57ac358e4
---

# Nbtscan

## Overview

nbtscan is a NetBIOS name information scanner for IP networks. It sends NetBIOS status queries to each address in a supplied range and lists IP address, NetBIOS computer name, logged-in user name, and MAC address for each responding host. It operates over UDP port 137 and is significantly faster than TCP-based enumeration tools. The tool is most effective against Windows systems and Samba servers with NetBIOS enabled. Two main implementations exist: the original by Alla Bezroutchko and an alternate by Steve Friedl (nbtscan-unixwiz); functionality is similar.

## When to use

Use nbtscan during the reconnaissance phase of an engagement to rapidly enumerate live Windows hosts on a network segment. It is ideal for: identifying NetBIOS-enabled systems in large IP ranges; mapping Windows workgroups and domains; discovering logged-in users for targeting; obtaining MAC addresses for device fingerprinting; initial network profiling before SMB share enumeration. Deploy nbtscan when you have network access to a subnet and need quick, non-intrusive enumeration. It is less useful on networks with NetBIOS over TCP/IP disabled (increasingly common on modern hardened Windows 10/11), in pure Active Directory environments using DNS for name resolution, or against non-Windows targets. Always follow with deeper SMB enumeration tools (enum4linux, smbclient, CrackMapExec) after identifying targets.

## Authentication & setup

nbtscan requires no authentication or credentials; it operates entirely via unauthenticated UDP queries to port 137. No special setup is required. The tool must be able to send UDP packets to destination port 137 and receive responses; verify that local and network firewalls permit outbound UDP 137 and inbound responses. On some distributions, nbtscan may need to bind to a local UDP port; use -p <port> if conflicts occur (default is port 0 for random assignment). No configuration files are used. If scanning remote networks, ensure there are no stateful firewalls blocking UDP return traffic. The tool runs with standard user privileges; root/administrator access is not required for sending queries, though some systems may require elevated privileges to bind to low-numbered ports if specified with -p.

## Key commands / parameters

Basic syntax: nbtscan [options] target [targets...]

Target formats:
- Single IP: 192.168.1.10
- CIDR range: 192.168.1.0/24
- Octet range: 192.168.1.1-254
- DNS name: hostname.local

Critical options:
-f : Show full NBT resource record responses with service suffixes; use for detailed single-host analysis
-v : Verbose mode; additional debugging output
-n : No reverse DNS lookups; prevents hangs on misconfigured DNS
-t <n> : Retry each address <n> times (default 1); useful for lossy/remote networks
-T <n> : Timeout in seconds for no-responses (default 2)
-w <n> : Wait <n> milliseconds after each write (default 10); tune for rate limiting
-m : Include MAC address in output (implied by -f)
-p <n> : Bind to UDP source port <n> (default 0 for random)
-O <file> : Write output to file instead of stdout
-P : Generate Perl hashref output format for scripting
-V : Show version information
-H : Generate HTTP header (specialized use case for web-based execution)

No -h or --help flag is supported; running nbtscan without arguments or with invalid options shows usage.

## Example workflows

1. Scan a /24 subnet with standard output:
   nbtscan 192.168.1.0/24
   Output: IP, WORKGROUP\HOSTNAME, USER, MAC per line

2. Detailed scan of single host with full NBT records:
   nbtscan -f 192.168.1.50
   Shows all NetBIOS names with suffixes (e.g., <00>, <20>, <1D>)

3. Scan range without DNS lookups (faster, avoids hangs):
   nbtscan -n 10.10.10.1-254

4. Scan remote/unreliable network with retries and longer timeout:
   nbtscan -t 3 -T 5 -w 50 172.16.0.0/16

5. Save results to file for later analysis:
   nbtscan -O netbios_scan.txt 192.168.0.0/16

6. Generate machine-parseable Perl output:
   nbtscan -P 192.168.1.0/24 > results.pl

7. Enumerate and identify file servers (look for <20> suffix in full output):
   nbtscan -f 192.168.1.0/24 | grep '<20>'

8. Combined recon workflow:
   nbtscan -n 10.0.0.0/8 | tee netbios.txt
   cat netbios.txt | awk '{print $1}' | nmap -p445 -iL -
   (Feed discovered IPs to SMB scanner)

Interpret suffixes in -f output:
<00> (U) = Workstation Service
<03> (U) = Messenger Service
<20> (U) = File Server Service
<1D> (U) = Master Browser
<1E> (G) = Browser Service Elections

## Output format

Default output format (one line per responding host):
IP_ADDRESS WORKGROUP\HOSTNAME USERNAME MAC_ADDRESS

Example:
192.168.1.10 WORKGROUP\DESKTOP-PC John 00:0c:29:3a:2b:1c
192.168.1.15 CORP\FILESERVER01 Administrator 00:50:56:a1:b2:c3

With -f (full NBT resource records), output is multi-line per host:
192.168.1.10 WORKGROUP\DESKTOP-PC
  DESKTOP-PC      <00> UNIQUE Workstation Service
  DESKTOP-PC      <03> UNIQUE Messenger Service
  DESKTOP-PC      <20> UNIQUE File Server Service
  WORKGROUP       <00> GROUP  Domain Name
  WORKGROUP       <1E> GROUP  Browser Service Elections
  00:0c:29:3a:2b:1c ETHER

Common end-of-scan message:
timeout (normal end of scan)

With -P (Perl hashref format), output is structured Perl data for programmatic parsing.

No responses (timeouts) are not printed by default; only responding hosts appear in output. Use -v for verbose mode to see query attempts. The scan completes with 'timeout (normal end of scan)' when the timeout period elapses with no further responses. Output is plain text, not JSON/XML; post-process with awk/grep/sed as needed.

## Common pitfalls

NetBIOS disabled: Modern Windows 10/11 and hardened environments often disable NetBIOS over TCP/IP; you will see no responses even though hosts are live. Verify with nmap -sU -p137 or check 'nbtstat -n' on target if you have access. DNS hangs: Without -n flag, nbtscan performs reverse DNS lookups that can hang on misconfigured nameservers; always use -n for large scans or unknown networks. Firewall blocking: Stateful firewalls may drop unsolicited UDP responses; scans from outside the local subnet may yield incomplete results. Rate limiting: Scanning very large ranges (e.g., /8) without tuning -w may cause local network congestion or dropped packets; increase wait time with -w 50 or higher for WAN scans. UDP unreliability: Packets may be lost; use -t 2 or -t 3 for retry attempts on unreliable links. False negatives: No response does NOT mean the host is down; it may be a non-Windows system, have NetBIOS disabled, or be filtered by firewall. Interpretation errors: Users sometimes expect nbtscan to enumerate SMB shares; it does NOT — use enum4linux, smbclient, or smbmap for that. Verbose output confusion: -v adds developer debugging info that is not useful for operators; use -f for detailed enumeration, not -v. Version confusion: Multiple nbtscan implementations exist (original vs. nbtscan-unixwiz); flags are mostly compatible but output formatting may differ slightly. ICMP errors on Windows 2000: May report 'Connection reset by peer' errors; these are normal and should be ignored.

## References

• https://en.kali.tools/?p=1744
• https://highon.coffee/blog/nbtscan-cheat-sheet/
• https://man.archlinux.org/man/extra/nbtscan/nbtscan.1.en
• http://www.unixwiz.net/tools/nbtscan.html
• https://sectools.org/tool/nbtscan/
• https://www.kali.org/tools/nbtscan-unixwiz/
• https://pentestlab.blog/tag/nbtscan/
