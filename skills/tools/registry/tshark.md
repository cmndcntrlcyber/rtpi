---
name: Wireshark (tshark)
description: Terminal network protocol analyzer for packet capture, dissection,
  and statistical analysis in penetration testing and incident response.
registry: registry
tool_id: tshark
category: network
tags:
  - packet-capture
  - network-analysis
  - pcap
  - traffic-inspection
  - protocol-dissection
  - wireshark
  - forensics
mitre_techniques:
  - T1040
  - T1046
  - T1590.001
  - T1595.002
summary: "TShark is the CLI version of Wireshark providing full protocol
  dissection on live traffic or PCAP files. Use when you need to capture packets
  (-i interface -f \"capture filter\"), analyze existing captures (-r
  file.pcap), or extract structured data from traffic. Apply display filters
  with -Y 'filter_expression' to match on dissected protocol fields (e.g.,
  dns.qry.name, http.request.uri). Extract specific fields using -T fields -e
  field.name for scripting. Generate statistics with -q -z statistic_type. Live
  capture requires root/CAP_NET_RAW. Write output with -w file.pcap for binary
  or redirect stdout for text. Combine with Unix tools (awk, grep, sort) for
  custom analytics. Default output is one-line summary per packet; use -V for
  full dissection, -x for hex dump, -T for structured formats (json, jsonraw,
  ek, fields, pdml, psml). Stop conditions: -c packet_count, -a
  duration:seconds. Filter syntax: capture filters use BPF (host, port, net);
  display filters use Wireshark syntax (tcp.port==80, ip.src==192.168.1.1).
  Statistics: -z io,phs for protocol hierarchy, -z conv,tcp for conversations,
  -z endpoints,ip for endpoint stats. Expect verbose output; use -q to suppress
  packet details when running statistics. Does not exploit vulnerabilities—only
  observes traffic."
sources:
  - https://www.wireshark.org/docs/wsug_html_chunked/AppToolstshark.html
  - https://tshark.dev/
  - https://www.wireshark.org/docs/wsug_html_chunked/
  - https://linux.die.net/man/1/tshark
  - https://oneuptime.com/blog/post/2026-03-20-tshark-command-line-analysis/view
  - https://www.wireshark.org/docs/wsug_html_chunked/ChCustCommandLine.html
  - https://www.wireshark.org/docs/man-pages/tshark.html
  - https://www.esecurityplanet.com/products/wireshark/
  - https://computerscience.unicam.it/marcantoni/reti/laboratorio_wireshark/Wireshark%20for%20Security%20Professionals%20-%20Using%20Wireshark%20and%20the%20Metasploit%20Framework.pdf
  - https://www.hackerone.com/knowledge-center/7-pentesting-tools-you-must-know-about
  - https://www.varonis.com/blog/how-to-use-wireshark
  - https://www.wireshark.org/
generated_at: 2026-05-19T11:14:53.273Z
generated_by: anthropic
source_hash: 98dc924077d9a7ff745c89e89e8c47a24f29d015021fd1ec3b7aad8ad98fb89a
---

# Wireshark (tshark)

## Overview

TShark is the terminal-based version of Wireshark, providing network protocol analysis from the command line. It captures live network traffic or reads saved PCAP/PCAPNG files, dissecting hundreds of protocols and exporting structured data. Unlike GUI Wireshark, tshark enables scripting, remote analysis, and pipeline integration. Supported on Linux, Windows, macOS, and UNIX. Ideal for penetration testing reconnaissance, incident response traffic analysis, and automated network monitoring. Requires elevated privileges for live capture. Does not perform active exploitation—strictly passive observation and analysis.

## When to use

Use tshark during network reconnaissance to identify active hosts, services, and protocols (T1046 Network Service Discovery, T1040 Network Sniffing). Capture authentication traffic to identify cleartext credentials or weak encryption. Analyze PCAP artifacts during post-exploitation or incident response. Extract IOCs (domains, IPs, user-agents) from captured traffic for threat hunting. Validate firewall rules by observing allowed/blocked traffic. Decode custom or proprietary protocols using Lua dissectors. Generate protocol statistics to understand baseline network behavior. Use instead of tcpdump when you need protocol dissection beyond packet headers. Use instead of GUI Wireshark when working on headless systems, in scripts, or processing large captures. Do NOT use for active scanning or packet injection—tshark is read-only.

## Authentication & setup

Live packet capture requires root privileges or CAP_NET_RAW capability on Linux. Run as root or configure capabilities: sudo setcap cap_net_raw+eip /usr/bin/tshark. No authentication required—tshark operates on local network interfaces and files. List interfaces with tshark -D to identify capture targets. Verify permissions by attempting capture on loopback: tshark -i lo -c 10. On remote systems via SSH, capture and stream back: ssh user@target 'tshark -i eth0 -w -' | wireshark -k -i -. Reading PCAP files requires only read permissions on the file. No network service or daemon—tshark runs as a single command-line process. Install via package manager: apt-get install tshark (Debian/Ubuntu), yum install wireshark (RHEL/CentOS), or brew install wireshark (macOS). Version discrepancies may affect filter syntax; check version with tshark -v.

## Key commands / parameters

Capture: tshark -i <interface> [-f "capture_filter"] [-c count] [-a duration:seconds] -w output.pcap. Capture filter uses BPF syntax: -f "host 192.168.1.1 and port 80". Read file: tshark -r input.pcap. Display filter: -Y 'display_filter' (e.g., -Y 'http.request.method==POST'). Field extraction: -T fields -e field.name [-e another.field] -E header=y -E separator=, -E quote=d. Output formats: -T [text|fields|json|jsonraw|ek|pdml|psml]. Statistics: -q -z <statistic> where statistic includes io,phs (protocol hierarchy), conv,tcp (TCP conversations), endpoints,ip, expert (expert info), http,tree. Full packet details: -V. Hex dump: -x. Name resolution: -n disables all, -N mt enables MAC/transport. Two-pass analysis for read filters: -2 -R 'read_filter'. Decoding: -d tcp.port==8888,http forces protocol on port. Stop conditions: -c <count> (packet count), -a duration:<seconds>, -a filesize:<KB>. Ring buffer: -b filesize:<KB> -b files:<count>. List protocols: tshark -G protocols. Quiet mode: -q (suppress packet output, show only stats).

## Example workflows

Capture HTTP traffic to file: tshark -i eth0 -f 'tcp port 80' -w http_capture.pcap. Extract HTTP URLs: tshark -r capture.pcap -Y 'http.request' -T fields -e http.host -e http.request.uri. Find failed DNS queries: tshark -r traffic.pcap -Y 'dns.flags.response==1 and dns.flags.rcode!=0' -T fields -e dns.qry.name -e dns.flags.rcode. Protocol hierarchy statistics: tshark -r capture.pcap -q -z io,phs. Identify top talkers: tshark -r capture.pcap -q -z endpoints,ip. Extract SMB file transfers: tshark -r capture.pcap --export-objects smb,./smb_files. Live monitoring with display filter: tshark -i eth0 -Y 'tcp.flags.syn==1 and tcp.flags.ack==0'. Capture credentials: tshark -i wlan0 -Y 'ftp or telnet or http.authbasic' -T fields -e ip.src -e text. JSON export for SIEM: tshark -r capture.pcap -T ek > output.json. Combine with grep: tshark -r capture.pcap -Y http.request -V | grep -i authorization. Capture only from specific MAC: tshark -i eth0 -f 'ether host 00:0c:29:57:b3:ff' -w target.pcap. Continuous capture with rotation: tshark -i eth0 -b filesize:100000 -b files:10 -w rolling.pcap.

## Output format

Default output: one-line summary per packet with frame number, timestamp, source, destination, protocol, and info. Use -t [r|a|ad|d|e] to control timestamp format (relative, absolute, etc.). Field extraction (-T fields) produces delimited text; configure with -E separator=/t|,|<char>, -E quote=d|s|n, -E header=y. JSON output (-T json) creates array of packet objects with nested protocol layers; use -T jsonraw for raw field values. PDML (-T pdml) produces XML for programmatic parsing. Statistics (-q -z) output plain text tables or trees. Verbose mode (-V) prints full protocol dissection tree. Hex dump (-x) shows offset, hex bytes, and ASCII representation. Expert info (-z expert) categorizes warnings/errors. Redirect stdout for text or use -w for binary PCAP. No color by default; use --color for ANSI color codes (requires 24-bit terminal). Fields use dotted notation: ip.src, tcp.port, http.user_agent. List available fields: tshark -G fields. Multi-occurrence fields repeat or aggregate based on -E occurrence=f|l|a and -E aggregator=,|<char>.

## Common pitfalls

Forgetting root/sudo for live capture results in permission errors or empty interface list. Confusing capture filters (BPF, -f) with display filters (Wireshark syntax, -Y); capture filters are applied during capture and cannot reference dissected fields, display filters work post-capture on any field. Using -w with -T: -w writes binary PCAP regardless of -T; redirect stdout for text output. Large captures without stop conditions (-c or -a) fill disk or crash system. Display filters on live capture (-Y) may drop packets under high load; capture all then filter offline. Not using -q with statistics causes packet output to print before stats. Typos in field names fail silently; verify with tshark -G fields | grep <field>. Name resolution (-N) adds latency and may leak DNS queries; disable with -n during stealth operations. Capture filters too broad create massive files; narrow with host/port/protocol. Not testing filters before long captures wastes time. Expert info requires full dissection (-2 for read files). Exporting objects (--export-objects) only works for supported protocols (http, smb, tftp, etc.). Using -R without -2 causes error: read filters require two-pass analysis. Checksum validation warnings on local captures are often false positives due to offloading; disable with -o tcp.check_checksums:false.

## References

• https://www.wireshark.org/docs/wsug_html_chunked/AppToolstshark.html
• https://tshark.dev/
• https://www.wireshark.org/docs/man-pages/tshark.html
• https://linux.die.net/man/1/tshark
• https://oneuptime.com/blog/post/2026-03-20-tshark-command-line-analysis/view
• https://www.wireshark.org/docs/wsug_html_chunked/ChCustCommandLine.html
• https://www.varonis.com/blog/how-to-use-wireshark
• https://www.wireshark.org/
