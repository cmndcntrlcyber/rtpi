---
name: Claude Task Master
description: "MCP server enabling AI-driven task management: parse PRDs into
  subtasks, track progress, manage dependencies, and coordinate development
  workflow within Cursor/Claude."
registry: mcp
tool_id: default:task-master
category: mcp-server
tags:
  - task-management
  - mcp-server
  - development-workflow
  - ai-coordination
  - project-planning
  - prd-parsing
  - cursor-integration
summary: "Task Master is an MCP server that structures AI-assisted development
  through hierarchical task management. Use it when building complex
  applications with AI assistance to maintain coherent progress tracking and
  prevent context loss. The server exposes ~36 tools (configurable to 7-15 core
  tools to reduce token overhead). Initialize in project root with `task-master
  init`, place PRD at `.taskmaster/docs/prd.txt`, then prompt AI to parse PRD
  into subtasks. AI reads task context from `.taskmaster/` directory structure
  and invokes tools like `parse-prd`, `list-tasks`, `next-task`,
  `complete-task`. Typical workflow: write requirements → parse into tasks →
  work task-by-task → mark complete → proceed to next. Supports tag-based
  isolation matching git branches (`add-tag --from-branch`). Requires API keys
  in `.mcp.json` (for MCP invocation) or `.env` (for CLI usage). Configure
  models via `models setup` command; supports Claude, GPT-4, local Ollama. Tools
  consume 21k tokens by default; set `TASK_MASTER_TOOLS=core` to reduce to ~5k
  tokens for essential workflow. Designed for Cursor IDE but compatible with
  Windsurf, VS Code, Claude Code. AI agent should prompt user to initialize if
  `.taskmaster/` absent, guide PRD creation, then orchestrate task execution by
  invoking MCP tools through natural language. Watch for: large files (break
  down >500 lines), context drift (re-check task details), superficial AI fixes
  on complex bugs (create dedicated task). Not for penetration testing task
  tracking—this is software development project management."
sources:
  - https://github.com/eyaltoledano/claude-task-master/blob/main/docs/tutorial.md
  - https://github.com/eyaltoledano/claude-task-master
  - https://pageai.pro/blog/claude-code-taskmaster-ai-tutorial
  - https://shipixen.com/tutorials/reduce-ai-coding-errors-with-taskmaster-ai
  - https://www.youtube.com/watch?v=47UW2XXpxms
  - https://github.com/eyaltoledano/claude-task-master/blob/main/docs/command-reference.md
  - https://code.claude.com/docs/en/commands
  - https://www.penligent.ai/hackinglabs/where-claude-4-7-actually-fits-in-a-pentest-or-red-team-workflow/
  - https://www.mindstudio.ai/blog/ai-security-auditing-vs-human-pen-testing-claude-mythos/
  - https://arxiv.org/html/2501.06963v1
  - https://samelogic.com/blog/claude-task-master-just-fixed-our-vibe-coding-workflow-heres-what-happened
  - https://github.com/eyaltoledano/claude-task-master/blob/main/README.md
generated_at: 2026-05-19T10:53:13.027Z
generated_by: anthropic
source_hash: be3166de9b8678202338ff841d2f920a8e540d5c76e669f6f2d4001ea325e12f
---

# Claude Task Master

## Overview

Claude Task Master is an MCP (Model Control Protocol) server that provides structured task management for AI-driven development workflows. It parses Product Requirement Documents (PRDs) into hierarchical task trees, tracks completion state, manages dependencies, and maintains development context across sessions. The system is optimized for use with Cursor AI editor but supports Windsurf, VS Code, and Claude Code. It exposes 36 MCP tools (configurable down to 7 core tools) that AI agents invoke to coordinate multi-step development projects without losing context or duplicating work.

## When to use

Use Task Master when coordinating AI-assisted development of complex applications that span multiple files, components, or features. Essential for projects where: (1) requirements are detailed enough to warrant structured breakdown, (2) task dependencies matter and need tracking, (3) development spans multiple sessions and context must persist, (4) multiple feature branches run in parallel (tag-based isolation), (5) AI-generated code volume is high and human review must be systematic. Do NOT use for: ad-hoc scripting, single-file utilities, exploratory prototyping, or actual security testing/red-teaming task management (this tool manages software development tasks, not operational security engagements).

## Authentication & setup

**Prerequisites**: Node.js/npx installed; at least one AI provider API key (Anthropic, OpenAI, Google, or local Ollama). **Installation**: Run `npm i -g task-master-ai` globally. **MCP Configuration**: Add server config to editor's MCP settings file: `~/.cursor/mcp.json` (Cursor), `~/.codeium/windsurf/mcp_config.json` (Windsurf), `<project>/.vscode/mcp.json` (VS Code), or Claude Code settings. Config specifies `npx -y task-master-ai` as command and includes API keys as environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`). For Cursor 1.0+: use one-click install link then replace placeholder keys. **API Keys**: Store in `.mcp.json` for MCP tool invocation OR `.env` for CLI usage. Add `.mcp.json` to `.gitignore`. **Model config**: Run `task-master models setup` interactively or configure main/research/fallback models. Claude Code users: all requests route through subscription (no separate API key needed). **Cursor-specific**: Enable MCP server in Cursor Settings → MCP tab → toggle task-master-ai.

## Key commands / parameters

**Initialization**: `task-master init` creates `.taskmaster/` directory structure, config files, and optionally sets up rules for Cursor/Windsurf. **PRD Management**: Place requirements document at `.taskmaster/docs/prd.txt`. Run `task-master parse prd` to generate task tree; can also run via migration `task-master migrate` if using legacy `scripts/prd.txt`. **Task Operations**: `task-master list` shows all tasks; `task-master next` advances to next incomplete task; `task-master complete <id>` marks task done. **Tag/Branch Isolation**: `task-master add-tag --from-branch` creates tag matching current git branch; `task-master use-tag <name>` switches context; `task-master delete-tag <name>` removes tag after merge. **Rules Management**: `task-master rules setup` launches interactive profile selection (Cursor, Roo, Windsurf); `task-master rules add <profile>` adds specific profile; `task-master rules remove <profile>` deletes it. **Model Config**: `task-master models setup` for interactive configuration. **MCP Tool Optimization**: Set `TASK_MASTER_TOOLS` env var to `core` (7 tools, ~5k tokens), `standard` (15 tools, ~10k tokens), `all` (36 tools, ~21k tokens default), or comma-separated custom list. **Help**: `task-master help` lists all commands.

## Example workflows

**Greenfield Project**: (1) Create project directory, initialize git repo. (2) Prompt AI: "Initialize taskmaster-ai into my project". (3) AI runs `init`, creates `.taskmaster/` structure. (4) Write PRD at `.taskmaster/docs/prd.txt` describing features, requirements, architecture. (5) Prompt AI: "Parse the PRD and generate tasks". AI invokes `parse-prd` tool, creates task hierarchy. (6) Prompt AI: "List all tasks" to review breakdown. (7) Prompt AI: "Work on the next task" repeatedly. AI invokes `next-task`, reads context, implements, invokes `complete-task`, proceeds. (8) For new feature branch: `git checkout -b feature/auth` then prompt AI: "Add a tag from this branch". AI runs `add-tag --from-branch`, isolates task context. (9) Switch branches: `git checkout main`, prompt AI: "Use the main tag" to restore main task context. **Bug Fix as Task**: Encounter complex bug requiring architectural change. Prompt AI: "Create a new task for this bug: [description]", work it as a structured task to avoid circular superficial fixes. **File Breakdown**: If AI generates file >500 lines, prompt: "Break down this file into logical modules with domain-driven structure". **Context Injection**: When running task, provide extra context: "Work on next task. For UI, use Tailwind with dark mode. Reference the Stripe API docs I attached."

## Output format

Task Master maintains state in `.taskmaster/` directory as JSON files. **Task Structure**: Each task has `id`, `title`, `description`, `status` (pending/in-progress/completed), `dependencies` array, optional `subtasks`. **MCP Tool Responses**: Tools return structured JSON to AI agent (not directly to user). Example: `list-tasks` returns array of task objects; `next-task` returns single task object with full context; `parse-prd` returns confirmation with task count. **Human-Facing Output**: Task lists displayed via AI agent's natural language summary. Use `task-master list` CLI command for direct terminal output showing task IDs, titles, status. **Rules Files**: Generated rules placed in `.roo/rules`, `.windsurf/rules`, or `.cursorrules` depending on profile selected. **Logs**: Operations logged to `.taskmaster/logs/` for debugging. Agents should surface task titles, IDs, and status in conversational summaries, not raw JSON.

## Common pitfalls

**Missing PRD**: Agent cannot parse tasks without PRD at `.taskmaster/docs/prd.txt`. If absent, agent must prompt user to create it or provide requirements inline. **API Key Location Mismatch**: Keys in `.env` work for CLI but not MCP; keys in `.mcp.json` work for MCP but not CLI. Solution: maintain both, gitignore `.mcp.json`. **Token Overhead**: Default 36 tools consume ~21k tokens per request. For long conversations, set `TASK_MASTER_TOOLS=core` in MCP config to reduce to 7 essential tools (~5k tokens). **Large File Generation**: AI generates monolithic 1000+ line files that become unmaintainable. Mitigation: explicitly prompt to break files >500 lines into modules. **Context Drift**: AI loses track of current task after long conversation. Mitigation: periodically prompt "What task are we working on?" or "Show current task status". **Superficial Bug Fixes**: AI applies quick patches to complex bugs instead of addressing root cause. Mitigation: create dedicated task for architectural bugs. **Tag/Branch Confusion**: Forgetting to switch tags when switching branches causes task context bleed. Always run `use-tag` or prompt AI to switch context when changing branches. **Uninitialized Project**: Invoking task commands before `init` fails silently. Agent should detect missing `.taskmaster/` and guide initialization first. **Model Config for Claude Code**: Users may add unnecessary API keys; Claude Code routes through subscription. **Rules Overwrite**: Running `init` again can overwrite custom rules. Use `rules setup` instead to manage rules post-initialization.

## References

- https://github.com/eyaltoledano/claude-task-master/blob/main/docs/tutorial.md
- https://github.com/eyaltoledano/claude-task-master
- https://github.com/eyaltoledano/claude-task-master/blob/main/docs/command-reference.md
- https://pageai.pro/blog/claude-code-taskmaster-ai-tutorial
- https://shipixen.com/tutorials/reduce-ai-coding-errors-with-taskmaster-ai
- https://www.youtube.com/watch?v=47UW2XXpxms
- https://samelogic.com/blog/claude-task-master-just-fixed-our-vibe-coding-workflow-heres-what-happened
- https://github.com/eyaltoledano/claude-task-master/blob/main/README.md
