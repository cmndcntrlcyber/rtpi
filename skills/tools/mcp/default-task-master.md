---
name: Claude Task Master
description: AI-powered task management system for decomposing PRDs into
  structured, trackable development tasks with dependency tracking and git
  integration.
registry: mcp
tool_id: default:task-master
category: mcp-server
tags:
  - task-management
  - project-planning
  - ai-orchestration
  - development-workflow
  - prd-parsing
  - mcp-server
  - claude
  - cursor-ide
summary: "Use task-master to decompose complex development requirements into
  structured JSON tasks. Initialize with `task-master init`, place PRD in
  `.taskmaster/docs/`, run `task-master parse-prd` to generate tasks.json.
  Operates within tag contexts for isolated workstreams (use `--tag=<name>` or
  `task-master use-tag`). Supports natural language via MCP: 'implement next
  task', 'show pending tasks'. Requires at least one AI provider (Anthropic,
  OpenAI, Gemini, Perplexity, xAI, OpenRouter) OR Claude Code CLI (no API key).
  Store API keys in `.env` for CLI, in MCP config for editor integration. Core
  commands: `list-tasks`, `show-next`, `set-status -i <id> -s <status>`,
  `update-task -i <id> -p '<changes>'`, `expand-task -i <id>` (breaks complex
  tasks into subtasks), `research -q '<query>'` (investigates technical
  questions). Task states: pending, in-progress, done, review, cancelled. Tasks
  reference by ID (e.g., '5') or subtask ID (e.g., '5.2'). Tags isolate work
  contexts—create from branch with `add-tag --from-branch`. All operations
  respect active tag unless `--tag` overrides. Not for vulnerability tracking or
  offensive tasking—purely development project management."
sources:
  - https://github.com/eyaltoledano/claude-task-master/blob/main/docs/tutorial.md
  - https://glama.ai/mcp/servers/eyaltoledano/claude-task-master
  - https://www.youtube.com/watch?v=ZFcAwdMyiw4
  - https://github.com/eyaltoledano/claude-task-master
  - https://medium.com/@abhishek.bhattacharya04/from-requirement-to-reality-how-claude-task-master-cursor-transformed-a-complex-feature-request-c8ec735d6096
  - https://deepwiki.com/athif23/claude-task-master/7.1-cli-commands
  - https://github.com/DevDreed/claude-task-master-extension
  - https://github.com/eyaltoledano/claude-task-master/blob/main/docs/command-reference.md
  - https://github.com/khulnasoft-bot/claude-task/blob/main/docs/command-reference.md
  - https://gist.github.com/hardchor/b6b47dd32067b71c8c95ae4b22812f4b
  - https://www.penligent.ai/hackinglabs/where-claude-4-7-actually-fits-in-a-pentest-or-red-team-workflow
  - https://snyk.io/articles/top-claude-skills-cybersecurity-hacking-vulnerability-scanning
generated_at: 2026-09-03T12:39:01.828Z
generated_by: anthropic
source_hash: be3166de9b8678202338ff841d2f920a8e540d5c76e669f6f2d4001ea325e12f
---

# Claude Task Master

## Overview

Claude Task Master is an MCP server (invoked via `npx -y task-master-ai`) that provides AI-driven task decomposition and management for software development projects. It parses Product Requirement Documents (PRDs) into structured tasks stored in `.taskmaster/tasks.json`, tracks dependencies, manages workstream isolation via git-integrated tags, and exposes both CLI commands and natural-language MCP tools for task CRUD operations. Designed for use inside AI-enabled editors (Cursor, Windsurf, VS Code with Copilot, Roo) where the agent can invoke task-master commands directly or via chat. The system maintains task state (pending, in-progress, done, review, cancelled), handles parent-child subtask relationships, and supports AI-powered task expansion and research.

## When to use

Use task-master when an agent needs to manage multi-step development projects with complex dependencies. Invoke during planning phases to decompose a PRD into actionable tasks, during execution to track progress and retrieve next-available work items, or when switching between feature branches to isolate task contexts. Ideal for scenarios where the agent must maintain long-running context across sessions (tasks.json persists state), coordinate parallel workstreams (tags), or research technical questions before implementation (research command). Do NOT use for operational security tasking, vulnerability tracking, or red-team mission planning—task-master is a development workflow tool with no built-in OPSEC, compartmentalization, or data sanitization for sensitive operations.

## Authentication & setup

Requires Node.js and npx. Install globally: `npm i -g task-master-ai`. For MCP integration, add to editor's MCP config (e.g., Cursor settings or `.cursor/mcp.json`, VS Code `settings.json` under `mcp.servers`): `{"command": "npx", "args": ["-y", "task-master-ai"], "env": {"ANTHROPIC_API_KEY": "...", "OPENAI_API_KEY": "...", ...}}`. At least one AI provider API key required UNLESS using Claude Code CLI (run `claude mcp add taskmaster-ai -- npx -y task-master-ai` and authenticate via Claude subscription—no API key needed). Supported providers: Anthropic (Claude), OpenAI, Google Gemini, Perplexity, xAI, OpenRouter, Codex CLI (ChatGPT OAuth). Store keys in project root `.env` for CLI usage AND in MCP config `env` section for editor integration. Recommended: add `.mcp.json` and `.env` to `.gitignore`. Initialize project: cd into repo, run `task-master init` (interactive setup) or have agent prompt 'initialize taskmaster-ai in my project'. Creates `.taskmaster/` directory structure. Optional: specify rule profiles with `--rules=cursor,roo` (defaults to all: claude, cline, codex, cursor, roo, trae, vscode, windsurf).

## Key commands / parameters

**CLI Commands:**
- `task-master init [--rules=<profile,profile>]` — initialize project structure
- `task-master parse-prd [--num-tasks=<n>]` — parse PRD from `.taskmaster/docs/` into tasks.json (default 10 tasks; omit flag for AI-determined count)
- `task-master list-tasks [-s <status>] [--subtasks] [--tag=<name>]` — list tasks, optionally filter by status (pending|in-progress|done|review|cancelled)
- `task-master show-next` — show next available task based on dependencies and status
- `task-master show-task -i <id> [--tag=<name>]` — display task by ID (e.g., '5' or '5.2' for subtask)
- `task-master set-status -i <id> -s <status> [--tag=<name>]` — update task status (supports comma-separated IDs: '16,17.1')
- `task-master update-task -i <id> -p '<prompt>' [--append] [-r] [--tag=<name>]` — modify task; use `--append` to add timestamped notes instead of replacing; `-r` enables research model
- `task-master add-task -p '<description>' [--tag=<name>]` — create new task
- `task-master remove-task -i <id> [-y] [--tag=<name>]` — delete task; `-y` skips confirmation
- `task-master expand-task -i <id> [--tag=<name>]` — AI breaks complex task into subtasks with implementation details
- `task-master research -q '<query>' [-r]` — interactive research session with follow-up questions; save to task/subtask or file
- `task-master add-tag --from-branch` — create tag matching current git branch
- `task-master use-tag <name>` — switch active tag context
- `task-master delete-tag <name>` — remove tag

**MCP Natural Language:** After initialization, agent can invoke via chat: 'implement next task', 'mark task 5 as done', 'expand task 3', 'research how to implement OAuth2 flow'. Task-master auto-selects appropriate command. All task operations respect active tag unless `--tag` flag overrides.

## Example workflows

**Typical flow:**
1. Place PRD in `.taskmaster/docs/prd.txt` (ask agent to generate if needed)
2. Agent runs `task-master parse-prd` → generates `.taskmaster/tasks.json` with structured task list
3. Agent queries `task-master show-next` → retrieves first unblocked pending task
4. Agent implements task, then `task-master set-status -i 1 -s done`
5. Repeat step 3-4 for subsequent tasks

**Multi-feature workflow with tags:**
1. `git checkout -b feature/user-auth`
2. Agent runs `task-master add-tag --from-branch` → creates 'feature/user-auth' tag, isolates tasks
3. Work on auth tasks in this context
4. `git checkout -b feature/billing`
5. `task-master add-tag --from-branch` → new isolated context
6. `task-master use-tag feature/user-auth` → switch back to auth tasks
7. After merge, `task-master delete-tag feature/user-auth` (optional cleanup)

**Research-driven development:**
1. Agent encounters complex task: 'Implement OAuth2 PKCE flow'
2. `task-master research -q 'OAuth2 PKCE implementation best practices for Node.js' -r`
3. Interactive session: agent asks follow-ups, explores edge cases
4. Save findings to task: choose 'Save to task/subtask' option, specify task ID
5. Agent retrieves task with `show-task -i <id>`, now includes research notes
6. Implement with informed context

**Task expansion:**
1. PRD generates high-level task: 'Build user authentication system'
2. `task-master expand-task -i 5` → AI decomposes into subtasks 5.1 (session management), 5.2 (password hashing), 5.3 (token refresh), etc.
3. Agent works through subtasks: `set-status -i 5.1 -s in-progress`

## Output format

**tasks.json structure (read from `.taskmaster/tasks.json`):**
```json
{
  "tasks": [
    {
      "id": "1",
      "title": "Setup database schema",
      "description": "...",
      "status": "done",
      "dependencies": [],
      "subtasks": [
        {"id": "1.1", "title": "...", "status": "done"},
        {"id": "1.2", "title": "...", "status": "pending"}
      ]
    },
    {
      "id": "2",
      "title": "Implement API routes",
      "status": "pending",
      "dependencies": ["1"]
    }
  ]
}
```
Task IDs are strings ('5', '5.2'). Status values: 'pending', 'in-progress', 'done', 'review', 'cancelled'. Dependencies block tasks until referenced IDs are 'done'. CLI list commands output text tables; MCP tools return structured data to agent context. Research command saves conversations as markdown in `.taskmaster/research/` with timestamp and query-based filename.

## Common pitfalls

**API key confusion:** Claude Pro subscription ≠ Anthropic API key. For Claude Pro users, select 'claude-code' provider during init (requires Claude Code CLI), NOT 'anthropic'. Anthropic provider expects separate pay-per-use API key. Agent must verify which credential type user has before initialization. **Tag isolation overlooked:** Forgetting active tag context causes task collisions when switching branches. Always create tag from branch (`add-tag --from-branch`) before starting isolated work. Operations default to active tag; use `--tag=<name>` to override. **Blocked dependencies:** `show-next` returns nothing if all pending tasks have unmet dependencies. Check `list-tasks -s pending` and verify dependency chain. **PRD location:** `parse-prd` expects PRD file in `.taskmaster/docs/`, not project root. Agent must ensure correct placement. **MCP config vs .env:** API keys must exist in BOTH `.env` (for CLI) and MCP config's `env` section (for editor integration). Missing either breaks respective interface. **No built-in OPSEC:** Tasks stored in plaintext JSON, no encryption, no compartmentalization. Never use for red-team operations, exploit development, or sensitive security workflows—use dedicated C2 tasking or OPSEC-aware tools instead. **Research model optional but recommended:** Omitting research model (`-r` flag or separate research key) limits quality of `research` and `expand-task` commands. Configure Perplexity, xAI, or OpenRouter key for better results.

## References

- https://github.com/eyaltoledano/claude-task-master
- https://github.com/eyaltoledano/claude-task-master/blob/main/docs/tutorial.md
- https://github.com/eyaltoledano/claude-task-master/blob/main/docs/command-reference.md
- https://glama.ai/mcp/servers/eyaltoledano/claude-task-master
- https://www.youtube.com/watch?v=ZFcAwdMyiw4
- https://medium.com/@abhishek.bhattacharya04/from-requirement-to-reality-how-claude-task-master-cursor-transformed-a-complex-feature-request-c8ec735d6096
- https://github.com/DevDreed/claude-task-master-extension
