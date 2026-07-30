# v3.4.8 — Web Testing Skills

**Priority:** P3
**Status:** Planning
**Skill Category:** `skills/offense/web/`
**Tools:** 6
**Parent:** [v3.4 Tool Catalogue](../v3.4.md)

---

## Objective

Expand the nexus-harness `web/` skill category from 22 skills to 28 skills covering web application vulnerability scanning, traffic interception and analysis, API specification extraction, GraphQL server fingerprinting, and API security testing. All skills operate standalone inside nexus-kali — independent of RTPI.

---

## Tool Inventory

| # | Tool | Purpose | Install Method | Skill Name |
|---|------|---------|----------------|------------|
| 1 | Wapiti | Web application vulnerability scanner (XSS, SQL injection, file inclusion, command injection, SSRF, XXE, and more) | git clone + pip (wapiti-scanner/wapiti) | `web/wapiti-scan` |
| 2 | mitmproxy | HTTP/HTTPS intercepting proxy for traffic capture, inspection, and modification | apt + pip | `web/mitmproxy-intercept` |
| 3 | mitmproxy2swagger | Convert mitmproxy traffic captures to OpenAPI/Swagger specifications | pip | `web/mitmproxy2swagger-extract` |
| 4 | graphw00f | GraphQL server fingerprinting and technology detection | git clone + pip (dolevf/graphw00f) | `web/graphw00f-fingerprint` |
| 5 | apicheck | API security testing suite with pipeline-based checks (BBVA) | git clone (BBVA/apicheck) | `web/apicheck-scan` |
| 6 | Astra | Automated REST API security testing (authentication, injection, rate limiting) | git clone (flipkart-incubator/Astra) | `web/astra-api` |

---

## Skill Structure

Each skill follows the nexus-harness offense skill pattern:

```
skills/offense/web/<skill-name>/
  SKILL.md          # YAML frontmatter + workflow sections
```

Standard sections per SKILL.md:
1. Scope Check (`$TARGET` must be in scope)
2. Quick Workflow (common one-liner usage)
3. Technique Sections (detailed usage patterns)
4. Output Handling (results -> `/results/$ENGAGEMENT/web/`)
5. Pitfalls (common mistakes, rate limiting, WAF detection)
6. Verification (confirm tool ran, output is valid)

---

## Acceptance Criteria

- [ ] 6 SKILL.md files created under `skills/offense/web/`
- [ ] Each skill works standalone via `nexus` CLI inside nexus-kali
- [ ] All 6 tools installed in nexus-kali image (see nexus-kali build manifest)
- [ ] Results output to `/results/$ENGAGEMENT/web/<tool>/`
- [ ] Scope enforcement: all skills check target against engagement scope before execution
- [ ] Skills reference MITRE ATT&CK techniques where applicable (Reconnaissance TA0043, Initial Access TA0001)
- [ ] Integration tested with existing web/ skills (api-testing, nuclei-scan, burpsuite-pro)

---

## Nexus-Kali Image Requirements

### git clone + pip
```
wapiti (wapiti-scanner/wapiti) — clone + pip install
graphw00f (dolevf/graphw00f) — clone + pip install
```

### apt + pip
```
mitmproxy — apt install mitmproxy + pip install mitmproxy (for latest version)
```

### pip only
```
mitmproxy2swagger — pip install mitmproxy2swagger
```

### git clone only
```
apicheck (BBVA/apicheck) — clone + follow repo setup
Astra (flipkart-incubator/Astra) — clone + pip install -r requirements.txt
```

### Runtime Prerequisites (not baked into image)
- Target URL in engagement scope
- mitmproxy CA certificate installed in target browser/application (for HTTPS interception)
- API credentials or authentication tokens for authenticated API testing (Astra, apicheck)
- GraphQL endpoint URL for graphw00f fingerprinting

---

## Dependencies

- Existing skill: `web/api-testing` — reference for API-focused skill structure and scope enforcement pattern
- Existing skill: `web/nuclei-scan` — complementary scanner, can chain with wapiti results
- Existing skill: `web/burpsuite-pro` — mitmproxy provides a lightweight alternative for traffic interception
- nexus-kali Dockerfile must include all tools above
- Python 3.9+ required for wapiti, mitmproxy, and mitmproxy2swagger

---

## Risks

| Risk | Mitigation |
|------|------------|
| Wapiti scan volume triggers WAF/IDS alerts | Skills include rate-limiting flags (--scan-force) and stealth guidance |
| mitmproxy CA trust requirements for HTTPS | Document CA certificate installation steps; warn about scope of interception |
| Stale git-cloned tools with no package manager updates | Pin commit hashes in nexus-kali build; document update procedure |
| apicheck and Astra repositories may be unmaintained | Monitor upstream activity; document fallback to api-testing skill |
| GraphQL endpoint detection false positives | graphw00f results should be verified manually before proceeding with exploitation |
| mitmproxy captures may contain sensitive data | Skills warn against storing captures outside engagement results directory; output sanitization guidance |
