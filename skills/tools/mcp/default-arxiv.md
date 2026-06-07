---
name: arXiv
description: MCP server providing programmatic access to arXiv scholarly
  preprints via query and metadata retrieval
registry: mcp
tool_id: default:arxiv
category: mcp-server
tags:
  - arxiv
  - research
  - mcp-server
  - osint
  - academic
  - papers
  - metadata
summary: arXiv MCP server enables searching and retrieving academic preprints
  from arXiv.org API during reconnaissance and research phases. Invoke via MCP
  protocol; server wraps arXiv REST API with query construction
  (title/author/abstract/category fields, Boolean operators), metadata
  extraction (authors, abstracts, categories, dates), and paper ID resolution.
  Returns Atom XML parsed to structured data. Use for target profiling (find
  papers by employees/affiliations), technology reconnaissance (identify
  techniques/tools mentioned in research), and domain expertise mapping. No
  authentication required; respect rate limits and Terms of Use. Output includes
  title, authors, abstract, primary_category, publication dates, and PDF/source
  links. Server handles query construction; agent provides search intent. Not
  for bulk downloads (>30k results) or real-time threat intel—papers are
  preprints, not vetted exploits.
sources:
  - https://info.arxiv.org/help/api/user-manual.html
  - https://ieeevis.org/year/2024/info/open-practices/arxiv-first-time-user
  - https://info.arxiv.org/help/submit/index.html
  - https://www.cardenas.sites.wfu.edu/arxiv/
  - https://info.arxiv.org/help/api/index.html
  - https://hackage.haskell.org/package/arxiv-client-cli
  - https://hermes-agent.nousresearch.com/docs/user-guide/skills/bundled/research/research-arxiv
  - https://www.sxolar.org/user-guide/command-line/
  - https://cran.r-project.org/web/packages/aRxiv/aRxiv.pdf
  - https://www.offsec.com/blog/red-teaming-vs-pentesting/
  - https://livrepository.liverpool.ac.uk/3138094/1/200928649_Sep2021.pdf
  - https://arxiv.org/html/2602.18483v1
generated_at: 2026-05-19T10:56:25.043Z
generated_by: anthropic
source_hash: eb4f34dfc7d18a288104aa54b7d7e1b28b320abbcbe086e94de62a838e70c9e9
---

# arXiv

## Overview

arXiv MCP server (arxiv-mcp-server) provides structured access to arXiv.org's corpus of 100,000+ scholarly preprints via the public arXiv API. Hosted as an MCP server exposing search and retrieval tools through Model Context Protocol. Server translates high-level queries into arXiv API calls, parses Atom XML responses, and returns structured metadata. Covers computer science, physics, mathematics, and other domains. Papers are author-submitted preprints, not peer-reviewed—treat content accordingly during OSINT or research tasks.

## When to use

Use during reconnaissance to profile targets by academic output (find papers authored by employees, map organizational research interests, identify collaboration networks). Query for technical intelligence (e.g., 'cat:cs.CR AND ti:fuzzing' to discover fuzzing research that may inform target defenses). Map domain expertise of individuals or teams. Identify preprints describing proprietary techniques, algorithms, or system architectures that may be deployed in target environments. NOT suitable for finding active exploits (use vuln databases), real-time threat intel, or assessing production security postures—arXiv hosts theoretical/experimental research, not operational security data.

## Authentication & setup

No API key required. arXiv API is publicly accessible. Invoke server via: uvx --from git+https://github.com/blazickjp/arxiv-mcp-server arxiv-mcp-server. Server runs as MCP endpoint; agent interacts through MCP protocol tools exposed by server (query, fetch by ID). Review arXiv API Terms of Use (https://info.arxiv.org/help/api/tou.html) before sustained use: rate-limit to 1 request/3 seconds, implement exponential backoff on 503 errors, include descriptive User-Agent identifying your project. No authentication credentials to manage; risk of account lockout is zero but IP-level rate limiting applies.

## Key commands / parameters

MCP server exposes tools (exact names depend on server implementation; typically 'search' or 'query' and 'get_paper'). Core parameters mirror arXiv API:

**Search/query tool:**
- search_query: Construct with prefix operators: ti: (title), au: (author), abs: (abstract), cat: (category, e.g. cs.CR, cs.AI), all: (anywhere). Boolean: AND, OR, ANDNOT. Example: 'au:"Jane Doe" AND cat:cs.LG'
- id_list: Comma-separated arXiv IDs (e.g. '2101.00001v1,1234.56789')
- start: Result offset (0-based)
- max_results: Limit per query (default 10, API max 30000—use pagination for large sets)
- sortBy: 'relevance', 'lastUpdatedDate', 'submittedDate'
- sortOrder: 'ascending', 'descending'

**Get paper tool:**
- id: arXiv identifier (e.g. '2101.00001' or '2101.00001v1')

Query supports exact phrase (quotes), substring match (default), field-specific searches. Categories use arXiv taxonomy (cs.CR=Cryptography, cs.AI=AI, etc.; see https://arxiv.org/category_taxonomy).

## Example workflows

**Workflow 1: Profile target organization's ML research**
Query: 'au:"*@targetcorp.com" AND cat:cs.LG' with sortBy='submittedDate', sortOrder='descending', max_results=50. Parse author affiliations, abstract keywords (e.g., frameworks used: PyTorch, TensorFlow), collaboration networks. Cross-reference author names with LinkedIn/OSINT to map roles.

**Workflow 2: Identify adversarial ML defenses**
Query: 'cat:cs.CR AND (ti:adversarial OR abs:"adversarial examples") AND submittedDate:[20230101 TO 20241231]'. Review abstracts for deployed defense mechanisms (input sanitization, model hardening). Note: papers describe research prototypes, not confirmed production deployments.

**Workflow 3: Map individual expertise**
Query: 'au:"John Smith"' → retrieve all papers. Extract co-authors, primary categories, publication velocity. Correlate with target's security team to assess defensive capability (e.g., if author published on IDS evasion, expect sophisticated monitoring).

**Workflow 4: Technology reconnaissance**
Query: 'all:"Company XYZ" AND cat:cs.SE' → find papers mentioning target's products/codebases. Abstracts may reveal architecture details, dependencies, or design decisions useful for threat modeling.

## Output format

Server returns structured data parsed from arXiv API's Atom XML. Typical fields per entry:
- id: arXiv identifier URL (extract ID from URL)
- title: Paper title
- authors: List of {name: string} objects
- summary: Abstract text
- published: ISO 8601 date (initial submission)
- updated: ISO 8601 date (latest version)
- primary_category: Main arXiv category (e.g., cs.CR)
- categories: List of all categories
- links: Array with {title, href} for PDF, abs page, DOI (if available). PDF link format: http://arxiv.org/pdf/{id}.pdf
- comment: Author-supplied metadata (e.g., 'Accepted to IEEE S&P 2024', page count)
- journal_ref: Citation if published in journal

Parse summary (abstract) for technical keywords, frameworks, datasets. Authors array preserves order; first author typically primary contributor. PDF link allows full-text retrieval (via separate HTTP GET or web_extract tool). Responses paginated; use start parameter to iterate.

## Common pitfalls

**1. Over-reliance on preprints:** arXiv papers are NOT peer-reviewed; treat claims skeptically. A paper describing a vulnerability doesn't mean it's exploitable in production.

**2. Rate limit violations:** Default 1 req/3 sec. Bursting queries triggers 503 errors and temporary IP bans. Implement delays between searches.

**3. Stale data interpretation:** Papers represent point-in-time research. A 2019 paper on Kubernetes security may describe outdated architectures. Always check publication/update dates.

**4. Author name ambiguity:** 'John Smith' may match multiple researchers. Cross-reference affiliations in abstracts/comments. Use exact email or ORCID if known.

**5. Category misalignment:** cs.CR includes cryptography + security; may return pure crypto theory irrelevant to pentesting. Combine with keyword filters (e.g., 'cat:cs.CR AND (ti:penetration OR abs:exploit)').

**6. Ignoring versions:** Papers often have multiple versions (v1, v2, etc.). Fetch latest unless tracking evolution of ideas. ID '2101.00001' defaults to latest; '2101.00001v1' fetches specific version.

**7. PDF parsing required for depth:** Abstracts summarize; threat-relevant details (implementation specifics, code, diagrams) are in full PDF. MCP server provides links but doesn't extract PDF content—chain with web_extract or PDF parsing tools.

**8. Assuming operational relevance:** Academic research ≠ deployed technology. Validate findings via additional recon before assuming target uses techniques described in papers.

## References

- arXiv API User's Manual: https://info.arxiv.org/help/api/user-manual.html
- arXiv API Terms of Use: https://info.arxiv.org/help/api/tou.html
- arXiv API Access overview: https://info.arxiv.org/help/api/index.html
- arXiv Submission Guidelines (context on paper lifecycle): https://info.arxiv.org/help/submit/index.html
- Category taxonomy: https://arxiv.org/category_taxonomy
- Server repository: https://github.com/blazickjp/arxiv-mcp-server
