---
name: arXiv
description: MCP server providing programmatic access to arXiv's repository of
  scientific papers via query, search, and metadata retrieval.
registry: mcp
tool_id: default:arxiv
category: mcp-server
tags:
  - arxiv
  - research
  - academic
  - osint
  - reconnaissance
  - mcp-server
  - scientific-papers
mitre_techniques:
  - T1595.002
summary: "The arXiv MCP server provides programmatic access to arXiv.org's
  repository of 1,000,000+ scientific papers in physics, mathematics, computer
  science, quantitative biology, finance, and statistics. Use it for
  reconnaissance to gather technical intelligence about adversary capabilities,
  emerging security research, exploit techniques, vulnerability analysis, or
  organizational research footprints. Invoke via MCP protocol; the server wraps
  arXiv's public API. Queries support field-specific searches (author, title,
  abstract, category, identifier) with Boolean logic, date filtering, pagination
  (max 300,000 results per query), and sorting by relevance/date. Results return
  as Atom feed metadata including titles, authors, abstracts, publication dates,
  categories, PDF/source URLs, and DOI/journal references. No authentication
  required—arXiv API is open access. Rate-limit to 1 request per 3 seconds
  minimum to comply with API Terms of Use. Primary operational value: identify
  researcher expertise, map organizational technical capabilities, discover
  proof-of-concept code in paper appendices, track emerging offensive/defensive
  techniques, and enumerate subject-matter experts. Expect structured metadata,
  not full-text; download PDFs separately if needed. Query syntax is
  critical—malformed queries return zero results without error messages."
sources:
  - https://docs.ropensci.org/aRxiv
  - https://info.arxiv.org/help/api/user-manual.html
  - https://info.arxiv.org/help/api/index.html
  - https://pypi.org/project/arxiv/1.4.8
  - https://info.arxiv.org/help/index.html
  - https://hackage.haskell.org/package/arxiv-client-cli
  - https://github.com/jbencina/arxivterminal
  - https://groups.google.com/a/arxiv.org/g/api/c/ZxAtZqj0Dmo
  - https://pypi.org/project/arxiv-update-cli
  - https://lobehub.com/skills/wentorai-research-plugins-arxiv-api
  - https://www.sciencedirect.com/science/article/abs/pii/S0167404824002505
  - https://arxiv.org/html/2507.00829v1
generated_at: 2026-09-04T02:30:08.493Z
generated_by: anthropic
source_hash: eb4f34dfc7d18a288104aa54b7d7e1b28b320abbcbe086e94de62a838e70c9e9
---

# arXiv

## Overview

The arXiv MCP server is a Model Context Protocol wrapper around the arXiv.org public API. ArXiv is a Cornell University Library project providing open-access scientific papers across STEM disciplines. This MCP server enables agents to search, retrieve metadata, and enumerate papers programmatically. It is invoked via `uvx --from git+https://github.com/blazickjp/arxiv-mcp-server arxiv-mcp-server` and communicates through the MCP protocol. The underlying arXiv API returns Atom-formatted XML feeds containing paper metadata (not full text). Primary use in red team contexts: technical reconnaissance, subject-matter expert enumeration, organizational research fingerprinting, and intelligence gathering on emerging offensive/defensive techniques published in academic literature.

## When to use

Use arXiv search during reconnaissance and intelligence-gathering phases when you need to: (1) identify researchers and subject-matter experts by name/affiliation to map organizational capabilities; (2) discover proof-of-concept exploits, vulnerability analyses, or offensive security techniques published in academic papers; (3) track emerging research in AI, machine learning, cryptography, or network security that may inform attack or defense strategies; (4) enumerate an organization's research output by querying author affiliations to understand technical focus areas; (5) find related work and citations to build a knowledge graph of technical expertise; (6) gather metadata on papers published within specific date ranges to track research trends; (7) identify papers in specific categories (e.g., cs.CR for cryptography/security, cs.AI for AI/ML) relevant to target technologies. Do NOT use for: full-text analysis (API returns metadata only), real-time threat intelligence (papers are pre-prints/publications, not live feeds), or high-volume scraping (rate limits apply).

## Authentication & setup

No authentication required. ArXiv API is fully open access. Setup: ensure `uvx` (pip/uv executable runner) is installed. The server is installed on-demand from GitHub: `uvx --from git+https://github.com/blazickjp/arxiv-mcp-server arxiv-mcp-server`. The MCP server handles API communication; the agent interacts via MCP protocol methods exposed by the server. Configuration: none required beyond MCP client setup. Constraints: arXiv API Terms of Use mandate respectful use—rate-limit to at least 1 request per 3 seconds. Do not hammer the API with rapid sequential queries. Acknowledge data usage per arXiv guidelines: 'Thank you to arXiv for use of its open access interoperability.' Do not brand projects with arXiv names/logos. Commercial use is permitted but discouraged from misrepresenting affiliation.

## Key commands / parameters

The MCP server exposes arXiv API query capabilities. Key parameters mirror the arXiv API specification:

**search_query**: Query string using field prefixes and Boolean logic. Field prefixes: `ti:` (title), `au:` (author), `abs:` (abstract), `cat:` (category, e.g., cs.CR, cs.AI), `id:` (arXiv identifier). Boolean operators: `AND`, `OR`, `ANDNOT`. Use `+` for OR, space-separated for AND, `-` for NOT. Example: `au:"John Doe" AND cat:cs.CR` searches for papers by John Doe in cryptography/security. Phrase matching uses quotes; substring matching is implicit.

**id_list**: Comma-separated arXiv IDs for direct lookups (e.g., `2301.00001,2301.00002`). Bypasses search; retrieves specific papers. If both `search_query` and `id_list` are provided, results are the intersection.

**start**: Pagination offset (default: 0). Use with `max_results` to paginate large result sets.

**max_results**: Number of results per request (default: 10; API max: 300,000). Set to high values cautiously—respect rate limits.

**sortBy**: Sort criterion—`relevance`, `lastUpdatedDate`, `submittedDate`. Default is relevance.

**sortOrder**: `ascending` or `descending`. Default varies by `sortBy`.

Date filtering (if server supports): `--after yyyy-mm-dd`, `--before yyyy-mm-dd` to filter by publication date. Verify server implementation as this may be a client-side feature.

Category codes: cs.AI (AI), cs.CR (crypto/security), cs.CL (computation/language), cs.LG (machine learning), math.*, physics.*, etc. See arXiv category taxonomy.

## Example workflows

**Workflow 1: Enumerate researchers at target organization**
Query: `au:"target.edu" AND cat:cs.CR` to find cryptography/security papers authored by affiliates of target.edu. Paginate with `start=0, max_results=100` then `start=100, max_results=100`. Parse author names, titles, publication dates. Cross-reference with LinkedIn/OSINT to map personnel expertise.

**Workflow 2: Discover recent ML security research**
Query: `cat:cs.LG AND (ti:adversarial OR ti:backdoor OR ti:poisoning)` sorted by `submittedDate descending` with date filter `after:2024-01-01`. Retrieve abstracts to identify novel attack vectors applicable to target ML systems.

**Workflow 3: Track emerging exploit techniques**
Query: `abs:"privilege escalation" AND cat:cs.CR` to find papers discussing privilege escalation. Download PDFs (URLs in Atom feed) for appendices with proof-of-concept code.

**Workflow 4: Map organizational research footprint**
Query: `au:"Doe, Jane" OR au:"Smith, John"` for known employees. Aggregate categories, co-authors, keywords to infer technical capabilities and collaborations.

**Workflow 5: Random paper discovery for lateral research**
Query broad category `cat:cs.CR`, sort by `submittedDate descending`, retrieve 1 random result from top 50 to explore unrelated security topics for creative attack ideation.

Always parse Atom XML/JSON response for: entry/id (arXiv ID), entry/title, entry/author, entry/summary (abstract), entry/published, entry/updated, entry/category, entry/link (PDF/abs URLs).

## Output format

The arXiv API returns results as Atom XML feeds (some clients parse to JSON). Each entry contains:

- **id**: Canonical arXiv identifier URL (e.g., `http://arxiv.org/abs/2301.00001v1`)
- **title**: Paper title
- **summary**: Abstract text
- **authors**: List of author names with optional affiliations
- **published**: Initial submission date (ISO 8601)
- **updated**: Last update date (ISO 8601)
- **categories**: Primary and secondary subject classifications (e.g., cs.CR, cs.AI)
- **links**: URLs for abstract page, PDF, source tarball
- **doi**: Digital Object Identifier (if available)
- **journal_ref**: Journal publication reference (if available)
- **comment**: Author comments (e.g., 'Accepted to XYZ conference')

Metadata only—full paper text is not included. PDF/source downloads require separate HTTP requests to URLs in `links`. Atom feed includes feed-level metadata: total results (`opensearch:totalResults`), start index (`opensearch:startIndex`), items per page (`opensearch:itemsPerPage`). Parse XML with standard libraries (ElementTree, lxml) or use arXiv client libraries that pre-parse. MCP server may normalize this to JSON; verify server's response schema.

## Common pitfalls

**1. Rate limiting**: ArXiv enforces politeness guidelines—minimum 3 seconds between requests. Rapid queries trigger soft bans. The MCP server may not enforce this; implement client-side delays.

**2. Query syntax errors**: Malformed queries return zero results without error messages. Use exact field prefixes (`ti:`, `au:`, `abs:`, `cat:`, `id:`), proper quoting for phrases, correct Boolean operators (AND, OR, ANDNOT). Test queries via arXiv web interface first.

**3. Pagination limits**: API maximum is 300,000 results, but retrieving large sets is slow and resource-intensive. Narrow queries with date/category filters. Use `start` and `max_results` conservatively.

**4. Metadata-only output**: API does not return full text. Abstracts are included but truncated in some contexts. Download PDFs separately if full content analysis is needed; this adds latency and storage requirements.

**5. Identifier format confusion**: ArXiv IDs have evolved. Old format: `arch-ive/YYMMNNN` (e.g., `hep-th/9901001`). New format: `YYMM.NNNNN` (e.g., `2301.00001`). Versions append `vN` (e.g., `2301.00001v2`). Use canonical URLs from API responses.

**6. Category code ambiguity**: Some papers have multiple categories. Query by primary category may miss relevant papers. Use OR logic across related categories (e.g., `cat:cs.CR OR cat:cs.LG` for ML security).

**7. Attribution requirements**: Failing to acknowledge arXiv per Terms of Use may violate acceptable use policies. Include attribution in tools/reports.

**8. Stale data assumptions**: ArXiv includes pre-prints; papers may be unreviewed, retracted, or superseded. Cross-check with DOI/journal references for peer review status.

## References

- arXiv API User Manual: https://info.arxiv.org/help/api/user-manual.html
- arXiv API Access & Terms of Use: https://info.arxiv.org/help/api/index.html
- arXiv Help Contents: https://info.arxiv.org/help/index.html
- Python arxiv library (reference): https://pypi.org/project/arxiv/1.4.8
- arXiv Skills Marketplace (query examples): https://lobehub.com/skills/wentorai-research-plugins-arxiv-api
- Academic research on LLMs for penetration testing: https://arxiv.org/html/2507.00829v1
- Red team automated testing modeling: https://www.sciencedirect.com/science/article/abs/pii/S0167404824002505
