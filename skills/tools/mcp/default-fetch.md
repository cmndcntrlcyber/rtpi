---
name: MCP Fetch
description: MCP server for fetching web content, converting HTML to markdown,
  with optional robots.txt respect and pagination support.
registry: mcp
tool_id: default:fetch
category: mcp-server
tags:
  - web-scraping
  - content-fetching
  - html-to-markdown
  - reconnaissance
  - osint
  - mcp-server
  - stdio
mitre_techniques:
  - T1595.002
  - T1592.002
  - T1590
summary: "MCP Fetch is a Model Context Protocol server invoked via `uvx
  mcp-server-fetch` that retrieves web content and converts HTML to markdown.
  Use it for OSINT collection, target reconnaissance, or extracting public web
  data during red team engagements. The server communicates over stdio and
  exposes a `fetch` tool that accepts URL, max_length (default 5000 chars),
  start_index (for pagination), and raw (boolean) parameters. Content is
  automatically converted to markdown unless raw=true. By default respects
  robots.txt; can be overridden with --ignore-robots-txt flag. Supports custom
  User-Agent strings and HTTP proxies. Environment variables: FETCH_TIMEOUT
  (default 30000ms), FETCH_USER_AGENT, FETCH_MAX_SIZE (default 10MB). For large
  pages, use start_index to read in chunks. Returns text content in MCP response
  format. Security note: can access local/internal IPs—validate targets to avoid
  unintended internal recon. No authentication required for public URLs;
  inherits network access of host. Tool name is `fetch` with parameters: url
  (required string), max_length (optional int), start_index (optional int,
  default 0), raw (optional bool, default false). Ideal for scraping target
  blogs, documentation, pastebins, or public disclosures. Watch for rate
  limiting, WAFs, and anti-bot measures on target sites."
sources:
  - https://mcp.so/server/mcp-fetch-node
  - https://github.com/zcaceres/fetch-mcp
  - https://docs.griptapenodes.com/en/stable/how_to/mcp/servers/fetch/
  - https://mcpservers.org/servers/modelcontextprotocol/fetch
  - https://docs.griptapenodes.com/en/stable/how_to/mcp/getting_started/
  - https://lib.rs/crates/mcp-server-fetch
  - https://www.reddit.com/r/ClaudeAI/comments/1jf4hnt/setting_up_mcp_servers_in_claude_code_a_tech/
  - https://arxiv.org/html/2511.15998v2
  - https://www.promptfoo.dev/docs/red-team/mcp-security-testing/
  - https://www.splunk.com/en_us/blog/security/securing-ai-agents-model-context-protocol.html
  - https://www.giskard.ai/knowledge/model-context-protocol-understanding-mcp-security-risks-and-prevention-methods
  - https://www.hiddenlayer.com/research/mcp-model-context-pitfalls-in-an-agentic-world
generated_at: 2026-05-19T10:54:11.771Z
generated_by: anthropic
source_hash: 4195fc904223cce05bd98d6e5426a11af915e4d3cf644d1df266c8cbf511443e
---

# MCP Fetch

## Overview

MCP Fetch is a Model Context Protocol server that provides web content retrieval and HTML-to-markdown conversion. It runs as a local stdio process launched via `uvx mcp-server-fetch` and exposes a single `fetch` tool for retrieving web pages. Originally designed to enable LLMs to consume web content efficiently, it is operationally useful for red team reconnaissance, OSINT gathering, and automated content extraction from public targets. The server supports pagination via start_index, respects robots.txt by default (overridable), and can use custom User-Agent strings and HTTP proxies. Content is truncated to configurable max_length (default 5000 characters) and returned as markdown for structured parsing. Written in Rust with Python bindings available via uvx.

## When to use

Use MCP Fetch when you need to programmatically retrieve and parse web content during red team operations: reconnaissance of target public web presence (blogs, documentation, employee directories), scraping paste sites or public disclosures, extracting text from HTML-heavy pages for analysis, collecting OSINT from forums or wikis, or chaining with other MCP tools for multi-step workflows (e.g., fetch + filesystem to store). Preferable to manual curl when you need markdown output or pagination through large documents. Avoid for binary files, authenticated content (unless credentials can be passed via headers), or sites with aggressive anti-bot protection. Not suitable for interactive JavaScript-heavy sites (use browser-tools MCP instead). Consider using when operating through MCP-aware AI agents that need web access without browser automation overhead.

## Authentication & setup

Installation: Run `uvx mcp-server-fetch` directly or configure in MCP client JSON as `{"command": "uvx", "args": ["mcp-server-fetch"]}`. No separate installation step required; uvx handles dependencies. The server communicates via stdio—no network listener. No authentication mechanism for the server itself; relies on host network access. For authenticated target sites, pass credentials via `headers` parameter in tool invocation (e.g., Bearer tokens, cookies). Configuration via environment variables: FETCH_TIMEOUT (milliseconds, default 30000), FETCH_USER_AGENT (string, default "mcp-server-fetch"), FETCH_MAX_SIZE (bytes, default 10485760 = 10MB). Command-line flags when running standalone: --user-agent <string>, --ignore-robots-txt, --proxy-url <url>, --help, --version. For red team use, consider custom User-Agent to blend with target traffic and proxy-url to route through infrastructure. Enable debug logging via LOG_LEVEL=debug environment variable.

## Key commands / parameters

The server exposes one tool: `fetch`. Parameters: `url` (string, required) - target URL to retrieve; `max_length` (integer, optional, default 5000, max 1000000) - character limit for returned content; `start_index` (integer, optional, default 0) - offset for pagination, allows reading large pages in chunks; `raw` (boolean, optional, default false) - if true, returns raw HTML instead of markdown conversion; `headers` (object, optional) - custom HTTP headers as key-value pairs; `proxy` (string, optional) - proxy URL format http://host:port or socks5://host:port. Example invocation via MCP protocol: {"url": "https://target.com/page", "max_length": 10000, "start_index": 0, "raw": false}. For large documents, increment start_index by max_length to paginate. To bypass robots.txt, launch server with --ignore-robots-txt flag (not a per-request parameter). For custom User-Agent per request, use headers parameter: {"url": "...", "headers": {"User-Agent": "Mozilla/5.0..."}}.

## Example workflows

**Basic reconnaissance**: Fetch target company blog for employee names and tech stack mentions: {"url": "https://target.com/blog", "max_length": 20000}. Parse markdown output for keywords. **Paginated extraction**: Large disclosure page—first chunk: {"url": "https://target.com/disclosure", "max_length": 5000, "start_index": 0}; next chunk: start_index: 5000; continue until content exhausted. **Custom headers for authenticated content**: Access API docs requiring token: {"url": "https://target.com/docs", "headers": {"Authorization": "Bearer TOKEN"}, "max_length": 10000}. **Raw HTML analysis**: Inspect page structure for hidden comments or metadata: {"url": "https://target.com", "raw": true}. **Proxied request**: Route through team infrastructure: launch server with --proxy-url http://10.0.0.1:8080, then invoke fetch normally. **Multi-turn OSINT**: Agent workflow—fetch LinkedIn profile HTML, extract job titles, fetch company careers page, cross-reference technologies. **Bypass robots.txt for permissive engagement**: Launch with --ignore-robots-txt, fetch sitemap.xml and recursively scrape allowed pages.

## Output format

The tool returns an MCP response with structure: {"content": [{"type": "text", "text": "<markdown or raw HTML content>"}]}. Markdown conversion strips navigation, ads, scripts, and boilerplate using Mozilla Readability algorithm (when Node.js available) or simpler HTML parser. Output includes headings, links (preserved as [text](url)), lists, code blocks, and paragraphs. If max_length is reached, content is truncated mid-sentence; use start_index to continue. Raw HTML mode returns complete unprocessed HTML within max_length constraint. For JSON endpoints, use the tool normally—JSON is returned as text (not parsed). No structured metadata returned (no HTTP status, headers, or response codes visible in tool output). If fetch fails (network error, 404, timeout), expect error message in MCP error response, not in content field. Character count includes whitespace. For YouTube URLs, use separate `fetch_youtube_transcript` tool if available in MCP Fetch Node variant (not in default mcp-server-fetch).

## Common pitfalls

**Internal IP exposure**: Tool can access local/RFC1918 addresses—validate URLs to prevent unintended internal network scanning; implement allowlist/denylist at orchestration layer. **Robots.txt enforcement**: Default behavior respects robots.txt, which may block recon targets; use --ignore-robots-txt flag carefully and only within engagement scope. **Truncation without warning**: Content silently cut at max_length; always check if pagination needed by examining output length. **JavaScript-rendered content**: Tool fetches static HTML only; SPA or React apps return empty content—use browser-based MCP server instead. **Rate limiting**: No built-in rate limiting; rapid requests may trigger WAF blocks or IP bans—implement delays in orchestration. **Markdown conversion artifacts**: Complex tables or nested HTML may not convert cleanly; inspect output or use raw=true for precision. **Proxy configuration**: --proxy-url is server-level, not per-request; requires server restart to change. **Authentication persistence**: Headers parameter does not persist across invocations—must resend credentials each time. **Binary content**: Tool attempts to parse PDFs/images as text, resulting in garbage; validate content-type before fetching. **HTTPS certificate validation**: Strict by default; may fail on self-signed certs in internal engagements—no documented flag to disable.

## References

- https://mcp.so/server/mcp-fetch-node
- https://github.com/zcaceres/fetch-mcp
- https://docs.griptapenodes.com/en/stable/how_to/mcp/servers/fetch/
- https://mcpservers.org/servers/modelcontextprotocol/fetch
- https://lib.rs/crates/mcp-server-fetch
- https://arxiv.org/html/2511.15998v2
- https://www.promptfoo.dev/docs/red-team/mcp-security-testing/
- https://www.splunk.com/en_us/blog/security/securing-ai-agents-model-context-protocol.html
- https://www.giskard.ai/knowledge/model-context-protocol-understanding-mcp-security-risks-and-prevention-methods
- https://www.hiddenlayer.com/research/mcp-model-context-pitfalls-in-an-agentic-world
