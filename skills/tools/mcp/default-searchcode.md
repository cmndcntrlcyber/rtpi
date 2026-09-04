---
name: searchcode
description: MCP server providing code search across GitHub, GitLab, Bitbucket
  and other public repositories via searchcode.com API
registry: mcp
tool_id: default:searchcode
category: mcp-server
tags:
  - code-search
  - osint
  - reconnaissance
  - mcp
  - api
  - github
  - gitlab
  - source-code
mitre_techniques:
  - T1593.003
  - T1595.002
summary: searchcode MCP server queries searchcode.com to find public source code
  across 243 languages and 10+ code hosts including GitHub, GitLab, and
  Bitbucket. Use this for OSINT reconnaissance to find exposed secrets, API
  keys, configuration files, security flaws, or code patterns in target
  organizations' public repositories. Invoke via MCP client (Claude Desktop,
  Cursor, VS Code Copilot) after adding the server with 'npx -y searchcode-mcp'.
  The server uses searchcode.com's REST API to search billions of lines of
  indexed code. Supports filters including language:, license:, site:, and
  special character searches. Returns structured JSON with file paths,
  repository URLs, matching code snippets, and metadata. Provides immediate
  reconnaissance capability without cloning repositories—single query replaces
  ~30 tool calls and 50k tokens. Watch for rate limiting (be excellent, don't
  spam per API guidelines). Results may lag 2-3 days behind latest commits. No
  authentication required for basic searches. Ideal for finding credential
  leaks, vulnerable code patterns, technology stack enumeration, and dependency
  analysis during initial target profiling.
sources:
  - https://daily.dev/blog/search-engines-for-developers-a-comparative-guide
  - https://news.ycombinator.com/item?id=7947075
  - https://www.supermonitoring.com/blog/find-code-snippets-easily-searchcode
  - https://pypi.org/project/searchcode
  - https://swimm.io/learn/software-development/what-is-a-code-search-engine-and-7-tools-to-know-in-2025
  - https://ast-grep.github.io/reference/cli
  - https://lobehub.com/skills/aaddrick-gh-cli-search-gh-search-code
  - https://searchcode.com
  - https://cli.github.com/manual/gh_search_code
  - https://developer.mozilla.org/en-US/blog/searching-code-with-grep
  - https://www.yash.com/blog/red-team-assessment-and-penetration-testing
  - https://www.themissinglink.com.au/news/red-team-penetration-testing
generated_at: 2026-09-04T02:29:55.236Z
generated_by: anthropic
source_hash: e1782f87a59c433da4b0fe9383e2dda315ba562f589225ac19ac9b1a8b539a87
---

# searchcode

## Overview

searchcode is an MCP (Model Context Protocol) server that provides programmatic access to searchcode.com, a comprehensive source code search engine indexing billions of lines of code from public repositories. The server wraps the searchcode.com REST API and exposes it to MCP-compatible AI clients like Claude Desktop, Cursor, VS Code Copilot, and others. SearchCode indexes code from GitHub, GitLab, Bitbucket, and other public code hosts across 243 programming languages. The MCP server is distributed as 'searchcode-mcp' via npm and runs via 'npx -y searchcode-mcp'. Unlike GitHub's native search, searchcode indexes special characters and provides cross-platform search capabilities. The tool is designed for code intelligence, OSINT reconnaissance, and vulnerability research without requiring repository clones or direct API authentication.

## When to use

Use searchcode MCP during reconnaissance phases to enumerate target organization code repositories, identify exposed secrets or credentials, find vulnerable code patterns, analyze technology stacks, discover API usage examples, locate configuration files, audit licensing compliance, or search for specific functions/methods. Particularly valuable when you need to search across multiple code hosting platforms simultaneously (GitHub + GitLab + Bitbucket) or when searching for special characters that traditional search engines ignore. Effective for finding 'language:python site:github.com org:targetname' patterns or 'filename:config.yml' across all public repos. Replaces manual GitHub/GitLab searches and reduces token consumption by ~100x compared to cloning and parsing repositories directly (500 tokens vs 50,000 tokens per investigation). Ideal for initial target profiling, supply chain analysis, and identifying publicly exposed attack surface.

## Authentication & setup

No API key or authentication required for basic searchcode.com usage. The MCP server connects to searchcode.com as a free public service. To add to Claude Desktop, edit claude_desktop_config.json and add: {"mcpServers": {"searchcode": {"command": "npx", "args": ["-y", "searchcode-mcp"]}}}. For Cursor, add to .cursor/mcp.json: {"mcpServers": {"searchcode": {"command": "npx", "args": ["-y", "searchcode-mcp"]}}}. For VS Code Copilot, add to .vscode/settings.json: {"mcp": {"servers": {"searchcode": {"command": "npx", "args": ["-y", "searchcode-mcp"]}}}}. The server can also connect via HTTP transport for remote MCP servers. After configuration, restart your MCP client. The searchcode.com API creator requests that users 'be excellent to each other' and avoid spamming. Optional: pass a referrer in API requests to identify your usage. No rate limits are publicly documented but abuse will likely be blocked per IP.

## Key commands / parameters

The MCP server exposes searchcode.com API capabilities through MCP tools. Primary search supports these qualifiers:

- language: filter by programming language (e.g., 'language:python', 'language:javascript')
- license: filter by code license (e.g., 'license:mit')
- site: limit to specific code host (e.g., 'site:github.com')
- filename: target specific filenames (e.g., 'filename:package.json', 'filename:config')
- Special character search: unlike most engines, searchcode indexes operators, braces, etc.

Search syntax supports boolean operators and exact phrases. Queries return: file path, repository URL, SHA/commit reference, language, matching code snippets with highlights, and textMatches array. The MCP server returns structured JSON containing these fields. No CLI flags are passed to the MCP server itself (invoked via npx); all parameters are sent through MCP tool calls from the AI client. Limit results per query (typically 30 default in API). Combine multiple qualifiers: 'api_key language:python site:github.com' to find Python files on GitHub containing 'api_key'.

## Example workflows

**Credential leak reconnaissance**: Search 'aws_secret_access_key language:python site:github.com' to find exposed AWS credentials in Python code. Follow up with 'filename:.env' or 'filename:config.yml' to find configuration files.

**Technology stack enumeration**: Query 'import flask site:github.com org:targetcompany' to identify Flask usage, then 'package.json site:github.com org:targetcompany' to enumerate Node.js dependencies. Search for specific framework versions: 'django==2.0 language:python'.

**Vulnerability pattern detection**: Search for known vulnerable patterns like 'eval(request language:python' or 'innerHTML = language:javascript' to find injection vulnerabilities. Use 'SELECT * FROM language:sql -filename:test' to find potential SQL injection points excluding tests.

**Supply chain analysis**: Find all repos using a specific library: 'import requests language:python site:github.com' or check for vulnerable versions: 'log4j-core 2.14 language:java'.

**License compliance audit**: Search 'license:gpl site:github.com org:yourorg' to find GPL-licensed code that may require disclosure.

## Output format

The MCP server returns structured JSON responses from the searchcode.com API. Each result contains:

- **path**: relative file path within repository
- **repository**: repository name and location
- **url**: direct link to file on source code host
- **sha**: commit hash or identifier
- **language**: detected programming language
- **textMatches**: array of matching code snippets with surrounding context

Code snippets are syntax-highlighted in the web UI but returned as plain text via API. Matching terms are indicated in textMatches. Responses include metadata like total result count. Results are ordered by relevance considering popularity, recency, and match quality. Official documentation and widely-used projects rank higher. Index lag is typically 2-3 days for new content. The MCP client (Claude, Cursor, etc.) will present this data in a conversational format, but the underlying structure is JSON. When multiple results exist, the agent receives a list of matches with enough context to identify relevant files without clicking through.

## Common pitfalls

**Rate limiting**: searchcode.com is a free service. Excessive automated queries from a single IP will likely be throttled or blocked. Space out requests and cache results. The API motto is 'be excellent to each other'—respect the service.

**Index lag**: New repositories or recent commits may not appear for 2-3 days. Don't assume code is absent if you know it was just pushed.

**No private repository access**: searchcode.com only indexes public code. It cannot search private GitHub/GitLab repos or internal code hosting.

**Special character quirks**: While searchcode handles special characters better than most engines, complex regex patterns are not supported. Use simple literal searches for operators.

**Result scope confusion**: searchcode is independent of GitHub search. It does NOT use GitHub's API or search backend. Results may differ from github.com search.

**False negatives on exclusions**: Using negative qualifiers like '-language:javascript' may not work as expected. Explicitly filter positive matches instead.

**No code execution**: You cannot run found code snippets directly. This is a search engine only.

**Context window with large result sets**: If searching for very common patterns, the AI agent may receive hundreds of matches, consuming tokens. Narrow searches with specific qualifiers.

## References

• https://searchcode.com
• https://daily.dev/blog/search-engines-for-developers-a-comparative-guide
• https://news.ycombinator.com/item?id=7947075
• https://www.supermonitoring.com/blog/find-code-snippets-easily-searchcode
• https://pypi.org/project/searchcode
• https://swimm.io/learn/software-development/what-is-a-code-search-engine-and-7-tools-to-know-in-2025
