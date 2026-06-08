---
name: Wafw00f
description: Fingerprint and identify Web Application Firewall (WAF) products
  protecting a target web application or site.
registry: registry
tool_id: wafw00f
category: fingerprinting
tags:
  - waf
  - fingerprinting
  - reconnaissance
  - web-security
  - detection
  - enumeration
  - http
mitre_techniques:
  - T1595.002
summary: wafw00f is a Web Application Firewall fingerprinting tool for active
  reconnaissance. Use it early in web application assessments to identify WAF
  presence and type before exploitation attempts. Invoke with
  /usr/local/bin/wafw00f followed by target URL (must include http:// or
  https://). The tool sends normal HTTP requests first, then potentially
  malicious payloads to trigger WAF behavior. By default it stops at the first
  match; use -a/--findall to test all signatures. Use -l/--list to see
  detectable WAFs (100+ products including CloudFlare, Akamai, AWS ELB, Imperva,
  F5, Citrix NetScaler). Output is plaintext to stdout unless -o/--output
  specified (supports csv, json, text). Use -r/--noredirect to prevent following
  3xx redirects. Pass -v for verbose output (repeat for more verbosity). Use
  -t/--test to check for one specific WAF. Set -p/--proxy for HTTP/SOCKS5
  proxying. WAF detection helps determine evasion tactics, payload encoding
  requirements, and whether direct exploitation is viable. Detection relies on
  response headers, cookies (e.g. ns_af for Citrix), status codes, and
  behavioral fingerprints. False negatives occur with custom WAFs or stealthy
  configurations; false positives are rare. Always validate findings manually by
  inspecting headers and cookies. This is an ACTIVE tool that sends requests to
  the target—ensure authorization before use.
sources:
  - https://www.geeksforgeeks.org/linux-unix/identification-of-web-application-firewall-using-wafw00f-in-kali-linux/
  - https://www.kali.org/tools/wafw00f/
  - https://github.com/EnableSecurity/wafw00f
  - https://www.briskinfosec.com/tooloftheday/toolofthedaydetail/WafW00f-Tool-to-Fingerprint-and-identify-Web-Application-Firewall
  - https://pentestlab.blog/tag/wafw00f/
  - https://null-byte.wonderhowto.com/how-to/identify-web-application-firewalls-with-wafw00f-nmap-0198145/
  - https://www.redpacketsecurity.com/wafw00f-v2-0-allows-one-to-identify-and-fingerprint-web-application-firewall-waf-products-protecting-a-website/
  - https://www.sans.org/blog/shifting-from-penetration-testing-to-red-team-and-purple-team
  - https://github.com/enablesecurity/wafw00f
  - https://sourceforge.net/projects/wafw00f.mirror/
generated_at: 2026-05-19T11:22:49.907Z
generated_by: anthropic
source_hash: fead6606597c923f9aabf646717e05e8b0169c44e271a2b2a8e16ed44d353532
---

# Wafw00f

## Overview

wafw00f is a Python-based active reconnaissance tool that identifies and fingerprints Web Application Firewall (WAF) products protecting websites. It sends HTTP requests—both benign and potentially malicious—and analyzes responses (headers, cookies, status codes, body content) to determine if a WAF is present and which product is deployed. The tool supports detection of 100+ commercial and open-source WAF solutions including major vendors like CloudFlare, Akamai, Imperva, F5, AWS, Citrix, and Microsoft. It uses a three-tier detection approach: normal HTTP analysis, malicious request probing, and heuristic response pattern matching.

## When to use

Use wafw00f at the beginning of web application assessments, immediately after initial target scoping and before vulnerability scanning or exploitation. Deploy it to determine if a WAF is protecting the target, which informs attack strategy (payload encoding, rate limiting, IP rotation). Run it when reconnaissance suggests WAF presence (unusual response headers, cookie patterns, consistent 403/406 responses to probes). Use it to validate whether direct exploitation is viable or if WAF bypass/evasion techniques are required. Also valuable in purple team exercises to confirm WAF deployment and effectiveness. Run before using active scanners like sqlmap or Burp Suite intruder to avoid triggering blocks or IP bans unnecessarily.

## Authentication & setup

wafw00f requires no authentication or configuration files. It is typically pre-installed in Kali Linux and RTPI at /usr/local/bin/wafw00f. If missing, install via 'pip3 install wafw00f' or from source using 'python setup.py install'. No API keys, credentials, or configuration files are needed. The tool makes direct HTTP/HTTPS requests to targets, so ensure network connectivity and DNS resolution. When operating through restrictive networks, use -p/--proxy to route through HTTP or SOCKS5 proxies (syntax: http://host:port or socks5://host:port). Use -H/--headers to pass a custom headers file if you need to override default User-Agent or add authentication tokens for authenticated endpoints. No persistent state or database is maintained.

## Key commands / parameters

Basic syntax: wafw00f <URL> (URL must include http:// or https://)

-h, --help : Show help message
-v, --verbose : Enable verbose output (stack multiple -v for increased verbosity)
-a, --findall : Test all WAF signatures instead of stopping at first match
-r, --noredirect : Do not follow HTTP 3xx redirects
-t TEST, --test=TEST : Test for one specific WAF by name
-l, --list : List all detectable WAF products (100+ vendors)
-o OUTPUT, --output=OUTPUT : Write results to file; format inferred from extension (.csv, .json, .txt) or use '-' for stdout
-f FORMAT, --format=FORMAT : Force output format (csv, json, text)
-i INPUT, --input-file=INPUT : Read multiple targets from file (csv, json, or text format; csv/json require 'url' column/field)
-p PROXY, --proxy=PROXY : Use HTTP or SOCKS5 proxy (e.g., http://127.0.0.1:8080 or socks5://host:1080)
-H HEADERS, --headers=HEADERS : Pass custom HTTP headers from text file
-T TIMEOUT, --timeout=TIMEOUT : Set request timeout in seconds
-V, --version : Print version and exit
--no-colors : Disable ANSI color output

## Example workflows

1. Basic WAF detection:
   wafw00f http://www.target.com/

2. Detect all matching WAFs (not just first):
   wafw00f -a https://www.target.com/

3. List all detectable WAF products:
   wafw00f -l

4. Test for specific WAF (e.g., Cloudflare):
   wafw00f -t Cloudflare https://www.target.com/

5. Scan multiple targets from file:
   wafw00f -i targets.txt -o results.json

6. Verbose output with proxy:
   wafw00f -v -p http://127.0.0.1:8080 https://www.target.com/

7. Output to JSON for parsing:
   wafw00f -o scan_results.json https://www.target.com/

8. Prevent redirect following:
   wafw00f -r https://www.target.com/

9. Combine flags for thorough scan:
   wafw00f -a -v -o results.csv --timeout 10 https://www.target.com/

10. Scan with custom headers (e.g., auth token):
    wafw00f -H custom_headers.txt https://api.target.com/

## Output format

Default output is plaintext to stdout with ASCII art banner showing tool version. Results indicate:
- '[+] The site <URL> is behind <WAF_Name> (<Vendor>) WAF.' if detected
- '[*] The site <URL> does not seem to be behind a WAF.' if none detected
- '[~] Number of requests: X' shows request count

With -o flag, supports three formats:
- TEXT: Human-readable plaintext (same as stdout)
- JSON: Structured data with fields for URL, detected WAF, manufacturer, requests_count
- CSV: Tabular format with columns url, waf_name, waf_manufacturer

Verbose mode (-v) adds request/response details, headers, and detection logic. Use --no-colors to strip ANSI codes for log file compatibility. When using -i for bulk scanning, results are aggregated in the output file. Exit codes: 0 for success, non-zero for errors. Parse JSON output programmatically for integration with reporting pipelines or orchestration tools.

## Common pitfalls

1. Forgetting protocol: URLs must include http:// or https:// or the tool will fail
2. False negatives: Custom or heavily customized WAFs may not match signatures; always manually verify with curl/Burp to inspect headers and cookies
3. IP blocking: Aggressive scanning with -a on rate-limited targets can trigger temporary IP bans; use delays or proxies
4. Redirect loops: Some WAFs redirect indefinitely; use -r/--noredirect to prevent hangs
5. Over-reliance on results: Detection is signature-based; absence of detection does not guarantee absence of WAF—check for behavioral indicators like consistent 403s or cookie patterns (e.g., ns_af, BIGipServer)
6. Network errors: Timeouts or DNS failures produce unclear errors; use -v to debug and verify connectivity first with ping/curl
7. Authenticated endpoints: WAF may only be active on authenticated paths; test multiple endpoints and use -H for session cookies
8. Outdated signatures: Tool version matters; ensure wafw00f is updated to detect newer WAF products
9. Proxy misconfigurations: Incorrect proxy syntax causes silent failures; verify proxy with curl first
10. Large input files: Scanning thousands of URLs without rate limiting can overwhelm the tool or network; batch into smaller jobs

## References

• https://github.com/EnableSecurity/wafw00f
• https://www.geeksforgeeks.org/linux-unix/identification-of-web-application-firewall-using-wafw00f-in-kali-linux/
• https://www.kali.org/tools/wafw00f/
• https://null-byte.wonderhowto.com/how-to/identify-web-application-firewalls-with-wafw00f-nmap-0198145/
• https://pentestlab.blog/tag/wafw00f/
• https://www.redpacketsecurity.com/wafw00f-v2-0-allows-one-to-identify-and-fingerprint-web-application-firewall-waf-products-protecting-a-website/
