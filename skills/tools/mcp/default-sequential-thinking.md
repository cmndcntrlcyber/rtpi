---
name: MCP Sequential Thinking
description: MCP server that provides structured, step-by-step reasoning
  capability for complex problem-solving, planning, and analysis with revision
  and branching support.
registry: mcp
tool_id: default:sequential-thinking
category: mcp-server
tags:
  - mcp-server
  - reasoning
  - planning
  - analysis
  - reflection
  - problem-solving
  - cognitive-tool
summary: Use sequential-thinking when you need to break down complex attack
  paths, plan multi-stage operations, or analyze problems where the full scope
  is unclear at the start. Invoke the `sequential_thinking` tool (your MCP host
  calls it automatically when you reason step-by-step) to record thoughts,
  revise earlier reasoning, branch into hypotheticals, and maintain context
  across a chain of analysis. Each invocation appends to
  `~/.mcp_sequential_thinking/current_session.jsonl` (override with
  `MCP_STORAGE_DIR`), creating an audit trail. The tool does NOT execute attacks
  or run commands—it structures your reasoning process so you can track
  hypotheses, adjust estimates, and backtrack when assumptions fail. Expect the
  tool to persist state between calls; you can revise thought N, branch from
  thought M, and dynamically extend `totalThoughts` if the problem proves deeper
  than estimated. Output is minimal acknowledgment; the value is in forcing
  disciplined, traceable reasoning that won't be lost if a long operation is
  interrupted. Do not use for simple one-shot queries; use for planning database
  migrations, debugging production-only failures, comparing architecture
  trade-offs, or mapping attack trees where you may need to backtrack.
sources:
  - https://github.com/arben-adm/mcp-sequential-thinking
  - https://mcpservers.org/servers/modelcontextprotocol/sequentialthinking
  - https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking
  - https://mcpservers.org/servers/arben-adm/mcp-sequential-thinking
  - https://www.npmjs.com/package/@modelcontextprotocol/server-sequential-thinking
  - https://mcp.so/servers/sequentialthinking
  - https://www.npmjs.com/package/@iflow-mcp/sequential-thinking-mcp
  - https://mcpmarket.com/server/redteam-1
  - https://www.cycognito.com/learn/red-teaming/red-teaming-vs-pentesting
  - https://github.com/ibrahimsaleem/PentestThinkingMCP
  - https://www.cycognito.com/learn/red-teaming
  - https://pentest.qa/blog/mcp-server-security-testing-red-team-guide
generated_at: 2026-09-03T12:38:40.018Z
generated_by: anthropic
source_hash: ec64c95057c2e6b53aac2cb8a5126ba2e2a561e8a7471a3393835473887b1613
---

# MCP Sequential Thinking

## Overview

MCP Sequential Thinking (`@modelcontextprotocol/server-sequential-thinking`) is a Model Context Protocol server that exposes a single tool—`sequential_thinking`—to structure multi-step reasoning. It is designed for problems that require breaking down complexity, planning with room for revision, course correction during analysis, and maintaining context over many steps. The server persists a session log as an append-only JSONL file at `~/.mcp_sequential_thinking/current_session.jsonl` (configurable via `MCP_STORAGE_DIR`). Each tool invocation appends one fsynced line, so interrupted writes self-recover and you get a complete audit trail. Sessions from older JSON-based versions are migrated automatically. The tool does not perform actions—it records and structures your reasoning so you can revise, branch, and extend your thought process dynamically.

## When to use

Use sequential-thinking when your task involves: breaking complex red-team operations into discrete steps; planning multi-stage attacks or migrations where scope may expand; debugging issues that require hypothesis generation and verification; comparing multiple approaches and needing to branch if an assumption fails; maintaining context over long chains of reasoning (e.g., privilege escalation paths, network traversal); filtering irrelevant recon data while preserving what matters. DO NOT use for simple enumeration, single-command execution, or tasks where the full solution is obvious upfront. Example scenarios: 'Plan a privilege escalation path from web shell to domain admin, revising if a technique fails'; 'Compare three C2 infrastructure designs and branch if egress filtering assumptions are wrong'; 'Debug why an exploit works in dev but fails in production, showing step-by-step reasoning.'

## Authentication & setup

No authentication required. The server is invoked via `npx -y @modelcontextprotocol/server-sequential-thinking` and auto-started by your MCP host (Claude Desktop, Cursor, etc.). Session data is written to `~/.mcp_sequential_thinking/current_session.jsonl` by default; override the directory by setting the `MCP_STORAGE_DIR` environment variable before launch (e.g., `MCP_STORAGE_DIR=/secure/logs npx -y @modelcontextprotocol/server-sequential-thinking`). Verify the tool appears in your host's MCP inspector after restart. No API keys, tokens, or network access needed—purely local state persistence.

## Key commands / parameters

The server exposes one tool: `sequential_thinking`. Your MCP host invokes it automatically when you reason step-by-step; you typically do not call it by hand. Parameters: `thought` (string, required): the current thinking step or hypothesis. `nextThoughtNeeded` (boolean, required): true if more reasoning is required. `thoughtNumber` (integer, required): current step number in the sequence. `totalThoughts` (integer, required): estimated total steps needed (can be revised upward/downward). `isRevision` (boolean, optional): true if this step revises earlier reasoning. `revisesThought` (integer, optional): which thought number is being reconsidered (required if `isRevision` is true). `branchFromThought` (integer, optional): the step number from which you are branching into a hypothetical or alternative path. `branchId` (string, optional): identifier for the branch (e.g., 'assume-fw-disabled'). `needsMoreThoughts` (boolean, optional): true if you reach the estimated end but realize more steps are needed. The tool returns minimal acknowledgment; the value is the persistent session log, not the response text.

## Example workflows

1. Multi-stage attack planning: Start with `thought='Enumerate SMB shares on 10.0.1.0/24', thoughtNumber=1, totalThoughts=5, nextThoughtNeeded=true`. Continue with `thought='Found admin$ accessible on .15, .22; test null session', thoughtNumber=2, totalThoughts=5, nextThoughtNeeded=true`. If null session fails, revise: `thought='Null session blocked; pivot to LLMNR poisoning', thoughtNumber=3, totalThoughts=6, isRevision=true, revisesThought=2, nextThoughtNeeded=true`. 2. Branching on assumptions: `thought='Assume port 445 filtered at perimeter', thoughtNumber=4, totalThoughts=6, branchFromThought=3, branchId='fw-filtered', nextThoughtNeeded=true`. Later, `thought='Confirmed 445 open; discard fw-filtered branch', thoughtNumber=5, totalThoughts=6, nextThoughtNeeded=false`. 3. Extending scope: Reach `thoughtNumber=6, totalThoughts=6, nextThoughtNeeded=false`, then realize you need more: `thought='Discovered nested AD trusts; need to map', thoughtNumber=7, totalThoughts=10, needsMoreThoughts=true, nextThoughtNeeded=true`.

## Output format

The tool returns a brief acknowledgment (e.g., 'Thought recorded'). The operational output is the session log file at `~/.mcp_sequential_thinking/current_session.jsonl`, one JSON object per line: `{"thought": "...", "thoughtNumber": N, "totalThoughts": M, "nextThoughtNeeded": true, "timestamp": "...", ...}`. Each line is fsynced immediately, so the file is safe to read mid-operation and serves as a forensic audit trail. Interrupted writes (truncated final line) are ignored on next load. To inspect the session, `tail -f ~/.mcp_sequential_thinking/current_session.jsonl` or parse with `jq`. Old JSON sessions (`current_session.json`) are migrated to JSONL on first run and renamed to `current_session.json.migrated-to-v2`.

## Common pitfalls

1. Over-use on trivial tasks: invoking sequential-thinking for simple one-shot commands wastes overhead and clutters the session log. 2. Forgetting to set `MCP_STORAGE_DIR` in shared/containerized environments: sessions may collide or be lost. 3. Not revising when assumptions fail: the tool's value is in `isRevision` and `branchFromThought`; if you never backtrack, you're just appending a linear list. 4. Ignoring the session log: the `.jsonl` file is the ground truth; if your host crashes, you can resume by reading the log and continuing from the last `thoughtNumber`. 5. Confusing the tool with an execution engine: sequential-thinking records reasoning, it does NOT run exploits, call APIs, or perform recon. Pair it with execution tools (e.g., `subprocess`, `http-fetch`) but keep reasoning and action separate. 6. Not adjusting `totalThoughts`: if scope expands or contracts, update the estimate so the log reflects your revised mental model.

## References

https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking
https://www.npmjs.com/package/@modelcontextprotocol/server-sequential-thinking
https://mcpservers.org/servers/modelcontextprotocol/sequentialthinking
https://github.com/arben-adm/mcp-sequential-thinking
https://mcp.so/servers/sequentialthinking
