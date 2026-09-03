---
name: Tavily Search
description: MCP server for AI-optimized web search via Tavily API; returns
  clean, LLM-ready content and images
registry: mcp
tool_id: default:tavily
category: mcp-server
tags:
  - search
  - osint
  - reconnaissance
  - web-scraping
  - llm-tool
  - mcp-server
  - tavily
mitre_techniques:
  - T1595.002
summary: "Tavily MCP provides AI-optimized web search returning clean,
  contextual snippets ready for LLM ingestion. Invoked via npx -y
  tavily-mcp@latest. Requires TAVILY_API_KEY environment variable (free tier:
  1,000 requests). Use for real-time intelligence gathering, domain
  reconnaissance, news monitoring, and content extraction. Returns JSON with
  AI-summarized answers plus source URLs. Key parameters: search_depth
  (basic|advanced), max_results (1-20), topic (general|news|finance), time_range
  (day|week|month|year), include_domains/exclude_domains for scoping,
  include_images for visual OSINT. Advanced depth slower but more comprehensive.
  News topic supports days filter. Unlike raw SERP APIs, Tavily pre-processes
  HTML into clean context, eliminating crawl/scrape/clean pipeline. Typical
  workflow: craft focused query → set filters (domain, date) → invoke search →
  parse JSON response → extract URLs/content for follow-on analysis. Output
  includes answer field (AI summary), results array (title, url, content
  snippet, score), images array if requested. Watch for: API rate limits
  (upgrade plan if exceeded), queries too broad (refine with domain/date
  filters), basic vs advanced depth trade-off (speed vs comprehensiveness). Not
  a replacement for deep crawling—use extract/crawl tools for full-page content.
  Integrates with LangChain, CrewAI frameworks. Operational value: rapidly
  surface public intelligence on targets, technologies, or threat actors without
  manual search/scrape loops."
sources:
  - https://www.tavily.com/blog/getting-started-with-the-tavily-search-api
  - https://www.linkedin.com/posts/tavily_best-practices-for-search-tavily-docs-activity-7344061189343051777-d-7o
  - https://shankar-k.medium.com/tavily-introduction-to-agentic-search-tool-8720b9d6aa19
  - https://www.freecodecamp.org/news/how-to-add-real-time-web-search-to-your-llm-using-tavily
  - https://docs.crewai.com/v1.15.3/en/tools/search-research/tavilysearchtool
  - https://clawdaddy.run/skills/tavily-search
  - https://aiprompt.co/mcp/tomatio13-mcp-server-tavily
  - https://docs.tavily.com/documentation/tavily-cli
  - https://docs.tavily.com/documentation/agent-skills
  - https://pkg.go.dev/github.com/y7ut/mcp-tavily-search
  - https://www.synack.com/knowledge-base/red-teaming-vs-penetration-testing-understanding-the-differences
  - https://www.offsec.com/blog/red-teaming-vs-pentesting
generated_at: 2026-09-03T12:38:58.057Z
generated_by: anthropic
source_hash: 44a4931b9d7e8188278db2000cb24e4240b08d275140d2f40a8bb20de245dbe0
---

# Tavily Search

## Overview

Tavily MCP server transforms web search into LLM-ready intelligence. Unlike traditional SERP APIs that return raw links requiring separate crawl/scrape/clean steps, Tavily performs the full pipeline (search → crawl → scrape → clean → summarize) and returns structured, contextual snippets optimized for AI agents. Supports text search, image retrieval, domain filtering, time-based queries, and multi-topic optimization (general, news, finance). Designed for red team reconnaissance, OSINT collection, and real-time threat intelligence gathering. Free tier provides 1,000 API calls; paid plans available for sustained operations.

## When to use

Use Tavily MCP when you need:
- Real-time web intelligence on targets, technologies, or threat actors without manual browsing
- Clean, summarized content for LLM analysis (eliminates HTML parsing overhead)
- Domain-scoped reconnaissance (e.g., search only within target.com or exclude noise domains)
- Time-bounded intelligence (recent news, weekly updates, month-long trend analysis)
- Image/visual OSINT alongside text results
- Quick validation of public exposure (leaked credentials, disclosed vulnerabilities, public documentation)

Do NOT use when:
- You need full-page content (use extract/crawl tools instead; Tavily returns snippets)
- You require deep subdomain enumeration (use dedicated DNS/subdomain tools)
- Target blocks or monitors search engine crawlers (Tavily uses standard search infrastructure)
- You need authenticated or non-public content (Tavily indexes public web only)

## Authentication & setup

1. Obtain API key: Sign up at tavily.com → Dashboard → API Keys (1,000 free requests per account)
2. Set environment variable: export TAVILY_API_KEY='tvly-xxxxxxxxxx'
3. Invoke MCP server: npx -y tavily-mcp@latest
4. Verify connectivity: MCP server exposes 'search' tool; test with simple query
5. Security considerations:
   - Store API key in environment variable, never hardcode
   - Monitor usage via Tavily dashboard to avoid unexpected overage
   - Create separate API keys per operation/team for usage tracking and revocation
   - API keys are rate-limited; respect limits to avoid service disruption
6. Alternative invocation for persistent use: Install locally (npm install -g tavily-mcp) to avoid npx download latency on each invocation

## Key commands / parameters

MCP tool: 'search'

Core parameters:
- query (string, required): Search query; craft focused queries for best results (e.g., 'site:target.com filetype:pdf' style syntax)
- search_depth (string): 'basic' (default, fast) | 'advanced' (slower, more comprehensive for complex research)
- max_results (integer, 1-20): Number of results; default 5, max 20
- topic (string): 'general' (default, broad web) | 'news' (recent news sources) | 'finance' (financial data)
- time_range (string): 'day' | 'week' | 'month' | 'year' - filters results to relative time window
- days (integer): For topic='news', limit to last N days (default 7)
- include_domains (array): Whitelist domains (e.g., ['target.com', 'subsidiary.net'])
- exclude_domains (array): Blacklist domains to reduce noise (e.g., ['pinterest.com', 'youtube.com'])
- include_answer (boolean): Return AI-generated summary answer (default false; enable for quick triage)
- include_raw_content (boolean): Include full raw content (default false; increases payload size)
- include_images (boolean): Return image URLs from search results (default false; enable for visual OSINT)
- timeout (integer): Request timeout in seconds (default 60)

Best practices:
- Use include_domains to scope reconnaissance to target infrastructure
- Combine time_range with topic='news' for breaking intelligence
- Set search_depth='advanced' only when basic results insufficient (performance cost)
- Increase max_results for broader coverage, but review API rate limits

## Example workflows

1. Target domain reconnaissance:
   {"query": "site:target.com", "include_domains": ["target.com"], "max_results": 20, "include_answer": false}
   → Returns indexed pages, subdomains, public documents from target domain

2. Recent vulnerability disclosure monitoring:
   {"query": "CVE-2024 [technology stack]", "topic": "news", "time_range": "week", "max_results": 10}
   → Surfaces recent CVE announcements, vendor advisories, exploit discussions

3. Competitor/third-party integration research:
   {"query": "API integration [target company]", "search_depth": "advanced", "include_answer": true}
   → Identifies public API documentation, integration guides, partner disclosures

4. Leaked credential/data exposure check:
   {"query": "[target domain] password OR credentials site:pastebin.com OR site:github.com", "max_results": 15, "exclude_domains": ["linkedin.com", "indeed.com"]}
   → Hunts paste sites and code repos for exposed credentials (exclude job boards)

5. Visual OSINT for infrastructure:
   {"query": "[target company] data center OR office", "include_images": true, "max_results": 10}
   → Collects images of physical infrastructure, office layouts, server rooms

6. Technology stack fingerprinting:
   {"query": "powered by OR built with site:target.com", "include_domains": ["target.com"], "include_raw_content": true}
   → Extracts technology disclosures from footers, meta tags, public pages

## Output format

JSON response structure:
{
  "answer": "AI-generated summary of search results (if include_answer=true)",
  "results": [
    {
      "title": "Page title",
      "url": "https://example.com/page",
      "content": "Clean, LLM-ready snippet (500-1000 chars)",
      "score": 0.95,  // Relevance score (0-1)
      "published_date": "2024-01-15"  // If available
    }
  ],
  "images": [  // If include_images=true
    {"url": "https://example.com/image.jpg", "description": "Alt text or caption"}
  ],
  "query": "Original query string",
  "response_time": 1.23  // Seconds
}

Key fields:
- results[].content: Pre-cleaned, HTML-stripped snippet ready for LLM context injection
- results[].score: Use to filter low-relevance results (threshold ~0.5+)
- results[].url: Extract for follow-on deep crawling/extraction with other tools
- answer: Quick-triage summary; verify with source URLs before operationalizing

Parse JSON, iterate results array, extract URLs for downstream tools (waybackurls, gospider, nuclei). Store content snippets for embedding/vector search in knowledge base.

## Common pitfalls

1. Overly broad queries → Refine with domain filters, time constraints, or exclude irrelevant domains (social media, aggregators)
2. Ignoring rate limits → Monitor Tavily dashboard usage; 1,000 free requests exhausted quickly in automated workflows; upgrade plan or implement query batching
3. Assuming completeness → Tavily indexes public web via search engines; does not guarantee 100% coverage of target domain (supplement with direct crawling, DNS enumeration)
4. Using basic depth for complex research → Advanced depth required for nuanced queries (e.g., technical documentation, obscure disclosures); basic depth optimized for speed, may miss depth
5. Not validating AI-generated answers → The 'answer' field is LLM-synthesized; always cross-reference with source URLs before acting on intelligence
6. Large include_raw_content payloads → Enabling raw content for max_results=20 creates multi-MB responses; use selectively or reduce max_results
7. Forgetting to scope domain filters → Generic queries ("login page") return noise; always include_domains or exclude_domains for targeted reconnaissance
8. Time zone assumptions → Time filters (day/week) use UTC; adjust queries for local time zone context
9. Overlooking image OSINT → Many operators forget include_images; visual intelligence (logos, diagrams, screenshots) valuable for social engineering, physical security assessments
10. API key exposure → Tavily keys often committed to repos, logged in scripts; treat as sensitive credential, rotate periodically, use secret management

## References

- https://www.tavily.com/blog/getting-started-with-the-tavily-search-api
- https://docs.tavily.com/documentation/tavily-cli
- https://docs.tavily.com/documentation/agent-skills
- https://www.freecodecamp.org/news/how-to-add-real-time-web-search-to-your-llm-using-tavily
- https://docs.crewai.com/v1.15.3/en/tools/search-research/tavilysearchtool
- https://shankar-k.medium.com/tavily-introduction-to-agentic-search-tool-8720b9d6aa19
- https://aiprompt.co/mcp/tomatio13-mcp-server-tavily
- https://clawdaddy.run/skills/tavily-search
