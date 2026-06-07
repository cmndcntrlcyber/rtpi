---
name: Gau
description: Passive URL fetcher aggregating historical URLs from Wayback
  Machine, Common Crawl, AlienVault OTX, and URLScan for domain recon.
registry: registry
tool_id: gau
category: web-recon
tags:
  - web-recon
  - osint
  - passive-recon
  - url-enumeration
  - attack-surface
  - wayback
  - archive-search
mitre_techniques:
  - T1595.002
summary: "Invoke `/opt/tools/bin/gau <domain>` to passively enumerate historical
  URLs from archive sources (Wayback, Common Crawl, OTX, URLScan). Reads domains
  from stdin or args. Use `-subs` for subdomain inclusion, `--blacklist` to skip
  binary extensions (png,jpg,woff), `--o` for file output, `--providers` to
  select sources. Date filters: `--from YYYYMM --to YYYYMM`. Outputs one URL per
  line. Pipe to `httpx` for live validation, `grep` for filtering (APIs, params,
  JS), `anew` for deduplication. Excels on mature targets with years of archived
  data; ineffective on brand-new sites. Does NOT validate URLs are live—many
  will 404. Combine with active crawling (katana/gospider) for JS-heavy modern
  apps. No auth required; respects source rate limits. Fast, high-volume
  output—expect thousands of URLs. Critical for discovering forgotten endpoints,
  leaked params, old admin panels, and historical API paths. Filter by status
  with `--fc`/`--mc` or MIME with `--ft`/`--mt` if needed. Use `--fp` to
  deduplicate parameter variations. Stealth-friendly: zero direct target
  interaction."
sources:
  - https://www.rrc.texas.gov/media/boffpp1c/gau_users_guide.pdf
  - https://pkg.go.dev/github.com/lc/gau
  - https://github.com/lc/gau
  - https://secnhack.in/gau-getallurls-find-known-and-hidden-url/
  - https://medium.com/@felixmelvinchitechi/gau-for-recon-91f8b331293d
  - https://linuxcommandlibrary.com/man/gau
  - http://www.catb.org/~esr/writings/taoup/html/ch10s05.html
  - https://www.cycognito.com/learn/red-teaming/red-teaming-vs-pentesting/
  - https://www.nuharborsecurity.com/blog/red-teaming-vs-penetration-testing
  - https://www.synack.com/knowledge-base/red-teaming-vs-penetration-testing-understanding-the-differences/
  - https://www.offsec.com/blog/red-teaming-vs-pentesting/
  - https://www.ibm.com/think/topics/red-teaming
generated_at: 2026-05-19T11:18:04.628Z
generated_by: anthropic
source_hash: 273db72ad7e363feb8a5616b1ce1071f932cc8a3686341b0ebe602aa54d6600a
---

# Gau

## Overview

gau (Get All URLs) v2.2.4 is a passive reconnaissance tool that aggregates historical and archived URLs for a given domain from multiple OSINT sources: Wayback Machine, Common Crawl, AlienVault OTX, and URLScan. It outputs discovered URLs line-by-line to stdout or file, enabling security researchers to map historical attack surface, find forgotten endpoints, leaked parameters, old admin interfaces, API paths, and sensitive files without directly interacting with the target. Inspired by waybackurls but with broader source coverage.

## When to use

Deploy gau during initial passive reconnaissance phases when you need comprehensive URL enumeration without alerting the target. Ideal for mature domains with years of web presence and rich archive history. Use before active crawling to build a baseline URL corpus. Effective for discovering: deprecated API endpoints, old admin panels, backup files, config leaks, historical parameters for fuzzing, hidden subdomains (with `--subs`), and previously exposed sensitive paths. Do NOT rely solely on gau for brand-new sites (no archive data), JS-heavy SPAs (requires active crawling), or when you need current live endpoints (combine with httpx validation). Works in air-gapped workflows—no target contact required.

## Authentication & setup

No authentication or API keys required. gau is pre-installed at `/opt/tools/bin/gau` in RTPI. No configuration file needed for basic use. Optional: create `~/.gau.toml` or `%USERPROFILE%\.gau.toml` for custom defaults and specify with `--config <path>`. Requires internet access to query archive APIs (Wayback, Common Crawl, OTX, URLScan). Respects source rate limits—use `--retries` (default varies) and `--timeout` (seconds) to handle transient failures. Set `--proxy` for SOCKS5/HTTP proxy routing if operating through infrastructure: `--proxy socks5://127.0.0.1:9050` or `--proxy http://proxy:8080`. Use `--threads <N>` to control worker concurrency (default optimized per source).

## Key commands / parameters

**Basic invocation:** `gau <domain>` or `cat domains.txt | gau` or `printf "example.com\n" | gau`

**Essential flags:**
- `--subs` : Include subdomains in search (expands scope significantly)
- `--o <file>` : Write output to file instead of stdout
- `--providers <list>` : Comma-separated sources: wayback,commoncrawl,otx,urlscan (default: all)
- `--blacklist <exts>` : Skip extensions, e.g., `--blacklist png,jpg,gif,woff,ttf,svg,pdf`
- `--from YYYYMM --to YYYYMM` : Date range filter (e.g., `--from 202001 --to 202312`)
- `--fc <codes>` : Filter out HTTP status codes (e.g., `--fc 404,302`)
- `--mc <codes>` : Match only these status codes (e.g., `--mc 200,500`)
- `--ft <types>` : Filter out MIME types (e.g., `--ft image/png`)
- `--mt <types>` : Match only these MIME types (e.g., `--mt text/html,application/json`)
- `--fp` : Remove duplicate endpoints with different parameters (dedup params)
- `--json` : Output as JSON objects instead of plain text
- `--verbose` : Show errors and debug info
- `--retries <N>` : HTTP client retry attempts
- `--timeout <sec>` : HTTP timeout in seconds
- `--proxy <url>` : Route through proxy (socks5:// or http://)
- `--threads <N>` : Worker thread count
- `--version` : Display version

## Example workflows

**1. Basic domain enumeration:**
`gau example.com`

**2. Include subdomains, save to file:**
`gau --subs example.com --o urls.txt`

**3. Skip binary assets, filter by provider:**
`gau --blacklist png,jpg,gif,woff,ttf,css --providers wayback,commoncrawl target.com`

**4. Time-bound search (2021-2023):**
`gau --from 202101 --to 202312 example.com`

**5. Multi-domain from file:**
`cat domains.txt | gau --subs | tee all_urls.txt`

**6. Hunt for parameters (feed to fuzzer):**
`gau example.com | grep "=" | qsreplace "FUZZ" > params.txt`

**7. Find interesting files:**
`gau target.com | grep -E "\.js$|/api/|/admin|/config|backup|\.env|\.git" | tee juicy.txt`

**8. Validate live URLs:**
`gau example.com | httpx -silent -mc 200,403,401 -cl | tee live.txt`

**9. Deduplicate across runs:**
`gau example.com | anew urls.txt`

**10. Pipe to XSS scanner:**
`gau example.com | grep "=" | dalfox pipe`

**11. JSON output for parsing:**
`gau --json --mc 200 example.com | jq -r '.url'`

**12. Proxy through Tor:**
`gau --proxy socks5://127.0.0.1:9050 target.com`

## Output format

Default: plain text, one URL per line (newline-delimited). URLs include full scheme, domain, path, and query strings. Example:
```
https://example.com/api/v1/users
https://example.com/admin/login.php?redirect=/dashboard
https://sub.example.com/old/backup.zip
```

With `--json`: one JSON object per line (JSONL/ndjson):
```json
{"url":"https://example.com/path","status":200,"content_type":"text/html"}
```

Output volume: expect hundreds to tens of thousands of URLs for mature domains. Many URLs will be dead/404—historical archives include removed content. No deduplication by default (same URL may appear from multiple sources). Use `sort -u` or `anew` for dedup. No metadata unless `--json` is used. Verbose mode (`--verbose`) shows per-provider errors to stderr. Exit code 0 on success; errors printed to stderr if `--verbose` enabled.

## Common pitfalls

**1. Output overload:** Mature domains yield 10k–100k+ URLs. Pipe through `head -n 1000` for testing or use `--blacklist` aggressively.

**2. Dead URLs:** Archives contain historical data—most URLs may 404. Always validate with `httpx`, `httprobe`, or `curl` before exploitation.

**3. No recursion:** gau does NOT crawl links—it only queries archives. Combine with `katana`, `gospider`, or `hakrawler` for live crawling.

**4. JS-heavy sites underrepresented:** Modern SPAs with client-side routing may have sparse archive coverage. Use active JS-aware crawlers.

**5. Rate limiting:** Archive APIs have rate limits. If you hit them, `--retries` and `--timeout` help, but spreading requests over time or using `--proxy` rotation may be needed.

**6. Subdomain explosion with `--subs`:** Can return massive result sets. Filter early with `grep`, `--blacklist`, or `--fc`.

**7. Forgotten filtering:** Binary files (images, fonts, videos) bloat output. Always use `--blacklist png,jpg,gif,woff,woff2,ttf,svg,ico,mp4,pdf` unless specifically needed.

**8. Ignoring date filters:** For targeted recon (e.g., post-migration analysis), use `--from`/`--to` to narrow timeframes.

**9. No live validation:** Feeding raw gau output to exploit tools wastes time on 404s. Insert `httpx -mc 200,403,401,500` in your pipeline.

**10. Duplicate params:** Without `--fp`, you'll see `/api/user?id=1`, `/api/user?id=2`, etc. Use `--fp` or `uro`/`qsreplace` for deduplication.

**11. Missing context:** gau shows URLs but not page content. Pair with `waybackpack` or manual Wayback browsing for context on sensitive findings.

## References

- https://github.com/lc/gau
- https://pkg.go.dev/github.com/lc/gau
- https://secnhack.in/gau-getallurls-find-known-and-hidden-url/
- https://medium.com/@felixmelvinchitechi/gau-for-recon-91f8b331293d
- https://linuxcommandlibrary.com/man/gau
