---
name: MCP GitHub
description: MCP server enabling AI agents to query GitHub repos, issues, PRs,
  and workflows via Model Context Protocol without local Docker or token
  rotation.
registry: mcp
tool_id: default:github
category: mcp-server
tags:
  - mcp
  - github
  - reconnaissance
  - api
  - read-only
  - code-review
  - osint
  - context-gathering
mitre_techniques:
  - T1213.003
  - T1087.004
summary: Use MCP GitHub when you need to gather intelligence from GitHub
  repositories, issues, pull requests, or workflows through an AI-friendly
  interface. The server runs via `npx -y @modelcontextprotocol/server-github`
  and requires a GitHub personal access token (PAT). It offers read-only and
  read-write toolsets—read-only is safer for reconnaissance and avoids
  permission prompts. Specify toolsets via `--toolsets` flag or
  `GITHUB_TOOLSETS` env var (e.g., `repos,issues,pull_requests`); default
  toolset includes repos, issues, PRs, commits, branches, files, and releases.
  Tools include `listPullRequests`, `getPullRequest`, `searchPullRequests`,
  `getIssue`, `listIssues`, `getFile`, `searchCode`, and many others. For RTPI,
  prefer read-only variants to minimize detection risk and avoid write-side
  logging. The server communicates over stdio; output is structured JSON
  suitable for LLM parsing. Authentication requires
  `GITHUB_PERSONAL_ACCESS_TOKEN` env var or Docker volume mount. Watch for rate
  limits (5,000 req/hr authenticated), repository access restrictions, and
  potential secret leakage in prompts (future versions will block AI-generated
  secrets). Always validate that tools match your scope—default toolset may
  include write operations unless explicitly constrained. For stealth, limit
  toolset to only required capabilities (e.g., `repos,files` for code recon).
  Combine with Tavily or web MCP servers for cross-platform OSINT. Do not invoke
  if target org has MCP registry allowlist policies that may log unrecognized
  server usage.
sources:
  - https://github.blog/ai-and-ml/generative-ai/a-practical-guide-on-how-to-use-the-github-mcp-server/
  - https://docs.github.com/en/copilot/concepts/context/mcp
  - https://github.com/modelcontextprotocol
  - https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/use-the-github-mcp-server
  - https://github.com/microsoft/mcp-for-beginners/
  - https://github.com/IBM/mcp-cli
  - https://github.com/MladenSU/cli-mcp-server
  - https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers
  - https://github.com/github/github-mcp-server
  - https://codingbutterbot.github.io/gh_cli_mcp/
  - https://vulnerablemcp.info/security.html
  - https://www.penligent.ai/hackinglabs/es/anthropic-mcp-vulnerability-7000-servers-and-the-case-for-continuous-red-teaming/
generated_at: 2026-05-19T10:53:07.213Z
generated_by: anthropic
source_hash: 4609141c08b57b12156c0466622df290f299b4ef1593e0031d287167b3bf2dff
---

# MCP GitHub

## Overview

MCP GitHub is a Model Context Protocol server maintained by GitHub that exposes GitHub API operations (repos, issues, PRs, commits, files, workflows, releases, projects) as MCP tools. It eliminates the need for manual API calls, token rotation, or Docker container management. The server runs locally via `npx` or remotely through supported IDEs (VS Code, JetBrains) and communicates over stdio. It supports both read-only and read-write toolsets, with read-only being preferred for reconnaissance to avoid permission prompts and minimize footprint. The server is open-source and located at `github/github-mcp-server`.

## When to use

Deploy MCP GitHub for: (1) Enumerating public or accessible private repositories without manual API scripting. (2) Reviewing pull requests, issues, or commit history for OSINT or vulnerability research. (3) Searching code across repos (`searchCode` tool) for secrets, misconfigurations, or vulnerable patterns. (4) Mapping GitHub organizations, teams, and repository structures. (5) Monitoring CI/CD workflows and Actions for pipeline abuse opportunities. (6) Gathering context on target codebases before exploitation. Use read-only toolsets (`pull_requests_read_only`, `repos_read_only`) when you want to minimize detection surface and avoid write-side audit logs. Do not use if target has MCP allowlist policies or if you lack a valid PAT with appropriate scopes.

## Authentication & setup

**Prerequisites**: Node.js, npm/npx, and GitHub CLI authenticated OR a GitHub personal access token (PAT). **Setup**: (1) Generate a PAT at https://github.com/settings/tokens with scopes `repo` (full control of private repos), `read:org` (read org data), `workflow` (update GitHub Actions), or limit to `public_repo` for public-only access. (2) Set `GITHUB_PERSONAL_ACCESS_TOKEN` env var: `export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...`. (3) Invoke via `npx -y @modelcontextprotocol/server-github`. **Toolset selection**: Use `--toolsets` flag or `GITHUB_TOOLSETS` env var to specify enabled tools. Examples: `--toolsets repos,issues,pull_requests` (additive), `--toolsets pull_requests_read_only` (read-only variant), `--toolsets all` (all tools, risky). Default toolset (`default`) includes repos, issues, PRs, commits, branches, files, releases. **Docker alternative**: `docker run -e GITHUB_PERSONAL_ACCESS_TOKEN=ghp_... ghcr.io/github/github-mcp-server:latest`. **Individual tools**: Use `--tools get_gist,search_code` to enable specific tools; combines additively with toolsets.

## Key commands / parameters

The server is invoked as `npx -y @modelcontextprotocol/server-github [flags]`. **Flags**: `--toolsets <list>` (comma-separated toolset names, e.g., `repos,issues,pull_requests_read_only`), `--tools <list>` (comma-separated individual tool names, additive with toolsets), `--insiders` (enable experimental features). **Environment variables**: `GITHUB_PERSONAL_ACCESS_TOKEN` (required), `GITHUB_TOOLSETS` (alternative to `--toolsets` flag, takes precedence). **Available toolsets**: `repos`, `issues`, `pull_requests`, `pull_requests_read_only`, `commits`, `branches`, `files`, `releases`, `workflows`, `projects`, `gists`, `search`, `organizations`, `teams`, `all`, `default`. **Read-only toolsets**: Append `_read_only` suffix where available (e.g., `pull_requests_read_only`) to exclude write operations. **Tool examples**: `listPullRequests`, `getPullRequest`, `searchPullRequests`, `getIssue`, `listIssues`, `searchIssues`, `getFile`, `searchCode`, `listCommits`, `getBranch`, `listWorkflowRuns`, `getWorkflowRun`, `listOrganizationRepos`, `getRepository`. **CLI utilities**: `github-mcp-server tool-search "<query>"` to discover available tools (requires local build).

## Example workflows

(1) **Repository enumeration**: Invoke with `--toolsets repos,organizations` and query `listOrganizationRepos` for target org; parse output for private repo names, descriptions, topics, and last-push dates. (2) **Secret scanning**: Use `--toolsets search,files` and call `searchCode` with queries like `password`, `api_key`, `BEGIN RSA PRIVATE KEY`; retrieve file contents with `getFile` for match lines. (3) **PR review for vulns**: Enable `pull_requests_read_only` toolset, call `listPullRequests` filtered by state=open, then `getPullRequest` with diff=true to analyze code changes for injection points or misconfigurations. (4) **CI/CD recon**: Use `workflows` toolset, call `listWorkflowRuns` to enumerate Actions runs, `getWorkflowRun` for logs, and `listWorkflows` to map pipeline definitions for potential command injection or secret exposure. (5) **Cross-repo code search**: Invoke `searchCode` across org with query `extension:yaml secrets` to find hardcoded credentials in config files. (6) **Commit history analysis**: Use `commits` toolset and `listCommits` with author or date filters to map developer activity and identify patterns (e.g., late-night commits with reduced review).

## Output format

All tools return structured JSON objects suitable for LLM parsing. Typical fields: `{"success": true, "data": {...}, "error": null}`. **Repository objects**: `{"name", "full_name", "private", "description", "html_url", "created_at", "updated_at", "pushed_at", "size", "language", "topics": []}`. **Issue/PR objects**: `{"number", "title", "state", "user": {"login"}, "body", "html_url", "created_at", "updated_at", "labels": [], "comments": int}`. **File objects**: `{"name", "path", "sha", "size", "url", "html_url", "content": "base64-encoded", "encoding": "base64"}`. **Search results**: `{"total_count": int, "items": [{"name", "path", "repository": {"full_name", "html_url"}, "html_url", "score"}]}`. **Error responses**: `{"success": false, "error": {"message", "status": 404/403/401}}`. Decode base64 content with standard tools; search results include relevance scores. Rate-limit headers are not exposed via MCP; monitor for 403 responses indicating limit exhaustion.

## Common pitfalls

(1) **Rate limiting**: Authenticated requests allow 5,000/hr; unauthenticated only 60/hr. Exhaust limits quickly with broad searches or recursive repo enumeration. Spread requests over time or rotate PATs. (2) **Scope creep**: Default toolset includes write operations (create issue, update PR); accidentally invoking these generates audit logs. Always specify read-only toolsets for stealth. (3) **Secret exposure**: Prompts containing PATs or API keys may be logged by MCP host or LLM provider. Future versions will block AI-generated secrets, but current versions do not. Use env vars, never inline tokens in prompts. (4) **Allowlist policies**: Orgs with MCP registry allowlists will block unrecognized servers; verify target environment before deployment. (5) **Tool discovery mismatch**: Available tools depend on selected toolsets; invoking a tool outside enabled toolsets returns error. Use `tool-search` CLI utility to confirm. (6) **Content size limits**: Large file responses (>1MB) may timeout or truncate; chunk requests or filter by file size. (7) **Authentication failure**: If PAT lacks required scopes (e.g., `repo` for private repos), tools return 404 instead of 403, masking permission issues. Validate scopes before operation. (8) **Logging exposure**: GitHub audit logs capture API calls tied to PAT; consider using burner accounts or short-lived tokens for sensitive ops.

## References

• https://github.blog/ai-and-ml/generative-ai/a-practical-guide-on-how-to-use-the-github-mcp-server/
• https://docs.github.com/en/copilot/concepts/context/mcp
• https://github.com/modelcontextprotocol
• https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/use-the-github-mcp-server
• https://github.com/microsoft/mcp-for-beginners/
• https://github.com/IBM/mcp-cli
• https://github.com/MladenSU/cli-mcp-server
• https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers
• https://github.com/github/github-mcp-server
• https://codingbutterbot.github.io/gh_cli_mcp/
• https://vulnerablemcp.info/security.html
• https://www.penligent.ai/hackinglabs/es/anthropic-mcp-vulnerability-7000-servers-and-the-case-for-continuous-red-teaming/
