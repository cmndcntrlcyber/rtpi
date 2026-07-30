# v3.4.6 Recon & ProjectDiscovery — Internal Workflows

**Context:** Standalone nexus-kali usage via `nexus` CLI. No RTPI involved.

---

## Workflow 1: Full Recon Pipeline

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `recon/asnmap`, `recon/mapcidr`, `recon/alterx-wordlist`, `recon/subdomain-enum` (existing), `recon/tlsx-certs`, `recon/cdncheck`, `recon/gau`, `recon/waybackurls`

```
1. Scope check -> verify target domain is in engagement scope
2. asnmap -d target.com -> resolve ASN and CIDR ranges
3. mapcidr -cidr <ranges> -> expand and filter IP ranges
4. alterx -l subdomains.txt -p '{{word}}.{{suffix}}' -> generate permuted subdomain wordlist
5. Feed wordlist into existing subdomain-enum skill (subfinder + httpx)
6. tlsx -l live-hosts.txt -> grab TLS certificates, extract SANs for additional subdomains
7. cdncheck -l live-hosts.txt -> identify CDN-fronted vs direct hosts
8. gau target.com -> fetch historical URLs from web archives
9. waybackurls target.com -> fetch Wayback Machine URLs
10. Deduplicate URLs: cat gau.txt waybackurls.txt | anew all-urls.txt
11. Results -> /results/$ENGAGEMENT/recon/full-pipeline/
```

### Key Outputs
- ASN and CIDR range mapping
- Expanded subdomain list (permuted + certificate-derived)
- CDN vs. direct host classification
- Historical URL archive (deduplicated)
- TLS certificate inventory with SAN extraction

---

## Workflow 2: Parameter Discovery

**Skills used:** `recon/arjun-params`, `recon/x8-params`, `recon/paramspider`, `recon/tomnomnom-utils`

```
1. Scope check -> verify target URLs are in engagement scope
2. paramspider -d target.com -> mine parameters from web archives
3. arjun -u https://target.com/endpoint -> discover hidden GET/POST parameters via fuzzing
4. x8 -u https://target.com/endpoint -w params.txt -> brute-force hidden parameters with heuristics
5. cat params.txt | qsreplace "FUZZ" -> prepare parameterized URLs for fuzzing
6. cat urls.txt | unfurl keys -> extract unique parameter names across all URLs
7. Results -> /results/$ENGAGEMENT/recon/parameters/
```

### Key Outputs
- Discovered hidden parameters per endpoint
- Parameterized URL list ready for injection testing
- Unique parameter key inventory across the target
- Archive-mined parameter patterns (historical)

---

## Workflow 3: TLS / CDN / ASN Fingerprinting

**Skills used:** `recon/tlsx-certs`, `recon/cdncheck`, `recon/asnmap`, `recon/mapcidr`, `recon/cloudlist`

```
1. Scope check -> verify target ranges are in engagement scope
2. asnmap -org "Target Corp" -> enumerate all ASNs owned by the target organization
3. mapcidr -cidr <asn-ranges> -aggregate -> merge overlapping CIDRs
4. tlsx -l ip-list.txt -san -cn -so -> extract TLS cert details (SANs, CN, org, issuer)
5. cdncheck -l ip-list.txt -resp -> classify each IP as CDN/WAF/direct
6. cloudlist -provider aws,gcp,azure -> enumerate cloud-hosted assets (requires cloud credentials)
7. Cross-reference: CDN-fronted hosts may need origin IP discovery; direct hosts are priority targets
8. Results -> /results/$ENGAGEMENT/recon/fingerprinting/
```

### Key Outputs
- Organization ASN inventory with CIDR ranges
- TLS certificate map (CN, SANs, issuer, expiry)
- CDN/WAF classification per host
- Cloud asset inventory (if cloud credentials provided)
- Direct-access host list (non-CDN targets)

---

## Workflow 4: Out-of-Band Testing

**Skills used:** `recon/interactsh`, `recon/proxify`, `recon/notify`, `recon/cvemap`

```
1. Scope check -> verify target is in engagement scope
2. interactsh-client -> start OOB interaction listener (generates unique subdomain)
3. Inject interactsh payload into target parameters (SSRF, XXE, blind XSS, DNS exfil)
4. Monitor interactsh-client output for callbacks (DNS, HTTP, SMTP)
5. proxify -http -listen 127.0.0.1:8888 -> set up transparent proxy for request/response logging
6. Route tool traffic through proxify for full request capture
7. cvemap -id CVE-2024-XXXXX -> check if discovered vulns map to EPSS scores and KEV catalog
8. notify -bulk -data findings.txt -> send findings to configured notification channels
9. Results -> /results/$ENGAGEMENT/recon/oob-testing/
```

### Key Outputs
- OOB interaction log (DNS callbacks, HTTP callbacks, SMTP interactions)
- Full request/response capture via proxy
- CVE-to-EPSS/KEV mapping for discovered vulnerabilities
- Notification delivery confirmation
