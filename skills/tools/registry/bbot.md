---
name: Bbot
description: BBOT is a recursive internet scanner for OSINT and asset discovery,
  featuring subdomain enumeration, web spidering, and API integrations.
registry: registry
tool_id: bbot
category: reconnaissance
tags:
  - reconnaissance
  - osint
  - subdomain-enumeration
  - web-spider
  - asset-discovery
  - api-integration
  - scanning
mitre_techniques:
  - T1595
  - T1595.002
  - T1590
  - T1590.005
  - T1593
  - T1593.002
summary: BBOT is a modular reconnaissance framework installed at
  /usr/local/bin/bbot. Invoke with `bbot -t <target>` where target is a domain,
  IP, CIDR, email, or organization. Use `-m` to specify modules (e.g., `-m
  subdomain-enum` for passive+active subdomain discovery, `-m spider` for web
  crawling). BBOT requires no flags by default but benefits from API keys
  configured in `~/.config/bbot/bbot.yml` for services like SecurityTrails,
  Shodan, Hunter.io, etc. Output is written to `~/.bbot/scans/<name>/` in JSON,
  CSV, and text formats. BBOT excels at recursive enumeration, consistently
  finding 20-50% more subdomains than competitors through target-specific
  mutations and DNS brute-forcing. Use preset configs like `subdomain-enum.yml`,
  `spider.yml`, `email-enum.yml`, or `web-thorough.yml` via `-c` flag. Specify
  scope with `-t` for targets and `--whitelist` for in-scope assets; BBOT
  respects scope boundaries strictly. Watch for rate-limiting when using
  multiple API modules simultaneously. Output includes event types (DNS_NAME,
  URL, VULNERABILITY, TECHNOLOGY, etc.) with parent-child relationships for
  attack path mapping. BBOT is best for initial footprinting and continuous
  asset monitoring in red team engagements.
sources:
  - https://docs.enov8.com/docs/enov8-platform/bbot-monitoring/user-guide-modules/bbot-user-guide
  - https://blacklanternsecurity.github.io/bbot/Stable/scanning/configuration/
  - https://github.com/blacklanternsecurity/bbot
  - https://pypi.org/project/bbot/
  - https://github.com/blacklanternsecurity/bbot/discussions/1920
  - https://www.blacklanternsecurity.com/bbot/
  - https://docs.kernel.org/admin-guide/kernel-parameters.html
  - https://docs.u-boot.org/en/latest/usage/cmdline.html
  - https://www.synack.com/knowledge-base/red-teaming-vs-penetration-testing-understanding-the-differences/
  - https://www.ibm.com/think/topics/red-teaming
  - https://redbotsecurity.com/
  - https://www.sprocketsecurity.com/blog/red-teaming-best-practices
generated_at: 2026-05-19T10:58:12.537Z
generated_by: anthropic
source_hash: 524dd27d810022b1a57aa1eef91831dc453d62ca5c42f9a75421d43b2211428d
---

# Bbot

## Overview

BBOT (Bighuge BLS OSINT Tool) is a recursive internet scanner designed for security reconnaissance. It aggregates passive API sources with active scanning techniques to enumerate subdomains, discover assets, spider web applications, gather emails, and identify technologies. BBOT's modular architecture supports 100+ modules with flags for categorization (safe, aggressive, passive, etc.). It handles unlimited targets simultaneously and maintains parent-child event relationships for attack surface mapping. The tool is Python-based, available via pipx/Docker, and outputs scan results in multiple formats for integration with asset management or SIEM platforms.

## When to use

Use BBOT during the reconnaissance phase of red team engagements when you need comprehensive asset discovery beyond single-point tools. Invoke for: (1) Initial target profiling - discovering all subdomains, IPs, and web assets for a target organization; (2) Continuous monitoring - scheduled scans to detect new assets or configuration changes; (3) Scope validation - mapping the full attack surface before active exploitation; (4) Email/credential harvesting - finding employee emails and leaked credentials via OSINT APIs; (5) Technology fingerprinting - identifying frameworks, CMSs, and vulnerable components across large estates. BBOT is ideal when you need recursive discovery (finding subdomains of subdomains) or when target scale exceeds manual enumeration. Prefer BBOT over Amass/Subfinder when you need an all-in-one platform with web spidering, port scanning, and API aggregation in a single workflow.

## Authentication & setup

BBOT reads configuration from `~/.config/bbot/bbot.yml` where API keys are stored. Create this file with module-specific keys:

```yaml
modules:
  shodan:
    api_key: YOUR_KEY_HERE
  securitytrails:
    api_key: YOUR_KEY_HERE
  censys:
    api_key: 'id:secret'
```

Alternatively, pass keys on command line: `bbot -t example.com -m shodan -c modules.shodan.api_key=YOUR_KEY`. No authentication is required for passive/active modules that don't call APIs. Verify installation with `bbot --version`. Default scan output goes to `~/.bbot/scans/<scan_name>/`. For Docker: `docker run -v ~/.bbot:/root/.bbot blacklanternsecurity/bbot -t example.com`. In RTPI context, ensure ~/.config/bbot/ is persistent across container restarts if using API keys. Module-specific limits (e.g., `modules.censys_dns.max_pages: 5`) can be tuned in config to control API usage and scan depth.

## Key commands / parameters

`bbot -t <target>` - specify target(s); accepts domains, IPs, CIDRs (1.2.3.0/24), emails, URLs, or special formats like ORG:company, USER:username

`-m <modules>` - enable specific modules (e.g., `-m subdomain-enum,httpx,sslcert`); see full list with `bbot -l`

`-f <flags>` - enable modules by flag category: `safe`, `passive`, `aggressive`, `subdomain-enum`, `active`, `web-basic`, `email-enum`

`-c <preset.yml>` - load preset configurations (subdomain-enum.yml, spider.yml, email-enum.yml, web-thorough.yml, kitchen-sink.yml)

`-n <name>` - name the scan (affects output directory)

`-o <dir>` - custom output directory

`--whitelist <target>` - define in-scope assets explicitly

`--blacklist <target>` - exclude specific assets from scanning

`-om <output_modules>` - specify output formats: json, csv, http, websocket, neo4j, splunk, discord, slack, elasticsearch

`-c modules.<module>.<option>=<value>` - override module config inline (e.g., `-c modules.httpx.threads=10`)

`--allow-deadly` - permit modules that can cause service disruption

No arguments prints help. Use `bbot -l` to list all modules and `bbot -lf` to list flags.

## Example workflows

**1. Subdomain enumeration with API aggregation:**
`bbot -t evilcorp.com -f subdomain-enum -om json,csv`
Uses passive APIs (SecurityTrails, crt.sh, etc.) + DNS brute-force with mutations. Output in ~/.bbot/scans/.

**2. Web application spidering:**
`bbot -t https://app.evilcorp.com -m httpx,spider,wayback -c modules.spider.max_depth=3`
Crawls site, fetches Wayback Machine URLs, fingerprints technologies.

**3. Email harvesting:**
`bbot -t evilcorp.com -f email-enum -m hunterio,skymem -c modules.hunterio.api_key=KEY`
Gathers employee emails from OSINT sources.

**4. Full asset discovery with aggressive scanning:**
`bbot -t evilcorp.com,1.2.3.0/24 -f subdomain-enum,web-thorough,port-scan --allow-deadly -om elasticsearch`
Combines subdomain enum, port scanning, web tech detection; sends to Elasticsearch for analysis.

**5. Scope-limited red team recon:**
`bbot -t evilcorp.com --whitelist evilcorp.com,evilcorp.net -f safe,passive -n rt_recon_001 -om json`
Strictly scoped passive recon with named output for engagement tracking.

**6. Recursive org-wide discovery:**
`bbot -t ORG:evilcorp -m github_org,github_codesearch -c modules.github_org.api_key=TOKEN -om csv`
Enumerates GitHub org members, repos, and code secrets.

## Output format

BBOT writes scan results to `~/.bbot/scans/<scan_name>/` with multiple files:

- `output.txt` - human-readable event stream
- `output.json` - structured JSON with full event metadata (event type, data, module, timestamp, parent relationships)
- `output.csv` - flat CSV for spreadsheet analysis
- `output.ndjson` - newline-delimited JSON for streaming ingest
- `scan.log` - detailed scan logs with errors/warnings
- `scan.json` - scan metadata (config, duration, target, modules)

Event types include: DNS_NAME, IP_ADDRESS, OPEN_TCP_PORT, URL, HTTP_RESPONSE, VULNERABILITY, TECHNOLOGY, EMAIL_ADDRESS, USERNAME, FINDING, etc. Each event has `type`, `data`, `host`, `source_module`, `tags`, and `parent` fields for graph reconstruction. JSON output is ideal for downstream processing (jq, Elasticsearch, Neo4j). Use `-om` to enable additional outputs like Splunk HEC, Discord webhooks, or HTTP POST to custom endpoints. For continuous monitoring, parse `output.ndjson` incrementally and diff against previous scans to detect new assets.

## Common pitfalls

**API rate limits:** Using many API modules simultaneously can exhaust quotas quickly. Stagger scans or use `-c modules.<module>.max_pages=N` to limit requests. BBOT does not automatically throttle across all APIs.

**Scope creep:** Without `--whitelist`, BBOT recursively expands to all discovered subdomains and IPs, potentially scanning out-of-scope assets. Always define explicit scope boundaries for client engagements.

**Module conflicts:** Some aggressive modules (DNS brute-force, port scans) can trigger IDS/IPS. Use `-f safe,passive` for stealthy recon. Check module flags with `bbot -l`.

**Large output volumes:** Comprehensive scans (kitchen-sink preset) generate gigabytes of data. Use `-c modules.spider.max_depth=2` or selective modules to control scope.

**Missing dependencies:** Some modules require external tools (nmap, masscan). Verify with `bbot -l` and check module requirements.

**Target format errors:** BBOT is strict about target syntax. Use `evilcorp.com` not `http://evilcorp.com` for domain targets (URLs go in separate `-t` arguments).

**Config persistence:** When using Docker/containers, mount `~/.config/bbot/` to persist API keys across runs. In RTPI, ensure volume mapping is configured.

**Event parent relationships:** Output events reference parent IDs for attack path tracking. Parse JSON output with `parent` field awareness for graph reconstruction; CSV loses this context.

## References

- https://github.com/blacklanternsecurity/bbot
- https://blacklanternsecurity.github.io/bbot/Stable/scanning/configuration/
- https://www.blacklanternsecurity.com/bbot/
- https://pypi.org/project/bbot/
- https://github.com/blacklanternsecurity/bbot/discussions/1920
