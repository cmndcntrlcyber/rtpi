---
name: Qsreplace
description: Accepts URLs on stdin, replaces query parameter values, and
  deduplicates by host+path+param combinations for fuzzing and testing.
registry: registry
tool_id: qsreplace
category: web-recon
tags:
  - url-manipulation
  - web-recon
  - parameter-fuzzing
  - deduplication
  - injection-testing
  - stdin-filter
  - golang
mitre_techniques:
  - T1595.002
summary: "qsreplace is a stdin-to-stdout filter for web reconnaissance that
  manipulates URL query strings. Invoke it by piping URLs into
  /opt/tools/bin/qsreplace with a replacement value or flag. Primary modes: (1)
  Replace all query parameter values with a supplied string (e.g., 'FUZZ' or
  SQL/XSS payloads) via `qsreplace newval`; (2) Append to existing values using
  `-a newval`; (3) Deduplicate URLs by outputting only unique combinations of
  host+path+parameter names via `qsreplace -a` (no value argument). The tool
  outputs one line per unique parameter combination, ignoring the path's role in
  duplication logic. Use this before fuzzing tools (ffuf, Burp Intruder) to
  normalize parameter injection points, or before manual testing to reduce
  noise. Expects well-formed URLs on stdin; malformed input may be skipped. No
  authentication or setup required. Output is line-delimited URLs on stdout;
  redirect or pipe to next tool. Common mistake: forgetting that deduplication
  ignores parameter *values*, only considering parameter *names*—two URLs with
  same params but different values are treated as duplicates."
sources:
  - https://github.com/tomnomnom/qsreplace
  - https://www.blackhatethicalhacking.com/tools/qsreplace/
  - https://pkg.go.dev/github.com/Johnfarcy/hacks/qsreplace
  - https://www.youtube.com/watch?v=quKCPdscTIw
  - https://stackoverflow.com/questions/11392478/how-to-replace-a-string-in-multiple-files-in-linux-command-line
  - https://askubuntu.com/questions/20414/find-and-replace-text-within-a-file-using-commands
  - https://docs.tenable.com/nessus/command-line-reference/Content/PDF/CommandLineReference.pdf
  - https://www.sans.org/blog/shifting-from-penetration-testing-to-red-team-and-purple-team
  - https://firecompass.com/top-25-red-teaming-tools/
  - https://medium.com/@alifmuhamadhafidz23/the-100-essentials-linux-command-tools-for-penetration-testing-1a1680a3120e
  - https://www.sprocketsecurity.com/blog/red-teaming-best-practices
  - https://www.youtube.com/watch?v=dennz5v_D40
generated_at: 2026-05-19T11:13:24.495Z
generated_by: anthropic
source_hash: 35398d74045e33ea445afc2f2d932bd9ff81100effb1d68fc128dffbb0fd9734
---

# Qsreplace

## Overview

qsreplace is a Go-based command-line tool by tomnomnom that accepts URLs on stdin, manipulates query string parameters, and outputs results to stdout. It performs three core operations: replacing all query string values with a user-supplied string, appending to existing query string values, or deduplicating URLs by outputting only unique combinations of host, path, and parameter names. The tool is designed for web application reconnaissance and vulnerability testing workflows, particularly when preparing large URL sets for injection-based attacks (SQLi, XSS, command injection). Version information is unknown but stable releases exist up to v0.0.3 (June 2022). The tool runs as a single binary at /opt/tools/bin/qsreplace with no persistent configuration.

## When to use

Use qsreplace when preparing URLs for parameter-based vulnerability testing or fuzzing. Ideal scenarios: (1) Normalizing thousands of URLs from crawlers (gau, waybackurls, hakrawler) by replacing all parameter values with a fuzzing placeholder like 'FUZZ' or injection payload; (2) Reducing duplicate testing effort by deduplicating URLs that share the same host, path, and parameter structure; (3) Quickly injecting SQL, XSS, or command injection test strings into all parameters of a URL set before piping to httpx, ffuf, or manual Burp Suite analysis; (4) Appending canary tokens or tracking values to existing parameters without full replacement. Do NOT use for: URL parsing validation, complex parameter-specific manipulation (it replaces ALL params uniformly), or when you need to preserve original parameter values for comparison. It is a preprocessing step, not a scanner or exploit tool.

## Authentication & setup

No authentication or configuration required. The tool operates as a stateless stdin/stdout filter. Ensure the binary is executable at /opt/tools/bin/qsreplace. No API keys, config files, or environment variables are needed. The tool processes URLs line-by-line from stdin and writes to stdout; redirect or pipe as needed. If installed via Go: `go install github.com/tomnomnom/qsreplace@latest` places it in $GOPATH/bin. In RTPI the binary is pre-installed at /opt/tools/bin/qsreplace. Verify functionality: `echo 'http://example.com?a=1&b=2' | /opt/tools/bin/qsreplace test` should output `http://example.com?a=test&b=test`.

## Key commands / parameters

qsreplace accepts URLs on stdin and outputs modified URLs to stdout. Invocation patterns:

1. Replace all query string values: `cat urls.txt | qsreplace newval` — Sets every parameter value to 'newval'.

2. Append to query string values: `cat urls.txt | qsreplace -a suffix` — Appends 'suffix' to existing parameter values.

3. Deduplicate only (no replacement): `cat urls.txt | qsreplace -a` — Outputs one URL per unique combination of host+path+parameter names; omits the value argument to -a flag. This mode ignores parameter values and only considers parameter keys for uniqueness.

Flags:
- `-a [value]`: Append mode. If value provided, appends to existing param values. If omitted, performs deduplication only.

No other flags documented. Tool reads from stdin only; does not accept file arguments directly. Combine with shell redirection: `qsreplace payload < urls.txt > modified.txt`.

## Example workflows

Workflow 1 - Prepare URLs for SQLi fuzzing:
```
gau target.com | qsreplace "'" | httpx -mc 500 -silent
```
Replace all params with single quote, pipe to httpx to find 500 errors indicating SQL errors.

Workflow 2 - XSS payload injection:
```
waybackurls target.com | grep '?' | qsreplace '<script>alert(1)</script>' > xss_test.txt
```
Filter URLs with params, inject XSS payload, save for manual testing.

Workflow 3 - Deduplication before fuzzing:
```
cat large_urls.txt | qsreplace -a | qsreplace FUZZ | ffuf -w wordlist.txt -u FUZZ
```
First deduplicate by param structure, then replace with FUZZ placeholder, pipe to ffuf.

Workflow 4 - Append tracking token:
```
cat urls.txt | qsreplace -a canary123
```
Appends 'canary123' to every parameter value for tracking.

Workflow 5 - Command injection prep:
```
echo 'http://api.target.com/search?q=test&format=json' | qsreplace ';id;'
```
Outputs: `http://api.target.com/search?q=;id;&format=;id;` for command injection testing.

## Output format

qsreplace outputs one URL per line to stdout. Each line is a complete URL with modified query parameters. When deduplicating (`qsreplace -a` with no value), output contains only the first occurrence of each unique host+path+parameter-name combination; subsequent URLs with the same structure but different parameter values are suppressed. Output is not sorted. Malformed URLs or lines without query strings may pass through unchanged or be skipped silently. No JSON, CSV, or structured output mode exists. Redirect stdout to a file or pipe to another tool for further processing. No stderr logging for normal operations; errors (e.g., invalid input) may produce stderr messages but are minimal. Example output:
```
http://example.com?user=FUZZ&id=FUZZ
http://example.com/path?param=FUZZ
http://other.com?user=FUZZ
```

## Common pitfalls

1. Deduplication logic: qsreplace considers host+path+parameter NAMES for uniqueness, not values. Two URLs with identical structure but different parameter values are treated as duplicates; only the first is output. Do not expect value-based deduplication.

2. Path sensitivity: The tool's description states 'ignore the path when considering what constitutes a duplicate,' which contradicts observed behavior in examples. Test behavior with your dataset; the tool may deduplicate by host+params OR host+path+params depending on version.

3. URL encoding: qsreplace does not automatically URL-encode special characters in replacement strings. If injecting payloads with spaces or special chars, pre-encode them or pipe output through a URL encoder.

4. No parameter-specific targeting: You cannot replace only certain parameters; ALL query string values are replaced uniformly. Use other tools (like sed or custom scripts) for selective replacement.

5. Stdin-only input: The tool does not accept file arguments. Always use shell redirection or pipes: `qsreplace value < file.txt`, not `qsreplace value file.txt`.

6. Large datasets: Processing millions of URLs may be slow as it's single-threaded. Consider splitting input files for parallel processing with GNU parallel.

7. Empty query strings: URLs without query parameters pass through unchanged; no placeholder params are added.

## References

• https://github.com/tomnomnom/qsreplace
• https://www.blackhatethicalhacking.com/tools/qsreplace/
• https://medium.com/@alifmuhamadhafidz23/the-100-essentials-linux-command-tools-for-penetration-testing-1a1680a3120e
