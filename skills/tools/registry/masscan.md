---
name: Masscan
description: Ultra-fast TCP SYN port scanner capable of scanning entire networks
  in minutes; transmits millions of packets/sec, asynchronous & stateless.
registry: registry
tool_id: masscan
category: network
tags:
  - port-scanner
  - network-recon
  - syn-scan
  - masscan
  - discovery
  - internet-scale
  - asynchronous
mitre_techniques:
  - T1046
summary: "Masscan is a high-speed TCP SYN port scanner designed for rapid
  reconnaissance of large IP ranges. It is stateless and asynchronous, capable
  of scanning the entire IPv4 space in under 6 minutes at maximum rate (10M
  packets/sec). Use it for initial network enumeration when speed is critical
  and you need to identify open ports across many hosts quickly. Default rate is
  100 packets/sec; increase with --rate for faster scans. Masscan requires
  elevated privileges and raw socket access. It randomizes target order by
  default. Output is minimal by default (only open ports); use --banners for
  service detection. Save results in XML (-oX), JSON (-oJ), grepable (-oG),
  binary (-oB), or list (-oL) formats. Binary format is smallest; use --readscan
  to convert later. Masscan is nmap-compatible in syntax but fundamentally
  different: it does not maintain state, sends retries blindly, and provides
  less detail per host. Pair with nmap for deeper enumeration of discovered
  hosts. On Linux without virtualization, expect ~1.6M packets/sec; Windows/VMs
  max around 300K packets/sec. PF_RING DNA driver enables >2M packets/sec on
  10Gbps NICs. Always specify interface with -e on multi-homed systems. Use
  --exclude or --excludefile to avoid scanning critical infrastructure. Set
  --max-rate to control bandwidth. Use --packet-trace at low rates for
  debugging. Masscan forces -sS -Pn -n --randomize-hosts --send-eth internally.
  Scan results appear in real-time with --interactive. Use --echo to dump
  configuration without scanning. Test installation with --regress. For
  repeatable scans, save config to file and load with -c. Masscan does not
  perform OS detection or version scanning natively; use --banners for basic
  service fingerprinting on HTTP, FTP, SMTP, etc."
sources:
  - https://hackviser.com/tactics/tools/masscan
  - http://chousensha.github.io/blog/2017/06/10/masscan-kali-linux-tools
  - https://www.kali.org/tools/masscan/
  - https://github.com/robertdavidgraham/masscan/blob/master/doc/masscan.8.markdown
  - https://www.techtarget.com/searchsecurity/tutorial/How-to-use-Masscan-for-high-speed-port-scanning
  - https://manpages.ubuntu.com/manpages/focal/man8/masscan.8.html
  - https://danielmiessler.com/blog/masscan
  - https://github.com/robertdavidgraham/masscan
  - https://delinea.com/what-is/penetration-testing
  - https://www.infosecinstitute.com/resources/penetration-testing/masscan-scan-internet-minutes/
  - https://medium.com/@abdulkhakim/scanning-tools-fe1bbe2a14b0
  - https://www.linkedin.com/posts/wesleyabryan_cybersec-infosec-offsec-activity-7407059713814740992-PeUH
generated_at: 2026-05-19T11:19:03.847Z
generated_by: anthropic
source_hash: 395fa14f1bbd8d1836b9bb8cc7ea4c9b9a1dafc19eaf44069fbf61c09e6db27d
---

# Masscan

## Overview

Masscan is a TCP SYN port scanner optimized for speed, capable of transmitting millions of packets per second. It scans asynchronously and statelessly, making it ideal for large-scale network reconnaissance. Unlike nmap, masscan sacrifices detailed per-host analysis for raw speed and can scan the entire Internet IPv4 space in minutes. It uses a custom TCP/IP stack, bypasses the kernel, and randomizes scan order to distribute load. Version 1.3.2 is stable and widely deployed in red team and research contexts.

## When to use

Use masscan when you need rapid port enumeration across large IP ranges (thousands to millions of hosts) during initial reconnaissance. Ideal for Internet-wide surveys, asset discovery on large enterprise networks, or quickly identifying exposed services before deeper analysis. Use it to generate target lists for follow-up scanning with nmap or other tools. Do NOT use masscan when you need OS detection, service versioning, or detailed scripting; use nmap instead. Do NOT use masscan on networks where high packet rates may trigger IDS/IPS or cause instability. Always obtain authorization before scanning external networks.

## Authentication & setup

Masscan requires root/administrator privileges to send raw packets. No authentication to target hosts is performed; this is a network-layer scanner. Verify installation with 'masscan --regress' (should output 'regression test: success!'). Identify available network interfaces with 'masscan --iflist'. On multi-homed systems, specify the interface with '-e eth0' (replace eth0 with actual interface name). Optionally set source IP with '--source-ip' and router MAC with '--router-mac' for custom routing. If using PF_RING DNA drivers for >2M packets/sec, ensure drivers are installed and use '--pfring' flag. For virtualized environments or Windows, expect lower performance (300K-1.6M packets/sec). Test performance offline with 'masscan 0.0.0.0/4 -p80 --rate 100000000 --offline' to benchmark without transmitting packets.

## Key commands / parameters

**Target specification:** Provide IP addresses, CIDR ranges, or ranges. Examples: '192.168.1.0/24', '10.0.0.1-10.0.0.254', '0.0.0.0/0' (entire Internet). Use '-iL file.txt' to read targets from file. **Port specification:** '-p80' (single port), '-p80,443,8080' (list), '-p1-1000' (range), '-p0-65535' (all ports), '--top-ports 100' (top N ports). UDP ports: '-pU:161,U:1024-1100'. **Rate control:** '--rate 10000' (packets per second; default 100). '--max-rate 100000' is an alias. Higher rates require tuning and may cause packet loss. **Exclusions:** '--exclude 192.168.1.100' (exclude single IP), '--excludefile exclude.txt' (exclude from file). **Interface/source:** '-e eth0' (specify interface), '--source-ip 192.168.1.50' (spoof source IP). **Banners:** '--banners' (grab service banners after TCP handshake; supports HTTP, FTP, SMTP, POP3, IMAP, SSH, etc.). **Output:** '-oX file.xml' (XML), '-oJ file.json' (JSON), '-oG file.txt' (grepable), '-oB file.bin' (binary), '-oL file.txt' (simple list). '--output-format' and '--output-filename' can be used explicitly. '--append-output' appends to existing file. **Retries:** '--retries 3' (send retries at 1-sec intervals; default 0). **Randomization:** '--randomize-hosts' (default; randomize target order). **Resume:** '--resume paused.conf' (resume interrupted scan). '--resume-index N' and '--resume-count M' for manual sharding. **Debugging:** '--packet-trace' (print sent/received packets; use at low rates). '--echo' (print config and exit). '--regress' (run self-test). **Nmap compatibility:** '--nmap' (list nmap-compatible options). Masscan accepts many nmap flags but ignores some (e.g., OS detection).

## Example workflows

**Scan single host, single port:** 'masscan 192.168.1.1 -p80' → discovers if port 80/tcp is open. **Scan subnet for web ports:** 'masscan 192.168.1.0/24 -p80,443,8080 --rate 10000' → fast scan of 256 IPs for common HTTP ports. **Scan large network, all ports:** 'masscan 10.0.0.0/8 -p0-65535 --rate 100000 -oX results.xml' → scan 16M IPs, all ports, save XML. **Internet-wide scan for single port:** 'masscan 0.0.0.0/0 -p443 --rate 10000000 --excludefile rfc1918.txt -oJ https_hosts.json' → scan entire IPv4 space for HTTPS, exclude private ranges. **Grab banners from discovered services:** 'masscan 192.168.1.0/24 -p22,80,443 --banners --rate 1000 -oX banners.xml' → identify service versions. **Generate target list for nmap:** 'masscan 10.0.0.0/16 -p80 --open -oL targets.txt' → create list of IPs with port 80 open, feed to nmap for deeper scan. **Resume interrupted scan:** 'masscan --resume paused.conf' (masscan auto-saves state on Ctrl+C). **Exclude specific IPs:** 'masscan 192.168.1.0/24 -p80 --exclude 192.168.1.1,192.168.1.254' → skip gateway and broadcast. **Scan with config file:** 'masscan -c scan.conf' where scan.conf contains 'rate=100000\nports=80,443\nrange=10.0.0.0/8'. **Offline benchmark:** 'masscan 0.0.0.0/4 -p80 --rate 100000000 --offline' → test max transmit rate without sending packets.

## Output format

Default output is text to stdout showing discovered open ports: 'Discovered open port 80/tcp on 192.168.1.10'. **XML (-oX):** nmap-compatible XML with <host>, <address>, <ports>, <port protocol="tcp" portid="80"><state state="open"/>. **JSON (-oJ):** array of objects with {"ip":"192.168.1.10","ports":[{"port":80,"proto":"tcp","status":"open"}]}. **Grepable (-oG):** nmap grepable format, one line per host: 'Host: 192.168.1.10 () Ports: 80/open/tcp//'. **Binary (-oB):** compact binary format, smallest file size; use '--readscan file.bin' to convert to other formats later. **List (-oL):** simple list, one IP:port per line: '192.168.1.10:80'. Use '--open' (default) to show only open ports or '--show closed' to include closed/filtered. '--interactive' displays real-time results on console (no effect if output file specified). '--pcap file.pcap' saves received packets in libpcap format for analysis.

## Common pitfalls

**Default rate is too slow:** masscan defaults to 100 packets/sec. Always set --rate explicitly for production scans (e.g., --rate 10000 or higher). **Scanning without exclusions:** scanning RFC1918 or critical infrastructure without --exclude can cause network disruption or legal issues. Always exclude sensitive ranges. **Ignoring interface selection:** on multi-homed hosts, masscan may pick wrong interface; use -e to specify. **Expecting stateful behavior:** masscan is stateless and does not track connections; retries are sent regardless of responses. Do not rely on it for connection state. **Assuming nmap feature parity:** masscan does not do OS detection, version detection (beyond --banners), or NSE scripts. Use nmap for detailed enumeration. **High rate without tuning:** rates >1M packets/sec may cause packet loss, local CPU saturation, or ISP rate-limiting. Test incrementally. **Scanning entire Internet without throttling:** 10M packets/sec will saturate most uplinks and may get you blacklisted by ISPs or abuse desks. **Not saving results:** masscan does not keep history; always use -oX, -oJ, or -oB to save output. **Running as non-root:** masscan requires raw socket access and will fail without root/admin privileges. **Ignoring --banners overhead:** banner grabbing is slower and stateful; reduces effective scan rate. Use only when service identification is needed. **Resuming without original config:** --resume requires the paused.conf file generated on interrupt; if deleted, scan must restart. **Misinterpreting closed/filtered:** by default masscan only shows 'open' ports; use --show closed to see RST responses, but filtered ports (no response) are not reported.

## References

- https://hackviser.com/tactics/tools/masscan
- http://chousensha.github.io/blog/2017/06/10/masscan-kali-linux-tools
- https://www.kali.org/tools/masscan/
- https://github.com/robertdavidgraham/masscan/blob/master/doc/masscan.8.markdown
- https://www.techtarget.com/searchsecurity/tutorial/How-to-use-Masscan-for-high-speed-port-scanning
- https://manpages.ubuntu.com/manpages/focal/man8/masscan.8.html
- https://danielmiessler.com/blog/masscan
- https://github.com/robertdavidgraham/masscan
- https://www.infosecinstitute.com/resources/penetration-testing/masscan-scan-internet-minutes/
