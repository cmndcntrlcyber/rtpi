---
name: searchcode
description: MCP server for searching public and private code repositories via
  searchcode API
registry: mcp
tool_id: default:searchcode
category: mcp-server
tags:
  - code-search
  - recon
  - osint
  - repository
  - vulnerability-research
  - mcp-server
  - npm
mitre_techniques:
  - T1593.003
  - T1213
summary: "searchcode-mcp is an MCP server that exposes code search capabilities
  across public repositories and potentially private organizational code. Invoke
  via `npx -y searchcode-mcp`. Use during reconnaissance to find vulnerable code
  patterns, exposed secrets, API usage examples, dependency chains, or security
  anti-patterns. Particularly valuable for: (1) identifying reused vulnerable
  code across codebases, (2) locating hardcoded credentials or keys, (3)
  researching target tech stacks and frameworks, (4) discovering similar
  exploitable patterns after finding one vulnerability, (5) accelerating dev
  onboarding to unfamiliar targets. Expect results as structured references to
  code locations with snippets and metadata. Tool enables cross-repository
  pattern matching far beyond grep or single-repo IDE search. Integrates as MCP
  server so queries appear as function calls in agent context. No authentication
  documented for public search; private repo access may require API keys. Output
  is typically JSON with file paths, line numbers, repo URLs, and code context.
  Fastest value: search for known-bad patterns (e.g., 'eval(request.GET',
  'password = \"', 'jwt.decode(verify=False)') across entire target org codebase
  at once."
sources:
  - https://codesearchguide.org/
  - https://www.uspto.gov/trademarks/search/design-search-codes
  - https://zitniklab.hms.harvard.edu/ToolUniverse/guide/literature_search_tools_tutorial.html
  - https://ampcode.com/manual
  - https://www.youtube.com/watch?v=tIb_TzVNbDM
  - https://man7.org/linux/man-pages/man1/find.1.html
  - https://github.com/microsoft/vscode/issues/6484
  - https://developers.openai.com/codex/cli/reference
  - https://kilo.ai/docs/code-with-ai/platforms/cli-reference
  - https://code.claude.com/docs/en/cli-reference
  - https://www.cycognito.com/learn/red-teaming/red-teaming-vs-pentesting/
  - https://blog.securelayer7.net/red-team-assessment/
generated_at: 2026-05-19T10:54:38.025Z
generated_by: anthropic
source_hash: e1782f87a59c433da4b0fe9383e2dda315ba562f589225ac19ac9b1a8b539a87
---

# searchcode

## Overview

searchcode-mcp is a Model Context Protocol server that wraps code search functionality, allowing AI agents to query vast code repositories programmatically. Unlike grep or IDE search limited to local files, this tool searches across public code on platforms like GitHub and potentially private organizational repositories. It is designed for understanding codebases at scale, finding code reuse patterns, locating vulnerabilities, and performing security research. The MCP architecture means queries are exposed as callable functions within the agent's tool suite, with results returned as structured data.

## When to use

Use searchcode-mcp during reconnaissance and target analysis phases to:
• Map technology stacks and frameworks used by target organizations
• Find vulnerable code patterns (SQL injection, command injection, hardcoded secrets) across multiple repositories
• Locate previous instances of a vulnerability class after discovering one example
• Research how target uses specific libraries or APIs (authentication flows, crypto implementations)
• Identify code reuse that might propagate vulnerabilities
• Discover exposed credentials, API keys, or sensitive configuration
• Accelerate understanding of unfamiliar codebases during red team engagements
• Find proof-of-concept code or exploit examples in public repos
• Track down specific function implementations or security control implementations
• Incident response: quickly assess blast radius of a disclosed vulnerability across all organizational code

## Authentication & setup

Invoked via `npx -y searchcode-mcp` which downloads and runs the package without permanent installation. No explicit authentication mechanism documented in available research. Public code search typically requires no credentials. If accessing private organizational repositories, the tool may honor:
• Environment variables for API tokens (e.g., GITHUB_TOKEN, SEARCHCODE_API_KEY)
• Configuration files in ~/.searchcode/ or similar
• OAuth flows initiated on first use

As an MCP server, it must run as a subprocess accessible to the MCP client (the AI agent runtime). RTPI likely handles this lifecycle automatically. Verify connectivity by issuing a test query immediately after attachment. If results fail, check:
1. Network connectivity to searchcode.com or target code hosts
2. Rate limiting (public APIs often throttle anonymous requests)
3. API token validity if using private repo access
4. MCP server process health in container/VM logs

## Key commands / parameters

As an MCP server, searchcode-mcp exposes functions callable via MCP protocol, not direct CLI commands. Expected functions based on code search conventions:

**search_code**(query: string, language?: string, repo?: string, limit?: int)
• `query`: search terms, supports boolean operators and regex patterns in many implementations
• `language`: filter by programming language (e.g., 'python', 'javascript', 'go')
• `repo`: scope search to specific repository or organization
• `limit`: max results to return (default often 10-50)

**search_by_pattern**(pattern: string, file_extension?: string)
• Regex-based search for precise pattern matching
• Useful for finding specific vulnerable function calls or code structures

**get_code_context**(result_id: string, lines_before?: int, lines_after?: int)
• Retrieve surrounding code for a search result
• Essential for understanding whether a match is actually exploitable

Common query patterns:
• Exact phrase: "password = "
• Boolean: "eval AND request.GET"
• Regex patterns for crypto keys, JWTs, AWS credentials
• Function signatures: "def execute_sql(" to find custom SQL execution

Invoke via agent's tool-calling mechanism, not shell commands. The MCP client translates agent tool requests into JSON-RPC calls to the server subprocess.

## Example workflows

**Workflow 1: Finding hardcoded secrets**
1. search_code(query='"AWS_SECRET_ACCESS_KEY" OR "aws_secret_access_key ="', language='python')
2. For each result, get_code_context to verify it's not a safe example/test
3. Extract any exposed credentials for later use
4. Search for same developer's other repos to find credential reuse

**Workflow 2: Vulnerability pattern hunting**
1. Discover SQLi in target's /api/search endpoint via manual testing
2. search_code(query='db.execute("SELECT * FROM " + request', repo='target-org/*')
3. Identify 15 other endpoints with same vulnerable pattern
4. Build comprehensive exploit map before blue team patches initial finding

**Workflow 3: Tech stack reconnaissance**
1. search_code(query='import flask OR from flask import', repo='target-org/*', limit=100)
2. search_code(query='require("express")', repo='target-org/*')
3. Map which services use which frameworks
4. Cross-reference with CVE databases for framework vulnerabilities
5. Prioritize targets running vulnerable versions

**Workflow 4: Authentication bypass research**
1. search_code(query='jwt.decode AND verify=False', language='python')
2. search_code(query='jwt.verify(token, { verify: false })', language='javascript')
3. Identify services disabling signature verification
4. Craft forged tokens for identified services

**Workflow 5: Incident response**
1. New log4shell-style vuln disclosed in library X
2. search_code(query='import X OR require("X")', repo='our-org/*')
3. Generate complete inventory of affected services in minutes
4. Prioritize patching based on service criticality

## Output format

Expect JSON-structured results via MCP protocol response. Typical structure per result:

```json
{
  "results": [
    {
      "id": "unique-result-id",
      "filename": "src/auth/login.py",
      "repo": "target-org/webapp",
      "repo_url": "https://github.com/target-org/webapp",
      "lines": {
        "start": 145,
        "end": 148
      },
      "code_snippet": "def login(username, password):\n    query = f\"SELECT * FROM users WHERE name='{username}'\"\n    result = db.execute(query)",
      "language": "Python",
      "score": 0.95
    }
  ],
  "total": 1,
  "query": "db.execute AND format string"
}
```

Key fields:
• `repo_url`: direct link to investigate further or clone locally
• `lines`: precise location for grep/exploitation
• `code_snippet`: immediate context; request full context if needed
• `score`: relevance ranking (prioritize >0.8)

Results are piped into agent's context window. Agent can iterate on results, request more context, or refine queries. Large result sets may be paginated; check for `next_page` tokens in responses.

## Common pitfalls

**Rate limiting**: Public searchcode APIs aggressively throttle. Spread queries over time or use authenticated access. If queries start failing, exponential backoff required.

**False positives**: Code search returns many test files, examples, and commented-out code. Always use get_code_context to verify exploitability. A match in `/tests/` or `/examples/` is rarely valuable.

**Overly broad queries**: Searching for 'password' returns millions of results. Narrow with language filters, repo scopes, and precise patterns. Start specific, broaden only if needed.

**Private repo access**: Tool may silently fall back to public-only search if credentials fail. Verify you're actually searching target's private code by looking for known internal repo names in results.

**Regex escaping**: If patterns aren't matching, check whether tool requires double-escaping special characters in JSON strings.

**Stale indexes**: Code search indexes may lag days behind repository HEAD. Recently committed secrets might not appear immediately.

**Language detection errors**: Files with unusual extensions may be misclassified. Try searching without language filters if expected results are missing.

**Context window overflow**: Returning 1000 results will exceed most agent context limits. Use aggressive filtering and pagination.

**Legal boundaries**: Searching public code is legal; accessing private repos without authorization is not. Ensure RTPI engagement scope covers any private repositories searched.

**Noise from forks**: Popular repos have hundreds of forks. Results may be dominated by copies rather than unique implementations. Filter by org or use fork-detection if available.

## References

• https://codesearchguide.org/ (code search concepts and use cases)
• https://github.com/microsoft/vscode/issues/6484 (command-line search patterns)
• https://ampcode.com/manual (Librarian subagent for cross-repo code search)
• https://blog.securelayer7.net/red-team-assessment/ (red teaming methodology context)
• https://www.cycognito.com/learn/red-teaming/red-teaming-vs-pentesting/ (reconnaissance techniques)
