---
name: Proxychains
description: Force TCP connections through SOCKS/HTTP proxy chains for
  anonymity, pivoting, and firewall evasion during red team operations.
registry: security
tool_id: proxychains
category: network_analysis
tags:
  - proxy
  - pivoting
  - anonymity
  - tcp
  - socks
  - network-evasion
  - post-exploitation
mitre_techniques:
  - T1090
  - T1090.001
  - T1090.002
summary: "Proxychains (command: proxychains4) wraps TCP-based tools to route
  connections through one or more proxy servers. It does NOT support UDP or
  ICMP—TCP only. Invoke as 'proxychains4 <command>' or 'proxychains4 -q
  <command>' (quiet mode). Config file is /etc/proxychains4.conf; set proxy type
  (socks4/socks5/http), IP, and port in [ProxyList] section. Choose chain type:
  dynamic_chain (skips dead proxies), strict_chain (uses all in order), or
  random_chain (randomizes order). Default DNS is hardcoded to 4.2.2.2; change
  in /usr/lib/proxychains3/proxyresolv for internal name resolution. Use -f flag
  to specify alternate config. For nmap, use -sT (TCP connect) only; SYN scans
  require raw sockets and fail. Proxychains is extremely verbose by default—use
  -q flag for clean output. Common pivoting workflow: establish SOCKS proxy via
  SSH tunnel or C2 beacon (e.g., metasploit autoroute + socks_proxy), add
  'socks5 127.0.0.1 1080' to config, then prefix tools like nmap, crackmapexec,
  impacket scripts, curl, or browsers. Scanning through proxychains is
  inherently slow—reduce timeouts (tcp_read_time_out, tcp_connect_time_out in
  config), limit port ranges, and use parallel execution where possible. Does
  not proxy sudo commands unless sudo wraps the entire proxychains invocation.
  Verify proxy functionality by checking external IP with 'proxychains4 curl
  ipinfo.io' before operational use."
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
  - https://app.cyberyozh.com/guides/proxy-setup/Proxyclients/proxies-in-proxychains-linux/
  - https://thecyberfort.net/proxychains-a-guide-to-anonymity/
  - https://www.usenix.org/event/atc10/tech/full_papers/Dacosta.pdf
generated_at: 2026-05-19T11:28:57.460Z
generated_by: anthropic
source_hash: ad588265d381b01897a412844588e989fad441e3fe68ee1bdc92051c8710e51f
---

# Proxychains

## Overview

Proxychains intercepts libc network calls (gethostname, connect) and redirects TCP traffic through a configurable chain of proxy servers (SOCKS4, SOCKS5, HTTP/HTTPS). It operates as a command-line wrapper—prefix any TCP-aware application with 'proxychains4' to force connections through your proxy infrastructure. Primary uses: anonymizing reconnaissance traffic, pivoting through compromised hosts, bypassing egress filtering, and obfuscating attack origin. Does NOT support UDP or ICMP protocols. Compatible with most Linux tools including nmap (TCP scans only), curl, nc, impacket scripts, database clients, and browsers.

## When to use

Use proxychains when you need to: (1) Route reconnaissance or exploitation tools through a compromised pivot host to reach isolated network segments. (2) Anonymize attack traffic origin by chaining through multiple proxies including Tor. (3) Evade network egress controls or IDS/IPS by tunneling through allowed proxy protocols. (4) Test internal resources via external SOCKS tunnels (SSH -D, Metasploit socks_proxy, Cobalt Strike SOCKS). (5) Force non-proxy-aware tools through existing proxy infrastructure. Do NOT use for: UDP-based scans (DNS zone transfers, SNMP enumeration), ICMP (ping sweeps), or raw socket operations (nmap SYN scans). For tools with native proxy support (curl --proxy, browsers), direct proxy configuration is faster.

## Authentication & setup

Install: 'apt-get install proxychains4' (Kali/Debian) or 'apt install proxychains-ng'. Config file locations checked in order: (1) PROXYCHAINS_SOCKS5 env var, (2) PROXYCHAINS_CONF_FILE env var, (3) -f argument path, (4) ./proxychains.conf, (5) ~/.proxychains/proxychains.conf, (6) /etc/proxychains4.conf. Edit config: 'nano /etc/proxychains4.conf'. Select chain mode (uncomment one): dynamic_chain (recommended—skips dead proxies), strict_chain (fails if any proxy down), random_chain (randomizes order for anonymity), round_robin_chain (load balancing). Configure [ProxyList] at end of file—format: '<type> <host> <port>' e.g., 'socks5 127.0.0.1 1080'. Supports mixing proxy types. For internal DNS resolution, edit /usr/lib/proxychains3/proxyresolv and change DNS_SERVER variable from 4.2.2.2 to internal DNS (often domain controller IP). Test with: 'proxychains4 curl ipinfo.io'—verify returned IP matches proxy endpoint.

## Key commands / parameters

Basic syntax: 'proxychains4 [options] <command> [args]'. Key options: '-f <config_file>' (use alternate config), '-q' (quiet mode—suppresses [proxychains] output lines, essential for clean tool output and screenshots). Config file directives: 'dynamic_chain' / 'strict_chain' / 'random_chain' (chain behavior), 'proxy_dns' (tunnel DNS through proxy—enabled by default), 'tcp_read_time_out <ms>' and 'tcp_connect_time_out <ms>' (reduce from defaults 15000/8000 for faster scanning), 'localnet 127.0.0.0/255.0.0.0' (exclude localhost from proxying). ProxyList syntax: 'socks4 <ip> <port>', 'socks5 <ip> <port> [username] [password]', 'http <ip> <port> [username] [password]'. Environment variable shortcuts: 'PROXYCHAINS_SOCKS5=<port>' sets SOCKS5 proxy on 127.0.0.1, 'PROXYCHAINS_QUIET=1' enables quiet mode. Example: 'proxychains4 -q nmap -sT -Pn --top-ports 20 10.10.20.50'. For nmap: MUST use -sT (TCP connect scan)—SYN/UDP/ICMP scans require raw sockets and will not proxy.

## Example workflows

Pivoting via Metasploit: (1) Get meterpreter session on pivot host. (2) 'run autoroute -s 10.10.20.0/24' to route target subnet. (3) 'use auxiliary/server/socks_proxy', 'set SRVPORT 1080', 'run -j' to start SOCKS server. (4) Edit /etc/proxychains4.conf, add 'socks5 127.0.0.1 1080' to [ProxyList]. (5) 'proxychains4 -q crackmapexec smb 10.10.20.0/24 -u admin -p pass'. SSH tunnel pivoting: 'ssh -D 1080 user@pivot-host' then configure proxychains for 127.0.0.1:1080. Anonymous scanning: Configure Tor proxy (default 127.0.0.1:9050 SOCKS5), set 'socks5 127.0.0.1 9050' in config, run 'proxychains4 nmap -sT -Pn <target>'. Database access: 'proxychains4 mysql -h 10.10.20.50 -u root -p' or 'proxychains4 psql -h 10.10.20.50 -U postgres'. Impacket tools: 'proxychains4 impacket-psexec domain/user:pass@10.10.20.50'. Web browsing: 'proxychains4 firefox' (entire browser session proxied). Parallel port scanning: 'for port in 22 80 443 445 3389; do proxychains4 -q nc -zv 10.10.20.50 $port & done; wait'. Suppress verbosity: Always add -q for production use to avoid cluttering tool output with proxy connection logs.

## Output format

Proxychains prints status lines to stderr prefixed with '[proxychains]'. Format: '[proxychains] config file found: <path>', '[proxychains] preloading <lib>', '[proxychains] DLL init: proxychains-ng <version>', '[proxychains] <chain_type>_chain ... proxy list:', then for each connection: '[proxychains] Strict chain ... 127.0.0.1:1080 ... 10.10.20.50:445 ... OK'. Failed connections show 'timeout' or connection refused errors. With -q (quiet) flag, these lines are suppressed—only wrapped tool output displays. Wrapped tool output format is unchanged—nmap shows normal scan results, curl shows HTTP responses, etc. To verify proxy functionality, check external IP before operational use: 'proxychains4 curl ipinfo.io' should return proxy exit node IP, not your real IP. When troubleshooting, run without -q to see connection chain details. DNS resolution messages appear if proxy_dns enabled: '[proxychains] resolving <hostname> ... OK' or 'ERROR'.

## Common pitfalls

UDP/ICMP NOT supported—proxychains only works with TCP. Nmap: Must use -sT (TCP connect scan); default SYN scan (-sS) uses raw sockets and bypasses proxychains entirely, exposing real IP. Scanning is extremely slow through proxies—reduce tcp timeouts in config, limit port ranges (--top-ports, -p list), use -Pn to skip ping, avoid version detection (-sV) unless necessary. DNS leaks: Default DNS server 4.2.2.2 is external—for internal network enumeration, change DNS_SERVER in /usr/lib/proxychains3/proxyresolv to internal DNS IP. Sudo interaction: 'sudo proxychains4 <cmd>' works; 'proxychains4 sudo <cmd>' or running proxychains then using sudo in spawned shell does NOT proxy sudo traffic due to environment isolation. Verbose output: Default output clutters tool results—always use -q flag for operational work and screenshots. Localhost bypass: By default, 127.0.0.0/8 is excluded from proxying (localnet directive)—remove or comment out if you need to proxy localhost connections. Chain failures: With strict_chain, one dead proxy breaks entire chain; use dynamic_chain for resilience. Proxy authentication: Not all tools handle SOCKS5 auth well through proxychains—test before operational use. Performance: Parallel tool execution (xargs, background jobs) can partially mitigate slowness but may overwhelm proxy.

## References

• https://www.stationx.net/proxychains/
• https://cybervie.com/how-to-use-proxychains/
• https://redsiege.com/blog/2025/09/getting-started-with-proxy-chains/
• https://www.geeksforgeeks.org/linux-unix/staying-anonymous-with-proxychains-in-kali-linux/
• https://zweilosec.gitbook.io/hackers-rest/os-agnostic/pivoting/proxychains
• https://www.jamescarroll.me/blog/pivoting-with-meterpreter-and-proxychains
• https://www.exploit-db.com/exploits/45554
• https://app.cyberyozh.com/guides/proxy-setup/Proxyclients/proxies-in-proxychains-linux/
• https://thecyberfort.net/proxychains-a-guide-to-anonymity/
