---
name: Tavily Search
description: Web search API with AI-synthesized answers and cited sources;
  deployed as MCP server via npx -y tavily-mcp@latest
registry: mcp
tool_id: default:tavily
category: mcp-server
tags:
  - search
  - osint
  - research
  - mcp-server
  - api
  - web-intelligence
  - real-time
mitre_techniques:
  - T1595.002
summary: "Tavily is an AI-powered web search API exposed as an MCP (Model
  Context Protocol) server. Invoke using npx -y tavily-mcp@latest to spawn the
  server; your MCP client will then offer Tavily tools for search, extract,
  crawl, map, and research operations. Requires TAVILY_API_KEY environment
  variable. Free tier: 1,000 requests; monitor usage via dashboard at
  tavily.com. Returns structured JSON with an AI-generated answer field
  (synthesized from search results) plus an array of result objects (title, url,
  content excerpt, relevance score). Use for real-time OSINT, fact-checking,
  competitor research, or enriching LLM context with current web data. Key
  search parameters: search_depth (ultra-fast | fast | basic | advanced),
  max_results (1–20), topic (general | news | finance), time_range (day | week |
  month | year), include_domains / exclude_domains (domain filters),
  include_answer (boolean or 'basic'/'advanced'), include_raw_content (boolean
  or 'markdown'/'text'), include_images. Higher depth = slower, more credits.
  Extract endpoint pulls full content from specific URLs. Crawl/map endpoints
  discover and extract sitemaps (max_depth, max_breadth, instructions for
  filtering). Research endpoint performs deep multi-query analysis. Output is
  always JSON; parse the 'answer' field for LLM-ready summaries and 'results'
  array for citation trails. Pitfalls: API key leakage (always use env vars),
  rate-limit exhaustion on free tier, over-reliance on 'answer' field without
  validating sources, timeout on advanced depth without adjusting limits,
  ignoring domain filters leading to low-quality results."
sources:
  - https://www.tavily.com/blog/getting-started-with-the-tavily-search-api
  - https://www.linkedin.com/posts/tavily_best-practices-for-search-tavily-docs-activity-7344061189343051777-d-7o
  - https://www.freecodecamp.org/news/how-to-add-real-time-web-search-to-your-llm-using-tavily
  - https://docs.crewai.com/v1.15.3/en/tools/search-research/tavilysearchtool
  - https://docs.tavily.com/documentation/api-reference/introduction
  - https://lobehub.com/de/skills/kyopark2014-agent-skills-tavily-search
  - https://docs.tavily.com/documentation/tavily-cli
  - https://github.com/tavily-ai/tavily-cli
  - https://github.com/tavily-ai/langchain-tavily
  - https://mcpservers.org/agent-skills/tavily-ai/tavily-search
  - https://www.synack.com/knowledge-base/red-teaming-vs-penetration-testing-understanding-the-differences
  - https://www.offsec.com/blog/red-teaming-vs-pentesting
generated_at: 2026-09-04T02:30:15.933Z
generated_by: anthropic
source_hash: 44a4931b9d7e8188278db2000cb24e4240b08d275140d2f40a8bb20de245dbe0
---

# Tavily Search

## Overview

Tavily Search is a commercial web search API optimized for LLM and agent workflows, delivered as an MCP server. Unlike raw Google or Bing APIs, Tavily synthesizes search results into citation-backed answers and structured excerpts. The MCP server (tavily-mcp) exposes multiple tools: search (web queries), extract (URL content extraction), crawl (recursive site scraping), map (sitemap discovery), and research (multi-query deep analysis). Designed for real-time data retrieval in red-team reconnaissance, OSINT collection, and competitive intelligence workflows.

## When to use

Deploy Tavily when you need:
- Real-time web intelligence beyond the LLM's training cutoff (news, CVEs, vendor disclosures).
- Citation-backed answers for fact-checking or compliance documentation.
- Domain-scoped OSINT (include_domains for target org research; exclude_domains to filter noise).
- Competitive analysis or market research (finance topic, date filters).
- Automated research reports (research endpoint with multi-step synthesis).
- Content extraction from specific URLs (extract) or full-site crawls (crawl/map for documentation, pricing pages).

Avoid for:
- Stealth reconnaissance (API calls are logged; leaves billing trail).
- Queries requiring anonymity (use Tor + direct search scraping instead).
- High-volume brute-force searches (free tier = 1,000 requests; paid plans required for scale).
- Static/historical data already in LLM knowledge (wastes credits).

## Authentication & setup

1. Obtain API key: Sign up at tavily.com; dashboard provides key + usage tracking. Free tier = 1,000 requests.
2. Export key: export TAVILY_API_KEY='tvly-YOUR_API_KEY' (never hardcode in scripts).
3. Launch MCP server: npx -y tavily-mcp@latest (npx auto-installs latest version; -y skips prompts). Server listens for MCP client connections.
4. Configure MCP client (e.g., Claude Desktop, custom agent): Point to the Tavily MCP server endpoint. Client will auto-discover available tools (search, extract, crawl, map, research).
5. Optional: Set TAVILY_PROJECT env var or pass X-Project-ID header to track usage by project in dashboard.
6. Verify: Check dashboard at tavily.com for request counts; test with a basic search query.

Security: Store keys in secrets manager or .env files excluded from version control. Rotate keys if exposed. Monitor /logs endpoint for anomalous usage.

## Key commands / parameters

MCP server exposes tools via JSON-RPC; your client invokes them by name. Core parameters:

**search tool:**
- query (string, required): Search terms. Be specific (e.g., 'CVE-2024-1234 exploit PoC' not 'vulnerability').
- search_depth (string): 'ultra-fast' | 'fast' | 'basic' (default) | 'advanced'. Higher = more results, slower, more credits.
- max_results (int, 1–20, default 5): Number of result objects returned.
- topic (string): 'general' (default) | 'news' | 'finance'. Optimizes ranking.
- time_range (string): 'day' | 'week' | 'month' | 'year'. Filters by publish date.
- start_date / end_date (YYYY-MM-DD): Explicit date bounds.
- include_domains (array): ['example.com', 'target.org'] restricts results.
- exclude_domains (array): ['spam.com'] filters out domains.
- country (string): Boosts results from specific country.
- include_answer (boolean | 'basic' | 'advanced'): AI-synthesized answer in response. 'advanced' = detailed.
- include_raw_content (boolean | 'markdown' | 'text'): Full page content. 'markdown' preferred for parsing.
- include_images (boolean): Returns image URLs.
- include_image_descriptions (boolean): AI-generated image captions.

**extract tool:**
- urls (array): ['https://example.com/page'] to extract content from.
- extract_depth ('basic' | 'advanced'): Content detail level.
- format ('markdown' | 'text'): Output format.

**crawl tool:**
- url (string): Starting URL.
- max_depth (int, 1–5): Link recursion depth.
- max_breadth (int, default 20): Links per page.
- limit (int, default 50): Total page cap.
- instructions (string): Natural language filter (e.g., 'only documentation pages').
- select_paths / exclude_paths (regex): Path filters.

**map tool:** Same as crawl but returns sitemap structure, not content.

**research tool:**
- question (string): Research query for deep multi-source analysis.
- (returns request_id for async polling)

## Example workflows

**OSINT on target org:**
1. Use search with include_domains=['target.com'], time_range='month', max_results=10 to find recent announcements, press releases.
2. Parse results array for URLs; feed to extract tool for full content.
3. Use include_answer='advanced' to get AI summary of findings.

**CVE research:**
1. Query 'CVE-2024-5678 exploit proof-of-concept' with topic='general', search_depth='advanced'.
2. Check include_raw_content='markdown' for code snippets in results.
3. Cross-reference 'answer' field with results[].url for citation trail.

**Competitor pricing intel:**
1. crawl url='https://competitor.com', instructions='focus on pricing and product pages', max_depth=2.
2. Extract structured pricing from returned markdown.

**News monitoring:**
1. Scheduled search with topic='news', time_range='day', query='data breach OR ransomware'.
2. Parse results, alert on new incidents.

**Deep research report:**
1. research tool with question='What are emerging attack vectors in cloud infrastructure?'
2. Poll async endpoint for completion; retrieve multi-page synthesized report with citations.

**Domain recon (cautiously):**
1. map url='https://target.com', max_depth=3, allow_external=False to build sitemap.
2. Identify hidden endpoints, admin panels, docs.

## Output format

All tools return JSON. **search** response schema:
{
  "answer": "AI-synthesized answer string (if include_answer=true)",
  "results": [
    {
      "title": "Page title",
      "url": "https://source.com/page",
      "content": "Relevant excerpt (200–500 chars)",
      "score": 0.95,  // relevance score 0–1
      "raw_content": "Full markdown/text (if include_raw_content)",
      "published_date": "2024-01-15" // if available
    }
  ],
  "query": "original query string",
  "response_time": 1.23,  // seconds
  "images": [  // if include_images=true
    {"url": "https://...", "description": "..."}
  ]
}

**extract** response:
{
  "results": [
    {"url": "...", "content": "markdown or text", "success": true}
  ]
}

**crawl/map** response:
{
  "pages": [
    {"url": "...", "title": "...", "content": "...", "depth": 1}
  ],
  "total_pages": 47
}

**research** (async):
Initial: {"request_id": "abc123"}
Polling: {"status": "in_progress" | "completed", "result": "...markdown report..."}

Parse 'answer' for quick summaries; iterate 'results' for source validation. Always check 'score' to prioritize high-confidence results. Use 'raw_content' for deeper analysis (increases latency and response size).

## Common pitfalls

1. **API key leakage:** Hardcoding keys in scripts committed to repos. Always use environment variables; rotate keys if exposed. Check Tavily dashboard /logs for unexpected IPs.

2. **Free-tier exhaustion:** 1,000 requests burn fast in loops or broad crawls. Monitor usage in dashboard; set max_results and max_depth conservatively. Upgrade plan before red-team engagements.

3. **Ignoring domain filters:** Generic queries return SEO spam. Use include_domains for targeted recon; exclude_domains to filter content farms.

4. **Over-relying on 'answer' field:** AI synthesis can hallucinate or miss nuance. Always validate against results[].url and raw_content for ground truth.

5. **Timeout on advanced depth:** search_depth='advanced' can take 10–30s; may hit client timeouts. Increase timeout param or use 'basic'/'fast' for iterative queries.

6. **Crawl scope creep:** crawl without max_depth/limit can retrieve thousands of pages, burning credits and causing timeouts. Start with max_depth=1, limit=10; expand incrementally.

7. **Attributable activity:** API calls log source IP, queries, timestamps in Tavily's systems. For red-team OPSEC, consider this a 'noisy' technique (vendor has logs). Use for pre-engagement research, not active intrusion.

8. **Date filter confusion:** time_range='day' vs. start_date. Use time_range for relative windows (last 7 days); start_date/end_date for absolute bounds. Mixing both can yield empty results.

9. **Ignoring response_time:** High latency queries (>5s) indicate depth/result-count too high. Optimize to keep agent workflows responsive.

10. **No error handling:** API can return 4xx (auth fail, rate limit) or 5xx (service error). Wrap calls in try/catch; check HTTP status before parsing JSON.

## References

- https://www.tavily.com/blog/getting-started-with-the-tavily-search-api
- https://docs.tavily.com/documentation/api-reference/introduction
- https://docs.tavily.com/documentation/tavily-cli
- https://www.freecodecamp.org/news/how-to-add-real-time-web-search-to-your-llm-using-tavily
- https://docs.crewai.com/v1.15.3/en/tools/search-research/tavilysearchtool
- https://github.com/tavily-ai/tavily-cli
- https://github.com/tavily-ai/langchain-tavily
- https://www.linkedin.com/posts/tavily_best-practices-for-search-tavily-docs-activity-7344061189343051777-d-7o
- https://lobehub.com/de/skills/kyopark2014-agent-skills-tavily-search
- https://mcpservers.org/agent-skills/tavily-ai/tavily-search
