---
name: Nmap
description: Network exploration tool and security/port scanner for host
  discovery, port enumeration, service detection, and OS fingerprinting.
registry: security
tool_id: nmap
category: reconnaissance
tags:
  - reconnaissance
  - network-scanning
  - port-scanning
  - host-discovery
  - service-enumeration
  - vulnerability-assessment
  - osint
mitre_techniques:
  - T1046
  - T1595.002
  - T1590.005
summary: "Nmap (Network Mapper) is your primary tool for network reconnaissance
  and port scanning during red team engagements. Use it to discover live hosts,
  enumerate open ports, identify running services and versions, detect operating
  systems, and map network topology. Invoke with target specification (IP,
  hostname, CIDR range) followed by scan type and options. Default behavior
  scans top 1000 ports with randomized order; requires root/admin for SYN scans
  (-sS), falls back to TCP connect scans (-sT) otherwise. Key scan types: -sS
  (stealth SYN), -sT (TCP connect), -sU (UDP), -sV (version detection), -O (OS
  detection), -A (aggressive: OS, version, scripts, traceroute). Host discovery:
  -sn (ping scan only), -Pn (skip ping, assume hosts up). Port specification:
  -p- (all ports), -p22,80,443 (specific), --top-ports N. Timing templates: -T0
  to -T5 (use -T2 or lower for stealth). Output formats: -oN (normal), -oX
  (XML), -oG (greppable), -oA (all formats). Always get authorization before
  scanning; unauthorized scanning is illegal. Nmap generates noise detectable by
  IDS/IPS—adjust timing and use evasion techniques (-f fragmentation,
  --data-length, --source-port) when operational security matters. Expect port
  states: open, closed, filtered, unfiltered. Combine with NSE scripts
  (--script) for deeper enumeration. Parse XML output programmatically for
  automation. Resume interrupted scans with --resume. Increase verbosity with
  -v/-vv for real-time feedback."
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
generated_at: 2026-05-19T11:27:24.079Z
generated_by: anthropic
source_hash: 1578b52c6aeeb5c4186a97da4070569c005f861ebbae33a776cf86404c5a9d3b
---

# Nmap

## Overview

Nmap 7.80 is an open-source network exploration and security auditing tool that uses raw IP packets to determine available hosts, running services with versions, operating systems, firewall types, and network characteristics. It scans single hosts or entire networks rapidly. Core functionality includes host discovery (ping scanning), port scanning (TCP/UDP), service/version detection, OS fingerprinting, and scriptable interaction via NSE (Nmap Scripting Engine). Nmap is the de-facto standard for reconnaissance in penetration testing and red teaming, used by security professionals for network inventory, vulnerability assessment, and attack surface mapping. It operates from command line with extensive flag-based configuration.

## When to use

Deploy Nmap during initial reconnaissance to map target infrastructure and identify attack surface. Use for host discovery when you need to identify live systems on a network segment. Invoke for port enumeration to find open services on target hosts. Apply version detection (-sV) to identify exact service versions for vulnerability correlation. Use OS detection (-O) to fingerprint target systems for exploit selection. Employ during network mapping to understand topology and trust relationships. Scan before exploitation to confirm service availability. Use ping scans (-sn) for rapid host enumeration on large networks. Deploy targeted port scans when you have specific service intelligence requirements. Combine with vulnerability scanners after initial enumeration. Use throughout engagement to verify persistence mechanisms and discover new lateral movement targets. Avoid on highly monitored networks without evasion techniques; consider alternative OSINT methods when operational security is critical.

## Authentication & setup

No authentication required—Nmap is a client-side scanning tool. Install via package manager or from nmap.org. Requires root/administrator privileges for advanced scan types (SYN scan, OS detection, raw packet manipulation). Without elevated privileges, Nmap defaults to TCP connect() scans (-sT) which are louder and slower. Verify privilege level before engagement: root users get -sS by default, unprivileged users get -sT. Use --privileged flag to assert full privileges or --unprivileged to force unprivileged mode. No configuration files required for basic operation. Custom data files (nmap-services, nmap-os-db, nmap-service-probes) can be specified with --datadir for specialized scanning. Ensure firewall rules on scanning host allow outbound traffic. For IPv6 targets, use -6 flag. No credential storage or API keys needed. Tool is fully self-contained and portable.

## Key commands / parameters

TARGET SPECIFICATION: Provide IPs (192.168.1.1), ranges (10.0.0-255.1-254), CIDR (192.168.1.0/24), hostnames (target.com), or -iL <file> for input list. Use --exclude or --excludefile to avoid scanning specific hosts.

HOST DISCOVERY: -sn (ping scan, no port scan), -Pn (skip ping, treat all as online), -PS/PA/PU[ports] (TCP SYN/ACK/UDP discovery), -PE/PP/PM (ICMP probes), -n (no DNS), -R (always resolve DNS).

SCAN TYPES: -sS (SYN stealth, default for root), -sT (TCP connect, default unprivileged), -sU (UDP scan), -sA (ACK scan for firewall rules), -sV (version detection), -O (OS detection), -A (aggressive: -O -sV --script=default --traceroute).

PORT SPECIFICATION: -p <ports> (e.g., -p22,80,443 or -p1-65535), -p- (all 65535 ports), --top-ports <n>, -F (fast, top 100 ports), -r (sequential vs. random).

TIMING/PERFORMANCE: -T<0-5> (paranoid|sneaky|polite|normal|aggressive|insane; default T3), --min-rate/--max-rate <packets/sec>, --host-timeout, --scan-delay.

OUTPUT: -oN <file> (normal), -oX <file> (XML), -oG <file> (greppable), -oA <basename> (all formats), -v/-vv (verbosity), --open (show only open ports), --reason (why port in state), --packet-trace (show packets).

EVASION: -f (fragment packets), --mtu <val>, -D <decoy1,decoy2> (decoys), --source-port <port>, --data-length <num>, --spoof-mac <mac>.

SCRIPTING: --script=<script-name|category>, --script-args=<args>.

MISC: -6 (IPv6), --resume <file> (resume scan), --iflist (show interfaces).

## Example workflows

BASIC HOST DISCOVERY: nmap -sn 192.168.1.0/24 (ping sweep, no ports)

STANDARD PORT SCAN: nmap 10.10.10.50 (default: top 1000 ports, SYN if root)

COMPREHENSIVE SINGLE TARGET: nmap -A -p- -T4 -oA full_scan 192.168.1.10 (all ports, OS, version, scripts, save all formats)

STEALTH SCAN: nmap -sS -T2 -f --source-port 53 -oN stealth.txt target.com (slow SYN, fragmented, DNS source port)

SERVICE ENUMERATION: nmap -sV -p 22,80,443,8080 --script=banner,http-title -oX services.xml targets.txt (version detection + scripts from file)

UDP SCAN: nmap -sU --top-ports 20 -T4 192.168.1.0/24 (top 20 UDP ports, faster timing)

QUICK VULNERABILITY CHECK: nmap -sV --script=vulners -p- target.com (version detection + vulnerability scripts on all ports)

FIREWALL MAPPING: nmap -sA -p 1-1000 firewall.target.com (ACK scan to map firewall rules)

LARGE NETWORK SWEEP: nmap -sS -p 22,80,443 --open -oG live_web.gnmap 10.0.0.0/8 (syn scan specific ports, only show open, greppable output)

RESUME ABORTED: nmap --resume previous_scan.nmap (continue interrupted scan)

## Output format

Nmap outputs to stdout (interactive) by default, displaying an 'interesting ports table' with columns: PORT (number/protocol), STATE, SERVICE (name). Port states: open (application listening), closed (accessible but no application), filtered (packet filtering prevents determination), unfiltered (accessible but state unknown), open|filtered (cannot determine), closed|filtered (cannot determine). Summary includes scan timing, total hosts scanned, and hosts up/down counts.

NORMAL OUTPUT (-oN): Human-readable text format with headers, port tables, and summary. Good for manual review.

XML OUTPUT (-oX): Structured XML for programmatic parsing. Contains complete scan metadata, host details, port states, service versions, OS matches, scripts output. Parse with tools like xmllint, python xml.etree, or Nmap's own parsers. Preferred for automation and integration.

GREPPABLE OUTPUT (-oG): One line per host with tab/slash/comma delimiters. Fields: Host, Ports, OS. Easy to process with grep, awk, cut. Format: Host: <ip> (<hostname>) Ports: <port>/<state>/<protocol>/<owner>/<service>/<rpc-info>/<version-info>/

Use -oA to generate all three formats simultaneously. Add -v or -vv for real-time progress updates during scan. Use --reason to see why each port is in its state (syn-ack, reset, no-response, etc.). --open filters output to show only open (and possibly open) ports. --packet-trace shows all sent/received packets for debugging.

## Common pitfalls

LEGAL RISK: Never scan networks without explicit written authorization. Unauthorized scanning is illegal in most jurisdictions and detectable. Always confirm scope boundaries.

NOISE GENERATION: Default scans are loud and easily detected by IDS/IPS. Use -T2 or lower for stealth, combine with -f (fragmentation), adjust timing parameters. Aggressive scans (-T4/-T5, -A) generate significant traffic.

INCOMPLETE RESULTS: Default scans only check 1,000 common ports. Critical services may run on non-standard ports. Use -p- for comprehensive coverage but expect longer scan times.

UDP SCANNING SLOWNESS: UDP scans (-sU) are inherently slow due to lack of handshake and rate limiting. Combine with --top-ports or specific port lists. Budget extra time.

FALSE NEGATIVES: Firewalls may silently drop packets, making ports appear filtered when they're actually open behind additional layers. Filtered results require investigation with alternative techniques.

PRIVILEGE ISSUES: Running without root/admin forces TCP connect scans (-sT) which complete three-way handshakes, generating more logs and being slower than SYN scans. Verify privilege level.

TIMEOUT PROBLEMS: Default timeouts may be too aggressive for slow networks or too slow for fast networks. Adjust --host-timeout, --min-rtt-timeout based on target environment.

RESUME LIMITATIONS: --resume only works with -oN or -oG formats. Always use -oA for important scans to enable resume capability.

OVERRELIANCE ON SERVICE DETECTION: -sV generates additional probes that can trigger alerts and takes longer. Use only when version information is operationally necessary.

SCRIPT DANGERS: NSE scripts can crash services or trigger alerts. Test scripts in lab before using against production targets. Some scripts are intrusive by design.

## References

• https://nmap.org/book/man.html
• https://nmap.org/docs.html
• https://nmap.org/book/man-briefoptions.html
• https://nmap.org/book/port-scanning-options.html
• https://nmap.org/book/output-formats-commandline-flags.html
• https://highon.coffee/blog/nmap-cheat-sheet/
• https://netlas.io/blog/nmap_commands/
• https://www.recordedfuture.com/threat-intelligence-101/tools-and-techniques/nmap-commands
