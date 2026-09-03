---
name: MCP Memory
description: MCP server providing persistent memory and knowledge graph storage
  across AI sessions via stdio transport.
registry: mcp
tool_id: default:memory
category: mcp-server
tags:
  - memory
  - persistence
  - knowledge-graph
  - session-state
  - mcp-server
  - context-management
  - stdio
summary: Use @modelcontextprotocol/server-memory to store and retrieve
  information across AI sessions. Invoke via npx with optional
  MEMORY_PERSIST=true and MEMORY_PATH environment variables. Stores memories
  (entities, observations, relations) in JSON or JSONL format. Tools include
  create_entities, create_relations, add_observations, search_nodes, read_graph,
  delete operations. Memory persists between sessions only if MEMORY_PERSIST is
  set; otherwise state is ephemeral. Default storage is ./memory.json in CWD.
  Watch for memory limits (some implementations cap at ~200 entries), file path
  permissions, and lack of built-in encryption. Output is JSON-RPC 2.0 tool
  responses. Use for maintaining context about targets, findings, or workflow
  state across multiple agent invocations during long-running engagements.
sources:
  - https://modelcontextprotocol.info/docs/best-practices
  - https://fast.io/resources/mcp-server-memory-management
  - https://www.mintlify.com/blog/how-claudes-memory-and-mcp-work
  - https://lobehub.com/mcp/eragonht1-simple-memory-mcp
  - https://www.youtube.com/watch?v=qeru0ZdudD4
  - https://lobehub.com/mcp/danieleugenewilliams-local-memory-mcp
  - https://docs.basicmemory.com/reference/mcp-tools-reference
  - https://github.com/okooo5km/memory-mcp-server
  - https://code.visualstudio.com/docs/agents/reference/mcp-configuration
  - https://forum.cursor.com/t/mcp-add-persistent-memory-in-cursor/57497
  - https://mcpmarket.com/server/redteam-1
  - https://lobehub.com/mcp/deloney-code-ai-powered-red-team-automation
generated_at: 2026-09-03T12:38:42.981Z
generated_by: anthropic
source_hash: ff83e9a5a01b84d42a41d11a392d2179aaf37d67ef4df27cf8c0b4e1d52706bd
---

# MCP Memory

## Overview

MCP Memory is a Model Context Protocol server that provides persistent storage for AI agents. It acts as a stateful knowledge graph, allowing agents to store entities, observations, and relationships across sessions. The server runs as a stdio transport subprocess launched via npx, communicating over JSON-RPC 2.0. It is designed to solve the problem of context loss between agent invocations by maintaining a structured memory store on disk. The canonical package is @modelcontextprotocol/server-memory. Alternative implementations like @itseasy21/mcp-knowledge-graph and local-memory-mcp exist with similar interfaces.

## When to use

Use MCP Memory when you need an AI agent to remember information across multiple invocations or sessions. Ideal for: tracking discovered assets, services, and vulnerabilities during multi-stage penetration tests; maintaining state about targets between reconnaissance, enumeration, and exploitation phases; storing contextual notes and observations that inform later decision-making; building a knowledge graph of relationships (e.g., which hosts run which services, which CVEs apply to which versions). Do NOT use for: storing credentials or sensitive secrets (no encryption at rest); high-throughput logging (designed for structured memory, not append-only logs); real-time collaboration (single-process, file-based storage). Consider Claude Projects or external databases if you need richer querying, access control, or multi-user support.

## Authentication & setup

No authentication required—MCP Memory is a local subprocess. Setup: (1) Ensure Node.js ≥16 is installed. (2) Add server configuration to your MCP client config (e.g., .cursor/mcp.json, ~/Library/Application Support/Claude/claude_desktop_config.json). Minimal config: {"mcpServers": {"memory": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"]}}}. (3) For persistence, add env vars: "env": {"MEMORY_PERSIST": "true", "MEMORY_PATH": "/absolute/path/to/memory.json"}. Without MEMORY_PERSIST, memory is ephemeral and lost on process exit. MEMORY_PATH defaults to ./memory.json in CWD; use absolute paths to avoid confusion. On Windows, use forward slashes or escaped backslashes in JSON. Create the target directory manually before first run. Some implementations support --db-path or --memory-path CLI args instead of env vars. Verify setup by invoking read_graph after restart; empty graph confirms fresh state, populated graph confirms persistence is working.

## Key commands / parameters

MCP Memory exposes tools via JSON-RPC 2.0. Key tools: **create_entities** (params: entities [array of {name, entityType, observations[]}])—bulk-create nodes in the knowledge graph. **create_relations** (params: relations [array of {from, to, relationType}])—define directed edges between entities. **add_observations** (params: [{entityName, contents[]}])—append observations to existing entities. **search_nodes** (params: {query})—full-text search across entity names, types, and observations. **open_nodes** (params: {names[]})—retrieve specific entities by name. **read_graph** (no params)—dump the entire knowledge graph. **update_memory** / **delete_memory** (params: {id} or {entityName})—modify or remove entries. **list_sessions** / **get_session_stats**—some implementations support session scoping via --session-id CLI arg or session_id param. **store_memory** (params: {content, source, importance, tags, session_id})—simplified storage interface in some variants. All tools return JSON responses with entities, relations, and observations arrays. Importance and tagging are implementation-dependent.

## Example workflows

**Reconnaissance persistence**: After running nmap, store discovered hosts: create_entities([{name: "192.168.1.10", entityType: "host", observations: ["ports: 22,80,443", "OS: Linux"]}]). Link services: create_relations([{from: "192.168.1.10", to: "SSH", relationType: "runs_service"}]). Later, search_nodes({query: "SSH"}) to retrieve all hosts running SSH. **Vulnerability tracking**: Store findings as entities with CVE IDs, then relate them to affected hosts. add_observations to append exploitation attempts or remediation notes. **Multi-stage attack chains**: After initial foothold, store credentials, pivot paths, and compromised accounts as entities. Use relations to map privilege escalation paths (e.g., user -> group -> admin). **Session continuity**: At the start of each engagement, read_graph to restore context. At the end, verify MEMORY_PATH to ensure findings are persisted. Use session_id if running parallel engagements to isolate memory stores.

## Output format

MCP Memory returns JSON-RPC 2.0 responses. Successful tool calls return {"entities": [{"name": str, "entityType": str, "observations": [str]}], "relations": [{"from": str, "to": str, "relationType": str}]}. search_nodes returns matching entities with relevance scoring (implementation-dependent). read_graph returns the full graph structure: {"entities": [...], "relations": [...]}. Errors return JSON-RPC error objects with code and message fields. The underlying storage format is JSON (default) or JSONL (some implementations). Example memory.json: {"entities": [{"name": "target.com", "entityType": "domain", "observations": ["resolved to 203.0.113.5"]}], "relations": [{"from": "target.com", "to": "web-server-1", "relationType": "hosted_on"}]}. Do not parse the file directly; always use MCP tools to ensure consistency.

## Common pitfalls

**Memory limits**: Some implementations cap storage at ~200 entities and auto-evict or require manual deletion. Monitor with get_session_stats. **Path issues**: MEMORY_PATH must be absolute or relative to the MCP server's CWD, not the client's. Verify with process.cwd() or by checking where npx runs. On Windows, backslashes in JSON must be escaped (\\) or use forward slashes. **No encryption**: Memory files are plaintext JSON. Do not store credentials, API keys, or sensitive PII. **Ephemeral by default**: Without MEMORY_PERSIST=true, all state is lost on process exit. Always set this in production. **Concurrent access**: Single-process, file-based storage; no locking. Do not run multiple MCP Memory instances with the same MEMORY_PATH. **Schema drift**: No enforced schema; entityType and relationType are free text. Maintain consistent naming conventions (e.g., lowercase, underscores). **Performance**: Full-text search over large graphs is slow. Implementations using SQLite (local-memory-mcp) perform better at scale. **Session isolation**: If using session_id, ensure it's passed consistently across all tool calls within an engagement; otherwise, memories mix.

## References

- https://modelcontextprotocol.info/docs/best-practices
- https://fast.io/resources/mcp-server-memory-management
- https://www.mintlify.com/blog/how-claudes-memory-and-mcp-work
- https://lobehub.com/mcp/eragonht1-simple-memory-mcp
- https://www.youtube.com/watch?v=qeru0ZdudD4
- https://lobehub.com/mcp/danieleugenewilliams-local-memory-mcp
- https://docs.basicmemory.com/reference/mcp-tools-reference
- https://github.com/okooo5km/memory-mcp-server
- https://code.visualstudio.com/docs/agents/reference/mcp-configuration
- https://forum.cursor.com/t/mcp-add-persistent-memory-in-cursor/57497
