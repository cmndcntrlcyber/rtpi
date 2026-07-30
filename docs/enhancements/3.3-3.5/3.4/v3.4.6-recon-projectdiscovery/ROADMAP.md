# v3.4.6 — Recon & ProjectDiscovery Skills

**Priority:** P3
**Status:** Dockerfile Updated, Skills Pending
**Skill Category:** `skills/offense/recon/` (expand existing)
**Tools:** 16
**Parent:** [v3.4 Tool Catalogue](../v3.4.md)

---

## Objective

Expand the nexus-harness `recon/` skill category (currently 15 skills covering nmap, masscan, subdomain-enum, dns-recon, etc.) with 16 additional skills covering HTTP parameter discovery, subdomain wordlist generation, TLS/CDN/ASN fingerprinting, out-of-band testing, CVE mapping, and URL archive mining. Primarily ProjectDiscovery and tomnomnom ecosystem tools. All skills operate standalone inside nexus-kali -- independent of RTPI.

---

## Tool Inventory

| # | Tool | Purpose | Install Method | Skill Name |
|---|------|---------|----------------|------------|
| 1 | x8 | Hidden HTTP parameter discovery via brute-force/heuristic | cargo install x8 | `recon/x8-params` |
| 2 | arjun | HTTP parameter discovery via fuzzing | pip install arjun | `recon/arjun-params` |
| 3 | paramspider | Parameter mining from web archives (Wayback, CommonCrawl) | pip install paramspider | `recon/paramspider` |
| 4 | alterx | Subdomain wordlist generator with pattern-based permutation | binary download (projectdiscovery/alterx) | `recon/alterx-wordlist` |
| 5 | mapcidr | CIDR/subnet manipulation, aggregation, and filtering | binary download (projectdiscovery/mapcidr) | `recon/mapcidr` |
| 6 | tlsx | Fast TLS certificate grabber and analyzer | binary download (projectdiscovery/tlsx) | `recon/tlsx-certs` |
| 7 | cdncheck | CDN/WAF detection for target hosts | binary download (projectdiscovery/cdncheck) | `recon/cdncheck` |
| 8 | asnmap | ASN-to-CIDR mapping and IP range enumeration | binary download (projectdiscovery/asnmap) | `recon/asnmap` |
| 9 | cloudlist | Multi-cloud asset enumeration (AWS/GCP/Azure/DO) | binary download (projectdiscovery/cloudlist) | `recon/cloudlist` |
| 10 | proxify | HTTP/HTTPS proxy for traffic interception and logging | binary download (projectdiscovery/proxify) | `recon/proxify` |
| 11 | interactsh-client | Out-of-band interaction testing (DNS, HTTP, SMTP) | binary download (projectdiscovery/interactsh) | `recon/interactsh` |
| 12 | notify | Multi-provider notification engine (Slack, Discord, Telegram) | binary download (projectdiscovery/notify) | `recon/notify` |
| 13 | cvemap | CVE-to-EPSS/KEV mapping and vulnerability intelligence | binary download (projectdiscovery/cvemap) | `recon/cvemap` |
| 14 | anew / meg / qsreplace / unfurl | URL/parameter manipulation utilities | go install (tomnomnom/*) | `recon/tomnomnom-utils` |
| 15 | gau | Fetch known URLs from AlienVault OTX, Wayback, CommonCrawl | git clone lc/gau + go build | `recon/gau` |
| 16 | waybackurls | Fetch all URLs from the Wayback Machine for a domain | git clone tomnomnom/waybackurls + go build | `recon/waybackurls` |

---

## Skill Structure

Each skill follows the nexus-harness offense skill pattern:

```
skills/offense/recon/<skill-name>/
  SKILL.md          # YAML frontmatter + workflow sections
```

Standard sections per SKILL.md:
1. Scope Check (`$TARGET` domain/IP must be in scope)
2. Quick Workflow (common one-liner usage)
3. Technique Sections (detailed usage patterns, piping between tools)
4. Output Handling (results -> `/results/$ENGAGEMENT/recon/`)
5. Pitfalls (rate limiting, API key requirements, false positives)
6. Verification (confirm tool ran, output is valid)

---

## Acceptance Criteria

- [ ] 16 SKILL.md files created under `skills/offense/recon/`
- [ ] Each skill works standalone via `nexus` CLI inside nexus-kali
- [x] All 16 tools installed in nexus-kali image (`docker/Dockerfile` updated 2026-07-30 — arjun via kali-linux-everything; gau, waybackurls pre-existing; alterx, mapcidr, tlsx, cdncheck, asnmap, cloudlist, proxify, interactsh, notify, cvemap, anew, gf, qsreplace, unfurl via go install; x8 via cargo; paramspider via pip)
- [ ] Results output to `/results/$ENGAGEMENT/recon/<tool>/`
- [ ] Scope enforcement: all skills check target domain/IP against engagement scope before execution
- [ ] Skills reference MITRE ATT&CK techniques where applicable (Reconnaissance TA0043, Resource Development TA0042)
- [ ] Pipeline skills (gau, waybackurls, paramspider) tested with stdin/stdout piping for tool chaining
- [ ] ProjectDiscovery tools authenticated with PDCP API key where applicable (cvemap, interactsh, cloudlist)
- [ ] tomnomnom utilities bundled as a single skill with per-tool documentation

---

## Nexus-Kali Image Requirements

### Binary downloads (GitHub releases, all ProjectDiscovery)
```
alterx        -> projectdiscovery/alterx
mapcidr       -> projectdiscovery/mapcidr
tlsx          -> projectdiscovery/tlsx
cdncheck      -> projectdiscovery/cdncheck
asnmap        -> projectdiscovery/asnmap
cloudlist     -> projectdiscovery/cloudlist
proxify       -> projectdiscovery/proxify
interactsh    -> projectdiscovery/interactsh (client binary)
notify        -> projectdiscovery/notify
cvemap        -> projectdiscovery/cvemap
```

### pip (single layer)
```
arjun paramspider
```

### cargo
```
x8
```

### go install
```
github.com/tomnomnom/anew@latest
github.com/tomnomnom/meg@latest
github.com/tomnomnom/qsreplace@latest
github.com/tomnomnom/unfurl@latest
```

### git clone + go build
```
lc/gau
tomnomnom/waybackurls
```

### Build toolchain requirements
- Rust (rustup) for x8 compilation
- Go 1.21+ for tomnomnom utilities, gau, waybackurls
- These can be build-stage only; binaries copied to final image

### Runtime Prerequisites (not baked into image)
- ProjectDiscovery Cloud Platform API key (for cvemap, interactsh, cloudlist)
- Shodan API key (optional, for asnmap enrichment)
- Cloud provider credentials (for cloudlist: AWS/GCP/Azure)
- Notification provider tokens (for notify: Slack webhook, Discord webhook, etc.)

---

## Dependencies

- Existing skills to reference for structure: `recon/subdomain-enum`, `recon/nmap-scan`, `recon/dns-recon`, `recon/web-crawl`
- Existing `recon/shodan-recon` complements asnmap and cloudlist
- alterx output feeds into existing `recon/subdomain-enum` (httpx/subfinder) workflows
- gau and waybackurls complement existing `recon/js-analysis` and `recon/web-crawl`
- interactsh integrates with nuclei (already present in nexus-kali as part of existing recon workflow)

---

## Risks

| Risk | Mitigation |
|------|------------|
| ProjectDiscovery binary version drift | Pin versions in nexus-kali Dockerfile; use specific release tags |
| PDCP API key rate limiting | Skills document rate limits; batch queries where possible |
| Rust/Go build toolchain bloat in image | Multi-stage Docker build: compile in builder stage, copy binaries to slim final stage |
| Web archive data staleness | Skills note that gau/waybackurls/paramspider return historical data; validate with live checks |
| interactsh server availability | Default to public interact.sh; document self-hosted server setup for air-gapped engagements |
| tomnomnom tools lack active maintenance | Pin known-good versions; tools are simple/stable with minimal dependencies |
