---
name: Whatweb
description: Web fingerprinting scanner that identifies CMS, web servers,
  frameworks, JavaScript libraries, and other technologies through passive and
  aggressive analysis.
registry: registry
tool_id: whatweb
category: fingerprinting
tags:
  - fingerprinting
  - web-scanner
  - reconnaissance
  - osint
  - technology-detection
  - cms-detection
  - ruby
mitre_techniques:
  - T1595.002
  - T1594
summary: "WhatWeb is a Ruby-based web fingerprinting tool that identifies
  technologies, frameworks, CMS platforms, web servers, JavaScript libraries,
  and embedded devices by analyzing HTTP responses, headers, HTML, cookies, and
  JavaScript. Use during initial reconnaissance to rapidly profile web targets
  and discover technology stacks. Invoke with `/opt/tools/bin/whatweb [options]
  <targets>` where targets can be URLs, hostnames, IPs, CIDR ranges, or input
  files. The tool operates at four aggression levels: (1) stealthy single
  request per target [default], (2) reserved, (3) aggressive with additional
  plugin-triggered requests, (4) heavy scanning all plugin URLs. Expect text
  output by default showing identified technologies with confidence levels; use
  `-v` for verbose plugin descriptions or `--log-json` for structured output.
  For red team ops, start with `-a 1` for low detection risk during initial
  profiling, escalate to `-a 3` for version-specific enumeration (e.g.,
  WordPress exact versions) when stealth is less critical. Control threading
  with `-t` (default 25), set custom User-Agent with `-U`, add headers with
  `-H`, configure proxies with `--proxy`, and use `--no-errors` to suppress
  connection failures during network sweeps. WhatWeb has 900+ plugins for
  detecting everything from CMSs to analytics tools. Be aware that aggressive
  scans generate significant traffic and are easily detected; default mode
  minimizes footprint but may miss version details. Output includes HTTP status
  codes, redirects, cookies, emails found in assets, server headers, and
  technology fingerprints with certainty indicators."
sources:
  - https://github.com/urbanadventurer/WhatWeb
  - https://www.securecodebox.io/docs/scanners/whatweb
  - https://www.kali.org/tools/whatweb/
  - https://medium.com/@techmindxperts/exploring-whatweb-a-versatile-tool-for-web-reconnaissance-and-vulnerability-scanning-7293c43483f
  - https://eldernode.com/tutorials/install-whatweb-on-kali-linux/
  - https://manpages.ubuntu.com/manpages/noble/man1/whatweb.1.html
  - https://www.synack.com/knowledge-base/red-teaming-vs-penetration-testing-understanding-the-differences/
  - https://www.rapid7.com/fundamentals/what-is-a-red-team/
  - https://firecompass.com/top-25-red-teaming-tools/
  - https://www.offsec.com/cyberversity/penetration-testing/
  - https://sourceforge.net/projects/whatweb.mirror/
  - https://securitee.org/files/wasabo_usec2024.pdf
generated_at: 2026-05-19T11:07:35.966Z
generated_by: anthropic
source_hash: acd4d8c31c8b90e652c7b820934701b5ee62b2748255d5273b4113f6c321b1d4
---

# Whatweb

## Overview

WhatWeb v0.6.4 is a next-generation web scanner developed by Andrew Horton and Brendan Coles. It performs technology fingerprinting by analyzing HTTP responses, headers, HTML structure, cookies, JavaScript, and other web artifacts to identify the software stack behind a website. The tool uses 900+ plugins to detect CMSs (WordPress, Drupal, Joomla), web servers (Apache, nginx, IIS), JavaScript frameworks, analytics tools, and embedded devices. WhatWeb supports both passive reconnaissance (single request, minimal footprint) and aggressive enumeration (multiple requests, static file hashing for version detection). It's written in Ruby and commonly pre-installed in penetration testing distributions like Kali Linux.

## When to use

Use WhatWeb during the reconnaissance phase of red team operations to fingerprint web applications and identify attack surfaces. Deploy it for initial target profiling to discover technology stacks, CMS versions, server software, and frameworks before planning exploitation. Run WhatWeb when you need to quickly scan multiple targets (CIDR ranges, IP lists) to identify interesting technologies across a network. Use aggressive scanning mode (-a 3) when you need precise version information for exploit matching, particularly for CMSs like WordPress where version-specific vulnerabilities exist. Employ it during client asset discovery to map web technologies across an organization's infrastructure. WhatWeb is particularly valuable for identifying outdated software versions, detecting security products (WAFs, analytics), and uncovering email addresses or account IDs leaked in HTML/JavaScript. Avoid using it as a vulnerability scanner—it identifies technologies but does not test for exploits.

## Authentication & setup

WhatWeb is pre-installed at `/opt/tools/bin/whatweb` in RTPI and requires no additional setup for basic usage. For authenticated scanning, use `--user username:password` for HTTP basic authentication or `--cookie 'name=value; name2=value2'` for session-based authentication. Configure proxy support with `--proxy <host:port>` (default port 8080) and credentials via `--proxy-user <username:password>`. For TOR routing, set `--proxy 127.0.0.1:9050`. Customize HTTP requests with `--user-agent` or `-U` to change the User-Agent string from default 'WhatWeb/0.6.4', and add custom headers using `--header` or `-H` (e.g., `-H 'Authorization: Bearer token'`). No API keys or configuration files are required. To extend functionality, WhatWeb supports custom plugins written in Ruby, though this is rarely needed for standard red team operations.

## Key commands / parameters

**Basic syntax:** `/opt/tools/bin/whatweb [options] <targets>` where targets are URLs, hostnames, IPs, CIDR ranges (192.168.1.0/24), IP ranges (x.x.x-x or x.x.x.x-x.x.x.x), or files via `-i <file>`.

**Aggression levels (-a):** `1` = stealthy single request + redirects [default], `3` = aggressive with plugin-triggered additional requests for version detection, `4` = heavy scanning attempting all plugin URLs. Level 2 exists but is rarely used.

**Output control:** `-v` verbose plugin descriptions, `--log-json=<file>` structured JSON output, `--log-json-verbose` detailed JSON, `--log-brief` minimal output, `--log-xml`, `--log-sql`, `--log-mongo-*`, `--log-elastic-*` for database logging.

**Performance:** `-t <num>` max threads (default 25), `--max-redirects=<num>` (default 10), `--open-timeout` (default 15s), `--read-timeout` (default 30s), `--wait=<seconds>` delay between connections (useful with `-t 1` for stealth).

**HTTP options:** `--follow-redirect=<never|http-only|meta-only|same-site|always>` (default always), `--url-prefix <prefix>` (e.g., `https://` for SSL scanning), `--no-errors` suppress error messages.

**Plugins:** `--list-plugins` or `-l` list all, `--info-plugins` or `-I` detailed info, `--search-plugins=<keyword>`, `--plugins` or `-p` select specific plugins.

**Common flags:** `--no-errors` for network sweeps, `-U <agent>` for custom user agents, `-H <header>` for custom headers.

## Example workflows

**1. Single target reconnaissance (stealthy):**
`/opt/tools/bin/whatweb example.com`
Produces minimal footprint with one HTTP request, follows redirects, identifies basic technologies.

**2. Aggressive WordPress version detection:**
`/opt/tools/bin/whatweb -a 3 www.target.com`
Triggers additional plugin requests to identify exact CMS version through static file fingerprinting.

**3. Network sweep for web servers:**
`/opt/tools/bin/whatweb --no-errors 192.168.0.0/24`
Scans entire subnet, suppresses connection errors for offline hosts.

**4. HTTPS network scan:**
`/opt/tools/bin/whatweb --no-errors --url-prefix https:// 10.0.0.0/24`
Scans for SSL-enabled websites across the target network.

**5. Verbose multi-target scan:**
`/opt/tools/bin/whatweb -v reddit.com slashdot.org`
Provides detailed plugin descriptions for multiple domains.

**6. Scan from file with JSON output:**
`/opt/tools/bin/whatweb -i targets.txt --log-json=results.json --no-errors`
Processes URL list, outputs structured JSON for parsing.

**7. Stealth scan with delays:**
`/opt/tools/bin/whatweb -t 1 --wait=5 -U 'Mozilla/5.0' target.com`
Single-threaded with 5-second delays between requests, custom User-Agent.

**8. Authenticated scan:**
`/opt/tools/bin/whatweb --cookie 'session=abc123' https://target.com/admin`
Accesses protected resources using session cookies.

## Output format

WhatWeb produces text-based output by default, showing one line per target with identified technologies enclosed in square brackets. Output format: `<URL> [HTTP Status] [Technology1] [Technology2], Key:Value pairs`. Example: `http://example.com [200 OK] [HTTPServer[nginx/1.18.0]] [Country[US]] [IP[93.184.216.34]]`. Technologies are listed with certainty indicators (if available) and version numbers when detected. Verbose mode (`-v`) adds detailed plugin descriptions below each finding. Use `--log-json` for machine-parseable output containing structured arrays of plugins, matches, certainty levels, versions, and metadata. JSON format includes fields: target, http_status, plugins (array), request_config, and timestamp. The tool displays redirects showing `[301/302]` with `RedirectLocation[]`. Cookies, email addresses (extracted from HTML/assets), frameworks, server headers, and uncommon headers are called out explicitly. Aggressive scans show additional findings from static content fingerprinting. For large-scale operations, use `--log-brief` for minimal output or redirect to files. WhatWeb outputs to stdout by default; redirect with `>` or use built-in logging flags for structured data storage.

## Common pitfalls

**Detection risk:** Aggressive scanning (`-a 3` or `-a 4`) generates multiple requests per target and is easily detected by IDS/IPS, WAFs, and security monitoring. Default aggression level 1 is stealthy but may miss version information critical for exploit selection. **Thread saturation:** Default 25 threads can overwhelm small networks or trigger rate limiting; reduce with `-t` for stability or stealth. **Version collision:** Static content fingerprinting (aggressive mode) can produce multiple version predictions spanning months or years if static files haven't changed between releases—requires manual verification of which version is correct. **Redirect loops:** Misconfigured sites may cause excessive redirects; use `--max-redirects` to limit. **False negatives in default mode:** Many CMS installations don't expose version information in homepage responses; aggressive mode is required but increases noise. **Output parsing:** Default text output is human-readable but difficult to parse programmatically—always use `--log-json` for automation. **Protocol assumptions:** Tool defaults to HTTP; must explicitly use `--url-prefix https://` or include protocol in URLs for SSL sites. **Timeout issues:** Default 15s open/30s read timeouts may be too short for slow servers or high-latency networks; adjust with `--open-timeout` and `--read-timeout`. **Suppressing errors:** `--no-errors` is essential for network sweeps but hides legitimate scanning issues. **Plugin limitations:** 900+ plugins are maintained by community; newly released technologies may not be fingerprinted until plugin updates.

## References

• https://github.com/urbanadventurer/WhatWeb
• https://www.kali.org/tools/whatweb/
• https://manpages.ubuntu.com/manpages/noble/man1/whatweb.1.html
• https://www.securecodebox.io/docs/scanners/whatweb
• https://eldernode.com/tutorials/install-whatweb-on-kali-linux/
• https://medium.com/@techmindxperts/exploring-whatweb-a-versatile-tool-for-web-reconnaissance-and-vulnerability-scanning-7293c43483f
• https://securitee.org/files/wasabo_usec2024.pdf
