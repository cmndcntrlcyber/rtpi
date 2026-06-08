---
name: Droopescan
description: Plugin-based CMS vulnerability scanner for identifying themes,
  plugins, versions, and interesting URLs in Drupal, WordPress, SilverStripe,
  Joomla, and Moodle.
registry: registry
tool_id: droopescan
category: cms
tags:
  - cms
  - vulnerability-scanner
  - drupal
  - wordpress
  - reconnaissance
  - web-application
  - enumeration
mitre_techniques:
  - T1595.002
  - T1590.001
  - T1190
summary: Droopescan is a Python-based CMS fingerprinting and enumeration tool
  that identifies CMS type, version, installed plugins, themes, and interesting
  URLs. Invoke with `droopescan scan {cms_type} -u {target}` where cms_type is
  drupal, wordpress, silverstripe, joomla, or moodle. Omit cms_type to
  auto-detect. Default scan uses 4 threads and tests for plugins (p), themes
  (t), version (v), and interesting URLs (i); control with `--enumerate` or `-e`
  flag. Output is machine-readable by default; use `--output json` for
  structured data or `--output screen` for human-friendly. For mass scanning,
  use `-U {file}` with one URL per line. Adjust concurrency with `--threads` and
  plugin bruteforce depth with `--number` to avoid overwhelming targets. Tool
  may generate 500 errors if server is overloaded; reduce threads if this
  occurs. Use `--timeout` to adjust HTTP wait time (seconds). Supports
  `--no-follow-redirects`, custom `--user-agent`, and `--host` header override.
  Results include version fingerprints (with confidence scores), plugin/theme
  lists, and interesting URLs (admin panels, changelogs, config files). Ideal
  for initial reconnaissance phase before deeper exploitation.
sources:
  - https://linuxsecurity.expert/tools/droopescan/
  - https://www.droptica.com/blog/whats-droopescan-and-how-use-it-effectively/
  - https://github.com/SamJoan/droopescan
  - http://droopescan-docs.readthedocs.io/en/latest/intro.html
  - https://www.geeksforgeeks.org/linux-unix/droopescan-cms-based-web-applications-scanner/
  - https://docs.safetycli.com/safety-docs/safety-cli/scanning-for-vulnerable-and-malicious-packages/available-commands-and-inputs
  - https://semgrep.dev/docs/cli-reference
  - https://www.edgescan.com/wp-content/uploads/2025/03/Use-Case_Red-Team-250326.pdf
  - https://www.securance.com/blog/redteaming-pentesting-vulnerabilityscanning/
  - https://www.cycognito.com/learn/penetration-testing/
  - https://www.youtube.com/watch?v=usDt-s2sACI
  - https://www.picussecurity.com/resource/glossary/what-are-red-team-tools
generated_at: 2026-05-19T11:21:13.935Z
generated_by: anthropic
source_hash: f1cc392f5bbd503cf8211aa3d5e5b72ab8cd15c371578d30f5a8280f2c4af94e
---

# Droopescan

## Overview

Droopescan is a reconnaissance tool designed for the initial information-gathering phase of web application security assessments. It fingerprints and enumerates Content Management Systems (CMS), with strong support for Drupal, WordPress, and SilverStripe, plus partial functionality for Joomla and Moodle. The tool identifies CMS versions, installed plugins, themes, and interesting URLs such as admin interfaces, changelogs, and exposed configuration files. It is Python-based, open-source (AGPL license), and supports both single-target and mass-scanning workflows. Default behavior balances accuracy with server load using 4 concurrent threads.

## When to use

Use droopescan during the reconnaissance and enumeration phases of penetration tests or red team operations when targeting web applications built on common CMS platforms. Ideal for mapping the attack surface of Drupal, WordPress, SilverStripe, Joomla, or Moodle installations before vulnerability exploitation. Suitable for mass-scanning multiple targets to identify outdated CMS versions or vulnerable plugins across an organization's infrastructure. Use when you need machine-readable output (JSON) for integration with other tools or reporting pipelines. Do not use if CMS type is unknown and not one of the five supported platforms; auto-detection only works for supported CMS. Avoid in scenarios requiring stealth, as default settings generate noticeable HTTP request volumes.

## Authentication & setup

No authentication or API keys required. Tool is invoked directly via `/usr/local/bin/droopescan`. If installed from GitHub, dependencies must be installed via pip (typically `pip install -r requirements.txt` or via setup.py). No configuration files are required for basic operation. Proxy support available via `--proxy-host`, `--proxy-port`, and `--proxy-protocol` flags if scanning through an intermediary. Custom HTTP headers can be set with `--user-agent` and `--host` to bypass basic WAF rules or mimic legitimate traffic. No persistent configuration needed; all options passed via command-line flags.

## Key commands / parameters

`droopescan scan {cms} -u {URL}` – Scan single target, where {cms} is drupal, wordpress, silverstripe, joomla, or moodle.
`droopescan scan -u {URL}` – Auto-detect CMS type (only works for supported platforms).
`droopescan scan {cms} -U {file}` – Mass-scan multiple URLs from file (one per line).
`--enumerate {p,t,v,i}` or `-e {p,t,v,i}` – Specify scan types: p=plugins, t=themes, v=version, i=interesting URLs. Default is all.
`--threads {N}` – Set concurrent threads (default 4); reduce if target shows 500 errors.
`--number {N}` – Control plugin/theme bruteforce depth (default varies); higher values = more requests.
`--timeout {seconds}` – HTTP response timeout in seconds.
`--output {json|screen}` – Output format; json for machine parsing, screen for human-readable.
`--no-follow-redirects` – Prevent following HTTP redirects.
`--user-agent {string}` – Override User-Agent header.
`--host {string}` – Override Host header.
`--debug` – Enable verbose debug output.
`--quiet` – Suppress runtime progress messages.

## Example workflows

**Single Drupal site reconnaissance:**
`droopescan scan drupal -u https://example.org --output json > drupal_recon.json`
Captures version, plugins, themes, and interesting URLs in structured format for further analysis.

**WordPress mass-scan from file:**
`droopescan scan wordpress -U targets.txt --threads 8 --output json > wordpress_results.json`
Scans multiple WordPress sites concurrently; increase threads for faster scanning if targets can handle load.

**Auto-detect CMS with reduced load:**
`droopescan scan -u https://target.com --threads 2 --timeout 15`
Attempts CMS identification with lower concurrency and longer timeout for slow or rate-limited targets.

**Enumerate only plugins and version (skip themes and URLs):**
`droopescan scan drupal -u https://example.org -e p,v`
Focused enumeration when time or stealth is a concern.

**Custom User-Agent to evade basic detection:**
`droopescan scan wordpress -u https://example.org --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" --output screen`

## Output format

Default output is human-readable text to stdout, organized by section: Plugins, Themes, Version (with confidence scores), and Interesting URLs. Each plugin/theme lists full path or identifier. Version output includes possible versions ranked by likelihood. Interesting URLs show full paths to admin panels, changelogs, readme files, config backups, etc.

JSON output (`--output json`) is structured with keys: 'plugins', 'themes', 'version', 'interesting_urls'. Each plugin/theme is a dict with name and potentially additional metadata. Version field contains array of possible versions with confidence scores. Interesting URLs are arrays of full URL strings.

Machine-readable format enables chaining with other tools (e.g., parsing JSON to feed URLs into Burp Suite or extracting version numbers to cross-reference with CVE databases). Exit codes: 0 for successful scan, non-zero for errors (network failures, invalid targets, etc.).

## Common pitfalls

**Server overload (500 errors):** Default 4 threads may overwhelm weak hosting or shared servers. Reduce `--threads` to 1-2 and increase `--timeout` if you see 'Got a 500 error' warnings. Tool will warn but may produce incomplete results.

**False negatives on hardened sites:** Sites with aggressive WAF rules, custom directory structures, or heavily modified CMS may evade detection. Auto-detect may fail if CMS fingerprints are obfuscated; manually specify CMS type if known.

**Incomplete plugin/theme enumeration:** Default `--number` setting limits bruteforce depth. Increase if you suspect more plugins exist, but expect significantly more HTTP requests and longer scan time.

**Redirect loops:** Some sites redirect endlessly or to external domains. Use `--no-follow-redirects` to prevent wasted requests, but may miss target if initial URL redirects to actual CMS location.

**Mass-scan rate limiting:** Scanning many targets from same IP may trigger rate limits or IP blocks. Distribute scans over time or use proxy rotation.

**Legal/ethical:** Tool outputs state 'usage for attacking targets without prior mutual consent is illegal.' Ensure written authorization before scanning. Noisy by default; not suitable for covert red team operations without modification.

**Version correlation:** Tool outputs likely versions but does NOT map to CVEs. Manual correlation required using vulnerability databases (NVD, Drupal Security Advisories, WPScan, etc.).

## References

• https://github.com/SamJoan/droopescan
• https://linuxsecurity.expert/tools/droopescan/
• https://www.droptica.com/blog/whats-droopescan-and-how-use-it-effectively/
• http://droopescan-docs.readthedocs.io/en/latest/intro.html
• https://www.geeksforgeeks.org/linux-unix/droopescan-cms-based-web-applications-scanner/
