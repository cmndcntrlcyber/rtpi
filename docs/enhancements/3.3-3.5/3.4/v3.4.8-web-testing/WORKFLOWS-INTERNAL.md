# v3.4.8 Web Testing — Internal Workflows

**Context:** Standalone nexus-kali usage via `nexus` CLI. No RTPI involved.

---

## Workflow 1: API Security Scan

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `web/apicheck-scan`, `web/astra-api`, `web/api-testing`

```
1. Scope check -> verify target API base URL is in engagement scope
2. Discover API endpoints:
   a. If OpenAPI spec available -> import into apicheck and Astra
   b. If no spec -> use web/api-testing to crawl and enumerate endpoints
3. apicheck pipeline:
   a. apicheck send-to -> pipe target endpoints through check modules
   b. Run JWT checks, CORS checks, rate-limit checks
   c. Output -> /results/$ENGAGEMENT/web/apicheck/
4. Astra scan:
   a. python astra.py --url $TARGET --loginurl $LOGIN_URL --loginmethod POST
   b. Run authenticated scan (injection, auth bypass, rate limiting, CORS)
   c. Output -> /results/$ENGAGEMENT/web/astra/
5. Consolidate findings:
   a. Merge apicheck and Astra results with api-testing output
   b. Deduplicate overlapping findings
   c. Consolidated output -> /results/$ENGAGEMENT/web/api-consolidated/
6. Feed consolidated results -> engagement-report skill
```

## Workflow 2: Traffic Interception & Analysis

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `web/mitmproxy-intercept`, `web/mitmproxy2swagger-extract`

```
1. Scope check -> verify target domain/IP is in engagement scope
2. Start mitmproxy:
   a. mitmdump -w /results/$ENGAGEMENT/web/mitmproxy/capture.flow --set flow_detail=3
   b. Configure target application to route through proxy (localhost:8080)
3. Capture traffic:
   a. Browse or interact with target application through proxy
   b. Automated crawling: use existing web/ skills (api-testing, browser-automation) routed through mitmproxy
4. Stop capture -> Ctrl+C or kill mitmdump process
5. Convert to OpenAPI spec:
   a. mitmproxy2swagger -i /results/$ENGAGEMENT/web/mitmproxy/capture.flow -o /results/$ENGAGEMENT/web/mitmproxy/openapi-spec.yaml -p https://$TARGET
   b. Review generated spec -> manually prune irrelevant endpoints
6. Analyze for security issues:
   a. Review captured requests for sensitive data in query strings
   b. Identify missing security headers (HSTS, CSP, X-Frame-Options)
   c. Flag authentication tokens transmitted insecurely
   d. Output analysis -> /results/$ENGAGEMENT/web/mitmproxy/analysis.md
7. Feed OpenAPI spec into Workflow 1 (API Security Scan) for automated testing
```

## Workflow 3: GraphQL Fingerprinting & Vulnerability Scan

**Trigger:** `/engage` or manual skill invocation
**Skills used:** `web/graphw00f-fingerprint`, `web/wapiti-scan`, `web/nuclei-scan`

```
1. Scope check -> verify GraphQL endpoint URL is in engagement scope
2. GraphQL fingerprinting:
   a. graphw00f -t https://$TARGET/graphql -> identify GraphQL server technology
   b. Output -> /results/$ENGAGEMENT/web/graphw00f/fingerprint.json
   c. Note server type (Apollo, Hasura, graphql-java, Ariadne, etc.)
3. Wapiti vulnerability scan:
   a. wapiti -u https://$TARGET -m all --scope url -o /results/$ENGAGEMENT/web/wapiti/
   b. Scan covers: XSS, SQL injection, file inclusion, command injection, SSRF, XXE
   c. For GraphQL specifically: test introspection queries, injection in query variables
4. Nuclei scan (existing skill):
   a. nuclei -u https://$TARGET/graphql -t graphql/ -> run GraphQL-specific templates
   b. Output -> /results/$ENGAGEMENT/web/nuclei/graphql/
5. Consolidate findings:
   a. Combine graphw00f server identification with vulnerability results
   b. Map findings to server-specific known CVEs based on fingerprint
   c. Consolidated output -> /results/$ENGAGEMENT/web/graphql-consolidated/
6. Feed consolidated results -> engagement-report skill
```
