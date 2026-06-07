---
name: Dalfox
description: Fast parameter analysis and XSS scanner with DOM parser, blind XSS
  support, and pipeline integration for automated vulnerability detection.
registry: registry
tool_id: dalfox
category: web-recon
tags:
  - xss
  - web-scanner
  - vulnerability-scanner
  - parameter-analysis
  - dom-parser
  - blind-xss
  - pipeline
mitre_techniques:
  - T1190
  - T1059.007
summary: "Dalfox is a Golang-based XSS detection tool that identifies reflected,
  stored, DOM-based, and blind XSS vulnerabilities through automated parameter
  analysis. Invoke it in three modes: 'url' for single targets, 'file' for batch
  scanning, or 'pipe' for stdin integration with reconnaissance chains. Use
  '--blind' or '-b' with a callback URL for out-of-band XSS detection. Dalfox
  validates findings via DOM parsing and real-time response analysis, returning
  PoC payloads and vulnerable parameter locations. It supports custom payloads
  via '--custom-payload', header injection with '-H', and mass parallel scanning
  with '--mass' and '--mass-worker'. Output defaults to console with severity
  markers; use '-o' for file output and '--format json' for structured results.
  Ideal for bug bounty workflows when chained with subdomain enumeration
  (assetfinder) and URL gathering (gau). Expect high-speed scans with low false
  positives due to verification engine. Always test with '--silence-force' in
  CI/CD to suppress progress bars. Does NOT perform authenticated scanning by
  default—inject auth tokens via custom headers. Best used after parameter
  discovery phase to focus testing surface."
sources:
  - https://dalfox.hahwul.com/page/usage/
  - https://github.com/hahwul/dalfox
  - https://dalfox.com/
  - https://www.geeksforgeeks.org/linux-unix/dalfox-parameter-analysis-and-xss-scanning-tool/
  - https://dalfox.hahwul.com/
  - https://dalfox.hahwul.com/advanced/config/
  - https://pkg.go.dev/github.com/hahwul/dalfox/v2
  - https://www.ebryx.com/blogs/what-is-red-team-penetration-testing
  - https://cybersecop.com/penetration-testing-red-team
  - https://medium.com/meetcyber/dalfox-smart-xss-scanner-for-bug-bounty-and-pentesting-c9a4a8708179
  - https://cybersectools.com/alternatives/dalfox
generated_at: 2026-05-19T11:13:31.424Z
generated_by: anthropic
source_hash: 67e496a10983de10f3a0094d072010866d6010d63979932b3448f1602e13af68
---

# Dalfox

## Overview

Dalfox (달=moon, Fox=Finder Of XSS) is an open-source parameter analyzer and XSS scanner built in Go. It detects reflected, stored, DOM-based, and blind XSS through automated payload injection combined with DOM parsing for verification. Additional detection includes basic SQLi, SSTI, and open-redirect checks. Core capabilities: multi-mode operation (single URL, file batch, stdin pipe), blind XSS with callback servers, WAF evasion techniques, custom payload support, and parallel scanning. Generates PoC code in multiple formats (curl, httpie, etc.).

## When to use

Use Dalfox during web application attack surface analysis after parameter discovery. Primary scenarios: testing GET/POST parameters for XSS in bug bounty programs; validating input sanitization in web pentests; chaining with reconnaissance tools (subfinder, waybackurls, gau) to test discovered endpoints at scale; confirming XSS in CI/CD security gates; testing for stored XSS via 'sxss' mode after creating test accounts. Invoke when you have URLs with query parameters, form endpoints, or need to verify suspected injection points. NOT appropriate for initial reconnaissance—run after you have target URLs with parameters identified.

## Authentication & setup

No authentication required by default. Dalfox is installed at /opt/tools/bin/dalfox. For authenticated testing, inject session tokens or API keys via '-H' flag (e.g., '-H "Cookie: session=abc123"' or '-H "Authorization: Bearer token"'). For blind XSS, set up an external callback server (Burp Collaborator, interactsh, XSS Hunter) and pass URL via '-b' flag. No credential storage or config files needed for basic operation. For persistent configuration, create YAML/JSON config and reference with '--config' flag. Mass scanning requires sufficient file descriptors—adjust ulimit if scanning >1000 URLs. Server mode ('dalfox server') requires port availability (default 8080).

## Key commands / parameters

**Modes**: 'url <target>' (single URL), 'file <path>' (batch from file), 'pipe' (stdin), 'sxss <target>' (stored XSS), 'server' (REST API), 'payload' (payload generation). **Critical flags**: '-b/--blind <callback-url>' (blind XSS with out-of-band server), '--custom-payload <file>' (custom payload list), '-H <header>' (add HTTP headers, repeatable), '-p/--param <name>' (test specific parameter only), '--ignore-param <names>' (skip parameters), '--ignore-return <codes>' (ignore HTTP status codes like 404,403), '-o/--output <file>' (save results), '--format <plain|json>' (output format), '--poc-type <curl|httpie>' (PoC format). **Performance**: '--mass' (parallel scanning), '--mass-worker <int>' (worker threads, default 10), '--limit <int>' (result limit), '--silence-force' (suppress progress, print only PoCs). **Analysis**: '--mining-dom' (deep DOM analysis), '--mining-dict' (parameter mining), '--no-color' (plain output), '--found-action <script>' (execute script on finding).

## Example workflows

**Single URL scan**: 'dalfox url "http://target.com/search?q=test&id=1" -b https://callback.example.com' → tests all parameters with blind XSS. **Pipeline integration**: 'cat subdomains.txt | waybackurls | grep "=" | dalfox pipe -H "Cookie: session=xyz" --silence-force' → chain recon to XSS testing. **Batch with custom payloads**: 'dalfox file urls.txt --custom-payload xss.txt -o results.json --format json' → scan URL list with custom vectors. **Focused parameter test**: 'dalfox url "http://api.target.com/v1/search?q=test&debug=1" -p debug --mining-dom' → test only 'debug' parameter with DOM mining. **Stored XSS testing**: 'dalfox sxss http://target.com/comment --data "content=FUZZ&author=test" -b https://callback' → inject payloads via POST to test stored XSS. **Mass parallel**: 'dalfox file big-list.txt --mass --mass-worker 20 --silence-force' → high-speed batch scanning. Always verify findings manually before reporting—copy PoC URLs to browser to confirm popup/execution.

## Output format

Default output: console with colored severity indicators ([V] for verified XSS, [G] for grep, [I] for info). Each finding includes: vulnerable parameter name, injection point, HTTP method, payload used, and full PoC URL. Use '--format json' for structured output with fields: target, vulnerability type, param, method, payload, evidence, poc-code. PoC code format controlled by '--poc-type' (curl, httpie, etc.). With '--output-all', includes all request/response data. Exit codes: 0 for completion (findings or not), non-zero for errors. '--silence-force' outputs only PoC lines for grep/parsing in automation. Report format ('--report') generates detailed HTML/JSON with request/response pairs, payload context, and verification steps. Blind XSS requires manual callback monitoring—tool only sends payloads, does not poll for hits.

## Common pitfalls

**False negatives**: WAF/filtering may block payloads—use '--waf-evasion' mode or custom payloads to bypass. DOM-based XSS may not trigger without '--mining-dom' flag. Stored XSS requires 'sxss' mode, not 'url' mode. **Rate limiting**: default speed may trigger blocks—use '--delay <ms>' between requests or reduce '--mass-worker' count. **Authentication**: forgetting '-H' headers causes 401/403, skipping protected endpoints. **Output parsing**: colored output breaks scripts—always use '--no-color' or '--silence-force' in automation. **Blind XSS misuse**: callback URL must be publicly accessible and monitored separately; Dalfox does not poll or report hits. **Parameter scope**: without '-p', scans ALL parameters including CSRF tokens, causing noise—use '--ignore-param' for tokens/nonces. **Resource exhaustion**: large file scans without '--limit' generate massive output—set limits or use '--silence-force'. Always validate findings—reflected content does not guarantee exploitability if sanitized in context.

## References

• https://dalfox.hahwul.com/page/usage/
• https://github.com/hahwul/dalfox
• https://dalfox.hahwul.com/advanced/config/
• https://www.geeksforgeeks.org/linux-unix/dalfox-parameter-analysis-and-xss-scanning-tool/
• https://dalfox.com/
• https://medium.com/meetcyber/dalfox-smart-xss-scanner-for-bug-bounty-and-pentesting-c9a4a8708179
