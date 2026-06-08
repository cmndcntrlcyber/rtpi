---
name: Waybackurls
description: Fetch all historical URLs archived by the Wayback Machine for a
  given domain via stdin
registry: registry
tool_id: waybackurls
category: web-recon
tags:
  - osint
  - web-recon
  - reconnaissance
  - wayback-machine
  - url-discovery
  - attack-surface
mitre_techniques:
  - T1594
summary: waybackurls reads line-delimited domains from stdin and outputs all
  URLs the Wayback Machine has archived for each domain (including subdomains by
  default). Invoke as `cat domains.txt | /opt/tools/bin/waybackurls` or `echo
  "example.com" | /opt/tools/bin/waybackurls`. It queries archive.org's CDX API
  and prints one URL per line to stdout. Use during reconnaissance to discover
  forgotten endpoints, old API paths, hidden admin panels, deleted content,
  legacy directories, and historical parameters that may still be live or reveal
  sensitive information. The tool accepts `-dates` to prepend archive fetch
  dates and `-no-subs` to exclude subdomains. Output is plain text suitable for
  piping into grep, sort, filters, or vulnerability scanners. Expect large
  result sets; use grep/awk to narrow scope. Only returns results for domains
  previously crawled by archive.org; never-archived sites yield no output.
  Combine with httpx to verify liveness or gf/gau for targeted bug hunting. No
  API key required.
sources:
  - https://waybackurls.com/
  - https://github.com/tomnomnom/waybackurls
  - https://osintteam.blog/waybackurls-the-ultimate-tool-for-recon-in-bug-bounty-hunting-3465a1786162
  - https://medium.com/@cuncis/waybackurls-a-powerful-tool-for-cybersecurity-professionals-to-enhance-reconnaissance-and-identify-6a25031f4a1c
  - https://security.packt.com/using-waybackurls-to-find-flaws/
  - https://sourceforge.net/projects/waybackurls.mirror/
  - https://www.geeksforgeeks.org/linux-unix/waybackurls-fetch-all-the-urls-that-the-wayback-machine-knows-about-for-a-domain/
  - https://pkg.go.dev/github.com/tomnomnom/waybackurls
  - https://www.redfoxsec.com/blog/red-team-attack-methodology-a-complete-guide-to-adversarial-penetration-testing
  - https://securiumsolutions.com/subdomain-enumaration-using-waybackurls/
  - https://nhattruong.blog/2024/08/12/web-application-reconnaissance-process/
  - https://www.nmmapper.com/tool/waybackurls/wayback-machine/online/
generated_at: 2026-05-19T11:08:35.823Z
generated_by: anthropic
source_hash: 47ee30b323cc952cfc281370d810909f2d5d0052a6fdc365f01c7298030ee746
---

# Waybackurls

## Overview

waybackurls is a Go-based command-line tool that queries the Internet Archive's Wayback Machine to retrieve all historically archived URLs for a given domain. It accepts domains via stdin and outputs discovered URLs to stdout, making it trivial to integrate into pipelines. The tool is designed for speed and simplicity: no configuration files, no complex flags. It fetches URLs for the primary domain and all subdomains by default, surfacing endpoints that may no longer be publicly linked but still exist on servers.

## When to use

Use waybackurls during the reconnaissance phase to expand attack surface. It is effective for discovering old API endpoints, forgotten admin interfaces, legacy paths, deleted pages, historical query parameters, and backup files that may expose sensitive data or vulnerabilities. Ideal when target documentation is sparse or when hunting for hidden resources not found through active crawling. Particularly valuable in bug bounty programs to uncover endpoints missed by modern scanners. Combine results with tools like httpx (liveness checks), gf (vulnerability pattern matching), Burp Suite (spidering and testing), or Gobuster (directory fuzzing). Note: only effective if archive.org has previously crawled the target domain.

## Authentication & setup

No authentication, API keys, or credentials required. The tool queries the publicly accessible Wayback Machine CDX API. Installation in RTPI is already complete at /opt/tools/bin/waybackurls. Ensure Go binaries are in PATH if running manually; verify installation with `waybackurls -h`. The tool does not require network proxies or special permissions. It respects standard Go proxy and TLS environment variables. No rate limits are documented, but the Wayback Machine API may throttle or timeout on extremely large result sets.

## Key commands / parameters

waybackurls accepts domains on stdin and supports two flags:

• Default usage (all subdomains included):
  `echo "example.com" | waybackurls`
  `cat domains.txt | waybackurls`

• `-dates` flag: Prepend the archive fetch date (YYYYMMDDHHMMSS format) in the first column:
  `echo "example.com" | waybackurls -dates`

• `-no-subs` flag: Fetch URLs only for the exact domain, excluding subdomains:
  `echo "example.com" | waybackurls -no-subs`

Output is written to stdout, one URL per line. Pipe to a file with `> urls.txt` or `| tee urls.txt`. The tool processes one domain per line; feed multiple domains via `cat` or `echo` loops. No other flags are supported. The `-h` flag displays help.

## Example workflows

**Basic single-domain scan:**
`echo "target.com" | /opt/tools/bin/waybackurls > wayback_urls.txt`

**Multi-domain batch processing:**
`cat subdomains.txt | /opt/tools/bin/waybackurls | tee all_urls.txt`

**Exclude subdomains:**
`echo "target.com" | /opt/tools/bin/waybackurls -no-subs > main_domain_only.txt`

**Filter for specific file types (e.g., JS files for analysis):**
`cat domains.txt | waybackurls | grep -E '\.js(\?|$)' > js_files.txt`

**Check URL liveness with httpx:**
`cat domains.txt | waybackurls | httpx -silent > live_urls.txt`

**Hunt for XSS-prone parameters using gf:**
`cat domains.txt | waybackurls | gf xss > xss_candidates.txt`

**Combine with other recon tools:**
`subfinder -d target.com | httpx -silent | waybackurls | sort -u | tee final_urls.txt`

**Search for admin panels:**
`echo "target.com" | waybackurls | grep -iE 'admin|login|dashboard' > admin_paths.txt`

## Output format

Output is plain text, one URL per line, printed to stdout. URLs are unsorted and may contain duplicates across runs. Format:

`https://example.com/path/to/resource?param=value`

With `-dates` flag:

`20190315120000 https://example.com/old/page.html`

First column is timestamp (YYYYMMDDHHMMSS), space-separated from the URL. No headers, no JSON, no metadata beyond the optional date. The tool does not resolve redirects, validate URL syntax, or check liveness. URLs may include query strings, fragments, and encoded characters exactly as archived. Pipe output through `sort -u` to deduplicate or `awk`, `sed`, `grep` for filtering. Large domains can produce tens of thousands of URLs; expect multi-megabyte output files.

## Common pitfalls

• **No results returned:** The domain may never have been archived by archive.org. Check manually at web.archive.org before assuming tool failure.
• **Massive output volume:** Popular domains return thousands of URLs. Pipe to `head`, `grep`, or filter by file extension to manage volume.
• **Stale or dead URLs:** Many returned URLs will 404 or redirect. Use httpx or similar to verify liveness before further testing.
• **Subdomain flood:** Default behavior includes all subdomains. Use `-no-subs` if only the primary domain is in scope.
• **No deduplication:** Tool does not deduplicate; pipe through `sort -u` or `uniq` to remove duplicates.
• **Slow on large domains:** Querying archive.org can be slow for heavily-archived sites. Be patient or run in background.
• **False sense of coverage:** Wayback Machine does not archive every page or every version. Missing URLs does not mean they never existed.
• **Sensitive data in URLs:** Archived URLs may contain API keys, tokens, or PII in query parameters. Handle output carefully and do not commit to public repos.

## References

• https://github.com/tomnomnom/waybackurls
• https://waybackurls.com/
• https://osintteam.blog/waybackurls-the-ultimate-tool-for-recon-in-bug-bounty-hunting-3465a1786162
• https://security.packt.com/using-waybackurls-to-find-flaws/
• https://www.geeksforgeeks.org/linux-unix/waybackurls-fetch-all-the-urls-that-the-wayback-machine-knows-about-for-a-domain/
• https://medium.com/@cuncis/waybackurls-a-powerful-tool-for-cybersecurity-professionals-to-enhance-reconnaissance-and-identify-6a25031f4a1c
• https://www.nmmapper.com/tool/waybackurls/wayback-machine/online/
