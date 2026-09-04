---
name: MCP Memory
description: MCP server providing persistent cross-session memory storage via
  knowledge graph; stores facts, entities, relations; query with semantic
  search.
registry: mcp
tool_id: default:memory
category: mcp-server
tags:
  - mcp-server
  - memory
  - knowledge-graph
  - persistent-context
  - entity-storage
  - semantic-search
  - session-continuity
summary: "Use MCP Memory to persist facts, preferences, and context across
  sessions so you don't need to re-learn project details or user preferences.
  Invoke by calling tools like `store_memory`, `search_memories`,
  `create_entities`, `create_relations`, `read_graph`. Store when you discover
  non-obvious project details, user workflows, or preferences; search before
  starting new tasks to recall prior context. Memory persists in a local JSON
  file (default `memory.json` in CWD; override with `--memory-file` arg or
  `MEMORY_FILE_PATH` env var). Knowledge graph supports entity/relation
  modeling: create named entities with types and observations, then link them
  with typed relations. Use `search_memories` for natural-language queries,
  `search_nodes` for entity lookups, `read_graph` to dump the full graph. Memory
  builds up over time—session data accumulates in heap and file; monitor memory
  usage in long-running sessions. Expect plain JSON or text responses; parse
  output carefully. Do not store PII, secrets, or ephemeral session state. Do
  not assume memory is shared across multiple agent instances unless explicitly
  configured (default is local, per-instance storage)."
sources:
  - https://fast.io/resources/mcp-server-memory-management
  - https://modelcontextprotocol.info/docs/best-practices
  - https://www.mintlify.com/blog/how-claudes-memory-and-mcp-work
  - https://www.memoryplugin.com/platforms/mcp
  - https://github.com/doobidoo/mcp-memory-service
  - https://lobehub.com/mcp/danieleugenewilliams-local-memory-mcp
  - https://docs.basicmemory.com/reference/mcp-tools-reference
  - https://www.qed42.com/insights/the-claude-youll-never-need-to-remind-mcp-in-action
  - https://github.com/okooo5km/memory-mcp-server
  - https://code.visualstudio.com/docs/agents/reference/mcp-configuration
  - https://arxiv.org/html/2511.15998v1
  - https://pentest.qa/blog/mcp-server-security-testing-red-team-guide
generated_at: 2026-09-04T02:29:57.903Z
generated_by: anthropic
source_hash: ff83e9a5a01b84d42a41d11a392d2179aaf37d67ef4df27cf8c0b4e1d52706bd
---

# MCP Memory

## Overview

MCP Memory is a Model Context Protocol server that provides persistent, cross-session storage for facts, preferences, entities, and relationships. It maintains a knowledge graph structure allowing you to store named entities with types and observations, create typed relations between entities, and query via natural language or entity name. The server keeps context alive between sessions, unlike stateless APIs. It runs as a local Node.js process spawned by `npx`, communicates over stdio, and persists data to a JSON file (default `memory.json` in the current working directory). Memory data accumulates over time and is not automatically pruned.

## When to use

Use MCP Memory when you need to remember context across separate sessions or long-running tasks: user preferences (code style, communication tone), project structure and architecture decisions, recurring workflows, entity relationships (people, systems, dependencies), or non-obvious facts discovered during recon or development. Do NOT use for ephemeral session state, secrets (API keys, tokens), or PII (unless explicitly authorized and aware of local file storage). Prefer MCP Memory over re-reading large documents when you've already extracted key facts. Use it to avoid redundant questions and to maintain continuity when a task spans multiple sessions.

## Authentication & setup

No authentication required; the server runs locally and accesses a file path you control. Setup: the MCP client (Claude Desktop, VS Code, Cursor, etc.) spawns the server via `npx -y @modelcontextprotocol/server-memory`. Default storage is `memory.json` in CWD. Override with `--memory-file /custom/path.json` in the args array or set `MEMORY_FILE_PATH` environment variable. Ensure the directory is writable. Example config (Claude Desktop): `{"memory": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory", "--memory-file", "/Users/you/claude-memory.json"]}}`. On first run the server creates the file if it doesn't exist. No API keys, no network calls (all local).

## Key commands / parameters

`store_memory(content, source?, importance?, tags?, session_id?)`: Store a text fact with optional metadata. `content` (required) is the fact; `source`, `importance` (1-10), `tags` (array), and `session_id` are optional. | `search_memories(query, limit?, min_importance?, session_id?)`: Full-text or semantic search; returns matching memories. `query` supports `tag:` shorthand (e.g., `tag:security`). | `create_entities(entities: [{name, entityType, observations}])`: Create or update named entities in the knowledge graph. | `create_relations(relations: [{from, to, relationType}])`: Create typed edges between entities. | `delete_entities(entityNames: string[])`, `delete_relations(relations: [{from, to, relationType}])`: Remove entities or relations. | `read_graph()`: Dump the entire knowledge graph (all entities and relations). | `search_nodes(query)`: Search entities by name, type, or observation. | `open_nodes(names: string[])`: Retrieve specific entities by name. | `list_sessions()`, `get_session_stats(session_id?)`: List sessions and get memory counts. | `update_memory(id, content?, importance?, tags?)`: Update existing memory by ID. | `delete_memory(id)`: Delete a memory by ID.

## Example workflows

**Store project architecture decision**: After discovering the codebase uses React 18 + TypeScript, call `store_memory({content: "Project uses React 18 with TypeScript and Vite bundler", tags: ["architecture", "frontend"], importance: 8})`. | **Recall context at task start**: Before beginning a new coding task, call `search_memories({query: "React TypeScript"})` to retrieve prior architecture notes. | **Build knowledge graph of services**: `create_entities({entities: [{name: "API Gateway", entityType: "service", observations: ["Handles auth"]}, {name: "UserDB", entityType: "database", observations: ["PostgreSQL 14"]}]})`, then `create_relations({relations: [{from: "API Gateway", to: "UserDB", relationType: "queries"}]})`. Later `read_graph()` to visualize dependencies. | **Tag-based search**: `search_memories({query: "tag:security", limit: 5})` returns all memories tagged `security`. | **Session isolation**: Pass `session_id: "recon-phase-1"` to `store_memory` and `search_memories` to namespace memories per operation phase.

## Output format

All tools return JSON. `store_memory`, `create_entities`, `create_relations` return confirmation objects. `search_memories` and `search_nodes` return arrays of matching records with fields like `id`, `content`, `tags`, `importance`, `timestamp`, or `name`, `entityType`, `observations`. `read_graph()` returns `{entities: [...], relations: [...]}`. `list_sessions()` returns session IDs and counts. Parse the JSON; do not assume pretty-printing. Text fields may contain newlines or special chars; handle accordingly. `update_memory` and `delete_memory` return success/error status. No binary data; all text-based.

## Common pitfalls

**Memory bloat**: The server does not auto-prune. Over many sessions the graph and memory file grow indefinitely, consuming heap and disk. In long ops, periodically check `get_session_stats()` and manually delete obsolete memories. | **No cross-instance sharing by default**: Each spawned server instance uses its own file. If you run multiple agent processes, they do NOT share memory unless you configure the same `--memory-file` path and handle concurrent writes (risk of race conditions and corruption). | **Secrets in memory**: Do not store API keys, passwords, or PII unless you understand the file is unencrypted local JSON. | **Schema drift**: Memory structure may evolve; older clients may not support all fields. Test compatibility. | **Session ID confusion**: If you don't pass `session_id`, memories are global. Use session IDs to isolate operation phases, but remember you must explicitly pass the same ID to retrieve them. | **Search relevance**: Full-text search is basic substring/keyword matching unless semantic/vector search is enabled (implementation-dependent). Do not assume fuzzy matching or embeddings without verifying the server version supports it. | **Concurrency**: The JSON file is not a database; simultaneous writes from multiple processes can corrupt it. Use file locking or a single coordinating process.

## References

- https://fast.io/resources/mcp-server-memory-management
- https://modelcontextprotocol.info/docs/best-practices
- https://www.mintlify.com/blog/how-claudes-memory-and-mcp-work
- https://github.com/doobidoo/mcp-memory-service
- https://lobehub.com/mcp/danieleugenewilliams-local-memory-mcp
- https://docs.basicmemory.com/reference/mcp-tools-reference
- https://www.qed42.com/insights/the-claude-youll-never-need-to-remind-mcp-in-action
- https://github.com/okooo5km/memory-mcp-server
- https://code.visualstudio.com/docs/agents/reference/mcp-configuration
- https://pentest.qa/blog/mcp-server-security-testing-red-team-guide
