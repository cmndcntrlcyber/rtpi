---
name: Unfurl
description: Extract and parse data from URLs and other structured strings
  (timestamps, UUIDs, etc.) into hierarchical tree output via stdin
registry: registry
tool_id: unfurl
category: web-recon
tags:
  - url-analysis
  - forensics
  - osint
  - web-recon
  - parsing
  - dfir
  - cli
mitre_techniques:
  - T1593.002
summary: Unfurl reads URLs or other structured strings from stdin and expands
  them into hierarchical trees that extract metadata, timestamps, identifiers,
  and semantic components. Invoke as `/opt/tools/bin/unfurl` with URL(s) piped
  or echoed to stdin. Outputs ASCII-art tree by default showing scheme, domain,
  path components, and embedded data like Twitter Snowflake timestamps, UUIDs,
  base64, and tracker parameters. Use `-d/--detailed` for node types and
  extended metadata. Use `-f/--filter <text>` to limit output rows matching a
  keyword (e.g., 'timestamp'). Use `-o/--output <file>` to save as CSV instead
  of stdout. Handles URLs from browser history, memory forensics, or carved
  artifacts. Particularly useful for social media URLs (Twitter/X, Facebook),
  search engine referrers, and chat app links that embed timestamps or session
  data. Does not require network access—purely local parsing. Output is
  multi-line tree; parse programmatically or filter. No authentication needed.
  Watch for shell metacharacters in URLs; always quote input. Not a web
  scraper—operates on URL structure only.
sources:
  - https://dfir.blog/introducing-unfurl/
  - https://hexdocs.pm/slack_web/Slack.Web.Chat-function-unfurl.html
  - https://www.vocabulary.com/dictionary/unfurl
  - https://docs.slack.dev/reference/methods/chat.unfurl
  - https://docs.slack.dev/messaging/unfurling-links-in-messages
  - https://docs.unfurl.run/cli.html
  - https://dfir.blog/unfurl-cli-version-now-on-pypi/
  - https://github.com/obsidianforensics/unfurl
  - https://www.ebryx.com/blogs/what-is-red-team-penetration-testing
  - https://blog.securelayer7.net/red-team-assessment/
  - https://cybersecop.com/penetration-testing-red-team
  - http://www.cybersecop.com/penetration-testing-red-team
generated_at: 2026-05-19T11:21:43.885Z
generated_by: anthropic
source_hash: bb1cb20f7db8f122ffd75d0697c24f1c36cb6050f278fc970f0704a9a925636c
---

# Unfurl

## Overview

Unfurl is a Python-based DFIR tool that decomposes URLs and structured strings into visual hierarchical trees, extracting every parseable component including schemes, domains, path segments, query parameters, timestamps (epoch, Snowflake), UUIDs, base64-encoded data, and application-specific identifiers. Originally designed for digital forensics (extracting URLs from memory images, slack space, browser artifacts), it is equally valuable in OSINT and reconnaissance workflows to understand tracking pixels, session tokens, user identifiers, and temporal data embedded in links. The CLI version reads from stdin and outputs ASCII-art trees to stdout by default, with optional CSV export. It includes parsers for major platforms (Twitter/X, Google, Bing, WhatsApp, Facebook) and generic decoders. This tool performs no network activity—it operates purely on the structure and encoding of the input string.

## When to use

Use Unfurl during web reconnaissance to decode tracking parameters, extract user/session IDs, or identify temporal metadata in URLs collected from target web applications, social media profiles, or shared links. Invoke when analyzing referrer chains, OAuth callbacks, or single-sign-on flows to map data leakage or session token structure. Apply to URLs harvested from Google dorking, wayback machine snapshots, or link aggregators to extract publication timestamps or campaign identifiers. Useful for deconstructing shortened URLs after expansion (e.g., unshorten with curl, pipe to Unfurl). Employ during phishing analysis to dissect malicious link parameters. Not a replacement for active scanning or crawling; use after URL collection to understand their anatomy. Complements tools like wafw00f, httprobe, or waybackurls by enriching collected URLs with metadata extraction.

## Authentication & setup

No authentication required. No configuration files. Tool is installed at `/opt/tools/bin/unfurl` in RTPI. Ensure Python 3 runtime and dependencies are present (handled by RTPI provisioning). No API keys, tokens, or network setup needed—Unfurl operates entirely offline on the input string. If invoking the Python script directly (not via the installed binary), ensure the `unfurl` Python package and its dependencies from `requirements.txt` are installed, but in RTPI the binary wrapper handles this. No initial setup steps; tool is immediately ready for use.

## Key commands / parameters

Invoke: `echo '<URL>' | /opt/tools/bin/unfurl` or `cat urls.txt | /opt/tools/bin/unfurl` (one URL per line). Core options: `-d` or `--detailed` to show node type and hover-text metadata for each extracted element; `-f <keyword>` or `--filter <keyword>` to output only rows matching the keyword (case-sensitive substring match, e.g., `-f timestamp` or `-f uuid`); `-o <file>` or `--output <file>` to save results as CSV instead of ASCII tree to stdout; `-v`, `-V`, or `--version` to display version information; `-h` or `--help` for usage summary. No flags required for basic operation—default behavior is ASCII tree to stdout. Multiple URLs can be processed by piping them line-by-line; each will be unfurled sequentially. Shell quoting is critical: always quote URLs containing `&`, `?`, or other special characters to prevent shell interpretation.

## Example workflows

**Basic URL parsing:** `echo 'https://twitter.com/_RyanBenson/status/1205161015177961473' | /opt/tools/bin/unfurl` outputs tree showing scheme, domain, path segments, and Twitter Snowflake components (timestamp, machine ID, sequence). **Extract only timestamps:** `echo 'https://example.com/page?t=1576167751484' | /opt/tools/bin/unfurl -d -f timestamp` filters output to lines containing 'timestamp'. **Batch processing:** `cat collected_urls.txt | /opt/tools/bin/unfurl -o parsed_urls.csv` processes multiple URLs and exports to CSV for spreadsheet analysis. **OAuth callback analysis:** `echo 'https://app.example.com/callback?code=abc123&state=xyz&timestamp=1700000000' | /opt/tools/bin/unfurl -d` reveals all query parameters, decoded base64 if present, and timestamp conversions. **Combine with other recon tools:** `cat wayback_results.txt | grep 'target.com' | /opt/tools/bin/unfurl -f uuid` to find URLs embedding UUIDs. Always quote URLs in echo commands to avoid shell parsing issues.

## Output format

Default output is ASCII-art tree printed to stdout, one node per line. Each line format: `├─(<type>)─ <label>` where `<type>` is a single-character or emoji indicator (e.g., `u` for URL component, `❄` for Twitter Snowflake, `🕓` for timestamp), and `<label>` is the extracted data or metadata. Indentation and tree characters (`├─`, `└─`, `│`) show hierarchical relationships. Node numbering in brackets (e.g., `[1]`) may appear. With `-d/--detailed`, additional lines show node type and hover-text documentation. With `-o/--output`, CSV format with columns for node ID, parent ID, label, type, and value. Output is multi-line and not JSON; post-process with grep, awk, or parse CSV. No structured API response. Errors or unparseable input may produce empty output or partial trees; no explicit error codes in output. Redirect stderr separately if logging is needed.

## Common pitfalls

**Shell quoting:** Failing to quote URLs with `&`, `?`, `#`, or spaces causes shell to interpret them as command separators or redirects—always use single quotes around URLs. **Stdin requirement:** Tool expects stdin input; running `/opt/tools/bin/unfurl <URL>` as a direct argument will fail (it does not accept positional arguments per research). Must pipe or echo. **No network activity:** Unfurl does not fetch URLs, resolve redirects, or perform DNS lookups—it only parses the string structure. Do not expect it to follow shortened links; expand them first with curl or similar. **Overwhelming output:** Complex URLs produce verbose trees; use `-f/--filter` to focus or redirect to file and post-process. **CSV format differences:** CSV output structure may differ from tree layout; test before scripting against it. **No validation:** Unfurl parses malformed URLs without error; garbage in yields partial or empty trees. **Locale/encoding:** Non-ASCII characters in URLs may not render correctly in terminal; ensure UTF-8 locale if processing international URLs.

## References

• https://dfir.blog/introducing-unfurl/
• https://dfir.blog/unfurl-cli-version-now-on-pypi/
• https://github.com/obsidianforensics/unfurl
• https://docs.unfurl.run/cli.html
