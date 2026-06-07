---
name: Httpx
description: Fast multi-purpose HTTP toolkit for probing web servers, gathering
  metadata, and validating services at scale
registry: registry
tool_id: httpx
category: reconnaissance
tags:
  - reconnaissance
  - http
  - web-probing
  - asset-discovery
  - enumeration
  - projectdiscovery
  - osint
mitre_techniques:
  - T1046
  - T1595.002
  - T1590.001
summary: "httpx is ProjectDiscovery's HTTP reconnaissance toolkit designed for
  large-scale web server probing and metadata extraction. Use it to validate
  live HTTP/HTTPS services, enumerate response codes, detect technologies
  (Wappalyzer), extract titles/headers/certificates, fingerprint
  ASN/JARM/favicon, and screenshot targets. Invoke via /usr/local/bin/httpx with
  input from stdin or -l/--list file containing URLs/IPs/domains. httpx accepts
  naked domains, full URLs, CIDRs, and ASN inputs. Core flags: -sc (status
  code), -title, -td (tech detect), -server, -ct (content-type), -cl
  (content-length), -location, -favicon, -jarm, -asn, -ss (screenshot), -mc
  (match code), -fc (filter code), -timeout, -threads, -random-agent, -H (custom
  headers), -follow-redirects, -ports (custom ports), -path (file/path
  bruteforce). Output defaults to stdout; use -o for file, -json for structured
  output. httpx maintains reliability under high concurrency and integrates
  seamlessly into pipelines (e.g., subfinder | httpx, dnsx | httpx). Expect one
  line per probed host showing URL and requested metadata fields. Common in
  asset discovery → technology profiling → vulnerability detection chains. Does
  NOT exploit; purely reconnaissance. Watch for rate limiting, WAF blocks, and
  false negatives on non-standard ports without explicit -ports flag. Always use
  -random-agent in operational environments. Can run as Go library or CLI;
  screenshot requires headless Chrome."
sources:
  - https://betterstack.com/community/guides/scaling-python/httpx-explained/
  - https://www.kali.org/tools/httpx-toolkit/
  - https://docs.projectdiscovery.io/opensource/httpx/overview
  - https://highon.coffee/blog/httpx-cheat-sheet/
  - https://docs.projectdiscovery.io/opensource/httpx/running
  - https://github.com/encode/httpx
  - https://github.com/projectdiscovery/httpx
  - https://www.redfoxsec.com/blog/red-team-attack-methodology-a-complete-guide-to-adversarial-penetration-testing
  - https://firecompass.com/top-25-red-teaming-tools/
  - https://www.picussecurity.com/resource/blog/techniques-tactics-procedures-utilized-by-fireeye-red-team-tools
  - https://bishopfox.com/blog/2025-red-team-tools-c2-frameworks-active-directory-network-exploitation
  - https://dev.to/ankitjaininfo/http-tools-for-security-researchers-and-pen-testers-57i0
generated_at: 2026-05-19T11:00:36.637Z
generated_by: anthropic
source_hash: 2a0fe42cc25decde2050ceb06934db05245a3ce2eb4ab04f4a2bb31eb6e5da43
---

# Httpx

## Overview

httpx is a fast, multi-purpose HTTP toolkit from ProjectDiscovery built for red team reconnaissance and asset validation. It probes web servers at scale using the retryablehttp library, maintaining result reliability even with high thread counts. Core capabilities include status code verification, HTTP header extraction, technology detection (Wappalyzer-based), ASN/JARM/favicon fingerprinting, response time measurement, screenshot capture, and TLS/HTTP2/CSP probing. Designed for pipeline integration with other recon tools (subfinder, dnsx, nuclei). Accepts domains, URLs, CIDRs, and ASNs as input.

## When to use

Use httpx to validate live HTTP/HTTPS services from domain enumeration (e.g., subfinder output), confirm web server presence on large IP ranges, fingerprint technologies and server types, identify redirect chains and final landing pages, capture screenshots for visual triage, extract titles and metadata for categorization, filter targets by status code before vulnerability scanning, perform large-scale asset inventory for bug bounty or red team scoping, and chain into detection pipelines (httpx → nuclei). Deploy when you need reliable, high-throughput HTTP probing beyond simple curl/wget. Essential for transforming raw asset lists into actionable web targets.

## Authentication & setup

httpx requires no authentication or configuration file by default. Install via package manager or binary release. For authenticated probing, use -H for custom headers (Authorization, Cookie, etc.) or pass secrets.yaml via -sf flag with BasicAuth, BearerToken, Header, Cookie, or Query credential types. For screenshot functionality (-ss), install headless Chrome/Chromium; httpx auto-detects system Chrome or specify path. Configure custom resolvers with -r/--resolvers for DNS control. Set custom config path with -config (default ~/.config/httpx/config.yaml). For Cloud Platform integration (PDCP), set PDCP_API_KEY environment variable and use -dashboard flag to upload results to UI with asset grouping.

## Key commands / parameters

INPUT: -l/--list <file> (host list), -request <file> (raw HTTP request), stdin via pipe. PROBES: -sc (status code), -title (page title), -server (Server header), -td/--tech-detect (Wappalyzer tech), -cl (Content-Length), -ct (Content-Type), -location (Location header), -favicon (favicon hash), -jarm (JARM fingerprint), -asn (ASN fingerprint), -rt (response time), -lc (line count), -wc (word count), -method (HTTP method). FILTERS: -mc (match code), -fc (filter code), -ms (match string), -fs (filter string). CONFIG: -threads <int> (concurrency), -timeout <duration>, -retries <int>, -random-agent (randomize User-Agent), -H/--header <string[]> (custom headers), -follow-redirects (follow HTTP redirects), -ports <list> (custom ports, format protocol:port e.g., http:8080,https:8443), -path <file> (path bruteforce list), -no-fallback (disable scheme fallback). OUTPUT: -o <file> (output file), -json (JSON output), -csv (CSV output), -silent (silent mode), -v (verbose), -nc (no color). ADVANCED: -ss/--screenshot (screenshot), -system-chrome (use system Chrome), -srd/--screenshot-dir <path>, -csp-probe (CSP probe), -tls-probe (TLS metadata), -http2 (HTTP/2 check), -pipeline (HTTP pipelining probe).

## Example workflows

1) Basic domain probe: echo 'example.com' | httpx -sc -title -server -td
2) Validate subfinder results: subfinder -d example.com -silent | httpx -sc -mc 200 -title -o live_hosts.txt
3) CIDR scan with tech detection: echo '192.168.1.0/24' | httpx -sc -td -server -random-agent -threads 50
4) Screenshot 200 responses: cat targets.txt | httpx -sc -mc 200 -ss -srd ./screenshots/
5) Follow redirects and extract location: httpx -l domains.txt -follow-redirects -location -title -o redirects.txt
6) Custom ports + auth: httpx -l targets.txt -ports http:8080,https:8443 -H 'Authorization: Bearer TOKEN' -sc -title
7) ASN fingerprinting: httpx -l hosts.txt -asn -json -o asn_results.json
8) Path bruteforce: httpx -l base_urls.txt -path wordlist.txt -mc 200,403 -sc -title
9) Chain dnsx → httpx: cat domains.txt | dnsx -silent | httpx -sc -mc 200 -title -td -o validated.txt
10) Upload to PDCP: export PDCP_API_KEY=key; httpx -l targets.txt -sc -title -dashboard -asg 'Q1-2024-Recon'

## Output format

Default output is line-oriented text: one line per probed host showing requested metadata. Format: [URL] [flags]. Example with -sc -title: 'https://example.com [200] [Example Domain]'. With -json, output is newline-delimited JSON objects with fields: url, status_code, title, webserver, content_type, content_length, response_time, technologies, location, favicon, jarm, asn, etc. CSV format available via -csv flag with columns matching requested probes. Screenshot mode creates PNG files in -srd directory named by domain/IP. Use -o to write to file instead of stdout. Silent mode (-silent) suppresses progress/errors, outputting only results. Verbose (-v) adds probe details and errors. No color (-nc) strips ANSI codes for pipeline compatibility.

## Common pitfalls

Default httpx only tests ports 80/443; explicitly specify -ports for custom ports or you will miss services on 8080, 8443, etc. Without -random-agent in production, identical User-Agent strings may trigger WAF/rate limiting. -follow-redirects is NOT default; enable to discover final landing pages. Screenshot (-ss) fails silently without Chrome/Chromium installed; verify with -system-chrome or install headless browser. High -threads without -timeout tuning causes hangs on slow/dead hosts. JSON output requires -json flag; default is human-readable. httpx does not exploit or authenticate by default; use -H or -sf for authenticated scans. False negatives occur on IP addresses that require Host header; use -vhost input if applicable. -tech-detect (Wappalyzer) increases response time and may be inaccurate; use selectively. Piping large input without -silent floods terminal; always use -silent in pipelines. No automatic retry logic for transient failures unless -retries set explicitly.

## References

• https://docs.projectdiscovery.io/opensource/httpx/overview
• https://docs.projectdiscovery.io/opensource/httpx/running
• https://github.com/projectdiscovery/httpx
• https://highon.coffee/blog/httpx-cheat-sheet/
• https://www.kali.org/tools/httpx-toolkit/
