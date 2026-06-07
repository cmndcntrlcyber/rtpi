---
name: Gobuster
description: Fast Go-based brute-forcing tool for URIs, directories, files, DNS
  subdomains, virtual hosts, S3/GCS buckets, and TFTP servers.
registry: registry
tool_id: gobuster
category: web
tags:
  - directory-enumeration
  - subdomain-discovery
  - web-reconnaissance
  - brute-force
  - vhost-discovery
  - dns-enumeration
  - fuzzing
mitre_techniques:
  - T1595.002
  - T1595.001
  - T1592.002
summary: Gobuster is a mode-based enumeration tool. Invoke it at
  /opt/tools/bin/gobuster with a required mode argument (dir, dns, vhost, fuzz,
  s3, gcs, tftp). For directory enumeration use 'gobuster dir -u <URL> -w
  <wordlist> -t <threads>'. For subdomain discovery use 'gobuster dns --domain
  <domain> -w <wordlist> --resolver <DNS-server>'. For virtual host discovery
  use 'gobuster vhost -u <URL> -w <wordlist>'. The tool requires wordlists
  (e.g., SecLists from /usr/share/seclists or similar). It is NOISY and
  aggressive—only use on authorized targets. Global flags include --delay
  (throttle requests per thread), -o (output file), -q (quiet mode), -z (no
  progress bar), --no-error (suppress errors), -t (thread count, default 10).
  Dir mode supports -x (file extensions like php,html), -s (filter by status
  codes), -r (follow redirects), -U/-P (basic HTTP auth), -p (proxy URL),
  --timeout (request timeout). DNS mode uses --domain (target domain) and
  --resolver (custom DNS server). Vhost mode discovers virtual hosts by fuzzing
  the Host header. Fuzz mode replaces the FUZZ keyword in URLs. Gobuster depends
  heavily on wordlist quality; poor lists yield poor results. Expect high
  resource usage and potential detection by IDS/WAF. Output is line-based with
  status codes and sizes. Recent versions (3.x+) use --domain for DNS mode, not
  -d (which is now --delay). Combine with other tools like Nmap or Burp Suite
  for comprehensive recon. Always verify permissions before scanning; this tool
  generates significant traffic and will be noticed by defenders.
sources:
  - https://github.com/OJ/gobuster
  - https://hackviser.com/tactics/tools/gobuster
  - https://manpages.debian.org/testing/gobuster/gobuster.1.en.html
  - https://gobuster.org/what-are-the-key-command-line-options-in-gobuster/
  - https://hackertarget.com/gobuster-tutorial/
  - https://gobuster.org/
  - https://abrictosecurity.com/gobuster-directory-enumerator-cheat-sheet/
  - https://gobuster.org/what-are-the-main-uses-of-gobuster-in-cybersecurity/
  - https://gobuster.org/what-is-gobuster-and-how-does-it-work/
  - https://fission.io/blog/penetration-testing-with-gobuster-fission/
  - https://medium.com/@estheresom17/%EF%B8%8F-%EF%B8%8F-brute-forcing-directories-on-a-vulnerable-website-using-gobuster-f40337489072
  - https://en.wikipedia.org/wiki/Gobuster
generated_at: 2026-05-19T11:17:45.742Z
generated_by: anthropic
source_hash: 57ac2f129597ac74cf5ff49f3aac247c6ff039c3a477a31aa2b5d83e6f57b8f9
---

# Gobuster

## Overview

Gobuster is a high-performance brute-forcing tool written in Go. It operates in distinct modes: dir (directory/file enumeration), dns (subdomain discovery), vhost (virtual host discovery), fuzz (custom fuzzing with FUZZ keyword), s3 (AWS bucket enumeration), gcs (Google Cloud Storage enumeration), and tftp (TFTP server file enumeration). Each mode is optimized for specific reconnaissance tasks. The tool is command-line driven, designed for speed and concurrency, and comes pre-installed on Kali Linux. It requires wordlists to function effectively and supports both HTTP and HTTPS targets.

## When to use

Use Gobuster during web application reconnaissance to discover hidden directories, files, backup files, admin panels, and sensitive resources not linked from the main site. Use DNS mode during the reconnaissance phase to map subdomains and expand the attack surface. Use vhost mode to identify virtual hosts sharing the same IP address. Deploy during penetration tests, bug bounty hunts, CTFs, and security assessments where you have explicit authorization. Use when you need fast, parallelized brute-forcing with wordlist-driven enumeration. Avoid in production environments without permission—this is an aggressive, high-traffic tool that will trigger IDS/IPS/WAF alerts.

## Authentication & setup

Gobuster is invoked at /opt/tools/bin/gobuster. No initial configuration or API keys are required. For basic HTTP authentication, use the -U and -P flags to pass username and password. For proxy usage (e.g., through Burp Suite), use -p <proxy-URL> (default port 1080). Gobuster requires wordlists; common sources include SecLists (install via apt-get install seclists, typically in /usr/share/seclists), directory-list-2.3-medium.txt from Dirbuster, or custom wordlists. For DNS mode, you may specify a custom DNS resolver with --resolver <server> or <server:port>. No daemon or service setup is needed; Gobuster is a single-binary tool invoked per scan.

## Key commands / parameters

**Global flags**: -u/--url <target-URL> (required for dir/vhost/fuzz), -w/--wordlist <path> (required), -t/--threads <N> (default 10, controls concurrency), --delay <duration> (e.g., 1500ms, throttles requests per thread), -o/--output <file> (write results to file), -q/--quiet (suppress banner and noise), -z/--no-progress (disable progress bar), --no-error (hide errors), --no-color (disable ANSI colors), --timeout <duration> (default 10s). **Dir mode** (gobuster dir): -x/--extensions <ext1,ext2> (e.g., php,html,txt to append extensions), -s/--status-codes <codes> (filter by HTTP status, default 200,204,301,302,307,401,403), -r (follow redirects), -U/--username and -P/--password (basic auth), -p/--proxy <URL>, -a/--useragent <string>, -c/--cookies <string>. **DNS mode** (gobuster dns): --domain/--do <domain> (target domain, required; -d is reserved for --delay in v3.x+), --resolver <server> (custom DNS server), -i/--show-ips (show resolved IPs). **Vhost mode** (gobuster vhost): -u <base-URL>, -w <wordlist> (fuzzes Host header to discover virtual hosts). **Fuzz mode** (gobuster fuzz): replaces FUZZ keyword in URL, headers, or POST data with wordlist entries.

## Example workflows

**Basic directory scan**: gobuster dir -u http://target.com -w /usr/share/wordlists/dirb/common.txt -t 50 -o dir-results.txt. **Scan with file extensions**: gobuster dir -u https://target.com -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,html,txt,bak -t 50. **Filter by status codes**: gobuster dir -u http://target.com -w wordlist.txt -s 200,301,403 -q. **DNS subdomain enumeration**: gobuster dns --domain example.com -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt --resolver 8.8.8.8 -t 50 -o subdomains.txt. **Virtual host discovery**: gobuster vhost -u http://192.168.1.10 -w /usr/share/seclists/Discovery/DNS/namelist.txt -t 30. **With authentication and proxy**: gobuster dir -u http://target.com -w wordlist.txt -U admin -P password123 -p http://127.0.0.1:8080 -x php. **Throttled scan**: gobuster dir -u http://target.com -w wordlist.txt --delay 500ms -t 10. **Quiet scan to file**: gobuster dir -u http://target.com -w wordlist.txt -q -z -o results.txt.

## Output format

Gobuster outputs line-by-line results to stdout (or to file with -o). Format varies slightly by mode. **Dir mode**: Lines show discovered paths with status code and size, e.g., '/admin (Status: 200) [Size: 1234]' or '/backup.zip (Status: 403)'. **DNS mode**: Lines show discovered subdomains and optionally IPs, e.g., 'Found: admin.example.com' or 'admin.example.com [192.168.1.5]'. **Vhost mode**: Lines show discovered virtual hosts with status, e.g., 'Found: dev.example.com (Status: 200)'. Progress indicators and summary statistics are printed unless -q (quiet) or -z (no-progress) flags are used. Errors (timeouts, connection refused) are printed unless --no-error is specified. Output is plain text, suitable for parsing with grep, awk, or piping into other tools. Use -o to capture results to a file for later analysis or reporting.

## Common pitfalls

**Wordlist dependency**: Gobuster is only as good as your wordlist. Poor or irrelevant wordlists yield no results. Use curated lists like SecLists. **Noise and detection**: This tool is LOUD. High request volumes will trigger IDS, IPS, WAF, and rate-limiting. Use --delay to throttle and -t to reduce threads if stealth is needed (though Gobuster is fundamentally noisy). **Resource consumption**: Large wordlists with high thread counts can consume significant bandwidth, CPU, and memory. Start with smaller lists and tune -t and --delay. **False positives**: Some servers return 200 or redirect for all requests (wildcard responses). Manually verify discovered paths. **Timeout issues**: Slow or unresponsive servers may cause hangs. Adjust --timeout to a reasonable value (e.g., 5s or 10s). **DNS mode confusion**: In Gobuster v3.x+, use --domain (or --do) for DNS mode, not -d, which is now shorthand for --delay. **Authentication and cookies**: If the target requires session cookies or tokens, Gobuster's -c flag may not suffice for complex auth flows. Consider proxying through Burp Suite with an authenticated session. **Legal and ethical**: ONLY scan targets you own or have explicit written authorization to test. Unauthorized scanning is illegal and unethical. **HTTPS certificate errors**: Some HTTPS targets with self-signed certs may cause issues; Gobuster generally handles this, but verify connectivity first. **Redirects**: By default, Gobuster does not follow redirects in dir mode. Use -r to follow them, but be aware this can lead to false positives if all paths redirect to a login page.

## References

- https://github.com/OJ/gobuster
- https://hackviser.com/tactics/tools/gobuster
- https://manpages.debian.org/testing/gobuster/gobuster.1.en.html
- https://gobuster.org/what-are-the-key-command-line-options-in-gobuster/
- https://hackertarget.com/gobuster-tutorial/
- https://gobuster.org/
- https://abrictosecurity.com/gobuster-directory-enumerator-cheat-sheet/
- https://gobuster.org/what-are-the-main-uses-of-gobuster-in-cybersecurity/
- https://gobuster.org/what-is-gobuster-and-how-does-it-work/
- https://fission.io/blog/penetration-testing-with-gobuster-fission/
- https://medium.com/@estheresom17/%EF%B8%8F-%EF%B8%8F-brute-forcing-directories-on-a-vulnerable-website-using-gobuster-f40337489072
- https://en.wikipedia.org/wiki/Gobuster
