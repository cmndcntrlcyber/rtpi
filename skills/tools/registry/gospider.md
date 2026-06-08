---
name: Gospider
description: Fast parallel web crawler written in Go that extracts URLs,
  JavaScript sources, and subdomains from target sites and 3rd-party archives.
registry: registry
tool_id: gospider
category: web-recon
tags:
  - web-recon
  - crawling
  - url-extraction
  - subdomain-enumeration
  - osint
  - reconnaissance
  - golang
mitre_techniques:
  - T1595.002
summary: "Gospider is a high-speed concurrent web crawler for reconnaissance.
  Use it to map attack surface by extracting all URLs, JavaScript files, and
  forms from a target domain. Invoke with `-s` for single sites or `-S` for site
  lists; set concurrency with `-c` (bots per site) and depth with `-d`. Add
  `--other-source` to query Archive.org, CommonCrawl, VirusTotal, and AlienVault
  for historical URLs. Use `--include-subs` to expand scope to subdomains.
  Output is written to `-o <folder>` as text files named by domain. Default
  blacklist blocks common static assets (jpg, css, woff, etc.); override with
  `--blacklist`. Expect noisy output; pipe through grep or use `-q` for quiet
  mode. Gospider respects robots.txt and extracts links from JavaScript, making
  it effective for modern SPAs. No authentication required for basic crawling;
  use `--cookie` or `--burp` for authenticated scans. Typical workflow: run
  shallow crawl (`-d 1`) with high concurrency (`-c 20`) to enumerate endpoints
  quickly, then filter results for interesting patterns (API endpoints, admin
  panels, parameters). Does not exploit vulnerabilities—strictly passive URL
  collection."
sources:
  - https://brightdata.com/blog/web-data/web-crawling-with-gospider
  - https://github.com/jaeles-project/gospider
  - https://security.packt.com/gospider-the-fast-web-spider/
  - https://www.geeksforgeeks.org/linux-unix/gospider-fast-web-spider-written-in-go/
  - https://pkg.go.dev/github.com/XMA-Lab/gospider
  - https://aider.chat/docs/config/options.html
  - https://crawler.docs.browsertrix.com/user-guide/cli-options/
  - https://scrapy.readthedocs.io/en/latest/topics/commands.html
  - https://developers.openai.com/codex/cli/reference
  - https://cybersectools.com/compare/bloodhound-vs-gospider
  - https://www.cycognito.com/learn/red-teaming/red-teaming-vs-pentesting/
  - https://www.synack.com/knowledge-base/red-teaming-vs-penetration-testing-understanding-the-differences/
generated_at: 2026-05-19T11:23:49.622Z
generated_by: anthropic
source_hash: f1d1e75cc1b76d63885e68bd785875b70883b336f290d8cf1195f0150854ed06
---

# Gospider

## Overview

Gospider v1.1.6 is a Go-based web spider optimized for parallel crawling of multiple domains. It extracts URLs from HTML, JavaScript files, and respects robots.txt. Built by @thebl4ckturtle and @j3ssiejjj as part of the Osmedeus engine. Key strengths: Go concurrency handles thousands of requests simultaneously, JavaScript parsing finds dynamic endpoints missed by traditional crawlers, and 3rd-party source integration (Archive.org, CommonCrawl, VirusTotal, AlienVault) surfaces historical URLs without active scanning. Default behavior blacklists static assets (images, fonts, CSS) to focus on functional endpoints.

## When to use

Use Gospider during initial reconnaissance to enumerate all accessible URLs on a target. Ideal for mapping attack surface before deeper testing, discovering forgotten subdomains via `--include-subs`, finding API endpoints embedded in JavaScript, and building wordlists for fuzzing. Particularly effective against JavaScript-heavy SPAs where links are dynamically generated. Use 3rd-party sources (`--other-source`) when the target has rate limiting or WAF, or to find historical endpoints that may still be exploitable. Prefer Gospider over Python-based crawlers (Scrapy, HTTrack) when speed matters—Go concurrency outperforms on large target lists. Not suitable for authenticated multi-step workflows or crawling requiring complex session handling; use Burp Suite crawler for those cases.

## Authentication & setup

No authentication required for basic operation. Binary located at `/opt/tools/bin/gospider`. For authenticated crawling, pass session cookies with `--cookie "session=abc123; token=xyz"` or load from Burp request file using `--burp <file>`. Custom headers via `-H` flag (repeatable): `-H "Authorization: Bearer token" -H "X-Custom: value"`. Proxy support with `-p` flag for routing through Burp or other intercepting proxy: `-p http://127.0.0.1:8080`. User-agent randomization: `-u web` (default, random desktop UA) or `-u mobi` (random mobile UA) or `-u "Custom Agent String"`. No API keys needed for basic crawling; 3rd-party sources may have rate limits but tool handles this internally.

## Key commands / parameters

**Single site:** `-s <URL>` specifies target. **Site list:** `-S <file>` crawls multiple targets from newline-delimited file. **Output:** `-o <folder>` creates directory with results; one text file per domain. **Concurrency:** `-c <num>` sets concurrent bots per site (default 20; use 10 for stability). **Depth:** `-d <num>` sets crawl depth (1=direct links only, 2=links from those pages, etc.). **Thread limit:** `-t <num>` crawls N sites simultaneously from site list. **3rd-party sources:** `--other-source` queries Archive.org, CommonCrawl, VirusTotal, AlienVault. **Subdomains:** `--include-subs` expands scope to all subdomains. **Filtering:** `--blacklist "regex"` excludes URLs matching pattern; `--whitelist "regex"` includes only matches; `--whitelist-domain <domain>` restricts to specific domain. **Length filter:** `-L <range>` filters responses by size. **Quiet mode:** `-q` suppresses verbose output. **Cookies/headers:** `--cookie "key=val; key2=val2"` or `-H "Header: value"` (repeatable) or `--burp <file>`. Example: `gospider -s https://target.com -o output -c 10 -d 2 --other-source --include-subs -q`

## Example workflows

**Quick surface enumeration:** `gospider -s https://target.com -o recon -c 20 -d 1 -q` (shallow crawl, high concurrency, quiet). **Authenticated crawl:** `gospider -s https://app.target.com -o auth_crawl -c 10 -d 2 --cookie "session=<token>" --blacklist "logout"` (avoid logout endpoints). **Multi-target recon:** Create `targets.txt` with one URL per line, then `gospider -S targets.txt -o batch -c 10 -d 1 -t 5` (crawl 5 sites concurrently, 10 bots each). **Historical URL discovery:** `gospider -s https://target.com -o archives -c 5 -d 1 --other-source` (query 3rd-party sources; lower concurrency to respect rate limits). **Subdomain expansion:** `gospider -s https://target.com -o subs -c 10 -d 1 --other-source --include-subs` (find and crawl all subdomains). **API endpoint extraction:** Run crawl, then grep results: `cat output/target.com.txt | grep -E '\.(json|api|v[0-9])' | sort -u`. **Custom filtering:** `gospider -s https://target.com -o filtered -c 10 -d 1 --whitelist "admin|api|upload"` (focus on interesting paths). **Burp integration:** Save raw HTTP request from Burp to `req.txt`, then `gospider -s https://target.com -o burp_crawl -c 10 -d 1 --burp req.txt` (inherit headers/cookies).

## Output format

Output is written to the folder specified by `-o`. Each target domain gets a separate text file named `<domain>.txt`. Files contain one URL per line with metadata prefix. Format: `[code] [type] URL`. Example lines: `[200] [javascript] https://target.com/app.js`, `[href] https://target.com/admin`, `[form] https://target.com/login.php`. Response codes shown for fetched resources; `[href]` indicates extracted links not directly fetched. JavaScript files flagged as `[javascript]`. Forms tagged `[form]`. No structured JSON/XML output; raw text suitable for grep/awk pipelines. Default blacklist (jpg, jpeg, gif, css, tif, tiff, png, ttf, woff, woff2, ico) prevents these from appearing unless overridden. Use shell tools to filter: `grep -v '\[javascript\]'` to exclude JS files, `grep '\[200\]'` for only successful fetches, `cut -d' ' -f3-` to extract URLs only.

## Common pitfalls

**Noisy output:** Default verbosity prints every request. Always use `-q` for operational use or redirect stderr: `gospider ... 2>/dev/null`. **Depth misconfiguration:** `-d 5` on large sites can run for hours and generate GB of data. Start with `-d 1`, increase cautiously. **Concurrency overload:** `-c 50` may trigger rate limiting or WAF blocks; 10-20 is safer default. **Blacklist confusion:** Default blacklist is active unless you override with `--blacklist`. To disable entirely, use `--blacklist "^$"` (matches nothing). **3rd-party source delays:** `--other-source` adds significant runtime (querying 4 external APIs); expect 5-10x slower crawls. **Subdomain scope creep:** `--include-subs` can expand scope dramatically; review `targets.txt` first or risk scanning out-of-scope assets. **No session management:** Gospider does not handle CSRF tokens or multi-step login flows; pre-authenticate and extract cookies manually. **Output overwrites:** Running same command twice appends to existing files; clean `-o` directory between runs. **robots.txt compliance:** Gospider respects robots.txt by default; some targets may block crawlers entirely. No flag to disable (by design). **Regex anchoring:** `--blacklist` and `--whitelist` need proper regex: use `\.pdf$` not `.pdf` to avoid matching `/upload.pdf.php`.

## References

- https://brightdata.com/blog/web-data/web-crawling-with-gospider
- https://github.com/jaeles-project/gospider
- https://security.packt.com/gospider-the-fast-web-spider/
- https://www.geeksforgeeks.org/linux-unix/gospider-fast-web-spider-written-in-go/
- https://cybersectools.com/compare/bloodhound-vs-gospider
