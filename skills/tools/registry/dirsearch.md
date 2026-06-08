---
name: Dirsearch
description: Web path scanner that brute-forces directories and files on HTTP
  servers using wordlists; Python-based, multi-threaded.
registry: registry
tool_id: dirsearch
category: fuzzing
tags:
  - fuzzing
  - web-recon
  - directory-enumeration
  - http
  - brute-force
  - content-discovery
  - web-application
mitre_techniques:
  - T1595.002
summary: "Dirsearch is a multi-threaded web path discovery tool for
  brute-forcing directories and files on web servers. Invoke via `python3
  dirsearch.py` or `/usr/local/bin/dirsearch` (standalone binary). Minimum
  required flag is `-u <URL>` or `-l <file>` for URL list input. Use `-e` to
  specify file extensions (e.g., php,html,js). Exclude unwanted status codes
  with `-x 404` or whitelist with `-i 200,500`. Enable recursion with `-r` and
  control depth with `-R <depth>`. Crawl mode (`--crawl`) extracts paths from
  HTML responses. Increase threads with `-t <count>`, add delays with `-s
  <seconds>`. Supports custom wordlists via `-w`, authentication with
  `--auth-type` and `--auth`, custom headers via `-H`, cookies with `--cookie`,
  proxies via `--proxy`. Output can be saved in multiple formats (plain, JSON,
  CSV, Markdown, XML). Use `--full-url` for complete URLs in output, `-q` for
  quiet mode. Pausing with CTRL+C allows saving progress or skipping targets.
  Default wordlist is built-in; custom lists improve coverage. Recursive scans
  generate high request volumes and may trigger WAFs. Expect verbose output by
  default; filter with exclude flags. Common pitfall: recursive+crawl modes can
  run indefinitely without depth limits. Session files enable resumption.
  Configuration via `config.ini` or `--config` flag."
sources:
  - https://ptplaybook.mfbktech.academy/tools/dirsearch
  - https://www.blackhillsinfosec.com/how-to-use-dirsearch/
  - https://www.briskinfosec.com/tooloftheday/toolofthedaydetail/DIRSEARCH
  - https://dirsearch.org/
  - https://github.com/maurosoria/dirsearch
  - https://manpages.debian.org/bookworm/dirsearch/dirsearch.1.en.html
  - https://www.kali.org/tools/dirsearch/
  - https://manpages.ubuntu.com/manpages/jammy/man1/dirsearch.1.html
  - https://www.cycognito.com/learn/penetration-testing/
  - https://www.picussecurity.com/resource/glossary/what-are-red-team-tools
  - https://www.geeksforgeeks.org/linux-unix/dirsearch-go-implementation-of-dirsearch/
  - https://www.sciencedirect.com/science/article/abs/pii/S0167404822002073
generated_at: 2026-05-19T11:12:17.981Z
generated_by: anthropic
source_hash: e9bf25473e6e7160a55640072d360380a412a05c99f934014b9160fe0298afe2
---

# Dirsearch

## Overview

Dirsearch (v0.4.3) is a Python-based web path scanner for discovering hidden directories and files on web servers through brute-force enumeration. It operates by reading wordlists, optionally transforming entries (prefixes, suffixes, extension replacement), issuing HTTP requests, and reporting results based on status codes and response characteristics. Supports multi-threading, recursive scanning, HTML crawling for path extraction, session persistence, and extensive customization for headers, authentication, and output formats. Available as Python script or standalone binary.

## When to use

Use during web application reconnaissance (MITRE T1595.002) to discover unlinked content, backup files, administrative interfaces, configuration files, or sensitive directories. Ideal after initial host enumeration when you need to map web server structure. Deploy when testing for information disclosure via directory listings, exposed APIs, or forgotten files. Effective against poorly configured servers, legacy applications, or when default installations leave predictable paths. Use recursive mode to follow discovered directories deeper. Combine with crawling to extract paths from HTML/JS. Suitable for both authenticated and unauthenticated testing.

## Authentication & setup

No authentication required for the tool itself. For target authentication, use `--auth-type` (basic, digest, bearer, ntlm) with `--auth user:pass` or `--auth token`. Add session cookies via `--cookie` flag. Custom headers (e.g., Authorization, API keys) via `-H 'Header: Value'` (supports multiple `-H` flags) or `--header-list <file>`. Proxy support with `--proxy http://localhost:8080` or `socks5://host:port`; list of proxies via `--proxy-list <file>`. User-agent randomization via `--random-agent` or set custom with `--user-agent`. Connection tuning: `--timeout <seconds>` for request timeout, `-s <seconds>` for inter-request delay (rate limiting). Configuration file via `--config <path>` or default `config.ini`. Follow redirects with `-F/--follow-redirects`.

## Key commands / parameters

**Mandatory**: `-u <URL>` (single target), `-l <file>` (URL list file), or `--stdin` (read from STDIN). **Extensions**: `-e php,html,js` (comma-separated). **Wordlist**: `-w <path>` (custom wordlist; default built-in used otherwise). **Filtering**: `-x 404,403` (exclude status codes), `-i 200,301` (include only these codes). **Recursion**: `-r` (enable), `-R <depth>` (max depth), `--deep-recursive` (scan every depth level), `--force-recursive` (recurse all found paths). **Crawling**: `--crawl` (extract paths from HTML). **Threads**: `-t <count>` (default varies). **Output**: `--format plain,json,csv,md,xml` with `-o <file>`. **Quiet**: `-q` (minimal output), `--full-url` (show complete URLs). **Extension handling**: `-f` (force append extensions), `-O` (overwrite existing extensions), `--remove-extensions` (strip extensions). **Transformations**: `--prefixes <list>`, `--suffixes <list>`, `-U/-L/-C` (case transforms). **Session**: `-s <file>` (save/resume). **Pause**: CTRL+C to pause, save, skip target, or skip subdirectory.

## Example workflows

**Basic discovery**: `python3 dirsearch.py -u https://target.com -e php,html,js -x 404` – Scan with common extensions, hide 404s. **Custom wordlist**: `dirsearch -u https://target.com -w /usr/share/wordlists/dirb/common.txt -e php -x 404,403` – Use specific wordlist. **Recursive scan**: `dirsearch -u https://target.com -e php -r -R 3 -x 404` – Recurse max 3 levels deep. **Crawl + recurse**: `dirsearch -u https://target.com --crawl -r -x 404 -t 50` – Extract paths from HTML and recurse with 50 threads. **Authenticated scan**: `dirsearch -u https://target.com -H 'Authorization: Bearer TOKEN123' -e php` – Add auth header. **Rate-limited scan**: `dirsearch -u https://target.com -e php -s 0.5 -t 10` – 10 threads, 0.5s delay. **Multiple targets**: `dirsearch -l urls.txt -e php,asp -x 404 -o results.json --format json` – Scan URL list, output JSON. **Resume session**: `dirsearch --session scan_state.txt` – Continue paused scan.

## Output format

Default output is terminal-based, line-by-line reporting: `[STATUS] [SIZE] <PATH>`. Example: `200   1234   /admin/`. Status codes are color-coded by default (disable with `--no-color`). Use `--full-url` to show complete URLs instead of paths. Quiet mode (`-q`) shows only discovered paths. Save results with `-o <file> --format <type>`: **plain** (simple list), **json** (structured data), **csv** (spreadsheet-ready), **markdown** (readable tables), **xml** (structured), **simple** (minimal). Multiple formats can be specified comma-separated. Output includes timestamp, target URL, wordlist used, extensions, and discovered paths with status, size, and redirect location if applicable. Use `--min <bytes>` and `--max <bytes>` to filter by response size.

## Common pitfalls

**Recursive loops**: Combining `-r --crawl --force-recursive` without `-R` depth limit can cause indefinite scanning and massive request volumes. Always set `--max-recursion-depth`. **Rate limiting/blocking**: Aggressive thread counts (`-t`) without delays (`-s`) trigger WAF blocks or IP bans; start conservatively (10-20 threads). **False positives**: Servers returning 200 for all requests require custom exclude rules; use `--exclude-sizes` or `--exclude-texts` to filter. **Noisy scans**: Default verbosity floods output; use `-x 404,403,500` and `-q` for cleaner results. **Extension misuse**: Forgetting `-e` means no extension testing; `-f` vs `-O` behavior differs (append vs replace). **Wordlist choice**: Built-in wordlist is minimal; use quality lists (SecLists) for better coverage. **Session file format**: Legacy `.pickle/.pkl` sessions unsupported in recent versions; use current session format. **Redirect following**: Without `-F`, 30x responses are reported but not followed, missing content. **Output overwrite**: Default appends; ensure unique output filenames or clear old results.

## References

• https://ptplaybook.mfbktech.academy/tools/dirsearch
• https://www.blackhillsinfosec.com/how-to-use-dirsearch/
• https://github.com/maurosoria/dirsearch
• https://manpages.debian.org/bookworm/dirsearch/dirsearch.1.en.html
• https://www.kali.org/tools/dirsearch/
• https://dirsearch.org/
• https://manpages.ubuntu.com/manpages/jammy/man1/dirsearch.1.html
• https://www.geeksforgeeks.org/linux-unix/dirsearch-go-implementation-of-dirsearch/
