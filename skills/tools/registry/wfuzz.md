---
name: Wfuzz
description: Web application fuzzer for brute-forcing URLs, parameters, headers,
  POST data, and cookies with wordlist-based payload injection.
registry: registry
tool_id: wfuzz
category: fuzzing
tags:
  - fuzzing
  - web
  - bruteforce
  - enumeration
  - directory-discovery
  - parameter-testing
  - http
mitre_techniques:
  - T1595.002
  - T1190
  - T1110
summary: "Wfuzz is a web application fuzzer that replaces the keyword FUZZ (or
  FUZnZ for multiple injection points) in HTTP requests with values from
  wordlists. Invoke with /usr/local/bin/wfuzz -w <wordlist> <URL_with_FUZZ>. Use
  for directory/file discovery, POST data fuzzing, header manipulation, cookie
  testing, and authentication brute-forcing. Always filter results using --hc
  (hide code), --hl (hide lines), --hw (hide words), or --hh (hide chars) to
  reduce noise—404s and default responses will dominate output otherwise.
  Supports multiple simultaneous fuzz points with -w list1.txt -w list2.txt. Use
  -d for POST data, -H for headers, -b for cookies, -X for HTTP methods, --basic
  for basic auth. Use -c for colored output, -v for verbose mode, -o for output
  format (json, html, csv), -f to save results. Expect tabular output: request
  ID, response code, line count (L), word count (W), character count (Ch), and
  matched value. Common wordlists: /usr/share/wfuzz/wordlist/ or custom lists.
  Response codes and size metrics are critical for identifying anomalies. Use
  --dry-run to test without sending requests. Filter with --ss (show string
  regex match). Concurrent connections controlled with -p. Baseline fuzzing with
  FUZZ{baseline_value} performs initial reference request."
sources:
  - https://hackviser.com/tactics/tools/wfuzz
  - https://medium.com/@cuncis/fuzzing-made-easy-how-to-use-wfuzz-for-efficient-web-application-testing-d843e5b089bf
  - https://www.kali.org/tools/wfuzz/
  - https://www.bootlesshacker.com/using-wfuzz/
  - https://www.techtarget.com/searchsecurity/feature/How-to-use-Wfuzz-to-find-web-application-vulnerabilities
  - https://owasp.org/www-project-web-security-testing-guide/latest/6-Appendix/C-Fuzzing
generated_at: 2026-05-19T11:11:31.712Z
generated_by: anthropic
source_hash: 9c05d94e486c52036dffb1d2ed048faa66c73b8cba54646e06f2a36d73b1fd17
---

# Wfuzz

## Overview

Wfuzz is a highly flexible web application fuzzer designed for brute-forcing web applications. It replaces placeholder keywords (FUZZ, FUZ2Z, etc.) in any part of an HTTP request—URLs, headers, POST data, cookies—with values from wordlists. Results include HTTP response codes, line/word/character counts, enabling identification of hidden resources, valid credentials, and application behavior differences.

## When to use

Use wfuzz when you need to discover hidden directories or files on web servers, enumerate valid parameters or endpoints, brute-force authentication credentials (basic auth, form-based, cookie values), test header injection points (User-Agent, X-Forwarded-For, custom headers), fuzz API endpoints or parameters, identify different application responses based on input, test for parameter pollution or injection points, and validate multiple attack surfaces simultaneously with multi-position fuzzing.

## Authentication & setup

Wfuzz is invoked at /usr/local/bin/wfuzz. No authentication or configuration files are required. Ensure wordlists are accessible; common paths include /usr/share/wfuzz/wordlist/, /usr/share/wordlists/dirb/, or custom lists. For authenticated fuzzing, use --basic user:FUZZ for basic auth, -H 'Authorization: Bearer FUZZ' for token-based auth, or -b 'session=FUZZ' for cookie-based sessions. Proxy support available with -p host:port flag.

## Key commands / parameters

**Required**: -w <wordlist> (payload source), <URL> (target with FUZZ keyword). **Filtering** (critical): --hc <codes> (hide HTTP codes, e.g., --hc 404,403), --hl <num> (hide by line count), --hw <num> (hide by word count), --hh <num> (hide by character count), --ss <regex> (show responses matching regex). **Request customization**: -d <data> (POST body, e.g., 'user=admin&pass=FUZZ'), -H <header> (custom header, e.g., 'User-Agent: FUZZ'), -b <cookie> (e.g., 'session=FUZZ'), -X <method> (HTTP method: PUT, DELETE, etc.), --basic <user:FUZZ> (basic auth). **Output**: -c (colorized), -v (verbose), -o <format> (json, html, csv, xml), -f <file,printer> (save results). **Performance**: -t <threads> (concurrent connections), -s <delay> (delay between requests), -L (follow redirects). **Multi-fuzzing**: use multiple -w flags and FUZ2Z, FUZ3Z, etc. **Baseline**: FUZZ{value} sets initial reference request. **Advanced**: -z <payload_type> (list, range, file), -e <encoder> (urlencode, hex), --recipe <file> (load saved config), --dry-run (test without sending).

## Example workflows

**Directory discovery**: wfuzz -c -w /usr/share/wordlists/dirb/common.txt --hc 404 http://target.com/FUZZ
**Subdomain enumeration**: wfuzz -c -w subdomains.txt -H 'Host: FUZZ.target.com' http://target.com/ --hc 404
**POST parameter fuzzing**: wfuzz -w passwords.txt -d 'username=admin&password=FUZZ' http://target.com/login --hc 200 (hide successful logins to find anomalies)
**Multi-position fuzzing**: wfuzz -w users.txt -w passes.txt -d 'user=FUZZ&pass=FUZ2Z' http://target.com/api/auth
**Header fuzzing**: wfuzz -w user-agents.txt -H 'User-Agent: FUZZ' http://target.com/ --hc 403
**Cookie brute-force**: wfuzz -w sessions.txt -b 'PHPSESSID=FUZZ' http://target.com/admin --hc 302
**API endpoint discovery**: wfuzz -w api-endpoints.txt http://target.com/api/FUZZ --hc 404,405
**Basic auth**: wfuzz -w passwords.txt --basic admin:FUZZ http://target.com/secure --hc 401
**Filter by size**: wfuzz -w wordlist.txt http://target.com/FUZZ --hh 1234 (hide responses with 1234 chars, common for default error pages)

## Output format

Wfuzz outputs results in tabular format with: **Request ID** (sequential number), **Response Code** (HTTP status), **L** (line count in response), **W** (word count), **Ch** (character count), **matched value** (the wordlist entry used). Example: '000000429: C=200 4 L 25 W 177 Ch "index"'. Use line/word/character counts to identify anomalies—responses differing in size often indicate valid resources or different application states. With -o json, output is machine-parsable JSON. Use -f filename,printer to save results for later analysis or reuse with --oF for wfuzz payload consumption.

## Common pitfalls

**Failing to filter results**: Without --hc, --hl, --hw, or --hh, output is dominated by 404s and default error pages, obscuring valid findings. Always filter. **Incorrect FUZZ placement**: FUZZ keyword is case-sensitive and must appear exactly where injection is intended. **Wordlist path errors**: Verify wordlist paths exist; wfuzz will fail silently with empty or invalid paths. **Rate limiting**: High-speed fuzzing (-t with large thread counts) triggers WAFs and rate limits; use -s for delays or -t for controlled concurrency. **Ignoring response size patterns**: Line/word/char counts are more reliable than status codes for identifying valid resources; many apps return 200 for all requests. **Not using baseline**: FUZZ{known_value} establishes a reference response; compare subsequent results against this baseline to identify deviations. **Overlooking authentication**: Fuzzing authenticated endpoints without valid session cookies or tokens yields false negatives. **Misinterpreting 3xx codes**: Use -L to follow redirects, or examine redirect targets manually; 302s may indicate valid discoveries. **Wordlist mismatches**: Ensure wordlist content matches the target (e.g., numeric IDs for user enumeration, common filenames for directory discovery).

## References

• https://hackviser.com/tactics/tools/wfuzz
• https://medium.com/@cuncis/fuzzing-made-easy-how-to-use-wfuzz-for-efficient-web-application-testing-d843e5b089bf
• https://www.kali.org/tools/wfuzz/
• https://www.bootlesshacker.com/using-wfuzz/
• https://www.techtarget.com/searchsecurity/feature/How-to-use-Wfuzz-to-find-web-application-vulnerabilities
• https://owasp.org/www-project-web-security-testing-guide/latest/6-Appendix/C-Fuzzing
