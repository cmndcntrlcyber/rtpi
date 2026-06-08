---
name: Wireshark (tshark)
description: Terminal-based network protocol analyzer for capturing, filtering,
  and dissecting packet data in CLI/scripted contexts.
registry: security
tool_id: wireshark-tshark
category: network_analysis
tags:
  - network-analysis
  - packet-capture
  - pcap
  - protocol-dissection
  - traffic-analysis
  - reconnaissance
  - forensics
mitre_techniques:
  - T1040
  - T1595.002
  - T1557
summary: "tshark is Wireshark's CLI engine. Use it to capture live traffic (-i
  interface -f 'bpf filter'), read existing PCAPs (-r file.pcap), apply display
  filters (-Y 'wireshark display filter'), and extract structured data. Common
  invocations: capture with 'tshark -i eth0 -w out.pcap -f \"host 10.0.0.5\"';
  read and filter with 'tshark -r in.pcap -Y \"http.request\"'; extract fields
  with 'tshark -r file.pcap -T fields -e ip.src -e ip.dst -E header=y'. Stop
  after N packets with '-c NUM'. For statistics without per-packet output use
  '-q -z statistic' (e.g., '-q -z io,phs' for protocol hierarchy). Display
  filters (-Y) require full packet dissection; capture filters (-f) use BPF
  syntax and are faster. Output formats: default one-line summary, '-V' for
  verbose details, '-T fields' for delimited output (combine with '-E
  separator=,' '-E quote=d'), '-T json' for structured data, '-x' for hex dump.
  Name resolution is on by default; disable with '-n'. Two-pass analysis ('-2')
  required for '-R' read filters. Raw packets written with '-w' are binary
  (pcap/pcapng); text output goes to stdout (redirect with '>'). Combine '-T
  fields' output with awk/sort/uniq for custom analytics. Always verify you have
  permission to capture on the target network."
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
generated_at: 2026-05-19T11:28:50.551Z
generated_by: anthropic
source_hash: 9e3dba2c30e8f17797cc64bfadd50bff36f6bc62c19f0078f2ca7e8b35a02a0e
---

# Wireshark (tshark)

## Overview

tshark is the command-line version of Wireshark, providing full protocol dissection and analysis capabilities in a scriptable, headless form. It captures live network traffic, reads saved capture files (pcap/pcapng), applies Berkeley Packet Filter (BPF) capture filters and Wireshark display filters, and outputs data in multiple formats including text summaries, verbose dissections, delimited fields, JSON, and hex dumps. Maintained by the Wireshark Foundation and distributed under GPL v2.

## When to use

Use tshark when you need to capture or analyze network traffic in non-GUI environments: during pentests to capture traffic on remote hosts, in incident response to extract specific fields from large PCAPs, for automated analysis pipelines that parse protocol details, to generate statistics from capture files, when troubleshooting network issues over SSH, or to convert between capture formats. It is the tool of choice for live packet capture during active reconnaissance (T1595.002), network sniffing (T1040), and man-in-the-middle positioning (T1557). Prefer tshark over tcpdump when you need deep protocol inspection beyond headers, or when working with application-layer protocols (HTTP, DNS, SMB, Kerberos, TLS). Do NOT use on networks without explicit authorization.

## Authentication & setup

No authentication required. Capturing live traffic typically requires root/administrator privileges or membership in the 'wireshark' group (Linux). On Linux, use 'sudo setcap cap_net_raw,cap_net_admin=eip /usr/bin/tshark' to allow non-root capture, or add user to wireshark group and configure dumpcap permissions. List available interfaces with 'tshark -D'. Verify capture permissions before engagement. Set buffer size with '-B <MiB>' (default 2MiB) for high-throughput captures. Monitor mode for wireless requires '-I' and compatible hardware. Check link-layer types with 'tshark -i <interface> -L'. No configuration files required for basic operation; preferences can be set via command-line or user profile directories.

## Key commands / parameters

**Capture**: '-i <interface>' (interface name or index), '-f <filter>' (BPF capture filter), '-w <outfile>' (write raw packets), '-c <count>' (stop after N packets), '-a duration:SEC' (autostop after seconds), '-b filesize:KB' (ring buffer by size), '-p' (disable promiscuous mode), '-s <snaplen>' (packet snapshot length), '-I' (monitor mode for wireless). **Read**: '-r <file>' (read from pcap/pcapng), '-Y <filter>' (Wireshark display filter), '-R <filter>' (read filter, requires '-2'), '-2' (two-pass analysis). **Output**: '-V' (verbose packet details), '-x' (hex+ASCII dump), '-T <format>' (fields|json|jsonraw|pdml|ps|psml|tabs|text), '-e <field>' (extract field, use with '-T fields'), '-E <option>' (field output options: header=y, separator=<char>, occurrence=f|l|a, aggregator=<char>, quote=d|s|n). **Filtering & Processing**: '-n' (disable all name resolution), '-N <flags>' (enable specific resolution: m=MAC, n=network, t=transport, d=DNS, s=async DNS), '-d <layer>==<proto>' (Decode As). **Statistics**: '-z <statistic>' (generate statistics), '-q' (quiet, suppress per-packet output, use with '-z'). Common '-z' options: 'io,phs' (protocol hierarchy), 'conv,tcp' (TCP conversations), 'endpoints,ip' (IP endpoints), 'http,tree' (HTTP statistics), 'follow,tcp,ascii,<stream#>' (follow TCP stream). **Misc**: '-D' (list interfaces), '-L' (list link-layer types), '-G <report>' (dump glossary).

## Example workflows

**Capture HTTP traffic from specific host**: 'tshark -i eth0 -f "host 192.168.1.50 and tcp port 80" -w http_capture.pcap'. **Read PCAP and filter DNS queries**: 'tshark -r traffic.pcap -Y "dns.flags.response == 0" -T fields -e frame.time -e ip.src -e dns.qry.name'. **Extract credentials from HTTP POST**: 'tshark -r capture.pcap -Y "http.request.method == POST" -T fields -e ip.src -e http.host -e http.request.uri -e http.file_data'. **Protocol hierarchy statistics**: 'tshark -r large.pcap -q -z io,phs'. **Follow TCP stream 5 in ASCII**: 'tshark -r session.pcap -q -z follow,tcp,ascii,5'. **Capture SMB traffic for 60 seconds**: 'tshark -i any -f "tcp port 445" -a duration:60 -w smb.pcap'. **Export HTTP objects list**: 'tshark -r web.pcap --export-objects http,./http_objects'. **Find failed DNS lookups**: 'tshark -r dns.pcap -Y "dns.flags.response == 1 and dns.flags.rcode != 0" -T fields -e dns.qry.name -e dns.flags.rcode'. **JSON output of TLS handshakes**: 'tshark -r tls.pcap -Y "tls.handshake" -T json > tls_handshakes.json'. **Live capture with immediate display**: 'tshark -i wlan0 -f "not arp" -Y "http or dns"'. **Combine with Unix tools**: 'tshark -r auth.pcap -Y kerberos -T fields -e kerberos.CNameString | sort | uniq -c | sort -rn'.

## Output format

Default output is one line per packet with frame number, timestamp (relative to first packet by default), source, destination, protocol, length, and info summary. Use '-t' to change timestamp format: 'a' (absolute), 'ad' (absolute with date), 'r' (relative, default), 'e' (epoch), 'd' (delta), 'dd' (delta displayed). Verbose mode ('-V') prints full protocol tree dissection. '-T fields' produces delimited output (tab-separated by default); control with '-E separator=<char>' (use '/s' for space, '/t' for tab, or literal character), '-E header=y' (print field names as first row), '-E occurrence=a' (all occurrences of multi-value fields), '-E aggregator=,' (separator for multiple values), '-E quote=d' (double-quote strings). '-T json' outputs packets as JSON array of objects with full dissection tree; use '--no-duplicate-keys' to merge duplicate keys into arrays. '-x' appends hex+ASCII dump after summary. All text output goes to stdout; use shell redirection '>'. Binary packet data ('-w') writes pcap or pcapng format; do NOT use '-w' for text. Errors and warnings go to stderr. Statistics ('-z') format varies by type; generally human-readable tables. Use '-q' with '-z' to suppress packet lines.

## Common pitfalls

**Permissions**: Live capture fails without sufficient privileges (root/CAP_NET_RAW). Test with '-D' first. **Filter syntax confusion**: Capture filters ('-f') use BPF/tcpdump syntax (e.g., 'host 10.0.0.1 and port 80'); display filters ('-Y') use Wireshark syntax (e.g., 'ip.addr == 10.0.0.1 && tcp.port == 80'). They are NOT interchangeable. **Output confusion**: '-w' writes binary data, not text. For text, redirect stdout. Mixing '-w' and text output flags produces unexpected results. **Name resolution overhead**: Default behavior resolves names, slowing analysis of large files; disable with '-n'. **Display filter performance**: '-Y' requires full dissection of every packet; use capture filters ('-f') when possible to reduce load. **Read filters require two-pass**: '-R' only works with '-2', which loads entire file into memory; use '-Y' for large files. **Field name errors**: Field names in '-e' are case-sensitive and must match Wireshark's internal names (e.g., 'http.request.uri' not 'http.uri'). Use 'tshark -G fields | grep <protocol>' to find valid field names. **Truncated packets**: Default snaplen may truncate large packets; increase with '-s 65535' or '-s 0' (unlimited). **Multiple occurrences**: By default '-T fields' only outputs first occurrence of repeated fields; use '-E occurrence=a' for all. **Interface name/index**: Interface names vary by OS; use 'tshark -D' to list. On Linux 'any' captures on all interfaces but strips Ethernet headers. **Legal risk**: Capturing traffic without authorization is illegal. Always obtain written permission. Capturing credentials or sensitive data creates custodial and legal obligations.

## References

• https://www.wireshark.org/docs/wsug_html_chunked/AppToolstshark.html
• https://tshark.dev/
• https://www.wireshark.org/docs/man-pages/tshark.html
• https://linux.die.net/man/1/tshark
• https://oneuptime.com/blog/post/2026-03-20-tshark-command-line-analysis/view
• https://www.wireshark.org/docs/wsug_html_chunked/ChCustCommandLine.html
• https://www.varonis.com/blog/how-to-use-wireshark
• https://www.wireshark.org/
