---
name: Hakrawler
description: Fast Go-based web crawler that discovers URLs, endpoints,
  JavaScript files, and subdomains from stdin; designed for tool chaining in
  recon workflows.
registry: registry
tool_id: hakrawler
category: web-recon
tags:
  - web-recon
  - crawler
  - endpoint-discovery
  - subdomain-enumeration
  - javascript-recon
  - bug-bounty
  - osint
mitre_techniques:
  - T1595.002
summary: "Hakrawler is a stdin-driven web crawler for discovering URLs,
  endpoints, JavaScript files, form actions, and subdomains. It reads target
  URLs from stdin (one per line) and outputs discovered assets to stdout. Invoke
  with `cat urls.txt | /opt/tools/bin/hakrawler [flags]` or `echo
  'https://target.com' | /opt/tools/bin/hakrawler`. Key flags: `-d <int>` sets
  crawl depth (default 2); `-subs` includes subdomains in scope; `-plain`
  removes color/banners for parsing; `-t <int>` sets concurrent threads (default
  8); `-u` shows only unique URLs; `-js` extracts JavaScript file links;
  `-forms` includes form actions; `-linkfinder` runs LinkFinder on JS files;
  `-s` shows source context (href/form/script); `-w` shows where URL was found;
  `-proxy <url>` routes through proxy; `-timeout <sec>` limits crawl time per
  URL; `-h <string>` adds custom headers (delimited by `;;`); `-cookie <string>`
  adds cookie header; `-auth <string>` adds Authorization header; `-dr` disables
  redirects; `-insecure` skips TLS verification; `-json` outputs JSON format;
  `-size <kb>` limits page size; `-outdir <path>` saves raw HTTP requests.
  Designed for Unix pipelines—chain with subdomain enumeration
  (haktrails/assetfinder), live host checking (httpx), and vulnerability
  scanners. Output is line-delimited URLs by default. Best for HTML-based sites;
  limited effectiveness on SPAs that render client-side. Higher depth values
  increase coverage but slow execution significantly. Always use `-plain` when
  piping to downstream tools. Does not auto-extract all endpoints—combine with
  other parsers for comprehensive coverage."
sources:
  - https://github.com/Elsfa7-110/hakrawler
  - https://www.youtube.com/watch?v=eSR-1e3vMto
  - https://app.daily.dev/posts/hakrawler-tutorial-fast-web-crawler-for-bug-bounty-xkhdmj8kp
  - https://github.com/hakluke/hakrawler
  - https://amrelsagaei.com/unveiling-hidden-urls-web-enumeration-with-hakrawler
  - https://linuxcommandlibrary.com/man/hakrawler
  - https://cybersecuritytome.com/unleashing-the-power-of-hakrawler-in-kali-linux-a-step-by-step-tutorial-for-beginners/
  - https://crawler.docs.browsertrix.com/user-guide/cli-options/
  - https://cybersectools.com/compare/hakrawler-vs-git-scanner-framework
  - https://starlog.is/articles/cybersecurity/hakluke-hakrawler
  - https://cybersecuritytome.com/unleashing-the-power-of-hakrawler-in-kali-linux-a-step-by-step-tutorial-for-beginners
  - https://cybersecop.com/penetration-testing-red-team
generated_at: 2026-05-19T11:17:28.265Z
generated_by: anthropic
source_hash: 24a00310b633511ab8e49cf8c9e965f87df275c168812eb434ba318f167f9151
---

# Hakrawler

## Overview

Hakrawler is a fast Golang web crawler built on the Gocolly library, designed for rapid URL and asset discovery during web application reconnaissance. It reads target URLs from stdin, crawls them to a specified depth, and outputs discovered URLs, JavaScript file references, form actions, and subdomains. The tool follows the Unix philosophy: do one thing well and enable easy composition with other tools through stdin/stdout chaining. It is widely used in bug bounty hunting and penetration testing workflows for automated endpoint discovery across multiple domains.

## When to use

Use hakrawler when you need fast, automated discovery of URLs and endpoints across one or many web applications during reconnaissance. Ideal for bug bounty workflows where you're chaining subdomain enumeration → live host detection → crawling → vulnerability scanning. Best suited for traditional server-rendered HTML sites where links, forms, and scripts are present in initial responses. Use when building Unix pipelines that require composable, reliable components. Do NOT use for modern single-page applications (SPAs) that render content client-side via JavaScript frameworks—you'll get minimal results since hakrawler crawls static HTML responses. Skip if you need deep JavaScript analysis or post-crawl exploitation; hakrawler stops at discovery. Do NOT use against targets without authorization.

## Authentication & setup

Hakrawler is pre-installed at `/opt/tools/bin/hakrawler` in RTPI. No additional setup required. For authenticated crawling, use `-cookie` flag with session cookies: `echo 'https://target.com' | hakrawler -cookie 'session=abc123'`. For bearer tokens or API keys, use `-auth` flag: `hakrawler -auth 'Bearer token123'`. For custom headers (e.g., User-Agent, Referer), use `-h` with double-semicolon delimiter: `hakrawler -h 'User-Agent: Mozilla/5.0;;Referer: https://google.com'`. For corporate proxies or routing through Burp Suite, use `-proxy`: `hakrawler -proxy http://127.0.0.1:8080`. Use `-insecure` flag to skip TLS certificate validation when testing internal/dev sites with self-signed certs. No configuration files or API keys needed.

## Key commands / parameters

`-d <int>`: Crawl depth; default 2. Higher values (3-5) yield more URLs but significantly slower. Depth >1 seeds from robots.txt, sitemap.xml, and Wayback Machine URLs.
`-subs`: Include subdomains in crawl scope (e.g., crawling example.com will also crawl api.example.com).
`-plain`: Disable colors and banners; mandatory when piping to other tools.
`-t <int>`: Number of concurrent threads; default 8. Increase cautiously to avoid rate limiting.
`-u`: Output only unique URLs (deduplication).
`-js`: Include JavaScript file URLs in output.
`-forms`: Include form action URLs.
`-linkfinder`: Run LinkFinder tool on discovered JavaScript files to extract additional endpoints.
`-s`: Show source type where URL was found (href, form, script, robots, sitemap).
`-w`: Show parent URL where each discovered URL was found.
`-json`: Output in JSON format instead of line-delimited text.
`-timeout <sec>`: Maximum crawl time per input URL; useful for large sites. Default unlimited (-1).
`-proxy <url>`: Route requests through HTTP/HTTPS proxy (e.g., http://127.0.0.1:8080).
`-cookie <string>`: Add Cookie header for authenticated crawling.
`-auth <string>`: Add Authorization header.
`-h <string>`: Custom headers separated by `;;` (e.g., `-h 'Cookie: x=y;;Referer: https://z.com'`).
`-dr`: Disable following HTTP redirects.
`-insecure`: Skip TLS certificate verification.
`-size <kb>`: Page size limit in kilobytes; skip pages exceeding this.
`-outdir <path>`: Save raw HTTP requests to directory for later analysis.
`-i`: Only crawl URLs within the initial path (stay in /admin if starting URL is /admin).

## Example workflows

**Single target basic crawl:**
`echo 'https://target.com' | /opt/tools/bin/hakrawler -plain`

**Multiple targets from file:**
`cat targets.txt | hakrawler -plain -u > discovered_urls.txt`

**Deep crawl with subdomains:**
`echo 'https://target.com' | hakrawler -d 4 -subs -plain`

**Full recon chain (subdomain enum → live check → crawl):**
`echo 'target.com' | haktrails subdomains | httpx -silent | hakrawler -plain -u`

**Extract JavaScript files only:**
`cat urls.txt | hakrawler -js -plain | grep -E '\.js$'`

**Crawl with LinkFinder for hidden endpoints in JS:**
`echo 'https://target.com' | hakrawler -linkfinder -d 3 -plain`

**Authenticated crawl with cookies:**
`echo 'https://app.target.com' | hakrawler -cookie 'session=xyz123' -plain`

**Crawl through Burp Suite for manual inspection:**
`cat urls.txt | hakrawler -proxy http://127.0.0.1:8080 -insecure`

**Show URL provenance (where found):**
`echo 'https://target.com' | hakrawler -s -w | tee crawl_provenance.txt`

**Timeout protection for large sites:**
`cat large_targets.txt | hakrawler -timeout 30 -plain`

**Extract form actions for CSRF/injection testing:**
`echo 'https://target.com' | hakrawler -forms -plain | grep 'action='`

**JSON output for structured parsing:**
`echo 'https://api.target.com' | hakrawler -json | jq '.url'`

## Output format

Default output is line-delimited URLs, one per line, written to stdout. URLs include discovered links (href), JavaScript files (if `-js`), form actions (if `-forms`), and subdomain URLs (if `-subs`). Use `-plain` to remove ANSI color codes and ASCII banner for clean parsing. With `-s` flag, output includes source tag in brackets: `[href] https://target.com/page`, `[form] https://target.com/submit`, `[script] https://cdn.target.com/app.js`. With `-w` flag, output shows parent URL: `[https://target.com] https://target.com/about`. With `-json` flag, output is JSON objects (one per line): `{"url":"https://target.com/page","source":"href","where":"https://target.com"}`. Exit code 0 on success. Errors/warnings print to stderr. No automatic deduplication unless `-u` flag is used. JavaScript file URLs only appear with `-js` flag. Form actions only with `-forms`. Robots.txt and sitemap.xml URLs included automatically at depth >1.

## Common pitfalls

**Forgetting `-plain` in pipelines:** Color codes and banners break downstream parsing. Always use `-plain` when piping to other tools.

**Over-aggressive depth:** Depth >3 can cause exponential crawl time and may trigger WAF/rate limiting. Start with default (2) and increase only if needed.

**Missing `-subs` for scope expansion:** By default, hakrawler stays on exact domain. Use `-subs` to discover api.target.com, admin.target.com, etc.

**No deduplication by default:** Without `-u`, you'll get duplicate URLs. Always use `-u` unless you need frequency counts.

**Limited SPA effectiveness:** Hakrawler crawls static HTML responses. Modern React/Vue/Angular apps that render client-side will yield minimal results. Pair with headless browser tools for SPAs.

**Ignoring rate limiting:** Default 8 threads may trigger aggressive WAFs or IP bans. Use `-t` to reduce concurrency, add delays with proxy tools, or route through rotating proxies.

**Not extracting JS files:** Many endpoints are only referenced in JavaScript. Always use `-js` and consider `-linkfinder` for comprehensive coverage.

**Timeout issues on large sites:** Without `-timeout`, hakrawler may hang on massive sites. Set reasonable timeout (30-60 sec) when crawling many targets.

**Redirects masking subdomains:** Some sites redirect to different subdomains. Use `-subs` to follow, or use `-dr` to analyze redirect chains separately.

**Cookie/auth issues:** Session cookies expire. Refresh tokens before long crawl runs. Some sites use CSRF tokens in forms—hakrawler won't solve them.

**Assuming completeness:** Hakrawler finds URLs present in crawled pages. It doesn't brute-force directories, fuzz parameters, or analyze authentication flows. Combine with directory brute-forcers (ffuf, gobuster) and parameter miners.

**Legal/scope violations:** Crawling is noisy and leaves logs. Ensure written authorization. Respect robots.txt in production assessments. Use `-timeout` and `-t` to reduce load.

## References

• https://github.com/hakluke/hakrawler
• https://github.com/Elsfa7-110/hakrawler
• https://www.youtube.com/watch?v=eSR-1e3vMto
• https://amrelsagaei.com/unveiling-hidden-urls-web-enumeration-with-hakrawler
• https://linuxcommandlibrary.com/man/hakrawler
• https://cybersecuritytome.com/unleashing-the-power-of-hakrawler-in-kali-linux-a-step-by-step-tutorial-for-beginners/
• https://starlog.is/articles/cybersecurity/hakluke-hakrawler
