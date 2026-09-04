---
name: MCP Fetch
description: MCP server that fetches web content and converts HTML to markdown
  for LLM consumption with chunking support
registry: mcp
tool_id: default:fetch
category: mcp-server
tags:
  - web-scraping
  - osint
  - reconnaissance
  - content-extraction
  - http-client
  - markdown-conversion
  - mcp-server
mitre_techniques:
  - T1595.002
  - T1590
summary: "Use mcp-server-fetch to retrieve web pages, APIs, or documentation
  during reconnaissance. Invoke the `fetch` tool with a target URL; content
  returns as markdown by default (raw HTML available via `raw=true`). Essential
  for gathering intelligence from public-facing sites, documentation, pricing
  pages, or blog posts. The tool automatically truncates at 5000 chars but
  supports pagination via `start_index` to read long pages in chunks. OPSEC:
  This server can reach internal/RFC1918 addresses—do NOT use in environments
  where SSRF poses a risk. Does NOT respect robots.txt by default in the Python
  implementation; the Rust variant offers `--ignore-robots-txt` flag. No
  built-in proxy support in the canonical Python version, but Rust version
  supports `--proxy-url`. Expect markdown output unless `raw=true` is set. For
  article extraction (stripped of navigation/ads), use the Readability-based
  `fetch_readable` tool if available (zcaceres/fetch-mcp fork). Always validate
  URLs and sanitize output before passing to downstream tools."
sources:
  - https://glama.ai/mcp/servers/modelcontextprotocol/fetch
  - https://github.com/zcaceres/fetch-mcp
  - https://github.com/modelcontextprotocol/servers/tree/main/src/fetch
  - https://mcp.so/server/fetch/test
  - https://agentskillshub.dev/skills/fetch
  - https://lib.rs/crates/mcp-server-fetch
  - https://mcp.so/servers/mcp_server_fetch
  - https://mcpservers.org/servers/wolfyy970/docs-fetch-mcp
  - https://arxiv.org/html/2511.15998v1
  - https://mcp.so/servers/read-team-mcp-server
  - https://www.promptfoo.dev/docs/red-team/mcp-security-testing
  - https://redcanary.com/blog/testing-and-validation/ai-security-testing
generated_at: 2026-09-04T02:29:52.212Z
generated_by: anthropic
source_hash: 4195fc904223cce05bd98d6e5426a11af915e4d3cf644d1df266c8cbf511443e
---

# MCP Fetch

## Overview

MCP Fetch is a Model Context Protocol server that retrieves web content and converts it to markdown. Deployed via `uvx mcp-server-fetch`, it exposes a `fetch` tool and a `fetch` prompt. The canonical implementation (modelcontextprotocol/servers) supports HTML-to-markdown conversion with optional raw output, truncation, and pagination. Alternative implementations (zcaceres/fetch-mcp, Rust mcp-server-fetch) add JSON fetching, YouTube transcript extraction, Mozilla Readability integration, and robots.txt compliance options. In RTPI, this tool enables automated OSINT collection, competitive analysis, and documentation scraping without manual browsing.

## When to use

Use mcp-server-fetch when you need to programmatically retrieve public web content during reconnaissance (T1595.002) or gather victim organization information (T1590). Ideal for fetching competitor pricing pages, technical documentation, blog posts, or API responses. Use it to scrape multiple pages in sequence, extract changelogs, or pull threat intelligence feeds. Do NOT use if the target may be internal/private infrastructure (SSRF risk), if you need JavaScript rendering (canonical version has limited JS support; check for node.js install or use Rust version with `--render=always`), or if you need to respect crawl politeness (no rate-limiting or robots.txt by default). Prefer browser automation (Puppeteer/Playwright MCP) for SPAs or login-protected content.

## Authentication & setup

No authentication required for the tool itself. Install via `uvx mcp-server-fetch` (recommended) or `pip install mcp-server-fetch && python -m mcp_server_fetch`. The server communicates over stdio. To add to an MCP client, include in config JSON: `{"mcpServers": {"fetch": {"command": "uvx", "args": ["mcp-server-fetch"]}}}`. Optionally install node.js to enable a more robust HTML simplifier in the Python version. For Rust version: `cargo install mcp-server-fetch`, supports CLI flags `--user-agent`, `--proxy-url`, `--ignore-robots-txt`. Docker option: `docker run mcp/fetch`. No API keys or credentials needed unless fetching from authenticated endpoints (pass custom headers via `headers` parameter in zcaceres fork).

## Key commands / parameters

**Tool**: `fetch`

**Required parameters**:
- `url` (string): Target URL (HTTP/HTTPS only)

**Optional parameters**:
- `max_length` (integer, default 5000): Maximum characters returned; range 1000–50000 in some forks
- `start_index` (integer, default 0): Character offset for pagination; increment by `max_length` to read next chunk
- `raw` (boolean, default false): Return raw HTML instead of markdown
- `headers` (object, zcaceres fork only): Custom HTTP headers as key-value pairs
- `proxy` (string, zcaceres/Rust only): Proxy URL, e.g., `http://proxy:8080`

**Additional tools (zcaceres fork)**:
- `fetch_json`: Parse and return JSON response
- `fetch_readable`: Extract article content via Mozilla Readability, strips ads/nav
- `fetch_youtube_transcript`: Extract captions, optional `lang` parameter (default `en`)

**Rust CLI flags**: `--user-agent <UA>`, `--proxy-url <URL>`, `--ignore-robots-txt`, `LOG_LEVEL=debug`

## Example workflows

**1. Reconnaissance on competitor pricing**: `fetch(url="https://target.com/pricing")` → returns markdown; parse tables, feature lists. Repeat with `start_index=5000` if truncated.

**2. Scrape documentation in chunks**: Page is 20k chars. Call `fetch(url="https://docs.target.com/api", max_length=5000, start_index=0)`, then `start_index=5000`, `10000`, `15000` until EOF.

**3. Extract clean article content**: Use zcaceres fork: `fetch_readable(url="https://blog.target.com/post")` strips navigation, ads, returns only article body as markdown.

**4. Fetch JSON API**: `fetch_json(url="https://api.target.com/v1/endpoints")` returns parsed JSON object.

**5. OPSEC-aware fetch via proxy (Rust)**: `mcp-server-fetch --proxy-url http://127.0.0.1:8080 --user-agent "Mozilla/5.0"` then invoke `fetch` tool.

**6. YouTube transcript for phishing lure research**: `fetch_youtube_transcript(url="https://youtube.com/watch?v=xyz", lang="en")` extracts captions without downloading video.

## Output format

Default: Markdown string, truncated at `max_length` characters (default 5000). If content exceeds limit, use `start_index` to paginate. Response includes the extracted text only; metadata (title, links) not included in canonical version. With `raw=true`, returns unprocessed HTML. zcaceres `fetch_readable` returns cleaner markdown (main content only). `fetch_json` returns parsed JSON object. `fetch_youtube_transcript` returns plain text transcript. Expect UTF-8 encoding. No structured metadata envelope in the response—just the content string. If node.js is installed, HTML-to-markdown conversion is more accurate (Python version). Check for truncation by comparing returned length to `max_length`; if equal, content likely continues.

## Common pitfalls

**SSRF risk**: The server can access local/internal IPs (127.0.0.1, 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12). In RTPI, ensure network segmentation or block private ranges at the firewall. **Truncation surprises**: Default 5000-char limit catches users off-guard; always check if `len(output) == max_length` and paginate. **No robots.txt respect (Python)**: Canonical version does not honor robots.txt; Rust version does by default unless `--ignore-robots-txt` is set. **JavaScript rendering**: Python version has limited JS support; install node.js for better results or use Rust `--render=always`, but this slows fetches significantly. **No rate limiting**: Rapid-fire requests may trigger WAFs or IP bans; implement delays between calls. **Markdown conversion quirks**: Complex tables, embedded media, or dynamic content may render poorly; use `raw=true` and parse manually if needed. **No error detail**: Failed fetches return generic errors; enable `LOG_LEVEL=debug` (Rust) for troubleshooting. **Version fragmentation**: MCP Python SDK 1.x required; SDK 2.0 port in progress—check compatibility.

## References

- https://glama.ai/mcp/servers/modelcontextprotocol/fetch
- https://github.com/modelcontextprotocol/servers/tree/main/src/fetch
- https://github.com/zcaceres/fetch-mcp
- https://lib.rs/crates/mcp-server-fetch
- https://mcp.so/servers/mcp_server_fetch
- https://agentskillshub.dev/skills/fetch
- https://arxiv.org/html/2511.15998v1
- https://www.promptfoo.dev/docs/red-team/mcp-security-testing
