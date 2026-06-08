---
name: MCP Memory
description: Persistent JSON/JSONL memory store for AI agents; enables
  cross-session recall of facts, patterns, and decisions via MCP protocol.
registry: mcp
tool_id: default:memory
category: mcp-server
tags:
  - mcp
  - memory
  - persistence
  - knowledge-graph
  - agent-state
  - context
  - nlp
  - retrieval
summary: "MCP Memory provides persistent storage for AI agent sessions, storing
  facts, observations, and decisions in a local JSON/JSONL file. Invoke via MCP
  protocol by running `npx -y @modelcontextprotocol/server-memory` or
  knowledge-graph variant `@itseasy21/mcp-knowledge-graph`. Use for maintaining
  operational continuity across sessions: store reconnaissance findings, track
  campaign progress, remember solved problems, and share context across multiple
  agent instances. Memory is local to the file path specified (default or via
  MEMORY_FILE_PATH env var). Recall stored memories by natural language search
  or tag filtering. Store with `store_memory` (content, memory_type, tags),
  retrieve with `recall_memories` (use first; optimized fuzzy matching) or
  `search_memories` (structured queries). Output is JSON array of memory
  objects. Each project should use a separate memory file path (e.g.,
  `target_domain.jsonl`) to avoid cross-contamination. Memory persists
  indefinitely unless explicitly deleted or file removed. Watch for memory file
  size growth; no automatic eviction in standard MCP server. For red team ops:
  store discovered credentials, network topology, vulnerability findings,
  exploit success/failure, and next-step reminders across days/weeks. Memory is
  plaintext on disk—encrypt parent directory if storing sensitive findings."
sources:
  - https://www.mintlify.com/blog/how-claudes-memory-and-mcp-work
  - https://fast.io/resources/mcp-server-memory-management/
  - https://mcpservers.org/servers/doobidoo/mcp-memory-dashboard
  - https://github.com/doobidoo/mcp-memory-service
  - https://medium.com/@brentwpeterson/mcp-memory-the-missing-piece-that-makes-claude-remember-your-code-89bcb13ebf64
  - https://www.qed42.com/insights/the-claude-youll-never-need-to-remind-mcp-in-action
  - https://forum.cursor.com/t/mcp-add-persistent-memory-in-cursor/57497
  - https://mcpservers.org/servers/chrishayuk/mcp-cli
  - https://mcpservers.org/servers/gregorydickson/memory-graph
  - https://www.cycognito.com/learn/ai-security/mcp-security/
  - https://arxiv.org/html/2511.15998v1
  - https://tierzerosecurity.co.nz/2025/04/29/mcp-llm.html
generated_at: 2026-05-19T10:55:57.735Z
generated_by: anthropic
source_hash: ff83e9a5a01b84d42a41d11a392d2179aaf37d67ef4df27cf8c0b4e1d52706bd
---

# MCP Memory

## Overview

MCP Memory is a Model Context Protocol server providing persistent storage for AI agent sessions. It stores structured memories (facts, code patterns, decisions, observations) in a local JSON or JSONL file, enabling agents to recall past interactions across session boundaries. The official Anthropic server (@modelcontextprotocol/server-memory) and community variants (e.g., @itseasy21/mcp-knowledge-graph) offer memory storage via MCP tools. Memory is file-backed, local, and accessed exclusively through MCP protocol calls. No network service required; all data stays on disk at the specified path. Suitable for maintaining campaign state, learning from past operations, and sharing knowledge between parallel agent instances targeting the same infrastructure.

## When to use

Use MCP Memory when you need operational continuity across multiple engagements or long-duration campaigns. Store reconnaissance data (discovered hosts, open ports, service banners) so subsequent sessions don't duplicate scanning. Record credential findings, exploitation attempts (success/failure), and remediation evidence. Track decision rationale (why a technique was chosen, why a path was abandoned) to avoid repeating mistakes. Share context across parallel agents working on different network segments. Maintain a knowledge base of target-specific patterns (naming conventions, security controls observed, admin behavior). Essential for campaigns spanning days/weeks where manual note-taking would lose fidelity. Also useful for post-engagement reporting: query all stored memories by tag to reconstruct timeline. Do NOT use for ephemeral session state (use in-memory variables), large binary artifacts (store file paths instead), or secrets requiring HSM/vault protection (memory file is plaintext JSON).

## Authentication & setup

No authentication required; MCP Memory is a local file-backed service. Install: `npm install @modelcontextprotocol/server-memory` or invoke directly via npx. Configure in MCP client (Claude Desktop, Cursor, etc.) by adding server entry to config JSON. Example config:
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_FILE_PATH": "/path/to/target_campaign.jsonl"
      }
    }
  }
}
```
On Windows use forward slashes or escaped backslashes in paths. Ensure directory exists before first run. The MEMORY_FILE_PATH env var specifies storage location; if omitted, defaults to server-chosen path (often ~/.mcp/memory.json). For red team ops, create separate memory files per target (e.g., `client_internalnet.jsonl`, `client_dmz.jsonl`) to isolate findings. File must be writable by the process invoking npx. No daemon setup needed; server spawns on-demand per MCP client session.

## Key commands / parameters

MCP Memory exposes tools (not CLI commands) via MCP protocol:

**store_memory**: Save a new memory. Parameters: `content` (string, required), `memory_type` (string, e.g., "fact", "observation", "CodePattern"), `tags` (array of strings for filtering). Example: `{"content": "192.168.1.50 runs Apache 2.4.41 with mod_status exposed", "memory_type": "reconnaissance", "tags": ["webserver", "apache", "infoleak"]}`.

**recall_memories**: Primary retrieval tool. Uses fuzzy natural language matching and relationship context. Parameters: `query` (string, natural language). Optimized for conversational queries. Always try this first before search_memories.

**search_memories**: Structured search. Parameters: `query` (string), `tags` (array), `memory_type` (string). Returns exact or keyword matches. Use when you need tag-filtered results (e.g., all memories tagged "credentials").

**list_memories**: Return all stored memories (or filtered by type). Use sparingly; scales poorly with large memory files.

**get_all_memories**: Alias for list, returns full dataset.

**count_all_memories**: Returns integer count of stored memories.

Knowledge-graph variant (@itseasy21/mcp-knowledge-graph) adds relationship edges (causes, fixes, contradicts). No additional commands in official server. Environment variables: MEMORY_FILE_PATH (required for custom location), MCP_MEMORY_CHROMA_PATH (for Chroma vector DB variant, not standard server). No CLI flags supported when invoked via npx; configuration is via MCP client config file only.

## Example workflows

**Workflow 1: Multi-day network mapping campaign**
Day 1: Run nmap, store results: `store_memory(content="Scanned 192.168.1.0/24, found 15 live hosts", tags=["nmap", "discovery", "day1"])`. Day 2: Before re-scanning, recall: `recall_memories(query="what hosts did I find yesterday")`, returns day1 memories. Store new findings with updated tags. Day 5: Generate report by querying `search_memories(tags=["nmap", "discovery"])` to retrieve all recon across all days.

**Workflow 2: Credential tracking**
After password spray success: `store_memory(content="Valid creds: alice:Summer2024! on mail.target.com", memory_type="credential", tags=["valid", "mail", "alice"])`. Later, attempting lateral movement: `search_memories(tags=["credential", "valid"])` to retrieve all known-good credentials. Tag with service/protocol for easy filtering.

**Workflow 3: Exploit attempt log**
Before trying CVE-2024-1234: `store_memory(content="Attempting CVE-2024-1234 against 192.168.1.10:8080, Tomcat 9.0.1", tags=["exploit", "attempt", "tomcat"])`. After failure: `store_memory(content="CVE-2024-1234 failed, target patched or WAF blocking", tags=["exploit", "failure", "tomcat"])`. Next session: `recall_memories(query="what did I try against the tomcat server")` avoids duplicate work.

**Workflow 4: Parallel agent coordination**
Agent A (DMZ): stores `"Found SSH on 203.0.113.5:22, banner OpenSSH 7.4"`. Agent B (internal): queries `search_memories(tags=["ssh"])`, retrieves DMZ findings, attempts pivot. Both agents use same MEMORY_FILE_PATH for shared state.

## Output format

MCP Memory returns JSON arrays of memory objects. Each memory object structure:
```json
{
  "id": "uuid-string",
  "content": "the stored text",
  "memory_type": "fact|observation|CodePattern|etc",
  "tags": ["tag1", "tag2"],
  "timestamp": "ISO8601 datetime",
  "metadata": { /* optional additional fields */ }
}
```
Search/recall tools return: `{"memories": [<array of memory objects>]}`. Store operations return: `{"success": true, "id": "uuid"}`. Count returns: `{"count": 42}`. Errors return: `{"error": "message"}`. Memory file on disk is JSONL (one JSON object per line) or single JSON array depending on variant. Do not parse file directly; always use MCP tools. For integration with other tools (e.g., passing findings to exploit scripts), extract `content` field from returned JSON and pipe to downstream commands.

## Common pitfalls

**Pitfall 1: Unbounded memory growth**. Standard MCP server has no automatic eviction or size limits. A long campaign can bloat the memory file to hundreds of MB, slowing search. Mitigation: periodically archive old memories (copy file, start fresh), or use tags with date prefixes ("2024-05-day1") and filter queries. **Pitfall 2: Plaintext secrets on disk**. Memory file is unencrypted JSON; storing passwords, API keys, or exploit payloads exposes them to disk forensics. Mitigation: store references/hashes instead of plaintext, or encrypt the parent directory with filesystem-level encryption (LUKS, BitLocker, FileVault). **Pitfall 3: Path confusion**. Forgetting to set MEMORY_FILE_PATH results in default location (often ~/.mcp/memory.json), mixing memories from different campaigns. Mitigation: always specify explicit paths per-target in MCP config. **Pitfall 4: Tag inconsistency**. Using "creds", "credentials", "password" interchangeably breaks tag-based retrieval. Mitigation: establish tag taxonomy at campaign start (e.g., always use "credential", "exploit", "recon"). **Pitfall 5: Over-reliance on recall_memories fuzzy matching**. Natural language queries can miss exact matches if phrasing differs significantly. Mitigation: combine recall (first pass) with search_memories by explicit tags (second pass) for completeness. **Pitfall 6: Concurrent write conflicts**. If multiple agent processes share one memory file and write simultaneously, JSONL corruption possible (depending on implementation locking). Mitigation: use one memory file per agent, or implement file locking at orchestration layer.

## References

- https://www.mintlify.com/blog/how-claudes-memory-and-mcp-work
- https://fast.io/resources/mcp-server-memory-management/
- https://mcpservers.org/servers/doobidoo/mcp-memory-dashboard
- https://github.com/doobidoo/mcp-memory-service
- https://medium.com/@brentwpeterson/mcp-memory-the-missing-piece-that-makes-claude-remember-your-code-89bcb13ebf64
- https://www.qed42.com/insights/the-claude-youll-never-need-to-remind-mcp-in-action
- https://forum.cursor.com/t/mcp-add-persistent-memory-in-cursor/57497
- https://mcpservers.org/servers/chrishayuk/mcp-cli
- https://mcpservers.org/servers/gregorydickson/memory-graph
- https://arxiv.org/html/2511.15998v1
- https://tierzerosecurity.co.nz/2025/04/29/mcp-llm.html
