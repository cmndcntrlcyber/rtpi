---
name: arXiv
description: MCP server providing programmatic access to arXiv's academic paper
  repository via REST API queries
registry: mcp
tool_id: default:arxiv
category: mcp-server
tags:
  - research
  - arxiv
  - mcp-server
  - academic-papers
  - osint
  - information-gathering
  - reconnaissance
mitre_techniques:
  - T1592
  - T1589
summary: "arXiv MCP server wraps the arXiv.org API to search and retrieve
  academic papers. Use for reconnaissance on adversary research, discovering
  published vulnerability details, finding author affiliations/contacts, or
  identifying institutional research focus. Invoke via MCP protocol; server runs
  as `uvx --from git+https://github.com/blazickjp/arxiv-mcp-server
  arxiv-mcp-server`. Queries use arXiv field prefixes (ti: title, au: author,
  abs: abstract, cat: category, id: ID) with Boolean operators. API limit is
  300,000 results per query; default max_results often 10-50. Returns Atom XML
  containing title, authors, abstract, categories, PDF URL, published/updated
  dates. Rate-limit to ~1 req/3sec per arXiv Terms. Common pitfall: advanced
  query syntax is strict (field:value format required). Not a
  penetration-testing tool itself but useful for OSINT on target organizations,
  researcher identities, and technical domain expertise before social
  engineering or targeted campaigns."
sources:
  - https://docs.ropensci.org/aRxiv
  - https://info.arxiv.org/help/api/user-manual.html
  - https://info.arxiv.org/help/api/index.html
  - https://lukasschwab.me/arxiv.py
  - https://pypi.org/project/arxiv/1.4.8
  - https://hackage.haskell.org/package/arxiv-client-cli
  - https://github.com/jbencina/arxivterminal
  - https://groups.google.com/a/arxiv.org/g/api/c/ZxAtZqj0Dmo
  - https://www.lchiarini.com/python/arxiv/2023/03/29/arxiv-today.html
  - https://lobehub.com/skills/wentorai-research-plugins-arxiv-api
  - https://arxiv.org/pdf/2507.00829
  - https://arxiv.org/search/cs?searchtype=author&query=Ahn%2C+M+K
generated_at: 2026-09-03T12:38:49.510Z
generated_by: anthropic
source_hash: eb4f34dfc7d18a288104aa54b7d7e1b28b320abbcbe086e94de62a838e70c9e9
---

# arXiv

## Overview

arXiv MCP server is a Model Context Protocol wrapper around the arXiv.org REST API, providing access to 1,000,000+ open-access papers in physics, mathematics, computer science, quantitative biology/finance, and statistics. The server translates MCP calls into arXiv API HTTP GET requests and returns structured metadata. arXiv itself is a Cornell University Library project offering preprints and published papers. The MCP server enables AI agents to search by author, title, abstract, category, or ID; retrieve paper metadata; and obtain PDF URLs. It does NOT download PDFs or full text directly—only metadata. API responses are Atom XML feeds parsed by the server.

## When to use

Use arXiv MCP server for:
- OSINT on target organizations: identify research focus, ongoing projects, or institutional expertise by searching author affiliations or categories
- Author profiling: enumerate papers by specific researchers to map expertise, co-author networks, or institutional ties
- Vulnerability research: find academic papers describing vulnerabilities, exploits, or security techniques (e.g., 'search_query=abs:penetration+testing+AND+cat:cs.CR')
- Technology reconnaissance: discover published research on technologies used by targets (ML models, cryptographic implementations, network protocols)
- Social engineering prep: gather author contact info, institutional affiliations, and research interests from paper metadata
- Timeline analysis: track publication dates to understand when research was active or when vulnerabilities were disclosed
- Do NOT use for: downloading paper PDFs (only URLs returned), bulk data scraping (violates Terms; use bulk data access instead), or real-time exploit development (arXiv is not exploit database)

## Authentication & setup

No authentication required. arXiv API is open access. Setup:
1. Ensure Python 3.8+ and uvx installed
2. RTPI invokes: `uvx --from git+https://github.com/blazickjp/arxiv-mcp-server arxiv-mcp-server`
3. MCP client connects via stdio transport
4. No API keys, tokens, or registration needed
5. Review arXiv API Terms of Use: rate-limit to ~1 request per 3 seconds; do not use arXiv branding; acknowledge usage with 'Thank you to arXiv for use of its open access interoperability'
6. For commercial use: review arXiv affiliate program and brand guidelines
7. Server maintains no state; each MCP call is independent HTTP GET to http://export.arxiv.org/api/query

## Key commands / parameters

MCP server exposes arXiv API query parameters as MCP tool arguments (exact names depend on server implementation; infer from canonical arXiv API):
- search_query: arXiv query string using field prefixes and Boolean logic. Field prefixes: ti (title), au (author), abs (abstract), cat (category), co (comment), jr (journal reference), id (arXiv ID), all (all fields). Operators: AND, OR, ANDNOT, ( ). Example: 'au:"Albert Einstein" AND cat:physics'
- id_list: comma-separated arXiv IDs (e.g., '2301.00001,1706.03762') for direct lookup. If both search_query and id_list provided, returns union.
- start: zero-indexed offset for pagination (default 0)
- max_results: number of results to return (default varies, often 10; API max 300,000 per query). Set high for exhaustive searches but mind rate limits.
- sortBy: 'relevance' (default), 'lastUpdatedDate', 'submittedDate'
- sortOrder: 'descending' (default) or 'ascending'
Examples:
- Search by author: search_query='au:"John Doe"'
- Search by category: search_query='cat:cs.CR' (crypto/security)
- Keyword in abstract: search_query='abs:"SQL injection"'
- Combined: search_query='ti:penetration AND cat:cs.CR AND submittedDate:[20230101 TO 20231231]'
- Direct ID: id_list='2301.00001'

## Example workflows

1. Profile target researcher:
   - search_query='au:"Jane Smith"', max_results=100, sortBy='submittedDate', sortOrder='descending'
   - Extract institutional affiliations, co-authors, research topics from results
   - Use for social engineering context or identifying internal collaborators

2. Find security research on specific tech:
   - search_query='abs:"kubernetes security" AND cat:cs.CR', max_results=50
   - Review abstracts for known vulnerabilities or attack techniques
   - Obtain PDF URLs for detailed read

3. Enumerate institutional output:
   - search_query='all:"MIT CSAIL"', max_results=200, sortBy='submittedDate'
   - Map research areas, active projects, faculty expertise

4. Track vulnerability disclosure timeline:
   - search_query='abs:CVE-2023-12345 OR ti:CVE-2023-12345'
   - Check published/updated dates to correlate with exploit development

5. Discover co-author networks:
   - search_query='au:"Target Researcher"', max_results=100
   - Parse author lists to build collaboration graph
   - Pivot to co-authors' papers for broader org understanding

6. Keyword-based exploit research:
   - search_query='abs:"buffer overflow" AND cat:cs.CR', sortBy='lastUpdatedDate', max_results=30
   - Filter recent papers for new techniques

## Output format

arXiv API returns Atom 1.0 XML feed. MCP server parses and returns structured JSON/dict per paper entry. Typical fields:
- id: arXiv identifier URL (e.g., http://arxiv.org/abs/2301.00001v1)
- updated: ISO 8601 timestamp of last update
- published: ISO 8601 timestamp of original publication
- title: paper title (string)
- summary: abstract text (string, can be long)
- authors: list of {name: string, affiliation: string (if available)}
- categories: list of arXiv category codes (e.g., ['cs.CR', 'cs.AI'])
- primary_category: main category
- links: list of URLs including {title: 'pdf', href: 'http://arxiv.org/pdf/...'} and {title: 'doi', href: '...'}
- comment: author comments (string, optional)
- journal_ref: journal reference (string, optional)
- doi: DOI if available
Expect array of these objects for multi-result queries. Empty array if no matches. Errors return HTTP status codes (e.g., 400 for malformed query). MCP server may transform XML to JSON; confirm exact schema from server docs or runtime inspection.

## Common pitfalls

- Rate limiting: arXiv requests <1 req/3sec average. Bulk queries trigger 503 errors or IP bans. Use start/max_results pagination with delays.
- Query syntax errors: field prefixes required (au:, ti:, abs:, cat:). Plain text searches fail. Wrap multi-word phrases in quotes: ti:"deep learning"
- Boolean operator strictness: must be uppercase (AND, OR, ANDNOT). Lowercase 'and' treated as keyword.
- Result limits: max_results caps single response; API overall limit 300,000. Large result sets require pagination (increment start by max_results).
- Metadata-only: API does not return PDF content, only URLs. Downloading PDFs is separate HTTP GET (mind rate limits).
- Category codes: use official arXiv taxonomy (cs.CR for crypto, cs.AI for AI, etc.). Incorrect codes return zero results.
- ID format: arXiv IDs are YYMM.NNNNN or archive/YYMMNNN (older). Version suffixes (v1, v2) optional.
- Date searches: use [YYYYMMDD TO YYYYMMDD] in submittedDate or lastUpdatedDate fields, not freeform text.
- Affiliation data: often missing or unstructured in author metadata; not reliable for precise org mapping.
- API Terms: do not brand tools with 'arXiv' name, do not scrape entire corpus via API (use bulk data access), acknowledge usage.
- MCP server errors: if server unavailable, falls back to direct HTTP; confirm server process running in RTPI.

## References

- https://info.arxiv.org/help/api/user-manual.html
- https://info.arxiv.org/help/api/index.html
- https://arxiv.org/help/api/user-manual#subject_classifications
- https://pypi.org/project/arxiv/1.4.8
- https://lukasschwab.me/arxiv.py
- https://github.com/blazickjp/arxiv-mcp-server
