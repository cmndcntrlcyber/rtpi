---
name: Proxychains
description: Force any TCP connection through SOCKS4/5 or HTTP proxy chains for
  anonymity, pivoting, and evading network restrictions.
registry: registry
tool_id: proxychains
category: network
tags:
  - proxy
  - anonymity
  - pivoting
  - network
  - socks
  - tor
  - tcp
  - evasion
mitre_techniques:
  - T1090
  - T1090.001
  - T1090.002
  - T1090.003
summary: "Proxychains forces dynamically-linked applications to route TCP
  connections through one or more proxy servers. Use it to mask your source IP,
  pivot through compromised hosts, bypass firewall restrictions, or chain
  through Tor. Command syntax: `proxychains4 [options] <command>`. Key flags:
  `-q` (quiet mode, suppress connection logs), `-f <config>` (specify alternate
  config file). Default config: /etc/proxychains4.conf. Edit [ProxyList] section
  to define proxies (format: `<type> <host> <port>`, e.g., `socks5 127.0.0.1
  1080`). Chain types: dynamic_chain (skips dead proxies), strict_chain (uses
  all in order), random_chain (randomizes order). TCP-only; does NOT support UDP
  or ICMP. Nmap requires `-sT -Pn` flags (TCP connect scan, no ping). DNS
  resolution tunneled through proxy by default, hardcoded to 4.2.2.2 unless
  changed in /usr/lib/proxychains3/proxyresolv. Proxychains is verbose; use `-q`
  for clean output. Only works with dynamically-linked binaries. Environment
  variable PROXYCHAINS_SOCKS5_HOST and PROXYCHAINS_SOCKS5_PORT can specify proxy
  without config file. Slow by default; reduce tcp_read_time_out and
  tcp_connect_time_out in config for speed. Common pivoting workflow: establish
  SOCKS proxy via Meterpreter autoroute + socks_proxy module or SSH dynamic
  forwarding (-D), configure proxychains to use 127.0.0.1:<port>, prepend
  `proxychains4` to recon/exploitation tools."
sources:
  - https://www.youtube.com/watch?v=KWwOU1z5E8E
  - https://www.stationx.net/proxychains/
  - https://cybervie.com/how-to-use-proxychains/
  - https://redsiege.com/blog/2025/09/getting-started-with-proxy-chains/
  - https://www.geeksforgeeks.org/linux-unix/staying-anonymous-with-proxychains-in-kali-linux/
  - https://zweilosec.gitbook.io/hackers-rest/os-agnostic/pivoting/proxychains
  - https://askubuntu.com/questions/885073/use-proxychains-in-terminal
  - https://www.jamescarroll.me/blog/pivoting-with-meterpreter-and-proxychains
  - https://www.exploit-db.com/exploits/45554
  - https://github.com/haad/proxychains
  - https://dev.to/thmnagpur/cybersecurity-proxychains-a-mask-of-anonymity-45pn
  - https://vickieli.dev/hacking/proxychains/
generated_at: 2026-05-19T11:03:36.923Z
generated_by: anthropic
source_hash: 74e20422175766ecb33657ac4c7ee3282d174f7609b65d5fb105f7c204f9a0f2
---

# Proxychains

## Overview

Proxychains is a UNIX/Linux tool that intercepts networking calls in dynamically-linked programs and redirects TCP connections through SOCKS4, SOCKS5, or HTTP proxy servers. It works by preloading a shared library that hooks libc networking functions. This enables any proxy-unaware application to operate through single or chained proxies, providing anonymity, IP obfuscation, and network pivoting capabilities. The tool is particularly valuable in red team operations for hiding attacker infrastructure, evading detection, bypassing network segmentation, and conducting reconnaissance from compromised hosts. Proxychains supports mixing proxy types in a chain and integrates seamlessly with Tor. Version 4 (proxychains4) is the current maintained release.

## When to use

Use proxychains when you need to: (1) Hide your source IP address during reconnaissance or exploitation; (2) Pivot through compromised hosts to reach internal networks; (3) Bypass geo-restrictions or IP-based access controls; (4) Chain through multiple proxies or Tor for increased anonymity; (5) Run tools without native proxy support (nmap, nc, sqlmap, impacket scripts) through a proxy; (6) Access internal resources from external position via compromised perimeter host; (7) Evade IDS/IPS by originating traffic from different source; (8) Test from a specific egress point during authorized engagements. Do NOT use for UDP-based tools (standard nmap scans, DNS queries unless TCP), ICMP traffic, or statically-compiled binaries. Ideal for penetration testing, red teaming, OSINT collection, and lateral movement scenarios.

## Authentication & setup

Install: `apt-get install proxychains` (Kali/Debian) or `apt-get install proxychains4`. Main config file: /etc/proxychains4.conf (or /etc/proxychains.conf). Edit with root/sudo: `nano /etc/proxychains4.conf`. Key config sections: (1) Chain type - uncomment ONE: `dynamic_chain` (skips dead proxies, recommended), `strict_chain` (fails if any proxy down), `random_chain` (randomizes order), `round_robin_chain` (distributes load). (2) [ProxyList] section at bottom - add proxies in format: `<type> <ip> <port> [username] [password]`. Types: socks4, socks5, http, https. Example: `socks5 127.0.0.1 1080`. For Tor: `socks5 127.0.0.1 9050`. For pivoting: set up SOCKS proxy on compromised host (via Meterpreter `auxiliary/server/socks_proxy` + `autoroute`, SSH `-D` flag, or 3proxy), then add `socks5 127.0.0.1 <local_port>` to ProxyList. Optional: reduce `tcp_read_time_out` and `tcp_connect_time_out` (default 15000/8000ms) for faster scans. Config priority: PROXYCHAINS_SOCKS5 env var > PROXYCHAINS_CONF_FILE env var > `-f` flag > ./proxychains.conf > ~/.proxychains/proxychains.conf > /etc/proxychains.conf.

## Key commands / parameters

Basic syntax: `proxychains4 <command> [args]` or `/usr/bin/proxychains4 <command> [args]`. Key flags: `-q` (quiet mode - suppresses [proxychains] connection logging, essential for clean output), `-f <config_file>` (use alternate config file). Environment variables: `PROXYCHAINS_SOCKS5_HOST=<ip>` and `PROXYCHAINS_SOCKS5_PORT=<port>` (define single SOCKS5 proxy without config file), `PROXYCHAINS_CONF_FILE=<path>` (specify config), `PROXY_DNS_SERVER=<ip>` (override DNS server for name resolution). Common usage patterns: `proxychains4 -q nmap -sT -Pn <target>` (quiet nmap TCP scan), `proxychains4 curl ipinfo.io` (check egress IP), `proxychains4 firefox` (browser through proxy), `proxychains4 ssh user@host` (SSH connection), `proxychains4 python3 script.py` (Python scripts), `proxychains4 nc -zv <ip> <port>` (port check). For shells: `proxychains4 xfce4-terminal` or `proxychains4 bash` spawns proxied shell session. DNS resolution tool: `proxyresolv <hostname>` (resolves through proxy chain). Note: Must use TCP-based operations only.

## Example workflows

**Tor anonymization**: Edit /etc/proxychains4.conf, uncomment `dynamic_chain`, add `socks5 127.0.0.1 9050` to [ProxyList]. Start Tor: `systemctl start tor`. Test: `proxychains4 -q curl ipinfo.io`. Run tools: `proxychains4 -q nmap -sT -Pn -p 80,443 target.com`. **SSH pivot**: On attacker box: `ssh -fN -D 1080 user@jumphost.com` (establish SOCKS proxy). Edit config: `socks5 127.0.0.1 1080`. Access internal: `proxychains4 -q psql -h 10.10.20.50 -U postgres`. **Meterpreter pivot**: In meterpreter: `run autoroute -s 10.10.20.0/24`, background session, `use auxiliary/server/socks_proxy`, `set SRVPORT 1080`, `run -j`. Edit config: `socks5 127.0.0.1 1080`. Enumerate: `proxychains4 -q crackmapexec smb 10.10.20.0/24`. **Multi-proxy chain**: Add multiple lines to [ProxyList]: `socks5 proxy1.com 1080`, `http proxy2.com 8080`, `socks4 proxy3.com 1080`. Traffic routes through all in sequence. **Port scanning internal network**: `proxychains4 -q nmap -sT -Pn --open -p 22,80,443,445,3389 10.10.20.0/24` or faster: `for port in 22 80 443 445; do proxychains4 -q nc -zv 10.10.20.50 $port; done`. **Impacket usage**: `proxychains4 -q psexec.py domain/user:pass@10.10.20.50`.

## Output format

Proxychains prepends `[proxychains]` tag to each line of its own output. Default (verbose) shows: connection attempts, proxy chain path, successful connections (`|S-chain|-<...>-<...>-<...>-|S-chain|-<OK>`), failed connections, DNS resolution attempts. Format: `[proxychains] Strict chain ... 127.0.0.1:1080 ... 10.10.20.50:445 ... OK`. Use `-q` flag to suppress all proxychains logging and show only target application output. Application output passes through unchanged. To verify proxy working: `proxychains4 curl ipinfo.io` returns external IP of exit proxy, not your real IP. DNS queries show as: `[proxychains] DLL init: proxychains-ng`, `[proxychains] config file found: /etc/proxychains4.conf`, `[proxychains] Strict chain ... 127.0.0.1:1080 ... 4.2.2.2:53 ... OK` (DNS hardcoded to 4.2.2.2 unless modified). Connection failures show `<--denied` or timeout. For scripting/automation, always use `-q` and parse underlying tool output normally. No structured output format; purely pass-through with optional logging prefix.

## Common pitfalls

**UDP/ICMP not supported**: Proxychains only handles TCP. Standard nmap scans (SYN `-sS`, UDP `-sU`) will fail silently or leak traffic. Always use `-sT` (TCP connect) with nmap. Ping (`-Pn`) must be disabled. **DNS leaks**: By default, DNS resolved via proxy but hardcoded to 4.2.2.2. Change nameserver in `/usr/lib/proxychains3/proxyresolv` to internal DNS (e.g., domain controller IP) for internal name resolution. Or use `proxy_dns` option in config. **Statically-linked binaries fail**: Proxychains requires dynamic linking to hook libc. Statically-compiled Go binaries, some custom tools won't work. Check with `ldd <binary>`. **Verbose output pollution**: Default logging clutters output. Always use `-q` for production use, especially with verbose tools (nmap, crackmapexec). **Speed issues**: Proxy adds latency. Reduce timeouts in config (`tcp_read_time_out`, `tcp_connect_time_out`) and limit port ranges for scans. Parallel execution with xargs can help: `echo "22 80 443" | xargs -P 3 -I{} proxychains4 -q nc -zv target {}`. **Sudo context**: `proxychains4 sudo command` breaks chain; use `sudo proxychains4 command` instead. Environment doesn't inherit through sudo. **Chain misconfiguration**: Strict chain fails if ANY proxy down. Use dynamic_chain for reliability. **Application compatibility**: Some apps detect/block proxy usage or require specific proxy config (browsers). Test with curl first. **No authentication feedback**: Wrong proxy credentials fail silently. Verify proxy accessible independently before chaining.

## References

• https://github.com/haad/proxychains
• https://www.stationx.net/proxychains/
• https://redsiege.com/blog/2025/09/getting-started-with-proxy-chains/
• https://www.geeksforgeeks.org/linux-unix/staying-anonymous-with-proxychains-in-kali-linux/
• https://zweilosec.gitbook.io/hackers-rest/os-agnostic/pivoting/proxychains
• https://www.jamescarroll.me/blog/pivoting-with-meterpreter-and-proxychains
• https://vickieli.dev/hacking/proxychains/
• https://www.exploit-db.com/exploits/45554
• https://cybervie.com/how-to-use-proxychains/
