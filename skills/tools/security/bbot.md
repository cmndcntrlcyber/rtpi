---
name: BBOT
description: OSINT automation for attack surface reconnaissance. Discovers
  subdomains, IPs, URLs, emails, and more via passive & active enumeration.
registry: security
tool_id: bbot
category: reconnaissance
tags:
  - reconnaissance
  - osint
  - subdomain-enumeration
  - attack-surface
  - web-spider
  - dns
  - automation
mitre_techniques:
  - T1595.002
  - T1595.001
  - T1590
  - T1589
  - T1593
summary: "BBOT is a recursive OSINT scanner for attack surface enumeration. Use
  when mapping external infrastructure, discovering subdomains (claims 20-50%
  better coverage than competitors), or gathering emails/URLs during initial
  reconnaissance. Invoke via `bbot -t <target>` with flags `-m` for modules and
  `-f` for presets. Accepts domains, IPs, CIDR blocks, emails, and org names as
  targets. Supports 100+ modules including passive APIs (SecurityTrails, Censys,
  etc.), DNS brute-force with intelligent mutations, web spidering, port
  scanning, and vulnerability detection. Configure API keys in
  `~/.config/bbot/bbot.yml` or via CLI flags for enhanced passive enumeration.
  Uses preset YAML configs for common scenarios: `subdomain-enum.yml`,
  `spider.yml`, `email-enum.yml`, `web-basic.yml`. Output formats include JSON,
  CSV, and direct integrations (Elasticsearch, Discord). Runs recursively—new
  discoveries become scan targets. Noisy by default; active modules trigger
  IDS/IPS. Scope management is critical—BBOT respects whitelists/blacklists but
  will pivot aggressively within scope. Ideal for pentest OSINT, bug bounty
  recon, and ASM. Not suitable for stealth ops without careful module
  selection."
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
generated_at: 2026-05-19T11:24:09.386Z
generated_by: anthropic
source_hash: 30fc333f5e24ef94aae39bdecb73c81ffe887c42a3b21d3f08af1fe0ccca98bd
---

# BBOT

## Overview

BBOT is a Python-based recursive internet scanner designed for offensive security reconnaissance. It automates OSINT collection across passive APIs, active DNS enumeration, web crawling, and vulnerability scanning. The tool accepts unlimited targets in multiple formats (domains, IPs, CIDR, emails, org names) and discovers assets recursively—each finding becomes a new scan input. BBOT excels at subdomain discovery through a combination of passive sources and DNS brute-forcing with context-aware mutations. It includes 100+ modules spanning reconnaissance, exploitation detection, and asset enumeration. Modular architecture allows precise control over scan behavior via flags, presets, and configuration files.

## When to use

Deploy BBOT during initial external reconnaissance phases of red team engagements or penetration tests. Use when you need comprehensive subdomain enumeration (BBOT claims 20-50% better results than alternatives on large domains), attack surface mapping, or passive intelligence gathering before active exploitation. Ideal for bug bounty programs requiring thorough asset discovery, ASM programs tracking organizational footprint, or threat intelligence collection on target infrastructure. Not suitable when stealth is paramount—many modules generate detectable traffic. Avoid in time-constrained scenarios where you need immediate results; BBOT's recursive nature means scans can run for hours on large targets.

## Authentication & setup

Install via pipx (`pipx install bbot`) or Docker. For enhanced passive enumeration, configure API keys in `~/.config/bbot/bbot.yml` following YAML format. Supports multiple keys per service. Example structure: `modules: > censys_dns: > api_key: 'key:secret'`. API keys can also be passed via CLI using `-c modules.<module_name>.api_key=<value>`. Supported services include SecurityTrails, Censys, BufferOverrun, Hunter.io, BuiltWith, C99, GitHub, and others. No authentication required for basic DNS/web modules, but passive API modules require keys for full functionality. Configuration also controls rate limits, timeouts, recursion depth, and output retention.

## Key commands / parameters

`bbot -t <target>` initiates scan. `-t` accepts domains (evilcorp.com), IPs (1.2.3.4), CIDR (1.2.3.0/24), emails (bob@evilcorp.com), org names (ORG:evilcorp). `-m <module1,module2>` specifies modules; `-f <flag1,flag2>` uses module flags for categorization (e.g., `-f subdomain-enum` enables all subdomain modules). `-p <preset.yml>` loads preconfigured scan profiles: `subdomain-enum.yml` (passive+DNS brute), `spider.yml` (web crawl), `email-enum.yml`, `web-basic.yml`, `web-thorough.yml`, `kitchen-sink.yml` (everything). `-c <config>` overrides config values (e.g., `-c modules.massdns.wordlist=/path/to/list`). `-o <dir>` sets output directory. `--config` shows all configuration options. Modules have individual settings for rate limits, page counts, file limits, timeouts, and recursion behavior accessible via config file or CLI overrides.

## Example workflows

**Subdomain enumeration**: `bbot -t example.com -f subdomain-enum` runs passive APIs + recursive DNS brute-force with mutations. **Full web recon**: `bbot -t example.com -f spider web-basic` crawls site and identifies technologies/vulnerabilities. **Email harvesting**: `bbot -t example.com -f email-enum` gathers emails from OSINT sources. **Scoped network scan**: `bbot -t 10.0.0.0/24 -m portscan sslcert httpx` maps IPs, open ports, certificates, web services. **With API keys**: `bbot -t target.com -c modules.securitytrails.api_key=abc123 -f subdomain-enum` enhances passive collection. **Custom output**: `bbot -t target.com -f subdomain-enum -o /tmp/scan1` saves results to specified directory. Combine flags for multi-faceted recon: `bbot -t target.com -f subdomain-enum spider -m github_org nuclei` for subdomains, web crawl, GitHub enumeration, and vuln scanning in one pass.

## Output format

BBOT outputs to multiple formats simultaneously. Default is human-readable console output plus structured files in `~/.bbot/scans/<scan_name>/`. Generates TXT (event list), JSON (structured events), CSV (tabular), and NMap XML formats. Each event type (DNS_NAME, IP_ADDRESS, URL, VULNERABILITY, EMAIL_ADDRESS, OPEN_TCP_PORT, etc.) is tagged and linked to its parent discovery chain. Integration modules send data to Elasticsearch, Discord, webhooks, or custom outputs. Output folder contains `output.txt` (all findings), `output.json` (event stream), `output.csv`, and module-specific files. Web screenshot modules save images; workflow modules download logs. Configure retention via `output_retention` setting (default 5 scans). Events include metadata like source module, scope status, and discovery timestamp.

## Common pitfalls

**Scope creep**: BBOT's recursive behavior can pivot to out-of-scope assets. Use whitelists/blacklists carefully and review scope settings before launching. **Noise generation**: Active modules (DNS brute, port scans, web crawling) create significant network traffic visible to blue teams. Disable noisy modules for stealthy recon. **Runtime duration**: Large domains with recursive enumeration can run for many hours. Set reasonable module limits (e.g., `max_pages`, `file_limit`) to control scan time. **API rate limits**: Free API tiers have strict limits; scans may pause or skip sources. Use commercial keys or reduce API module count. **Resource consumption**: Kitchen-sink scans consume significant CPU/memory/bandwidth. Start with targeted presets. **Certificate warnings**: SSL modules may generate errors on self-signed certs; this is expected behavior. **Output volume**: Recursive scans produce massive JSON/CSV files; ensure adequate disk space. **Module dependencies**: Some modules require external tools (Nuclei, Masscan); verify dependencies are installed.

## References

• https://github.com/blacklanternsecurity/bbot
• https://blacklanternsecurity.github.io/bbot/Stable/scanning/configuration/
• https://www.blacklanternsecurity.com/bbot/
• https://pypi.org/project/bbot/
• https://github.com/blacklanternsecurity/bbot/discussions/1920
