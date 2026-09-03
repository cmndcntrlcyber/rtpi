---
name: MCP Fetch
description: MCP server that fetches and converts web content (HTML, JSON,
  Markdown, plain text) from remote URLs via HTTP/HTTPS.
registry: mcp
tool_id: default:fetch
category: mcp-server
tags:
  - reconnaissance
  - osint
  - web-scraping
  - content-extraction
  - http
  - mcp-server
  - data-collection
mitre_techniques:
  - T1595.002
summary: "Invoke MCP Fetch to retrieve public web resources and convert them to
  machine-readable formats. Use when you need to download HTML pages, API
  responses, or documentation and convert them to Markdown or plain text for
  analysis. The tool runs as an MCP server (via `uvx mcp-server-fetch`) and
  exposes a `fetch` tool. Invoke with `url` (required), optional `max_length`
  (default 5000 chars), `start_index` (for pagination, default 0), and `raw`
  (boolean, default false; when true, skips Markdown conversion). By default,
  HTML is converted to Markdown. The server respects robots.txt unless
  `--ignore-robots-txt` is set. **Security warning**: The server can access
  internal/local IPs; never point it at internal infrastructure or metadata
  endpoints (169.254.169.254, localhost, RFC1918 ranges) without explicit
  authorization. Expect Markdown output by default; use `raw=true` for
  unprocessed HTML. Paginate large pages by incrementing `start_index`. Supports
  custom User-Agent (`--user-agent`) and HTTP proxies (`--proxy-url`). The
  server uses stdio for MCP communication. For YouTube transcripts or article
  extraction, other variants (fetch_youtube_transcript, fetch_readable) exist
  but are not guaranteed in the default mcp-server-fetch package."
sources:
  - https://apidog.com/blog/fetch-mcp-server
  - https://glama.ai/mcp/servers/tokenizin-agency/mcp-npx-fetch
  - https://mcp.so/server/fetch/modelcontextprotocol
  - https://glama.ai/mcp/servers/modelcontextprotocol/fetch
  - https://mcpservers.org/servers/goswamig/fetch-mcp
  - https://crates.io/crates/mcp-server-fetch
  - https://lib.rs/crates/mcp-server-fetch
  - https://github.com/zcaceres/fetch-mcp
  - https://mcp.so/servers/mcp_server_fetch
  - https://mcpservers.org/servers/wolfyy970/docs-fetch-mcp
  - https://mcpmarket.com/server/redteam-1
  - https://arxiv.org/html/2511.15998v1
generated_at: 2026-09-03T12:38:44.593Z
generated_by: anthropic
source_hash: 4195fc904223cce05bd98d6e5426a11af915e4d3cf644d1df266c8cbf511443e
---

# MCP Fetch

## Overview

MCP Fetch is a Model Context Protocol server that retrieves web content over HTTP/HTTPS and transforms it into Markdown, plain text, JSON, or raw HTML. It is designed to give AI agents the ability to fetch live public web data, documentation, and API responses. The server is part of Anthropic's MCP ecosystem and communicates over stdio. It runs via `uvx mcp-server-fetch` (no installation required) or can be installed via `pip install mcp-server-fetch`. The primary tool exposed is `fetch`, which accepts a URL and optional parameters to control output length, format, and pagination.

## When to use

Use MCP Fetch when you need to:
- Retrieve public documentation, blog posts, or reference material during reconnaissance
- Download HTML pages and convert them to Markdown for easier parsing
- Fetch JSON APIs and inspect responses
- Collect data from multiple pages in a structured way
- Bypass the need for manual copy-paste of web content

Do NOT use when:
- The target is an internal IP, localhost, or cloud metadata endpoint (169.254.169.254) unless explicitly authorized
- You need JavaScript rendering (use a browser-based MCP tool instead)
- The site blocks automated requests and you lack permission to bypass
- You need to exfiltrate data covertly (MCP traffic is logged by the host client)

## Authentication & setup

No authentication is required for public URLs. The tool is invoked by the MCP client (e.g., Claude Desktop, RTPI agent) which spawns the server process.

**Configuration in MCP client:**
```json
{
  "mcpServers": {
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"]
    }
  }
}
```

**Optional server arguments:**
- `--user-agent <string>`: Custom User-Agent header
- `--ignore-robots-txt`: Bypass robots.txt restrictions (use with caution)
- `--proxy-url <URL>`: Route requests through an HTTP proxy
- Environment variable `LOG_LEVEL=debug` for verbose logging

**Installation alternatives:**
- `pip install mcp-server-fetch` then run `python -m mcp_server_fetch`
- Docker: `docker run mcp/fetch`

The server automatically checks robots.txt for autonomous fetching unless `--ignore-robots-txt` is set. The User-Agent will indicate 'Autonomous' or 'User-Specified' mode.

## Key commands / parameters

**Tool:** `fetch`

**Required parameter:**
- `url` (string): HTTP or HTTPS URL to retrieve

**Optional parameters:**
- `max_length` (integer, default 5000): Maximum characters to return; prevents oversized responses
- `start_index` (integer, default 0): Character offset for pagination; fetch large pages in chunks
- `raw` (boolean, default false): If true, returns raw HTML instead of Markdown
- `headers` (object, optional): Custom HTTP headers for authentication or API keys (implementation-dependent; some variants support this)

**Server-level flags (set at startup, not per-request):**
- `--user-agent <string>`: Override default User-Agent
- `--ignore-robots-txt`: Disable robots.txt compliance
- `--proxy-url <URL>`: HTTP proxy for all requests

**Example invocation (via agent):**
Ask the MCP client: "Use the fetch tool to get https://example.com/api/status"

**Pagination example:**
First call: `fetch(url="https://long-page.com", max_length=5000, start_index=0)`
Next call: `fetch(url="https://long-page.com", max_length=5000, start_index=5000)`

## Example workflows

**1. Reconnaissance - enumerate subdomains from a known DNS enumeration tool output page:**
- Fetch the HTML page: `fetch(url="https://dnsdumpster.com/results/target.com")`
- Extract subdomain list from returned Markdown
- Feed results to further enumeration tools

**2. OSINT - download public Pastebin or GitHub gist:**
- `fetch(url="https://pastebin.com/raw/abc123", raw=true)` to get plaintext content
- Analyze for leaked credentials or configuration

**3. API enumeration:**
- `fetch(url="https://api.target.com/v1/users")` to retrieve JSON
- Inspect structure and identify endpoints

**4. Documentation scraping:**
- Fetch internal documentation if accessible: `fetch(url="https://internal-docs.target.com/admin-api")`
- Convert to Markdown and search for API keys, endpoints, or architecture details

**5. Paginated content extraction:**
- Large page: `fetch(url="...", max_length=5000, start_index=0)` → store
- Continue: `fetch(url="...", start_index=5000)` until end of content

**6. Proxy rotation:**
- Start server with `--proxy-url http://proxy.local:8080`
- All fetches route through proxy for anonymity or IP rotation

## Output format

**Default (Markdown conversion):**
Returns the page content converted to Markdown. Links, headings, and text structure are preserved. Navigation, ads, and boilerplate are not automatically stripped unless using a variant like `fetch_readable`.

**Raw mode (`raw=true`):**
Returns unprocessed HTML as a string. Useful for custom parsing or when Markdown conversion loses critical structure.

**JSON APIs:**
If the URL returns JSON, the content is returned as a JSON string (not parsed). You must parse it in subsequent steps.

**Truncation:**
If the content exceeds `max_length`, it is truncated. Use `start_index` to paginate through the full document.

**Errors:**
- HTTP errors (404, 500, etc.) are returned as error messages.
- Network failures, timeouts, or DNS issues will raise exceptions visible to the agent.
- Robots.txt violations (if enforced) will block the request and return an error.

## Common pitfalls

**1. Accessing internal IPs:**
The server can fetch localhost, 127.0.0.1, 169.254.169.254 (cloud metadata), and RFC1918 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16). This is a **critical SSRF risk**. Always validate URLs before fetching. Do not fetch user-controlled URLs without allowlisting.

**2. Ignoring robots.txt:**
Using `--ignore-robots-txt` can expose you legally and operationally. Only use during authorized engagements and document the decision.

**3. Large responses:**
Default `max_length=5000` is very short. Large pages will be truncated silently. Always check if content ends mid-sentence and paginate if necessary.

**4. JavaScript-rendered content:**
This tool does NOT execute JavaScript. Single-page apps (SPAs) or dynamic content will return skeleton HTML. Use a browser-based tool for such targets.

**5. Custom headers:**
Not all implementations support the `headers` parameter. Test your specific MCP Fetch variant. If unsupported, use `--user-agent` for simple User-Agent overrides.

**6. Logging and attribution:**
MCP clients (e.g., Claude Desktop) log all tool invocations. Fetches are visible in client logs and may be sent to Anthropic or other vendors. Assume no operational anonymity unless you control the entire stack.

**7. Proxy misconfiguration:**
If `--proxy-url` is set incorrectly, all requests will fail. Test connectivity before operational use.

**8. Robots.txt User-Agent fingerprinting:**
The default User-Agent includes 'ModelContextProtocol/1.0', which is highly attributable. Customize with `--user-agent` for lower-profile requests.

## References

- https://apidog.com/blog/fetch-mcp-server
- https://glama.ai/mcp/servers/tokenizin-agency/mcp-npx-fetch
- https://mcp.so/server/fetch/modelcontextprotocol
- https://glama.ai/mcp/servers/modelcontextprotocol/fetch
- https://mcpservers.org/servers/goswamig/fetch-mcp
- https://crates.io/crates/mcp-server-fetch
- https://lib.rs/crates/mcp-server-fetch
- https://github.com/zcaceres/fetch-mcp
- https://mcp.so/servers/mcp_server_fetch
- https://arxiv.org/html/2511.15998v1
