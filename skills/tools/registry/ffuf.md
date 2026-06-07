---
name: Ffuf
description: Fast Go-based web fuzzer for directory, file, vhost, and parameter
  discovery with flexible matching and filtering
registry: registry
tool_id: ffuf
category: fuzzing
tags:
  - fuzzing
  - web
  - discovery
  - enumeration
  - brute-force
  - recon
  - http
mitre_techniques:
  - T1595.002
  - T1190
  - T1083
summary: "ffuf (Fuzz Faster U Fool) v2.1.0 is invoked as `/opt/tools/bin/ffuf`
  for high-speed web application fuzzing. Use it to discover hidden directories,
  files, subdomains, vhosts, parameters, and API endpoints. Core invocation
  requires `-u <URL>` with the keyword FUZZ as a placeholder and `-w <wordlist>`
  to supply test values. The tool is extremely fast (written in Go, default 40
  threads) and returns results matching HTTP status codes 200-299, 301, 302,
  307, 401, 403, 405, 500 by default. Critical flags: `-mc` (match status
  codes), `-fc` (filter codes), `-fs` (filter response size), `-fl` (filter
  lines), `-fw` (filter words), `-fr` (filter regex), `-H` (custom headers),
  `-X` (HTTP method), `-d` (POST data), `-b` (cookies), `-r` (follow redirects),
  `-recursion` (recursive scan), `-e` (file extensions), `-t` (threads), `-rate`
  (requests/sec), `-p` (delay seconds), `-timeout` (per-request timeout),
  `-maxtime` (total job time), `-maxtime-job` (per-wordlist-entry time), `-o`
  (output file), `-of` (json/html/csv/md), `-c` (color), `-v` (verbose), `-s`
  (silent), `-se` (stop on spurious errors), `-sf` (stop on 95% 403s), `-ac`
  (auto-calibrate filters), `-acc` (custom auto-calibrate). Multi-wordlist
  support via comma separation or multiple `-w` flags with keyword aliases
  (e.g., `-w users.txt:USER -w pass.txt:PASS`). Always filter noise aggressively
  using size/line/word filters after initial run. Common use: directory
  brute-force `ffuf -u http://target/FUZZ -w wordlist.txt -c`, vhost discovery
  `ffuf -u http://target -H 'Host: FUZZ.target.com' -w subdomains.txt -fs
  <default_size>`, parameter fuzzing `ffuf -u http://target?FUZZ=value -w
  params.txt`, POST data `ffuf -u http://target/login -X POST -H 'Content-Type:
  application/x-www-form-urlencoded' -d 'user=admin&pass=FUZZ' -w passwords.txt
  -fc 401`. Output is line-based showing URL, status, size, words, lines. JSON
  output recommended for parsing. Watch for rate limiting (use `-rate` or `-p`
  delay), WAF blocks (tune threads with `-t`, add delays), and false positives
  (calibrate filters with `-ac` or manual `-fs/-fl/-fw`). Tool does not
  auto-encode by default; use `-raw` flag awareness and consider URI encoding in
  wordlists."
sources:
  - https://c9lab.com/blog/fuzzing-web-applications-using-ffuf-the-complete-mastery-guide/
  - https://hackviser.com/tactics/tools/ffuf
  - https://github.com/ffuf/ffuf
  - https://medium.com/@learntheshell/guide-to-using-ffuf-74824770076b
  - https://security.packt.com/fuzzing-faster-with-ffuf/
  - https://www.kali.org/tools/ffuf/
  - https://hackercoolmagazine.com/beginners-guide-to-ffuf-tool/?srsltid=AfmBOoqqJScm_8UP0j8_F6r5SvKyPYvl3t-TtM8rrM3M7cLWtMOTDoHn
  - https://dl.packetstormsecurity.net/papers/general/ffuf.pdf
  - https://codingo.com/posts/2020-08-29-everything-you-need-to-know-about-ffuf/
  - https://netwerklabs.com/complete-guide-on-ffuf/
  - https://securiumsolutions.com/ffuf-a-guide-to-content-discovery-using-ffuf/
  - https://lorikeetsecurity.com/blog/ffuf-fuzz-faster-u-fool-cheat-sheet
generated_at: 2026-05-19T11:06:36.976Z
generated_by: anthropic
source_hash: d5fbaf05e3d42ec5ccff02eba14beea01a5f8df1ec80c38b4c81a34587760de9
---

# Ffuf

## Overview

ffuf (Fuzz Faster U Fool) is a high-performance web fuzzer written in Go, designed for discovering hidden web application assets through brute-force enumeration. It excels at directory and file discovery, subdomain and virtual host enumeration, parameter fuzzing, and API endpoint discovery. The tool operates by replacing a FUZZ keyword in URLs, headers, or POST data with entries from a wordlist, testing thousands of combinations rapidly. Default threading is 40 concurrent requests. It supports advanced filtering by HTTP status codes, response size, line count, word count, and regex patterns to eliminate noise. Version 2.1.0 is installed at `/opt/tools/bin/ffuf`.

## When to use

Use ffuf during reconnaissance and active enumeration phases to discover hidden attack surfaces on web applications. Ideal for finding undocumented directories, backup files, configuration files, API endpoints, admin panels, and development/staging resources. Deploy for subdomain enumeration when DNS brute-forcing, virtual host discovery on shared hosting, parameter name discovery for injection testing, and username/password brute-forcing via POST. Effective for bug bounty hunting, penetration testing content discovery, and CI/CD security scanning. Prefer ffuf over slower tools when speed and flexibility are critical, especially against large wordlists or when custom filtering logic is required.

## Authentication & setup

No authentication or configuration required. ffuf is a standalone binary at `/opt/tools/bin/ffuf`. Verify installation with `ffuf -V` to check version. For authenticated scans, supply session cookies via `-b 'NAME=VALUE'` flag or custom headers with `-H 'Authorization: Bearer TOKEN'`. For client certificate authentication, use `-cc <cert_path>` and `-ck <key_path>`. When testing through proxies, use `-x http://proxy:port`. Wordlists must be provided externally; common sources are SecLists (often at `/usr/share/seclists/` or `/usr/share/wordlists/`) or custom lists. No API keys or licenses needed.

## Key commands / parameters

**Required flags:** `-u <URL>` (target URL with FUZZ keyword placeholder), `-w <path>` (wordlist file path). **HTTP options:** `-X <METHOD>` (GET/POST/PUT/DELETE, default GET), `-H 'Header: Value'` (add custom headers, repeatable), `-b 'cookie=value'` (cookies), `-d 'data'` (POST body, use FUZZ within), `-r` (follow redirects), `-recursion` (recursive directory scan, URL must end in FUZZ), `-recursion-depth <n>` (max recursion levels). **Matchers:** `-mc <codes>` (match status codes, default 200-299,301,302,307,401,403,405,500), `-ml <n>` (match line count), `-mr <regex>` (match response regex), `-ms <n>` (match size), `-mw <n>` (match word count), `-mmode <and|or>` (matcher logic). **Filters:** `-fc <codes>` (filter status codes), `-fl <n>` (filter line count), `-fs <n>` (filter response size, critical for eliminating default pages), `-fw <n>` (filter word count), `-fr <regex>` (filter regex). **Performance:** `-t <n>` (threads, default 40), `-rate <n>` (max requests/sec), `-p <seconds>` (delay between requests), `-timeout <n>` (request timeout seconds, default 10), `-maxtime <n>` (total scan duration seconds), `-maxtime-job <n>` (max time per wordlist entry). **Output:** `-o <file>` (output file), `-of <format>` (json/html/csv/md/ejson/ecsv/all), `-or` (don't create output if no results), `-c` (colored output), `-v` (verbose, show full URL and redirects), `-s` (silent mode, minimal output). **Extensions:** `-e <.ext1,.ext2>` (append extensions to FUZZ keyword). **Auto-calibration:** `-ac` (auto-calibrate filters based on baseline requests), `-acc` (custom auto-calibrate with filters). **Safety:** `-se` (stop on spurious errors: 95% 403 in last 50 or 20% 429), `-sf` (stop when >95% responses are 403). **Advanced:** `-ignore-body` (don't fetch response body), `-http2` (use HTTP/2), `-raw` (don't encode URI), multiple wordlists with `-w list1.txt:KEYWORD1 -w list2.txt:KEYWORD2`.

## Example workflows

**Directory discovery:** `ffuf -u http://target.com/FUZZ -w /usr/share/seclists/Discovery/Web-Content/common.txt -c -v` then refine with `-fs <size>` to filter default 404 pages. **Recursive scan:** `ffuf -u http://target.com/FUZZ -w wordlist.txt -recursion -recursion-depth 2 -e .php,.html -c`. **Vhost discovery:** `ffuf -u http://target.com -H 'Host: FUZZ.target.com' -w subdomains.txt -fs 4242` (filter default vhost response size). **Subdomain enumeration:** `ffuf -u http://FUZZ.target.com -w dns-subdomains.txt -mc 200,301,302 -t 100`. **Parameter fuzzing (GET):** `ffuf -u http://target.com/search?FUZZ=test -w params.txt -fw 54` (filter by word count). **Parameter value fuzzing:** `ffuf -u http://target.com/api?id=FUZZ -w numbers.txt -mc 200 -fs 15`. **POST login brute-force:** `ffuf -u http://target.com/login -X POST -H 'Content-Type: application/x-www-form-urlencoded' -d 'username=admin&password=FUZZ' -w passwords.txt -fc 401 -fs 1435`. **JSON API fuzzing:** `ffuf -u http://api.target.com/users -X POST -H 'Content-Type: application/json' -d '{"name": "FUZZ"}' -w names.txt -fr 'error' -mc 200`. **Multi-parameter fuzzing:** `ffuf -w users.txt:USER -w passes.txt:PASS -u http://target.com/login -X POST -d 'user=USER&pass=PASS' -H 'Content-Type: application/x-www-form-urlencoded' -fc 302`. **Auto-calibrate and scan:** `ffuf -u http://target.com/FUZZ -w wordlist.txt -ac -c`. **Rate-limited scan:** `ffuf -u http://target.com/FUZZ -w big-wordlist.txt -rate 50 -t 10`. **Output to JSON:** `ffuf -u http://target.com/FUZZ -w wordlist.txt -o results.json -of json`.

## Output format

Default output is human-readable colored text showing: URL tested, HTTP status code, response size (bytes), word count, line count, and redirect location (if `-r` used). Each match prints one line. Progress bar shows completion percentage and requests/sec. With `-v` verbose flag, full tested URLs are shown. Silent mode `-s` suppresses progress and only shows matches. JSON output (`-of json`) produces structured data with fields: input (fuzz value), position (keyword), status, length, words, lines, content-type, redirectlocation, url, resultfile (if `-od` used), host, duration (ms). HTML output generates browsable report. CSV/ECSV provide spreadsheet-compatible format. Use `-o <file> -of json` for machine parsing. Exit codes: 0 on success, non-zero on critical errors. No matches produce empty output (suppress file creation with `-or` flag).

## Common pitfalls

**Not filtering noise:** Initial runs often return hundreds of false positives (default error pages, redirects). Always analyze first results and add `-fs`, `-fl`, or `-fw` filters to eliminate common response sizes. Use `-ac` for automatic baseline calibration. **WAF/rate limiting:** Aggressive default threading (40) triggers WAFs and rate limits. Reduce with `-t 10` or lower, add `-p 0.1` delay, or use `-rate` cap. Monitor for 429/403 response spikes; use `-se` to auto-stop. **Incorrect FUZZ placement:** Forgetting to include FUZZ keyword in `-u` URL, headers, or POST data results in no fuzzing. Ensure FUZZ appears where testing is intended. **Content-Type omission:** POST requests need explicit `-H 'Content-Type: application/x-www-form-urlencoded'` or `application/json`; ffuf doesn't auto-set this unlike curl. **Ignoring redirects:** Default behavior doesn't follow redirects; use `-r` if testing requires following 30x responses. **Recursion without limits:** `-recursion` without `-recursion-depth` can run indefinitely on deep directory structures. Always set depth limit. **Large wordlists without timeout:** Massive wordlists can run for hours; use `-maxtime` to cap total duration or `-maxtime-job` per entry. **Certificate errors:** HTTPS targets with invalid certs may fail silently; check for connection errors in output. **Wordlist encoding issues:** Non-UTF8 or improperly encoded wordlists cause skipped entries; validate wordlist format. **False negatives from response variance:** Dynamic content causes size/word variations; regex matching with `-mr` is more reliable than size-based filters for some targets.

## References

• https://github.com/ffuf/ffuf
• https://codingo.com/posts/2020-08-29-everything-you-need-to-know-about-ffuf/
• https://c9lab.com/blog/fuzzing-web-applications-using-ffuf-the-complete-mastery-guide/
• https://hackviser.com/tactics/tools/ffuf
• https://www.kali.org/tools/ffuf/
• https://medium.com/@learntheshell/guide-to-using-ffuf-74824770076b
• https://security.packt.com/fuzzing-faster-with-ffuf/
• https://dl.packetstormsecurity.net/papers/general/ffuf.pdf
• https://netwerklabs.com/complete-guide-on-ffuf/
• https://lorikeetsecurity.com/blog/ffuf-fuzz-faster-u-fool-cheat-sheet
