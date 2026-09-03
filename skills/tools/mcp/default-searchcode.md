---
name: searchcode
description: MCP server for searching public source code across GitHub, GitLab,
  Bitbucket via searchcode.com API
registry: mcp
tool_id: default:searchcode
category: mcp-server
tags:
  - code-search
  - osint
  - reconnaissance
  - mcp-server
  - searchcode
  - source-code
  - api
mitre_techniques:
  - T1594
  - T1213
summary: searchcode-mcp is an MCP (Model Context Protocol) server that wraps the
  searchcode.com API for searching billions of lines of open-source code. Use it
  to find code patterns, credentials, API keys, configuration files, and
  vulnerability indicators across public repositories on GitHub, GitLab, and
  Bitbucket. Invoke via MCP tools exposed by the server; typically you will call
  search functions with query strings and optional filters (language:, license:,
  site:). Expect JSON responses containing code snippets, file paths, repository
  URLs, and metadata. The tool operates entirely via searchcode.com's public
  API—no local indexing, no authentication required, but rate limits apply per
  IP. Ideal for OSINT reconnaissance to discover exposed secrets, understand
  target technology stacks, find reusable exploit code, or map an organization's
  public code footprint. Do NOT use for proprietary or private code analysis
  (use searchcode-server self-hosted for that). Watch for API rate limits and
  ensure you do not spam the service; the author requests a referrer header and
  link-back courtesy. Results are syntax-highlighted and ranked by relevance and
  popularity. No direct integration with GitHub search; searchcode indexes
  independently.
sources:
  - https://daily.dev/blog/search-engines-for-developers-a-comparative-guide
  - https://news.ycombinator.com/item?id=7947075
  - https://pypi.org/project/searchcode
  - https://searchcode.com
  - https://github.com/boyter/searchcode-server
  - https://scancode-toolkit.readthedocs.io/en/latest/reference/scancode-cli/index.html
  - https://ast-grep.github.io/reference/cli
  - https://lobehub.com/skills/aaddrick-gh-cli-search-gh-search-code
  - https://searchcode.com/file/53785310/doc/manual/Command-Index.html
  - https://www.yash.com/blog/red-team-assessment-and-penetration-testing
  - https://blog.securelayer7.net/red-team-assessment
  - https://www.cycognito.com/learn/red-teaming/red-teaming-vs-pentesting
generated_at: 2026-09-03T12:38:39.841Z
generated_by: anthropic
source_hash: e1782f87a59c433da4b0fe9383e2dda315ba562f589225ac19ac9b1a8b539a87
---

# searchcode

## Overview

searchcode-mcp is an MCP server (invoked via `npx -y searchcode-mcp`) that provides AI agents access to searchcode.com, a public source code search engine indexing billions of lines from GitHub, GitLab, and Bitbucket. It exposes MCP tools for searching code by keyword, filtering by language/license/site, and retrieving real-world code examples. The service is read-only, API-based, and requires no authentication. It is NOT affiliated with GitHub search and operates its own independent index. Searchcode.com is maintained as a community resource with a 'be excellent to each other' ethos—do not abuse the API.

## When to use

Use searchcode-mcp during OSINT and reconnaissance phases to: discover exposed credentials, API keys, or secrets in public repos; identify technology stack and dependencies of target organizations; find proof-of-concept exploit code or vulnerable code patterns; map an organization's public code footprint by owner/repo filters; research common misconfigurations or insecure coding practices. Prefer this over manual GitHub searches when you need cross-platform coverage (GitLab, Bitbucket) or when you want AI-agent-driven automated queries. Do NOT use for private/internal code—deploy searchcode-server self-hosted for enterprise use cases. Do NOT use if you need real-time code execution or IDE integration; this is search-only.

## Authentication & setup

No authentication required. The MCP server is started with `npx -y searchcode-mcp` (npx will auto-download on first run). Configuration in Claude Desktop: add to `claude_desktop_config.json` under `mcpServers` with `{"command": "npx", "args": ["-y", "searchcode-mcp"]}`. For other MCP clients (VS Code, Cursor, etc.), consult searchcode.com setup guide. The server communicates with searchcode.com API over HTTPS; ensure outbound HTTPS is allowed. Optional: pass a referrer header in API requests to identify your usage (courtesy, not required). No API key needed but rate limits apply per source IP—unknown exact limit, assume standard web API throttling. If self-hosting is required for private code, deploy searchcode-server (separate Java application, Fair Source licensed).

## Key commands / parameters

The MCP server exposes tools (exact names depend on server implementation, typically MCP `call_tool` requests). Common search parameters based on searchcode.com API and web interface:

- **query**: freetext search string (required)
- **language:X**: filter by programming language (e.g., `language:python`)
- **license:X**: filter by license type (e.g., `license:MIT`)
- **site:X**: restrict to specific domain (e.g., `site:github.com` or `site:stackoverflow.com` for docs)
- **repo:owner/name**: limit to specific repository (if supported by MCP wrapper)
- **filename:X** or **path:X**: target specific file patterns (non-standard, verify MCP tool schema)

Query syntax is simple keyword-based; boolean operators and regex may not be supported. Results are ranked by relevance and popularity. New code typically indexed within days. No direct code execution or file download—only metadata and snippets returned.

## Example workflows

**Workflow 1: Find exposed AWS keys in target org**
Call searchcode MCP tool with query `'AWS_SECRET_ACCESS_KEY' language:python site:github.com owner:targetcorp`. Review results for hardcoded credentials in config files or scripts.

**Workflow 2: Identify target's tech stack**
Search for `package.json` or `requirements.txt` scoped to target repos: `filename:package.json owner:targetcorp`. Parse dependencies to map frameworks and libraries.

**Workflow 3: Locate vulnerable code patterns**
Query `eval( language:javascript` to find dangerous `eval()` usage. Combine with `owner:` filter to scope to specific organization.

**Workflow 4: Research exploit code**
Search `CVE-2024-1234 proof of concept` to find public PoCs or vulnerable code samples for a known CVE.

**Workflow 5: Map public repos of an org**
Use `owner:targetcorp` with broad queries to enumerate all indexed repositories and file types, building a reconnaissance map of public code assets.

## Output format

Expect JSON responses from MCP tool calls containing arrays of search results. Each result typically includes:
- **file path** and **filename**
- **repository URL** (GitHub/GitLab/Bitbucket)
- **code snippet** (syntax-highlighted, truncated)
- **language** and **license** metadata
- **relevance score** or rank
- **last updated** timestamp (index freshness)

Results are paginated (default limits unknown, likely 10-50 per call). Snippets are color-coded for readability but returned as text/JSON, not executable code. No raw file download—only previews. Links provided to view full file in source repo. Cross-reference URLs before using code in operations.

## Common pitfalls

**Rate limiting**: unknown exact limits but API is IP-based; avoid rapid-fire queries or you will be throttled. Space out requests and cache results.

**No private code**: searchcode.com only indexes public repos. Do not expect internal or private org code unless it was accidentally published.

**Index lag**: new code appears within days, not real-time. Fresh commits may not be searchable immediately.

**No regex or advanced boolean**: query syntax is basic keyword-based. Complex patterns may require multiple queries or post-processing.

**Legal/ethical**: searching public code is legal, but scraping credentials or exploiting found secrets without authorization is not. Always verify scope and rules of engagement.

**False positives**: keyword searches return many irrelevant results. Manually review snippets; do not assume every match is exploitable.

**No GitHub integration**: searchcode.com runs its own index, separate from GitHub search. Results may differ; use GitHub API directly if you need GitHub-specific features.

**Courtesy violation**: the API is free and community-supported. Do not spam, do not use for commercial scraping without permission, do provide referrer/link-back if possible.

## References

- https://searchcode.com
- https://daily.dev/blog/search-engines-for-developers-a-comparative-guide
- https://news.ycombinator.com/item?id=7947075
- https://pypi.org/project/searchcode
- https://github.com/boyter/searchcode-server
