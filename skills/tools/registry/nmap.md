---
name: Nmap
description: Network scanner for host discovery, port scanning, service
  enumeration, OS detection, and vulnerability assessment during reconnaissance.
registry: registry
tool_id: nmap
category: reconnaissance
tags:
  - reconnaissance
  - network-scanning
  - port-scanning
  - service-enumeration
  - host-discovery
  - vulnerability-assessment
  - nse
mitre_techniques:
  - T1046
  - T1595.002
  - T1590.005
summary: "Nmap 7.80 is the primary network reconnaissance tool at /usr/bin/nmap.
  Use it for host discovery, port scanning, service version detection, OS
  fingerprinting, and scripted vulnerability checks. Default behavior scans top
  1000 TCP ports using TCP SYN scan (-sS) as root or TCP connect scan (-sT) as
  standard user, with randomized port order and T3 timing. Port states: open
  (service listening), closed (no service), filtered (firewall/IDS blocking),
  unfiltered (accessible but state unknown). Invoke with target specification
  (IP, CIDR, hostname, ranges like 10.0.0-255.1-254) plus scan options. Key
  flags: -sS (stealth SYN), -sT (TCP connect), -sU (UDP), -sV (version
  detection), -O (OS detection), -A (aggressive: OS+version+scripts+traceroute),
  -p (port spec: -p22,80,443 or -p1-65535), -Pn (skip ping, assume host up), -n
  (no DNS), -T0-5 (timing), --script (NSE scripts). Host discovery: -sn (ping
  scan only, no ports), -PS/PA/PU (TCP SYN/ACK/UDP ping). Output: -oN (normal),
  -oX (XML), -oG (greppable), -oA (all formats). Always obtain authorization
  before scanning; unauthorized scans are illegal. Nmap sends raw packets and
  may trigger IDS/IPS. For large networks, tune timing with -T options
  (T0=paranoid, T3=normal, T5=insane). Use --reason to see why ports are marked
  in each state. Resume aborted scans with --resume <file.nmap>. Privileged
  (root) access enables SYN scans and OS detection; unprivileged falls back to
  connect() scans. Scan randomization aids stealth; disable with -r for
  sequential ports. NSE scripts extend functionality (vuln scanning, brute
  force, exploitation checks). Expect noise: aggressive scans (-A, -T4/T5, full
  port ranges) generate significant traffic and are easily detected."
sources:
  - https://nmap.org/book/man.html
  - https://nmap.org/docs.html
  - https://nmap.org/book/toc.html
  - https://netlas.io/blog/nmap_commands/
  - https://nmap.org/book/man-briefoptions.html
  - https://nmap.org/book/port-scanning-options.html
  - https://highon.coffee/blog/nmap-cheat-sheet/
  - https://nmap.org/book/output-formats-commandline-flags.html
  - https://www.recordedfuture.com/threat-intelligence-101/tools-and-techniques/nmap-commands
  - https://www.centralinfosec.com/blog/penetration-testing-with-nmap
  - https://www.pass4sure.com/blog/unleashing-the-power-of-open-source-essential-tools-for-red-team-success/
  - https://firecompass.com/top-25-red-teaming-tools/
generated_at: 2026-05-19T10:57:42.661Z
generated_by: anthropic
source_hash: 4a17aeafe7bf988cf5efcda610bfd0fde5ee81fc3efb0739179ca10d9b193afd
---

# Nmap

## Overview

Nmap 7.80 is an open-source network scanning utility for security auditing, network exploration, and red team reconnaissance. It identifies live hosts, open ports, running services with versions, operating systems, and packet filter behavior. Uses raw IP packets for host discovery and port scanning. Core capabilities: TCP/UDP/SCTP port scanning, service/version detection, OS fingerprinting via TCP/IP stack analysis, and extensibility through Nmap Scripting Engine (NSE) for vulnerability detection and exploitation checks. Output includes 'interesting ports table' showing port number, protocol, service name, and state.

## When to use

Use Nmap during reconnaissance and enumeration phases for: mapping network topology and identifying live hosts (-sn ping sweeps); discovering open ports and services on target systems (TCP/UDP scanning); fingerprinting service versions to identify vulnerable software (-sV); determining target operating systems for exploit selection (-O); running NSE scripts for vulnerability assessment (--script vuln); baseline network inventory before/after changes; verifying firewall rules and filtering behavior; identifying attack surface and entry points. Required for T1046 Network Service Discovery, T1595.002 Active Scanning: Vulnerability Scanning, and T1590.005 Gather Victim Network Information: IP Addresses. Essential first step before exploitation phases.

## Authentication & setup

No authentication required for basic operation. Runs as standard user or root; privilege level affects capabilities. As root: TCP SYN scans (-sS, default), OS detection (-O), and raw packet manipulation available. As standard user: falls back to TCP connect() scans (-sT), limited to higher-level socket operations, cannot perform OS detection or certain advanced scans. Requires network connectivity to targets. No configuration files needed for basic operation; optional custom data files in /usr/share/nmap/ for service fingerprints (nmap-service-probes), OS signatures (nmap-os-db), MAC vendors (nmap-mac-prefixes). Specify custom data directory with --datadir. For IPv6 scanning, use -6 flag. Unprivileged users should explicitly use --unprivileged flag if encountering permission errors. Root access strongly recommended for red team operations to enable full feature set.

## Key commands / parameters

TARGET SPECIFICATION: IP (192.168.1.1), CIDR (10.0.0.0/24), ranges (192.168.0-255.1-254), hostname (target.com), -iL <file> (target list), -iR <num> (random targets), --exclude/--excludefile (exclusions). HOST DISCOVERY: -sn (ping scan, no port scan), -Pn (skip ping, treat all online), -PS/PA/PU[ports] (TCP SYN/ACK/UDP ping), -PE/PP/PM (ICMP probes), -n (no DNS), -R (always resolve DNS). SCAN TYPES: -sS (SYN stealth, default root), -sT (TCP connect, default user), -sU (UDP), -sA (ACK scan for firewall rules), -sV (version detection), -O (OS detection), -A (aggressive: -sV -O -sC --traceroute). PORT SPECIFICATION: -p <ports> (e.g., -p22,80,443 or -p1-65535 or -p-), --top-ports <n>, -F (fast: top 100), -r (sequential, not random). TIMING: -T<0-5> (paranoid/sneaky/polite/normal/aggressive/insane), --min-rate/--max-rate (packets/sec). NSE: --script <category|name> (e.g., --script vuln or --script http-title), --script-args. OUTPUT: -oN (normal), -oX (XML), -oG (greppable), -oA <basename> (all formats), -v/-vv (verbosity), --reason (show port state reasons), --open (only open ports), --packet-trace (show packets). MISC: -6 (IPv6), --resume <file> (resume scan), --append-output, -d/-dd (debug).

## Example workflows

Basic host discovery: nmap -sn 10.0.0.0/24 (ping sweep, no port scan). Quick port scan: nmap 192.168.1.10 (scans top 1000 TCP ports). Full TCP port scan: nmap -p- 192.168.1.10 (all 65535 ports, slow). Service version detection: nmap -sV -p22,80,443 192.168.1.10 (identify SSH, HTTP versions). Aggressive scan: nmap -A -T4 192.168.1.10 (OS, version, scripts, traceroute, faster timing). Stealth SYN scan: sudo nmap -sS -p- 192.168.1.0/24 (requires root, less noisy than connect). UDP scan: sudo nmap -sU --top-ports 100 192.168.1.10 (slow, requires root). Vulnerability scan: nmap --script vuln 192.168.1.10 (NSE vuln checks). Firewall evasion: nmap -Pn -sS -f --data-length 200 -T2 192.168.1.10 (skip ping, fragment packets, append data, slow timing). Subnet enumeration: nmap -sn -n -iL targets.txt -oA discovery (ping scan from file, no DNS, all output formats). Resume aborted: nmap --resume scan.nmap. Multi-target with exclusions: nmap 10.0.0.0/8 --exclude 10.0.1.0/24 --excludefile important.txt -oG results.gnmap.

## Output format

Default interactive output to stdout: banner with Nmap version, scan report per host, 'interesting ports table' (PORT|STATE|SERVICE columns), additional info (MAC address, OS guess if -O used), scan statistics (time, hosts up, total IPs). Port states: open (application listening), closed (no service, reachable), filtered (firewall/IDS blocking, no response), unfiltered (accessible but open/closed undetermined), open|filtered or closed|filtered (ambiguous). With -sV: SERVICE column shows detected application and version. With -O: OS detection guess with accuracy percentage. With --reason: adds REASON column (syn-ack, reset, no-response, etc.). Output formats: -oN (human-readable, same as screen), -oX (XML for parsing, use with tools like searchsploit/metasploit), -oG (greppable, tab/slash/comma delimited, one host per line, easy for awk/grep), -oA (saves all three formats). XML preferred for programmatic analysis. Use -v for real-time progress updates during long scans. With NSE scripts: additional script output sections below port table. Resume capability: save with -oN or -oG, resume with --resume <file>.

## Common pitfalls

LEGAL: Never scan without explicit authorization; unauthorized scanning is illegal and detectable. Scans generate logs on target systems and IDS/IPS alerts. DETECTION: Default scans are noisy; aggressive options (-A, -T4/T5, -p-, --script all) generate massive traffic. SYN scans are 'stealthier' than connect scans but still logged by competent blue teams. Use slower timing (-T0/-T1) and fragmentation for evasion, but increases scan time dramatically. PERFORMANCE: Full port scans (-p-) on large networks take hours/days; prioritize likely ports or use --top-ports. UDP scans (-sU) are extremely slow due to protocol nature; limit port range. T5 timing can overwhelm targets or local network, causing false negatives. ACCURACY: -Pn (skip ping) required if ICMP blocked, but scans all IPs even if down (slower). OS detection (-O) requires open and closed ports; fails behind restrictive firewalls. Service version detection (-sV) adds scan time and may crash vulnerable services. Filtered ports don't confirm firewall presence; could be packet loss. PERMISSIONS: OS detection and SYN scans require root; forgotten sudo causes fallback to connect scans (noisier, different results). IPv6 requires -6 flag; IPv4-only by default. RESUME: Only works with -oN/-oG output; XML not supported for --resume. OUTPUT: Forgetting -oA loses scan data; always save output for later analysis and reporting. Not using -n (no DNS) adds delays and generates DNS queries that may alert defenders.

## References

• https://nmap.org/book/man.html
• https://nmap.org/docs.html
• https://nmap.org/book/toc.html
• https://nmap.org/book/man-briefoptions.html
• https://nmap.org/book/port-scanning-options.html
• https://nmap.org/book/output-formats-commandline-flags.html
