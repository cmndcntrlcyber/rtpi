---
name: MCP GitHub
description: MCP server that connects AI agents to GitHub repositories, issues,
  PRs, and code scanning via the Model Context Protocol
registry: mcp
tool_id: default:github
category: mcp-server
tags:
  - mcp
  - github
  - api
  - integration
  - repository
  - issues
  - pull-requests
  - code-scanning
summary: GitHub MCP server exposes GitHub API operations through the Model
  Context Protocol. Use when you need to read repository contents, search code,
  list/create/modify issues and pull requests, manage comments, or trigger
  GitHub-hosted workflows. Invoke via `npx -y
  @modelcontextprotocol/server-github` with GITHUB_PERSONAL_ACCESS_TOKEN
  environment variable. Supports stdio transport only. Configure with --toolsets
  flag (repos,issues,pull_requests,actions,code_security) or --tools flag for
  individual tools. By default provides read-only CLI subset; use
  --enable-all-github-mcp-tools for full access. Returns JSON responses. Does
  NOT push code changes or write repository contents directly. Requires
  fine-grained GitHub personal access token with appropriate scopes. Use
  read-only variants for reconnaissance without risk. For multi-step workflows,
  chain multiple tool calls. Output is structured JSON suitable for parsing.
  Watch for rate limiting on GitHub API. Ideal for automated triage, PR review,
  issue tracking, and CI/CD integration in red team infrastructure.
sources:
  - https://github.blog/ai-and-ml/generative-ai/a-practical-guide-on-how-to-use-the-github-mcp-server
  - https://docs.github.com/en/copilot/concepts/context/mcp
  - https://apidog.com/blog/github-mcp-server
  - https://docs.stacklok.com/toolhive/guides-mcp/github
  - https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/use-the-github-mcp-server
  - https://docs.github.com/enterprise-cloud@latest/copilot/reference/copilot-cli-reference/cli-command-reference
  - https://github.com/GlitterKill/sdl-mcp/blob/main/docs/cli-reference.md
  - https://github.com/IBM/mcp-cli
  - https://github.com/github/github-mcp-server
  - https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers
  - https://mcpmarket.com/server/redteam-1
  - https://github.com/cyberbuff/atomic-red-team-mcp
generated_at: 2026-09-04T02:29:50.498Z
generated_by: anthropic
source_hash: 4609141c08b57b12156c0466622df290f299b4ef1593e0031d287167b3bf2dff
---

# MCP GitHub

## Overview

The GitHub MCP server is an official Model Context Protocol implementation maintained by GitHub that bridges AI agents to the GitHub API. It exposes tools for reading repository files, searching code, managing issues and pull requests, adding comments, and interacting with GitHub Actions and code security features. The server runs as a local stdio process spawned via npx and communicates using the MCP wire protocol. It supports fine-grained tool filtering through toolsets (repos, issues, pull_requests, actions, code_security) or individual tool selection. The server is designed for safe integration with AI agents, offering read-only modes and permission-based access control.

## When to use

Use GitHub MCP when you need to automate reconnaissance of target repositories, enumerate issues and pull requests for intelligence gathering, read source code and configuration files, search codebases for secrets or vulnerabilities, monitor CI/CD workflows via Actions, review code security alerts (requires GitHub Advanced Security), or perform automated triage and classification of repository activity. Ideal for red team scenarios requiring systematic enumeration of organizational repositories, tracking security posture through public or accessible private repos, or integrating GitHub data into broader attack planning workflows. The read-only variant is perfect for reconnaissance without leaving modification traces. For automated PR reviews, issue tracking, or collecting organizational intelligence from GitHub Enterprise instances, this tool provides structured API access without manual web scraping.

## Authentication & setup

Requires a GitHub Personal Access Token (PAT), preferably fine-grained. Generate at Settings > Developer settings > Personal access tokens > Fine-grained tokens. Select repositories (specific or all accessible), set expiration, and grant permissions based on required toolsets: repos (Contents: read), issues (Issues: read/write), pull_requests (Pull requests: read/write), actions (Actions: read/write), code_security (Security events: read, requires GHAS). Export token as environment variable: `export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx`. Alternatively, set in MCP client configuration. For GitHub Enterprise, may need to configure API endpoint (check server docs). Never commit tokens to version control. Use minimal scopes required for operation. For read-only recon, grant only read permissions. Store tokens securely in credential managers or environment-specific secret stores. The server performs no authentication by itself; all auth is via the PAT passed to GitHub API.

## Key commands / parameters

Invocation: `npx -y @modelcontextprotocol/server-github`. Environment variables: GITHUB_PERSONAL_ACCESS_TOKEN (required), GITHUB_TOOLSETS (comma-separated: repos,issues,pull_requests,actions,code_security), GITHUB_TOOLS (comma-separated list of individual tools, overrides toolsets). Command-line flags: --toolsets (filter to specific toolsets), --tools (specify individual tools), --enable-all-github-mcp-tools (enable all tools instead of CLI subset). Key tools include: get_file_contents, search_code, list_issues, create_issue, add_issue_comment, list_pull_requests, get_pull_request, create_pull_request, add_comment_to_pending_review, list_commits, fork_repository, create_repository. Tools are called via MCP protocol by the AI agent; not directly invoked by user. Transport is stdio only. No HTTP/SSE modes in default GitHub MCP. Timeout defaults to 30000ms for tool calls. For CLI integration, use `copilot mcp add github -- npx -y @modelcontextprotocol/server-github` with env vars.

## Example workflows

**Recon workflow**: List all repositories for a user/org → iterate through repos → get_file_contents on .github/workflows, .env.example, config files → search_code for keywords like 'password', 'api_key', 'TODO: security'. **Issue intelligence**: list_issues with filters → extract metadata, assignees, labels → identify security-tagged issues → read issue bodies and comments for internal process intel. **PR review**: list_pull_requests for target repo → get_pull_request details → review changed files → identify risky changes (auth, crypto, input validation). **CI/CD analysis**: enumerate Actions workflows → identify deployment triggers, secrets usage, artifact handling → map CI/CD pipeline. **Security posture**: query code_security tools for alerts → triage findings → correlate with known vulns. **Read-only mode**: install read-only variant via --toolsets repos (no write tools) → safe browsing without modification risk → ideal for initial survey. Chain multiple calls: search repos → filter by stars/activity → deep-dive into high-value targets → extract credentials/config → document findings.

## Output format

All tool responses return structured JSON via MCP protocol. Typical structure: { success: boolean, data: object/array, error?: string }. Example get_file_contents: { content: string (base64 or UTF-8), encoding: string, sha: string }. list_issues: array of { number, title, state, user, labels, created_at, updated_at, body }. search_code: { items: [{ name, path, repository, html_url, score }] }. Errors include HTTP status codes (401 auth, 403 forbidden, 404 not found, 429 rate limit). MCP clients present this data to the agent as tool results. Logs and debugging output go to stderr. The agent parses JSON and extracts relevant fields for reasoning. For file contents, handle base64 decoding if encoded. For paginated results (issues, PRs), may need multiple calls with pagination parameters. Rate limit info often in response headers but not always surfaced in tool output; watch for 429 errors.

## Common pitfalls

**Rate limiting**: GitHub API has strict rate limits (5000/hour authenticated, 60/hour unauthenticated). Aggressive enumeration triggers 429 errors; implement backoff and caching. **Token scopes**: Insufficient permissions cause 403 errors; verify PAT has required scopes for target toolsets. **Private repos**: Token must have access to specific repos; fine-grained tokens limit scope. **Large files**: get_file_contents may fail or return truncated content for files >1MB; use Git LFS or raw URL for large binaries. **Search limits**: search_code has query syntax requirements and result caps (~100 results); refine queries iteratively. **Pagination**: Many list operations paginate; default page size ~30; must iterate for complete datasets. **Tool filtering**: Without --enable-all-github-mcp-tools, only CLI subset active; missing tools cause 'tool not found' errors. **No write confirmation**: Write operations (create_issue, create_pull_request) execute immediately; no undo; use read-only mode for safe recon. **GitHub Enterprise**: Default server targets github.com; Enterprise requires custom configuration (not documented in snippets). **Secrets in responses**: API may return partial tokens or keys in workflow files; sanitize before logging.

## References

- https://github.blog/ai-and-ml/generative-ai/a-practical-guide-on-how-to-use-the-github-mcp-server
- https://docs.github.com/en/copilot/concepts/context/mcp
- https://apidog.com/blog/github-mcp-server
- https://docs.stacklok.com/toolhive/guides-mcp/github
- https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/use-the-github-mcp-server
- https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers
- https://github.com/github/github-mcp-server
