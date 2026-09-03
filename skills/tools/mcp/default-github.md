---
name: MCP GitHub
description: Model Context Protocol server providing GitHub API integration for
  repository, issue, PR, actions, and security operations via LLM tool calls.
registry: mcp
tool_id: default:github
category: mcp-server
tags:
  - mcp-server
  - github-api
  - source-control
  - issue-tracking
  - ci-cd
  - code-review
  - llm-integration
mitre_techniques:
  - T1213.003
summary: "MCP GitHub server exposes GitHub's API as structured tools callable by
  LLMs and AI agents. Launch with 'npx -y @modelcontextprotocol/server-github'
  via stdio transport. Requires GITHUB_PERSONAL_ACCESS_TOKEN environment
  variable (fine-grained PAT recommended). Server organizes capabilities into
  toolsets: repos (file access, search), issues, pull_requests, actions
  (workflow read), code_security (GHAS findings). Use --toolsets flag or
  GITHUB_TOOLSETS env var to limit scope. Default provides CLI-safe subset;
  --tools allows granular tool selection. Read-only deployments skip permission
  prompts. GitHub also offers hosted remote variant for device-independent
  workflows. Authentication via OAuth or PAT; GitHub App auth available for
  non-interactive scenarios. Tools return structured JSON. Ideal for automating
  code review, security triage, CI inspection, repository enumeration. In
  red-team context: reconnaissance against GitHub orgs, identifying exposed
  secrets in issues/PRs, mapping CI pipelines, enumerating collaborators/repos.
  Watch token scope—overly permissive PATs leak org structure and code. MCP
  servers extend IDE/CLI tooling; this one is official from GitHub, maintained
  and documented."
sources:
  - https://github.blog/ai-and-ml/generative-ai/a-practical-guide-on-how-to-use-the-github-mcp-server
  - https://github.com/microsoft/mcp-for-beginners
  - https://docs.github.com/en/copilot/concepts/context/mcp
  - https://apidog.com/blog/github-mcp-server
  - https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/use-the-github-mcp-server
  - https://docs.github.com/enterprise-cloud@latest/copilot/reference/copilot-cli-reference/cli-command-reference
  - https://github.com/IBM/mcp-cli
  - https://github.com/github/github-mcp-server
  - https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers
  - https://github.com/TensorBlock/awesome-mcp-servers/blob/main/docs/operating-system--command-line.md
  - https://github.com/rcvassis/CS_RedTeam-Tools
  - https://github.com/RELIAX1212221/RedTeam-MCP
generated_at: 2026-09-03T12:39:06.377Z
generated_by: anthropic
source_hash: 4609141c08b57b12156c0466622df290f299b4ef1593e0031d287167b3bf2dff
---

# MCP GitHub

## Overview

MCP GitHub is an official Model Context Protocol server from GitHub that bridges LLMs and the GitHub API. It runs as a local or remote MCP server, exposing GitHub operations—reading files, listing issues, fetching PRs, inspecting Actions workflows, querying code security alerts—as callable tools for AI agents. The server is written in Go, distributed via npm (@modelcontextprotocol/server-github), and invoked using npx with stdio transport. It integrates into MCP-compatible hosts like VS Code, JetBrains IDEs, Copilot CLI, and custom AI workflows. GitHub provides both self-hosted (local) and cloud-hosted (remote) variants; the hosted version requires no local token setup and works across devices. The server is open-source and designed for safe read-heavy workflows, with optional write capabilities gated by toolset configuration.

## When to use

Use MCP GitHub when you need an LLM or AI agent to interact programmatically with GitHub repositories, issues, pull requests, CI/CD workflows, or security findings. Ideal for: automated code review (fetching PR diffs, comments, file contents); security triage (reading Dependabot alerts, code scanning results if GHAS enabled); CI/CD inspection (listing workflow runs, checking build status); repository reconnaissance (enumerating repos, collaborators, branches); issue/PR management via AI assistant. In red-team operations: gather intelligence on target GitHub organizations (public repos, contributor lists, workflow configs that may leak infrastructure details, exposed secrets in issues/comments); map CI pipelines for supply-chain analysis; identify overly permissive collaborators or stale tokens. Use read-only toolsets when you want context without modification risk. Use full toolsets only when actively managing GitHub resources through an agent. NOT suitable for: direct CLI git operations (use git tool instead); large-scale data exfiltration (API rate limits apply); tasks requiring repository write access unless explicitly configured and scoped.

## Authentication & setup

Authentication requires a GitHub Personal Access Token (PAT). Generate a fine-grained PAT: GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Set repository access scope (all repos or selected) and permissions based on toolsets: repos (Contents: Read), issues (Issues: Read/Write), pull_requests (Pull Requests: Read/Write), actions (Actions: Read), code_security (Security events: Read, requires GHAS). Store token securely. Set environment variable GITHUB_PERSONAL_ACCESS_TOKEN. For MCP clients: if using VS Code/JetBrains, configure in IDE's MCP settings; if using Copilot CLI, run 'copilot mcp add github -- npx -y @modelcontextprotocol/server-github' and provide token when prompted. Alternatively use OAuth flow (interactive) or GitHub App authentication (non-interactive deployments). Remote hosted variant: install from GitHub MCP server repo → Remote Server section → choose read-only or full variant; no local token required, uses GitHub's cloud auth. Toolset/tool filtering: pass --toolsets repos,issues,pull_requests or set GITHUB_TOOLSETS env var; use --tools for granular selection (e.g., --tools get_file_contents,issue_read). Environment variable takes precedence. For Docker: 'docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN=<token> ghcr.io/github/github-mcp-server'. Verify setup: in MCP client, list available tools; should see listPullRequests, getFileContents, etc., based on toolsets enabled.

## Key commands / parameters

Invocation: 'npx -y @modelcontextprotocol/server-github' (stdio transport, default). Flags: --toolsets <csv> (enable toolset groups: repos, issues, pull_requests, actions, code_security); --tools <csv> (enable specific tools, additive with toolsets). Environment variables: GITHUB_PERSONAL_ACCESS_TOKEN (required for auth); GITHUB_TOOLSETS (comma-separated toolsets, overrides --toolsets flag); GITHUB_TOOLS (comma-separated tool names, overrides --tools flag). MCP client commands (Copilot CLI): 'copilot mcp add github -- npx -y @modelcontextprotocol/server-github' (add server); 'copilot mcp list' (show configured servers); 'copilot mcp get github' (show tools for this server); 'copilot mcp remove github' (delete config). Tool examples (invoked via LLM/agent, not direct CLI): listPullRequests (repo, state, head, base); getPullRequest (repo, pr_number); getFileContents (repo, path, ref); searchRepositories (query); listIssues (repo, state, labels); getWorkflowRuns (repo, workflow_id). Tools return JSON responses. Read-only variant omits write tools (create_issue, update_pull_request, etc.). CLI flag in Copilot: --enable-all-github-mcp-tools (use full toolset instead of CLI-safe default). Transport options: stdio (default, local), http/sse (remote hosted). Timeout: default 30s for tool discovery/calls; override with --timeout <ms> in mcp add. Token replacement in config: ${TOKEN:bearer:github} for secure vaults.

## Example workflows

Code review automation: Agent invokes listPullRequests(repo='org/project', state='open') → iterates results → for each PR, calls getPullRequest(pr_number=N) to fetch diff, comments → calls getFileContents for changed files → LLM analyzes code, flags issues, optionally posts comments (if write enabled). Security triage: Agent calls code_security tools (list alerts, get alert details) for GHAS-enabled repo → correlates with recent commits via getCommit → prioritizes findings → generates report. CI/CD inspection: listWorkflows(repo) → getWorkflowRuns(workflow_id, status='failure') → analyze logs/configs to diagnose build failures. Reconnaissance (red-team): searchRepositories(query='org:target-org') → extract repo names → listIssues per repo to mine for leaked credentials, internal hostnames, API endpoints mentioned in comments → getFileContents on .github/workflows/*.yml to map CI pipeline, identify secrets usage, find deployment targets. Repository enumeration: listRepositories(org='target') → map collaborators, languages, topics → identify high-value targets (e.g., infra-as-code repos). Read-only PR viewer: Install read-only variant → agent uses listPullRequests, getPullRequest, searchPullRequests to browse changes, gather context without risk of accidental pushes. Multi-agent orchestration: Assign GitHub issues directly to Copilot agent → agent reads issue via getIssue → generates code → (if integrated) creates PR.

## Output format

All MCP GitHub tools return structured JSON. Common fields: success (boolean), data (object/array), error (string if failed). Example getFileContents response: {content: '<base64 or text>', encoding: 'base64', size: 1234, name: 'file.py', path: 'src/file.py', sha: '<commit_sha>'}. listPullRequests returns array of PR objects: [{number, title, state, user, created_at, updated_at, head, base, ...}]. getPullRequest adds diff, commits, files_changed arrays. searchRepositories: [{full_name, description, stargazers_count, html_url, ...}]. Error responses include error message and HTTP status context. Security tools (code_security toolset) return alert objects with severity, rule, location, state. Actions tools return workflow/run metadata: {id, name, status, conclusion, created_at, html_url}. Responses align with GitHub REST API v3 schemas. The MCP client (IDE/CLI) presents these to the LLM; agent interprets JSON, optionally reformats for user. No direct CLI output—tools invoked programmatically by MCP host or LLM.

## Common pitfalls

Token scope too narrow: if PAT lacks required permissions for chosen toolsets, tools fail silently or return 403/404. Always match token scopes to enabled toolsets. Token leakage: storing GITHUB_PERSONAL_ACCESS_TOKEN in plaintext config files or command history; use secure vaults or ${TOKEN:...} placeholders. Rate limiting: GitHub API enforces rate limits (5000 req/hr authenticated); aggressive automation or enumeration triggers 429 errors; implement backoff. Overly permissive toolsets: enabling all toolsets in red-team scenario exposes write capabilities if token has write scope; prefer read-only variants or explicit --tools filtering. Misconfigured transport: attempting to use remote server URL with stdio transport (or vice versa) causes connection failures; verify transport type in mcp add. Timeout issues: large repos or slow network cause tool timeouts (default 30s); increase --timeout for complex queries. Missing GHAS license: code_security tools require GitHub Advanced Security; fail or return empty on repos without GHAS. Confusing MCP server with git CLI: MCP GitHub does not execute git commands; it calls GitHub API; for local git ops, use separate git MCP server or shell tools. IDE permission prompts: write-enabled tools trigger user confirmation dialogs in VS Code; disable prompts by using read-only toolsets. Stale tokens: PATs expire; rotation required; expired tokens cause 401 errors. Exposing org structure: in adversarial context, querying public repos/issues leaks org hierarchy, tech stack, contributor identities; opsec risk if not anonymized.

## References

• https://github.blog/ai-and-ml/generative-ai/a-practical-guide-on-how-to-use-the-github-mcp-server
• https://github.com/microsoft/mcp-for-beginners
• https://docs.github.com/en/copilot/concepts/context/mcp
• https://apidog.com/blog/github-mcp-server
• https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/use-the-github-mcp-server
• https://docs.github.com/enterprise-cloud@latest/copilot/reference/copilot-cli-reference/cli-command-reference
• https://github.com/IBM/mcp-cli
• https://github.com/github/github-mcp-server
• https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers
• https://github.com/RELIAX1212221/RedTeam-MCP
