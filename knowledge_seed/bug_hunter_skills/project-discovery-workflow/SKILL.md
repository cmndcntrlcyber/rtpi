---
name: project-discovery-workflow
description: ProjectDiscovery toolchain operator reference. 20 CLI tools (pdtm tool manager, subfinder, naabu, katana, cloudlist, chaos, uncover, alterx, httpx, dnsx, tlsx, nuclei, interactsh, cvemap, notify, mapcidr, cdncheck, proxify, simplehttpserver, aix) organized as a 4-phase pipeline (Discover, Enrich, Detect, Notify) chained via stdin/stdout. Covers current flags, footguns, provider-config.yaml auth (PDCP_API_KEY, SHODAN_API_KEY, CENSYS_API_ID/SECRET, FOFA_EMAIL/KEY, QUAKE_TOKEN, HUNTER_API_KEY, ZOOMEYE_API_KEY), Nuclei v3 changes (-jsonl, -duc deprecation, -auth, flow/code protocols, self-contained templates, authenticated scanning via -secret-file), rate-limit tuning matrices, modern chains (SPA crawl with katana -headless, KEV-filtered nuclei via cvemap, JARM cert clustering with tlsx, ASN sweep via uncover, PDCP cloud upload with -pd / -auth), interactsh self-hosting on a VPS (NS records + -domain + -t token), notify provider-config webhooks, and PD-vs-BBOT positioning. Use when wiring up bug-bounty or pentest recon pipelines, troubleshooting subfinder providers, tuning nuclei -c/-bs/-rl/-rlm for the target box, or piping output into Slack/Discord/Jira via notify.
sources: docs.projectdiscovery.io, github.com/projectdiscovery, projectdiscovery.io/blog
report_count: 0
---

# ProjectDiscovery Toolchain — Operator Reference

ProjectDiscovery (PD) ships 20-some single-purpose Go CLIs that follow the
Unix philosophy: each does one thing, all chain on stdin/stdout, and all
agree on the same handful of conventions (`-list`, `-silent`, `-json`,
`-rl`, `-config`, `~/.config/<tool>/`). The result is a recon pipeline
you can compose with `|` and `tee`, rather than a monolith.

This reference is grouped into the four phases the tools fall into —
**Discover → Enrich → Detect → Notify** — plus a tool-manager (pdtm),
a Pipeline Cookbook, a cross-cutting Footguns table, a centralized
Provider Auth table, and Modern Patterns covering Nuclei v3+ flow,
the ProjectDiscovery Cloud Platform (PDCP), and PD-vs-BBOT positioning.

> **When to reach for PD vs a framework like BBOT**: PD wins when you
> want a transparent pipeline you read top-to-bottom in your shell
> history — small Unix tools you can swap in and out, with output you
> can grep and diff. BBOT wins when you want one tool that orchestrates
> a hundred modules and produces a unified asset graph. Most operators
> end up running both — BBOT for hands-off attack-surface monitoring,
> PD tools when actively hunting.

---

## pdtm — Tool Manager

Use `pdtm` for everything. Skipping it and `go install`-ing each tool
individually is the most common source of "I have nuclei v2, why don't
templates resolve?" pain.

```bash
go install -v github.com/projectdiscovery/pdtm/cmd/pdtm@latest  # needs Go 1.24.3+
pdtm -ia          # install all PD tools
pdtm -ua          # update all
pdtm -i nuclei,httpx,katana   # install a subset
pdtm -sp          # show the binary path
pdtm -up          # self-update pdtm itself
```

Binaries land in `$HOME/.pdtm/go/bin`, which pdtm appends to `$PATH` on
first run. **Restart the shell after install** — that's the "I tried
to use httpx and it won't work!" footgun. Pin a tool via
`go install …@v0.0.X` only when you specifically need to reproduce a
release; otherwise let `pdtm -ua` drive.

---

## Phase 1 — Discover (map attack surface)

### subfinder — passive subdomain enumeration

```bash
subfinder -d target.com -all -recursive -silent | tee subs.txt
```

**Key flags** (full list via `-h`):
- `-d / -dL` — single domain or file of domains.
- `-all` — uses every configured source (slow, more dupes; default
  uses a curated subset).
- `-recursive` — only sources that can recurse on found subdomains.
- `-active` — DNS-resolve discovered names; **required** for `-oI`
  (include IP) and `-nW` (filter wildcards).
- `-pc, -provider-config` — point at a different
  `provider-config.yaml`.
- `-s, -sources` / `-es, -exclude-sources` — narrow or block sources;
  `subfinder -ls` lists the ~30 supported.
- `-rl` — HTTP requests per second across sources.
- `-t` — concurrent resolution goroutines (only used with `-active`).
- `-oJ, -json` — JSONL output. Combine with `-cs` to include source
  attribution per record.
- `-r / -rL` — custom resolvers (file or comma list).

**Footguns**:
- `-all` without API keys returns a lot of junk from the noisier free
  sources. Configure providers first, then `-all` is actually useful.
- Default resolvers (`8.8.8.8` etc.) get rate-limited fast on big
  sweeps. Use your own resolver list (`trickest/resolvers`,
  `proabiral/Fresh-Resolvers`) and update it weekly.
- DNS caching at the source side can hide newly added subdomains —
  passive enum is a leading indicator, not a real-time signal.
- `subfinder -d example.com -oI -active` returns nothing if `-active`
  isn't paired with `-nW`; the IP-include path only fires on resolved
  records (see GitHub discussion #1126).

**Provider auth** (`~/.config/subfinder/provider-config.yaml`):
- Free-tier keys worth getting: chaos, virustotal, securitytrails,
  censys (250/mo), github, fullhunt, intelx, leakix, netlas.
- FOFA wants `email:key`, censys wants `api_id:api_secret`, github
  wants raw PATs.
- `passivetotal` uses `email:password`.
- Multiple keys per source rotate automatically.

### naabu — fast port scanner

```bash
sudo naabu -host target.com -top-ports 1000 -exclude-cdn -nmap-cli 'nmap -sV -oX scan.xml'
```

**Key flags**:
- `-host / -list / -eh / -ef` — input, exclusions.
- `-p`, `-tp top-ports {100|1000|full}`, `-ep`, `-pf` — port selection.
- `-s SYN|CONNECT` — scan type. SYN needs root; otherwise it silently
  falls back to CONNECT.
- `-c 25` — worker threads; `-rate 1000` — packets/sec.
- `-sV / -sV-fast / -sV-workers / -sV-probes` — built-in service
  version detection via the nmap-service-probes file.
- `-ec, -exclude-cdn` — for Cloudflare / Akamai / Incapsula / Sucuri
  IPs, only scan 80/443.
- `-cdn` — annotate detected CDN in output.
- `-passive` — use Shodan InternetDB (no packets sent).
- `-nmap-cli 'nmap -sV …'` — pipe found ports into a real nmap.
- `-metrics-port` — exposes JSON scan stats on localhost.
- `-iv 4,6 -sa` — scan all v4+v6 IPs a host resolves to.

**Footguns**:
- Default config assumes a VPS — local boxes need lower rates or you
  saturate your uplink and the scan looks "slow" while you're actually
  ddosing yourself.
- `-exclude-cdn` is *required* for Cloudflare/Akamai etc. unless you
  want to fingerprint the CDN, not the origin. Without it, you scan
  the CDN's IP pool and waste a lot of packets for `cloudflare:443`
  banner outputs.
- Without `sudo` you get CONNECT scans, which are slower and noisier
  (full TCP handshake, more IDS hits).
- Masscan goes faster but is less reliable; naabu is the right default
  for bug-bounty-scale lists where you re-probe with httpx anyway.

### katana — next-gen crawler

```bash
katana -u https://target.com -d 5 -jc -ps -iqp -kf all -c 30 -ef css,woff,svg
```

**Key flags**:
- `-u / -list` — input.
- `-d 5` — crawl depth.
- `-c 30 -p 10 -rl 100 -rlm 500` — concurrency, parallelism, rate
  limits (req/s and req/min).
- `-jc, -js-crawl` — parse endpoints out of JS bundles (the killer
  feature on SPAs).
- `-hl, -headless` — Chromium-backed crawl for React/Vue/Angular.
  Combine with `-sc, -system-chrome` to reuse the host Chrome,
  `-ho, -headless-options` for flags, `-nos, -no-sandbox` in
  containers, `-page-load-strategy {normal|eager|none}` to control
  the wait model.
- `-cs / -cos / -fs {dn|rdn|fqdn} / -ns / -do` — scope control.
- `-ef css,txt,md` extension filter; `-ndef` disables the default
  extension filter. `-mr / -fr` regex match/filter.
- `-kf all|robotstxt|sitemapxml|…` — known-file harvesters.
- `-iqp, -ignore-query-params` — collapses noisy parametric URLs.
- `-ps, -passive` — pull URLs from waybackmachine/commoncrawl/alienvault.
- `-aff, -automatic-form-fill` — fills forms during the crawl
  (experimental, worth turning on for endpoint discovery).
- `-jsonl` — structured output you can feed back into nuclei/httpx.

**Footguns**:
- Headless mode shells out to Chrome; on big lists you'll spawn
  hundreds of tabs and OOM. Cap with `-p 5 -c 10` first, then scale.
- DSL filters apply to *jsonl keys*, not the URL — `-fr` against the
  text URL works, `-fr` against a key needs the DSL pattern.
- `katana -u target.com -kf all` against SPA-heavy targets without
  `-headless` will look "shallow" because most endpoints only emit
  after JS execution.

### cloudlist — multi-cloud asset enumeration

```bash
cloudlist -provider aws,gcp,do -exclude-private -json | jq .
```

**Key flags**:
- `-pc, -provider-config` — `~/.config/cloudlist/provider-config.yaml`.
- `-p` / `-id` / `-s` — filter by provider, by provider-config id,
  by service (e.g. `-s ec2,route53,lambda`).
- `-host / -ip / -ep, -exclude-private` — output shape and pruning.

**Footguns**:
- Cloudlist is the *blue-team* tool — it inventories your accounts,
  not someone else's. Don't put it on a recon checklist for an
  external target.
- AWS supports `assume_role_arn` + `external_id` for cross-account
  scans; if the role isn't trusted to be assumed from your scanning
  account, the call silently returns zero assets.
- GCP has two modes: per-service APIs (fast, project-scoped) and
  the Cloud Asset Inventory API (org-wide; needs `cloudasset.assets.*`
  perms).
- Azure needs the explicit minimum role (see PD docs — VMs, NICs,
  Public IPs, DNS, Storage, AKS, CDN reads).
- 18 providers supported (aws, gcp, azure, alibaba, digitalocean,
  scaleway, heroku, linode, fastly, namecheap, cloudflare, hetzner,
  kubernetes, nomad, consul, terraform, openstack, ibm).

### chaos — PD's internet-wide DNS dataset

```bash
chaos -d uber.com -silent | httpx -silent -title -tech-detect
```

**Auth**: `PDCP_API_KEY` env var, OR `chaos -d uber.com -key XXX`.
Get the key from `cloud.projectdiscovery.io`. The old `CHAOS_KEY` env
is gone — use `PDCP_API_KEY`.

**REST**: `GET https://dns.projectdiscovery.io/dns/{domain}/subdomains`
with `Authorization: API_KEY`. Returns
`{"domain":"…","subdomains":["…"],"count":N}`.

**Footguns**:
- Chaos is a *snapshot*, not a live resolver. Subdomains that resolved
  hours ago may be stale; subdomains added in the last hour may be
  missing. Pair with subfinder and your own crt.sh poll.
- Bug-bounty programs that publish in-scope hosts to Chaos are the
  highest-signal targets — `chaos -d <program>` first, *then* enrich.

### uncover — query Shodan/Censys/FOFA/Quake/Hunter/ZoomEye/Netlas/CriminalIP/PublicWWW/HunterHow

```bash
uncover -q 'ssl:"target.com"' -e shodan,censys -ul 500 -uf 'host:port'
```

**Key flags**:
- `-q '…'` — query (stdin/file/CLI).
- `-e shodan,censys,fofa,quake,hunter,zoomeye,netlas,criminalip,publicwww,hunterhow,shodan-idb`
  — engine(s). Default is shodan.
- `-asq jira` — use ProjectDiscovery's curated "awesome search queries".
- `-uf ip:port|host:port|ip|host` — output field shape.
- `-ul 100` — limit (default 100).
- `-ur 60` — req/min when an engine doesn't expose its rate limit.
- Engine-specific aliases (`-s/-shodan`, `-sd/-shodan-idb`, `-ff/-fofa`,
  `-cs/-censys`, `-qk/-quake`, `-ht/-hunter`, `-ze/-zoomeye`,
  `-ne/-netlas`, `-cl/-criminalip`).
- Within nuclei: `-uc -uq '…' -ue shodan` to fan-out templates over
  uncover results.

**Auth** — environment variables (or
`~/.config/uncover/provider-config.yaml`):
- `SHODAN_API_KEY`, `CENSYS_API_ID`+`CENSYS_API_SECRET`,
  `FOFA_EMAIL`+`FOFA_KEY`, `QUAKE_TOKEN`, `HUNTER_API_KEY`,
  `ZOOMEYE_API_KEY`, `NETLAS_API_KEY`, `CRIMINALIP_API_KEY`,
  `PUBLICWWW_API_KEY`, `HUNTERHOW_API_KEY`.

**Footguns**:
- Each engine bills queries differently — Shodan free tier is 100
  results/mo, Censys is 250/mo. `-ul 500` against Shodan eats your
  monthly budget on a single command.
- FOFA *requires* `email:key`, not just `key`; subfinder/uncover both
  fail silently with "no API key defined" when only the key is set
  (see subfinder issue #1563).
- Shodan-idb is the free InternetDB — no key required, far less data
  than the paid Shodan engine.

### alterx — DSL-based subdomain permutation

```bash
chaos -d tesla.com | alterx -enrich -p '{{sub}}-{{word}}.{{suffix}}' | dnsx -silent
```

**Key flags**:
- `-l / -p / -pp` — input subdomains, pattern, payload (`key=value`).
- `-en, -enrich` — auto-extract words from the input as payloads.
- `-es, -estimate` — preview the permutation count before generating.
- `-limit / -ms 100mb / -o` — bound output size.
- `-ac` — point at a custom permutation config.

**DSL variables** (nuclei-style):
- `{{sub}}` — the input subdomain string.
- `{{word}}` — the payload word.
- `{{suffix}}` — the TLD/eTLD.
- `{{root}}` — the registered domain.

**Footguns**:
- Alterx generates *candidates*, not results — pipe to `dnsx -silent`
  to validate. Without `-enrich`, you'll generate millions of
  permutations that mostly resolve to nothing.
- The default permutation file lives at
  `~/.config/alterx/permutation_v0.0.1.yaml`; if you've edited it and
  pdtm later overwrites it, alterx silently picks up the new file.

---

## Phase 2 — Enrich (probe & fingerprint)

### httpx — the workhorse

```bash
cat subs.txt | httpx -silent -title -tech-detect -status-code -ip -cdn -jarm \
  -favicon -screenshot -srd /tmp/shots -rl 150 -jsonl > probes.jsonl
```

**Key flags**:
- Probes: `-title`, `-server`, `-td, -tech-detect`, `-status-code`,
  `-cl, -content-length`, `-location`, `-method`, `-cname`, `-ip`,
  `-asn`, `-cdn` (annotate CDN/WAF), `-jarm`, `-favicon`, `-bh, -body-hash`,
  `-hh, -header-hash`.
- `-screenshot -srd /path` — Chromium-driven full-page captures
  written to `<srd>/screenshot/<host>.png` plus an `<host>.txt` with
  metadata. Trims disk fast.
- `-nf, -no-fallback` — emit both HTTP and HTTPS, not just one. Pair
  with `-ports http:80,https:443,http:8080,https:8443` to enumerate
  non-standard ports.
- Rate: `-t 50` (threads), `-rl 150` (req/s, default 150),
  `-rlm` per-minute, `-delay 200ms`, `-timeout 10`, `-maxhr` max
  errors per host.
- Match/filter: `-mc 200,302`, `-mlc`, `-mwc`, `-fc`, `-fl`, etc.
- Burp / OpenAPI ingest: `-l burp-export.xml -im burp`, also
  `-im jsonl|yaml|openapi|swagger`.
- TLS: `-tls-probe`, `-tls-impersonate`, `-tls-grab`,
  `-min-tls-version`.
- `-fr, -follow-redirects`, `-fhr, -follow-host-redirects`.
- `-pd, -dashboard` / `-pdu, -dashboard-upload <jsonl>` — upload
  results to PDCP. `-auth` configures the API key; the env
  `ENABLE_CLOUD_UPLOAD=true` turns this on by default.
- `-fep, -filter-error-page` — emits a `filtered_error_page.json`
  side-file and removes soft-404s from the main output.
- `-sf, -secrets-file` — runs a YAML rule set against responses for
  obvious secret patterns.

**Output schema (`-jsonl`)** — common keys: `url`, `input`, `host`,
`port`, `scheme`, `status_code`, `content_length`, `title`,
`webserver`, `tech` (array), `cdn_name`, `cdn_type`, `ip`, `cname`,
`a` (array), `aaaa`, `asn`, `jarm`, `favicon`, `body_hash`,
`header_hash`, `time` (response time), `screenshot_path`. Feed the
same JSONL straight into nuclei v3.2 via `-im jsonl`.

**Footguns**:
- `-screenshot` writes one file per host. 50k subdomains = 50k PNGs;
  this *will* fill `/tmp`. Use `-srd` to point at a real disk and
  prune.
- `-tech-detect` is wappalyzer-based — accuracy is "best-effort",
  not authoritative. Always cross-check before reporting "site uses
  WordPress".
- `-cdn` is required upstream of nuclei when scanning shared
  infrastructure (Cloudflare, CloudFront). Without it, nuclei templates
  hit the CDN's response, not the origin, and you get phantom findings.
- Make sure you're on at least `httpx v1.6.7` for `-auth` / `-pd`;
  older builds silently drop the upload flag.

### dnsx — fast DNS toolkit

```bash
cat subs.txt | dnsx -silent -a -resp -cdn -asn -rl 1000 -auto-wildcard
```

**Queries**: `-a` (default), `-aaaa`, `-cname`, `-ns`, `-txt`, `-srv`,
`-ptr`, `-mx`, `-soa`, `-axfr`, `-caa`, `-any`.

**Probes**: `-cdn` (annotate CDN name), `-asn`.

**Rate/Resolvers**: `-t 100` threads, `-rl -1` (disabled by default —
**always set** this for big lists), `-retry 2`, `-r resolvers.txt`,
`-stream` (no resume/stats/wildcard, for low-mem scans).

**Bruteforce**: `dnsx -d target.com -w wordlist.txt` (use placeholders
like `WORD.target.com` for prefixed wordlists).

**Wildcard handling**:
- `-wd target.com -wt 5` — single-domain wildcard detection with
  threshold (default 5).
- `-auto-wildcard` — new in 2024+: detects wildcard roots across
  mixed-domain input automatically. Mutually exclusive with `-wd`.
- The PTR-on-CIDR / PTR-on-ASN trick: `echo 173.0.0.0/24 | dnsx -ptr`
  is a fast way to derive subdomains from a known range.

**Footguns**:
- Default `-r` resolvers can rate-limit your IP fast on big runs. A
  trusted resolver list is half the battle.
- Trace mode (`-trace`) recurses up to `-trace-max-recursion 32767`
  by default — fine for one host, not for 10k.
- `-resume` is incompatible with `-stream` mode.

### tlsx — TLS / cert intel

```bash
cat subs.txt | tlsx -silent -san -cn -jarm -ja3 -json -mode auto -pre-handshake
```

**Key flags**:
- `-u / -l` — input.
- `-san -cn` — extract Subject Alternative Names and Common Name from
  the cert (best subdomain pivot you'll get out of the recon phase).
- `-jarm` — JARM TLS fingerprint (passive infra clustering).
- `-ja3` — JA3 fingerprint.
- `-mode {auto|ctls|ztls|openssl}` — TLS stack. `ctls` is Go's
  `crypto/tls`, `ztls` is zcrypto/tls (faster, capped at TLS 1.2),
  `openssl` shells out, `auto` (default) tries ctls then ztls.
- `-pre-handshake` — terminate after `serverhello`; ~2x faster, but
  forces ztls mode (so TLS 1.2 ceiling).
- `-min-version tls12 -max-version tls13`, `-ci, -cipher-input` —
  cipher / version sweeps for misconfig hunting.
- `-expired -self-signed -mismatched -revoked` — flag misconfigured
  certs in output.

**Footguns**:
- `-pre-handshake` won't see TLS 1.3 servers correctly (zcrypto cap).
- `-jarm` is *one of many* fingerprints — cluster by JARM + favicon
  hash + server header for higher confidence.
- The cert SANs are an under-used subdomain source — pipe `tlsx -san`
  back into `dnsx`.

---

## Phase 3 — Detect (find vulns)

### nuclei — template-driven vulnerability scanner

```bash
nuclei -l targets.jsonl -im jsonl -severity critical,high \
  -t cves/,exposures/ -c 25 -bs 25 -rl 150 -jsonl -o nuc.jsonl -auth
```

**Current generation**: nuclei v3.x. v2 is end-of-life on
2026-03-01 (`nuclei-action@v2` and the legacy template directory
layout). Migrate now if you haven't.

**Key flags**:
- Targets: `-u`, `-l`, `-iv 4|6`, `-sa, -scan-all-ips`, `-eh` exclude
  hosts, `-resume <file>`.
- Templates: `-t path/`, `-w workflow.yaml`, `-tags cve,rce`,
  `-itags <tag>` (include tags marked dangerous by default),
  `-severity critical,high,medium,low,info`, `-tc <DSL>` (template
  condition), `-as, -automatic-scan`, `-disable-clustering`.
- Trust: `-sa` (signed-author), `-cs` (community signed),
  `-dut, -disable-unsigned-templates`. Use `-sign` to sign your own
  templates with `NUCLEI_SIGNATURE_PRIVATE_KEY`.
- Rate: `-c 25` (concurrent templates), `-bs 25` (targets per template
  in bulk), `-rl 150` (req/s), `-rlm` per-minute, `-timeout 10`,
  `-retries 1`, `-ldp leave-default-ports`, `-mhe 30 max-host-error`.
- I/O: `-jsonl`, `-o`, `-sresp / -srd` (store request/response),
  `-stats / -si 5 / -mp 9092` (metrics on localhost), `-cup, -cloud-upload`
  to PDCP.
- Update: `-update-templates` (regularly!), `-disable-update-check`
  (`-duc`, deprecated in v3.7+ — replaced by `-force-update-check`
  and a cached state file at `~/.cache/nuclei/update-state.gob`).
- Auth: `-auth` (configures `PDCP_API_KEY` via prompt or `-auth <key>`
  in v3.2+), `-tid team-id`, `-cup`, `-aname asset-name`.
- Interactsh: `-iserver oast.live,oast.pro,…` (CSV of servers),
  `-itoken` (self-hosted), `-no-interactsh` to disable OAST.
- Fuzzing (v3.2+): `-ft replace|prefix|postfix|infix`, `-fm multiple|single`,
  `-im jsonl|burp|openapi|swagger|yaml|postman` to ingest HTTP
  traffic from httpx/proxify/Burp.
- Uncover bridge: `-uc -uq '<query>' -ue shodan,censys` to fan out a
  template over an uncover result set.
- Authenticated scans (v3.2+): `-sf, -secret-file auth.yaml` plus
  `-ps prefetch-secrets`. The same secrets file works across all
  existing templates without per-template edits.

**Rate-limit tuning** (from the PD optimization guide):

| Hardware       | `-c` | `-bs` | `-rl` | `-timeout` | `-retries` |
| -------------- | ---- | ----- | ----- | ---------- | ---------- |
| 1 GB / 1 CPU   | 2    | 2     | 10    | 30         | 3          |
| 4 GB / 4 CPU   | 10   | 10    | 50    | 20         | 2          |
| 8 GB / 4–8 CPU | 25   | 25    | 200   | 15         | 1          |
| 32 GB+ / 16+   | 100  | 100   | 1000+ | 10         | 1          |

For bug-bounty programs that demand throttling (Intigriti, parts of
Bugcrowd), drop to `-rl 3 -c 2` and document the values in your
report.

**Footguns**:
- "9000 templates" doesn't mean "9000 distinct vulns" — many are
  variants, language localizations, or detection-only. Use `-tags
  cve,rce` + `-severity critical,high` first; expand if quiet.
- Templates with weak matchers cause false positives in waves
  (issue #12956 was a single bad day in the public set). When a
  template lights up, verify the match yourself before reporting.
- `-stop-at-first-match` is per-template, not global — and can break
  workflows that depend on multiple matches.
- Default templates include some DoS-shaped ones (`fuzz` / `dos`
  tags) excluded from default scans; only run with `-itags` if you
  have permission.
- `-code` is gated behind `-enable-self-contained` and a signed
  template by default; that's the safety net for the code protocol
  introduced in v3.0+.

### interactsh — OOB interaction server

```bash
interactsh-client -v -server oast.live          # use hosted (default)
interactsh-client -server interact.mydomain.com -token MY-TOKEN -v   # self-hosted
```

The hosted servers rotate (`oast.pro,oast.live,oast.site,oast.online,
oast.fun,oast.me`). For long-running scans or callbacks containing
sensitive metadata, **self-host**.

**Self-host recipe** (DigitalOcean / AWS Lightsail / Hetzner — any
$5/mo box works):
1. Buy a domain. In your registrar, add `ns1` and `ns2` glue records
   pointing to the VPS IP (Namecheap → Advanced DNS → "Personal DNS
   Server", or "Add nameserver"). Then change the domain's NS records
   to `ns1.<your-domain>`, `ns2.<your-domain>`.
2. Open ports on the VPS: 53/udp, 80, 443, 25, 587, 465, optionally
   8443 for the web client. LDAP needs 389; SMTPS needs 465.
3. `go install github.com/projectdiscovery/interactsh/cmd/interactsh-server@latest`
4. Run via systemd:
   ```
   ExecStart=/root/go/bin/interactsh-server \
     -domain interact.mydomain.com \
     -t SOME-RANDOM-TOKEN \
     -cidl 5 -cidn 6 \
     -hd /opt/interact-payloads/
   ```
   `-cidl/-cidn` shorten the correlation-id (the random subdomain
   payload prefix) for cleaner OOB strings.
5. From nuclei: `-iserver interact.mydomain.com -itoken SOME-RANDOM-TOKEN`.

**Footguns**:
- The hosted server's correlation IDs are long (`c2*...yyyyyn.oast.pro`).
  Some WAFs and SIEMs flag those as suspicious payloads. Self-hosting
  with `-cidl 5 -cidn 6` produces shorter, less obvious strings.
- Don't put your interactsh token in shell history — set it as an
  env var (`INTERACTSH_TOKEN`) and pass `-itoken $INTERACTSH_TOKEN`.

### cvemap — CLI over CVE databases

```bash
cvemap -auth                       # one-time PDCP setup
cvemap -kev -severity critical -product nginx,apache -l 10
cvemap -cs '>8' -es '>0.5' -poc -re -j | jq -r '.[].id' | nuclei -id -
```

**Note**: the github repo is now `projectdiscovery/cvemap` → **vulnx**
(rebranded). Both names work; vulnx adds richer filtering
(`--tags`, `--vuln-type`, `--vuln-age "<30"`, `--term-facets`,
`--range-facets`, `--detailed`).

**Key flags**:
- Filters: `-id`, `-v/-vendor`, `-p/-product`, `-eproduct`,
  `-s/-severity`, `-cs/-cvss-score '>7'`, `-es/-epss-score '>0.5'`,
  `-ep/-epss-percentile`, `-age '<30'`, `-a/-assignee`,
  `-vs/-vstatus {modified|confirmed|rejected|new|unconfirmed}`.
- Toggles (default `true`): `-kev` (CISA Known Exploited Vulnerabilities),
  `-t/-template` (has a nuclei template), `-poc` (has public POC),
  `-h1/-hackerone` (reported on H1), `-re` (remotely exploitable).
- Output: `-f field1,field2`, `-fe exclude_field`, `-lsi list-ids`,
  `-l 50`, `-offset`, `-j/-json`, `-q '<text>'` free-text search,
  `-epk` page-keys for interactive paging.

**Footguns**:
- Free-tier query budget per day on the PDCP CVE API — bulk pulls
  hit limits. Use `-q` instead of repeated single-CVE queries.
- The `-template true` filter is the fastest way to narrow to
  "things I can scan today with nuclei".

---

## Phase 4 — Notify & Plumbing

### notify — multi-platform alerting

```bash
subfinder -d target.com -silent | notify -bulk -id recon
nuclei -l targets -severity critical -o nuc.txt; notify -data nuc.txt -bulk -provider slack,discord
```

**Key flags**:
- `-bulk` — assemble all input into one message (chunked at `-cl 4000`
  by default; some providers chunk lower).
- `-data <file>` — input file (or pipe to stdin).
- `-p, -provider slack,discord,…` — restrict providers.
- `-id recon,vulns` — restrict to provider entries with these `id`s.
- `-mf, -msg-format 'Hey {{data}}'` — format string with helpers
  `{{datetime}}`, `{{date}}`, `{{time}}`, `{{count}}`, `{{data}}`.
- `-d, -delay 2` — seconds between sends (avoid rate-limiting on
  Discord webhooks).
- `-rl, -rate-limit 1` — alternative rate cap.
- `-pc, -provider-config notify.yaml` — alternate provider config.
- `-proxy http://…` — route through your own proxy for auditability.

**Provider config** (`~/.config/notify/provider-config.yaml`):
```yaml
slack:
  - id: recon
    slack_username: notify-bot
    slack_webhook_url: $SLACK_WEBHOOK   # env-var substitution supported
discord:
  - id: vulns
    discord_username: nuclei
    discord_webhook_url: $DISCORD_WEBHOOK
telegram:
  - id: vulns
    telegram_api_key: $TELEGRAM_BOT_TOKEN
    telegram_chat_id: "-1001234567890"
smtp:
  - id: digest
    smtp_server: smtp.gmail.com
    smtp_port: 587
    use_starttls: true
    smtp_password: $SMTP_PASSWORD
gotify:
  - id: ops
    gotify_host: https://gotify.internal
    gotify_token: $GOTIFY_TOKEN
```

Supported providers: Slack, Discord, Telegram, Pushover, Email (SMTP),
Microsoft Teams, Google Chat, Gotify, Custom Webhook.

**Footguns**:
- Webhook URLs are *capability secrets* — anyone with the URL can
  post to your channel. Don't put them in command lines (shell
  history, ps output, CI logs). Always use env-var substitution.
- Discord rate-limits aggressively per webhook; `-d 2 -cl 1800` is
  a safe default for bulk firehose runs.
- Telegram bot tokens leak the bot's identity — rotate if you
  accidentally commit the config file. `git-secrets` or
  `trufflehog --only-verified` saves you here.
- `-bulk` *concatenates* lines into a single message; for line-per-
  alert behavior (the default), omit `-bulk`.

### Utilities

#### mapcidr — CIDR math

```bash
mapcidr -cidr 173.0.84.0/24 -sbc 10                  # split into 10-host chunks
cat ips.txt | mapcidr -a                              # aggregate IPs to CIDR
cat ips.txt | mapcidr -aa                             # approximate aggregation
mapcidr -cl 'ips.txt,cidrs.txt' -f4                    # combine lists, filter IPv4
```

Flags: `-cidr/-cl`, `-sbc 10` (split by count), `-sbh 1024` (split by
host count), `-a/-aggregate`, `-aa/-aggregate-approx`, `-f4/-f6`
(filter), `-count`. Faster + more correct than ad-hoc Python for
prepping naabu input lists.

#### cdncheck — CDN/WAF detection

```bash
cat ips.txt | cdncheck -resp -silent       # tag each IP with provider
```

Standalone CLI plus a Go library many tools (naabu, httpx, metabigor)
embed. Knows Cloudflare, Akamai, Incapsula, Sucuri, Fastly,
CloudFront, plus less common players. Use it when you need a
*reason* to exclude IPs from a port scan, beyond naabu's built-in
`-exclude-cdn`.

#### proxify — Swiss army proxy

```bash
proxify -o logs/ -dump-req -dump-resp                  # HTTP :8888 / SOCKS5 :10080
proxify -dm 'api.target.com:127.0.0.1'                  # DNS mapping
proxify -mf 'host == "api.target.com"' -req-mf 'remove_header("X-Auth")'
```

**Key flags**:
- `-http-addr`, `-socks5-addr` — listen addresses.
- `-o logs/` — JSONL-per-request log dir; `-dump-req`, `-dump-resp`.
- `-dm domain:ip,domain:ip` — DNS mapping (override resolution).
- `-mf <DSL>` / `-req-mf` / `-resp-mf` — match filter + match-and-
  replace via DSL.
- `-cert`, `-key`, `-out-cert-path` — custom MITM CA for transparent
  TLS interception.
- `-elastic-url`, `-kafka-broker` — stream into your SIEM.
- `-upstream-proxy` — chain in front of Burp/Caido.

**Use cases**: full-fidelity request log for compliance / audit;
sit between Burp and the target to add structured logging;
*off-the-shelf* DNS rebinding via `-dm`; replay traffic into nuclei
v3.2 (`nuclei -im jsonl -input proxify.jsonl`).

#### simplehttpserver — Go take on Python's `http.server`

```bash
simplehttpserver -listen 0.0.0.0:8000 -upload -basic-auth user:pass -path /opt/share
simplehttpserver -tls -domain target.example.com -cert cert.pem -key cert.key
simplehttpserver -tcp 0.0.0.0:4444 -tls -rules tls-banner.yaml      # full TCP server
```

**Key flags**: `-listen`, `-path`, `-https / -cert / -key`,
`-basic-auth user:pass -realm "…"`, `-upload -max-file-size 100`,
`-cors`, `-sandbox`, `-tcp`, `-rules <yaml>`, `-verbose`.

Use it for: staging RCE payloads (`curl --upload-file shell.bin`),
serving SSRF callback content, running a quick TLS-banner emulator
when you're testing detection rules.

#### aix — LLM CLI

`aix` is a thin CLI wrapper to call LLM APIs from your terminal —
useful for one-shot prompts during recon ("classify these 200 titles
into categories"), but it's intentionally simple. If you want
template-driven AI workflows tied to scan results, you're really
looking at PDCP's template editor or nuclei v3.2's AI template
generation, not aix.

---

## Pipeline Cookbook

The recipes from the original SKILL.md, plus modern additions.

### 1. Classic external recon → vuln scan
```bash
subfinder -d target.com -silent \
  | dnsx -silent -resp -rl 1000 \
  | httpx -silent -title -tech-detect -status-code -jsonl \
  | nuclei -im jsonl -severity critical,high -t cves/
```

### 2. Cloud asset → vuln scan
```bash
cloudlist -silent -exclude-private -json \
  | jq -r '.host' \
  | httpx -silent \
  | nuclei -t cves/
```

### 3. ASN / network fingerprinting
```bash
subfinder -d target.com -silent | httpx -silent -asn -jsonl | jq -c '{host, asn}'
```

### 4. JARM TLS clustering (find sibling infra)
```bash
subfinder -d target.com -silent | httpx -silent -jarm -jsonl \
  | jq -r 'select(.jarm) | "\(.url)\t\(.jarm)"' | sort -k2 | uniq -f1 -c
```

### 5. Favicon hash hunting
```bash
subfinder -d target.com -silent | httpx -silent -favicon
# then pivot the hash:
uncover -q 'http.favicon.hash:-1234567890' -e shodan
```

### 6. Visual recon
```bash
subfinder -d target.com -silent | httpx -silent -screenshot -srd /tmp/shots
# review with: feh /tmp/shots/screenshot/ -F
```

### 7. Port-scan-driven probing
```bash
sudo naabu -host target.com -top-ports 1000 -exclude-cdn -silent \
  | httpx -silent -ports - \
  | nuclei -t exposures/
```

### 8. Real-time alerting layer
```bash
nuclei -l targets.txt -severity critical,high -silent \
  | notify -bulk -id vulns
```

### 9. SPA crawl (modern, JS-heavy targets)
```bash
katana -u https://app.target.com -headless -jc -kf all -d 5 -c 10 -p 3 -jsonl \
  | jq -r '.endpoint' \
  | httpx -silent -mc 200,401,403 \
  | nuclei -t exposures/,vulnerabilities/
```

### 10. KEV-filtered nuclei (only run templates for currently-exploited CVEs)
```bash
cvemap -kev -template -j -silent | jq -r '.[].id' | sort -u > kev-cves.txt
nuclei -l targets.txt -id "$(paste -sd, kev-cves.txt)" -severity critical,high
```

### 11. ASN sweep via uncover
```bash
uncover -q 'asn:"AS13335"' -e shodan,censys -uf 'host:port' -ul 500 -silent \
  | httpx -silent -title -tech-detect
```

### 12. Bug-bounty-friendly throttled chain (program demands rate limiting)
```bash
subfinder -d target.com -rl 5 -silent \
  | dnsx -silent -rl 50 \
  | httpx -silent -rl 5 -rlm 60 \
  | nuclei -rl 3 -c 2 -severity critical,high
```

### 13. Cert-pivot horizontal recon
```bash
tlsx -u target.com -san -cn -resp-only -silent \
  | sort -u | dnsx -silent -resp \
  | httpx -silent
```

### 14. Authenticated nuclei scan (v3.2+)
```bash
# auth.yaml:
# static:
#   - type: cookie
#     domains: ["target.com"]
#     cookies:
#       - key: session
#         value: $SESSION_COOKIE
nuclei -l targets.txt -sf auth.yaml -ps -severity high,critical
```

### 15. ProjectDiscovery Cloud handoff
```bash
httpx -auth                              # one-time
httpx -l subs.txt -silent -pd -aname "target.com-prod"   # upload as a named asset group
nuclei -list targets.txt -cloud-upload   # results appear in the dashboard
```

---

## Common Footguns (cross-cutting)

| What happens                                       | Why it bites                                                      | How to avoid                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `subfinder -all` returns 0 / very few              | No provider keys configured; the free sources alone are sparse    | Configure ≥5 free-tier providers; verify with `subfinder -ls` |
| `httpx -screenshot` fills `/tmp`                   | One PNG per host, no automatic rotation                            | `-srd /large/disk`; prune per-host older than N days          |
| naabu against `*.cloudflare-protected` is useless  | You're scanning the CDN's IP pool, not the origin                  | `-exclude-cdn` (and validate with `cdncheck` upstream)        |
| nuclei against shared CDN hosts thrashes neighbors | Rate-limit hits multiple tenants in the same /24                   | `-rl 3 -c 2` for bug-bounty; pair with `httpx -cdn`           |
| FOFA / Censys "no API key defined"                 | Wrong config format — they need `email:key` / `id:secret`          | Single string is the key; use the `:` separator               |
| `dnsx` saturates resolvers                         | Default rate is *unlimited*; default `-r` resolvers throttle hard  | Always set `-rl`; bring your own resolvers list               |
| `chaos -d target.com` returns nothing              | Missing `PDCP_API_KEY` — chaos requires auth, no free unauth path  | Get key from `cloud.projectdiscovery.io`; export env var       |
| Webhook URL in shell history                       | Anyone reading `~/.bash_history` (or your tmux scrollback) can post | Use env-var substitution in `provider-config.yaml`             |
| katana headless OOMs the box                       | Hundreds of Chromium tabs spawned in parallel                       | Cap `-p 5 -c 10` first; scale only after watching `top`        |
| Old `nuclei-templates` produce FPs                 | Templates updated daily; a stale clone misses fixes                | Run `nuclei -update-templates` weekly                          |
| "interact.sh callback in client logs"              | Hosted interactsh sees your payload metadata                        | Self-host for sensitive engagements                           |
| Self-XSS template fires on benign reflection       | Generic word matchers, no protocol gating                          | Pre-condition templates with method + path + tech signals     |
| Pipeline drops blank lines silently                | `subfinder | httpx` swallows lines with no protocol prefix          | Always `subfinder -silent` to suppress banners                 |

---

## Provider Auth & Secrets

| Tool/source       | Config path                                | Env var(s)                                                           | Notes                                                       |
| ----------------- | ------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| All PD tools      | n/a                                        | `PDCP_API_KEY`                                                       | Cloud upload, chaos, cvemap, nuclei `-auth`                 |
| subfinder         | `~/.config/subfinder/provider-config.yaml` | `SUBFINDER_*` per source                                             | `subfinder -ls` lists all sources                            |
| chaos             | n/a                                        | `PDCP_API_KEY`                                                       | Also accepts `-key XXX`                                     |
| uncover           | `~/.config/uncover/provider-config.yaml`   | `SHODAN_API_KEY`, `CENSYS_API_ID`+`CENSYS_API_SECRET`, `FOFA_EMAIL`+`FOFA_KEY`, `QUAKE_TOKEN`, `HUNTER_API_KEY`, `ZOOMEYE_API_KEY`, `NETLAS_API_KEY`, `CRIMINALIP_API_KEY` | Env vars take precedence over YAML                          |
| cloudlist         | `~/.config/cloudlist/provider-config.yaml` | `AWS_*`, `GOOGLE_APPLICATION_CREDENTIALS`, `AZURE_*`                 | AWS supports cross-account `assume_role_arn` + `external_id` |
| notify            | `~/.config/notify/provider-config.yaml`    | `SLACK_WEBHOOK`, `DISCORD_WEBHOOK`, `TELEGRAM_BOT_TOKEN`, `SMTP_PASSWORD`, `GOTIFY_TOKEN` | Use `$ENV` substitution inside the YAML                     |
| interactsh-server | `~/.config/interactsh-server/config.yaml`  | n/a                                                                  | `-t TOKEN` passed at startup; client passes `-token TOKEN`   |
| nuclei v3.2 auth  | per-template `auth.yaml` (passed via `-sf`) | per-template variables                                              | Future: HashiCorp Vault / AWS Secrets Manager / 1Password   |

**Secret discipline**:
- `chmod 0600 ~/.config/*/provider-config.yaml`.
- Add `.config/` and `*-config.yaml` to `~/.gitignore_global`.
- Never `cat` or `printenv` a config in screenshots or asciinema.
- Run `trufflehog --only-verified filesystem ~/.config` after a major
  refactor — it catches accidental key duplicates.
- Rotate the webhook tokens after any leaks; rotate the PD API key
  if you publish from a CI runner that other people can read.

---

## Modern Integration Patterns

### Nuclei v3 → v3.2 migration cheatsheet
- `-json` → `-jsonl` (the old `-json` was a JSON *array*, not lines).
- `-disable-update-check` / `-duc` is deprecated in v3.7+; new flag
  is `-force-update-check`, and an update-state cache lives at
  `~/.cache/nuclei/update-state.gob`.
- New protocols: `code:` (gated behind `-enable-self-contained` +
  signed templates), `javascript:` (LDAP brute-force, Kerberos,
  custom checks), `multi-protocol`.
- New template features: `flow:` (orchestrate multiple protocols
  inside one template), `pre-condition:` (skip the template unless
  DSL matches first), `self-contained: true` (no host required —
  use for cloud-config-review templates).
- Fuzzing: `-ft replace|prefix|postfix|infix|replace-regex`,
  `-fm multiple|single`, plus `-im` ingest from Burp/JSONL/OpenAPI/
  Swagger/Postman.
- Authenticated scans: `-sf auth.yaml -ps`. Works with every
  existing template — no template edits required.
- Signing: `-sign` with `NUCLEI_SIGNATURE_PRIVATE_KEY`; unsigned
  templates can be blocked with `-dut, -disable-unsigned-templates`.

### ProjectDiscovery Cloud Platform (PDCP)
- One API key (`PDCP_API_KEY`) authenticates **all** PD tools.
- `<tool> -auth` is a one-time interactive setup; persists the key.
- httpx `-pd`/`-dashboard` uploads probe results to the cloud
  dashboard. `-aname` groups them as named assets.
- nuclei `-cloud-upload` (or `-cup`) uploads scan results. `-tid
  TEAM-ID` targets a specific team.
- cvemap requires `-auth` to query the CVE API at all.
- Always set `ENABLE_CLOUD_UPLOAD=true` only if you genuinely want
  every run to upload — engagement data leaks otherwise.

### PD CLI vs BBOT
| Use PD CLI when…                                            | Use BBOT when…                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| You're hunting actively — composing pipelines in a shell     | You want hands-off attack-surface monitoring                   |
| You want grep-able JSONL you can diff between runs          | You want a unified asset graph + module DAG                    |
| You're integrating with proxies / Burp / Caido               | You want one tool that does everything end-to-end              |
| You need fine rate-limit control per stage                   | You want sensible defaults you don't think about               |
| You're writing custom Nuclei templates                       | You want OSINT + cloud + DNS + web in one binary               |

They're complementary, not exclusive — most operators run BBOT for
continuous discovery and the PD pipeline for targeted hunting.

### Burp / Caido handoffs
- `katana -hl -jsonl` → import into Burp via `proxify` as upstream;
  Burp's history is now the crawl plus the manual replays.
- `proxify -mf 'contains(path, "/admin")'` filters interesting traffic
  out of a noisy Burp session; pipe the JSONL into nuclei v3.2 via
  `-im jsonl`.
- Burp's project file → `nuclei -im burp -input file.xml` re-runs
  Burp-captured requests as fuzzing seeds.

### JSONL → SIEM / report
- All PD tools output a common-ish JSONL schema with `url`/`host`/
  `port`/`status_code`/`title`/`tech`/`time`.
- `notify -data results.jsonl -bulk -mf '{{datetime}} {{data}}'` is
  the lazy way; `proxify -elastic-url …` or `-kafka-broker …` is the
  production way.
- For Splunk/Elastic: use httpx/nuclei `-store-resp -srd resp/` to
  capture full bodies, then ship `resp/` as evidence alongside the
  JSONL index.

---

## Sources

Upstream PD documentation and blog posts that informed each section.
URLs grouped by tool so a reader can verify any specific claim.

**pdtm**: https://github.com/projectdiscovery/pdtm •
https://docs.projectdiscovery.io/opensource/pdtm/usage •
https://docs.projectdiscovery.io/quickstart •
https://projectdiscovery.io/blog/getting-started-with-projectdiscovery-in-linux-and-windows

**subfinder**: https://github.com/projectdiscovery/subfinder •
https://docs.projectdiscovery.io/opensource/subfinder/install •
https://docs.projectdiscovery.io/opensource/subfinder/running •
https://projectdiscovery.io/blog/do-you-really-know-subfinder-an-in-depth-guide-to-all-features-of-subfinder-beginner-to-advanced •
https://highon.coffee/blog/subfinder-cheat-sheet •
https://github.com/projectdiscovery/subfinder/discussions/1126 •
https://github.com/projectdiscovery/subfinder/discussions/1563

**naabu**: https://github.com/projectdiscovery/naabu •
https://docs.projectdiscovery.io/opensource/naabu/usage •
https://docs.projectdiscovery.io/opensource/naabu/running •
https://docs.projectdiscovery.io/opensource/naabu/overview

**katana**: https://github.com/projectdiscovery/katana •
https://projectdiscovery.io/blog/introducing-katana-the-best-cli-web-crawler •
https://projectdiscovery.io/blog/a-deep-dive-on-katana-field-extraction

**cloudlist**: https://docs.projectdiscovery.io/opensource/cloudlist/overview •
https://docs.projectdiscovery.io/opensource/cloudlist/providers •
https://docs.projectdiscovery.io/opensource/cloudlist/running •
https://docs.projectdiscovery.io/opensource/cloudlist/usage •
https://docs.projectdiscovery.io/cloud/integrations

**chaos**: https://chaos.projectdiscovery.io •
https://chaos.projectdiscovery.io/docs/api-key •
https://chaos.projectdiscovery.io/docs/fetch-subdomains •
https://github.com/projectdiscovery/chaos-client

**uncover**: https://docs.projectdiscovery.io/opensource/uncover/usage •
https://projectdiscovery.io/blog/uncover •
https://github.com/projectdiscovery/nuclei-docs/blob/main/docs/nuclei/get-started.md

**alterx**: https://docs.projectdiscovery.io/opensource/alterx/usage •
https://docs.projectdiscovery.io/opensource/alterx/running •
https://projectdiscovery.io/blog/introducing-alterx-simplifying-active-subdomain-enumeration-with-patterns

**httpx**: https://github.com/projectdiscovery/httpx •
https://docs.projectdiscovery.io/opensource/httpx/overview •
https://docs.projectdiscovery.io/opensource/httpx/running •
https://docs.projectdiscovery.io/opensource/httpx/usage •
https://projectdiscovery.io/blog/introducing-httpx-dashboard-2 •
https://highon.coffee/blog/httpx-cheat-sheet

**dnsx**: https://github.com/projectdiscovery/dnsx •
https://docs.projectdiscovery.io/opensource/dnsx/overview •
https://docs.projectdiscovery.io/opensource/dnsx/usage

**tlsx**: https://projectdiscovery.io/blog/a-hackers-guide-to-ssl-certificates-featuring-tlsx

**nuclei**: https://github.com/projectdiscovery/nuclei •
https://docs.projectdiscovery.io/opensource/nuclei/running •
https://projectdiscovery.io/blog/ultimate-nuclei-guide •
https://projectdiscovery.io/blog/nuclei-3-2 •
https://projectdiscovery.io/blog/scanning-login-protected-targets-with-nuclei •
https://projectdiscovery.io/blog/nuclei-fuzzing-for-unknown-vulnerabilities •
https://blog.projektckmt.com/blog/optimizing-nuclei-mass-scanning-strategies-configurations •
https://github.com/projectdiscovery/nuclei-action/discussions/104 •
https://github.com/projectdiscovery/nuclei/issues/6672

**interactsh**: https://github.com/projectdiscovery/interactsh •
https://docs.projectdiscovery.io/opensource/interactsh/server •
https://docs.projectdiscovery.io/opensource/interactsh/running •
https://projectdiscovery.io/blog/nuclei-interactsh-integration •
https://projectdiscovery.io/blog/interactsh-v1

**cvemap**: https://github.com/projectdiscovery/cvemap •
https://docs.projectdiscovery.io/opensource/cvemap/usage •
https://docs.projectdiscovery.io/opensource/cvemap/running •
https://projectdiscovery.io/blog/announcing-cvemap-from-projectdiscovery •
https://projectdiscovery.io/blog/future-of-automating-nuclei-templates-with-ai

**notify**: https://github.com/projectdiscovery/notify •
https://docs.projectdiscovery.io/opensource/notify/overview •
https://docs.projectdiscovery.io/opensource/notify/running •
https://docs.projectdiscovery.io/opensource/notify/provider-config •
https://github.com/projectdiscovery/notify/releases

**mapcidr / cdncheck / proxify / simplehttpserver / aix**:
https://docs.projectdiscovery.io/opensource •
https://projectdiscovery.io/blog/projectdiscovery-best-kept-secrets •
https://projectdiscovery.io/blog/proxify-portable-cli-based-proxy •
https://github.com/projectdiscovery/simplehttpserver •
https://github.com/projectdiscovery/aix

**Cross-cutting / PDCP / templates**:
https://docs.projectdiscovery.io/opensource •
https://docs.projectdiscovery.io/templates/faq •
https://projectdiscovery.io/blog/aws-cloud-security-config-review-using-nuclei-templates •
https://projectdiscovery.io/blog/gcp-cloud-configuration-review-templates-nuclei-templates-v10-2-0 •
https://projectdiscovery.io/blog/building-one-shot-recon
