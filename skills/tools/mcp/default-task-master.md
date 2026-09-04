---
name: Claude Task Master
description: AI-driven task management system for breaking down PRDs into
  tracked, dependency-aware development tasks within editor environments
registry: mcp
tool_id: default:task-master
category: mcp-server
tags:
  - task-management
  - mcp-server
  - ai-planning
  - project-tracking
  - workflow-automation
  - cursor-integration
  - prd-parsing
summary: "Claude Task Master is an MCP server that parses Product Requirement
  Documents (PRDs) into hierarchical task structures with dependency tracking.
  Use when you need to decompose complex development requirements into
  actionable subtasks. Invoked via natural language through MCP-enabled editors
  (Cursor, Windsurf, Cline, etc.) using '@taskmaster-ai' prefix or direct
  commands. Requires at least one LLM API key (Anthropic, OpenAI, Gemini,
  Perplexity, xAI, OpenRouter) or Claude Code CLI (no key needed). Primary
  workflow: initialize → parse PRD → list/next/show tasks → complete tasks →
  research context. Tasks stored in .taskmaster/ directory as JSON with status
  tracking (pending/in-progress/completed/blocked). Supports task expansion,
  complexity analysis, tag-based workstreams, and git branch alignment. Research
  command provides context-aware information gathering. Loop command enables
  autonomous multi-task execution. NOT a vulnerability scanner or offensive
  tool—purely development workflow automation."
sources:
  - https://glama.ai/mcp/servers/eyaltoledano/claude-task-master
  - https://github.com/tylerhuntington222/claude-task-master-gemini/blob/main/docs/tutorial.md
  - https://github.com/eyaltoledano/claude-task-master/blob/main/docs/tutorial.md
  - https://nikiforovall.blog/claude-code-rules/tips-and-tricks/extras/taskmaster
  - https://github.com/eyaltoledano/claude-task-master
  - https://github.com/eyaltoledano/claude-task-master/blob/main/docs/command-reference.md
  - https://samelogic.com/blog/claude-task-master-just-fixed-our-vibe-coding-workflow-heres-what-happened
  - https://www.facebook.com/groups/1400552731482097/posts/1531520348385334
  - https://timdietrich.me/blog/claude-code-commands-guide
  - https://www.penligent.ai/hackinglabs/where-claude-4-7-actually-fits-in-a-pentest-or-red-team-workflow
  - https://snyk.io/articles/top-claude-skills-cybersecurity-hacking-vulnerability-scanning
  - https://claudedirectory.org/skills/claude-skills-red-team
generated_at: 2026-09-04T02:30:01.033Z
generated_by: anthropic
source_hash: be3166de9b8678202338ff841d2f920a8e540d5c76e669f6f2d4001ea325e12f
---

# Claude Task Master

## Overview

Claude Task Master (task-master-ai) is an MCP (Model Control Protocol) server that integrates AI-powered task management directly into development environments. It parses Product Requirement Documents into structured task hierarchies with automatic dependency resolution, priority assignment, and progress tracking. The system maintains project state in .taskmaster/ directory and enables conversational task management through compatible editors. Tasks include complexity scoring (1-10), dependency graphs, subtask decomposition, and tag-based isolation for parallel workstreams. The tool supports multiple LLM providers and can operate with or without API keys when using Claude Code CLI.

## When to use

Use Task Master when starting new development projects from PRDs or specification documents that need systematic breakdown. Invoke when you need to track multi-step feature implementation with dependencies, expand high-complexity tasks into manageable subtasks, research contextual information without losing project scope, maintain isolated task contexts across git branches or feature streams, automate sequential task execution through loop mode, or coordinate AI-driven development workflows across team members. Do NOT use for vulnerability assessment, penetration testing, code scanning, or security analysis—this is purely a development planning and tracking tool. It complements but does not replace project management platforms; it's optimized for AI-editor integration.

## Authentication & setup

REQUIRED: At least one API key from Anthropic (Claude), OpenAI, Google Gemini, Perplexity, xAI, or OpenRouter—OR Claude Code CLI installed (no key required). Install globally: 'npm i -g task-master-ai'. Configure MCP server in editor's config file (e.g., Cursor's config.json) with command 'npx', args ['-y', 'task-master-mcp'], and environment variables for API keys: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, PERPLEXITY_API_KEY, XAI_API_KEY, OPENROUTER_API_KEY. Optional but recommended: PERPLEXITY_API_KEY for research model. Set MODEL (e.g., 'claude-3-7-sonnet-20250219'), PERPLEXITY_MODEL ('sonar-pro'), MAX_TOKENS (64000), TEMPERATURE (0.2), DEFAULT_SUBTASKS (5), DEFAULT_PRIORITY ('medium'). Enable server in editor settings. Initialize project: prompt '@taskmaster-ai initialize taskmaster-ai in my project'. Place PRD documents in .taskmaster/docs/ directory. API keys should be in both .env (CLI) and MCP config (editor usage); add .mcp.json to .gitignore.

## Key commands / parameters

Invoke via natural language through '@taskmaster-ai' or direct command strings:

PRD PARSING:
- 'parse-prd <file>' → generate tasks from PRD
- 'parse-prd <file> --num-tasks=N' → limit task generation
- 'parse-prd <file> --auto' → let system determine task count

TASK VIEWING:
- 'list' → show all tasks
- 'list --status=<pending|in-progress|completed|blocked>'
- 'list --subtasks' → include subtask details
- 'next' → show next task based on dependencies
- 'show <id>' → display specific task
- 'show <id1>,<id2>,<id3>' → multiple tasks

TASK MANAGEMENT:
- 'complete --id=N' → mark task done, update dependencies
- 'expand --id=N' → break complex task into subtasks
- 'analyze-complexity' → score all tasks 1-10
- 'update --id=N <field>=<value>' → modify task properties

RESEARCH & AUTOMATION:
- 'research "<query>"' → context-aware information lookup with follow-up questions and save options
- 'loop' → autonomous multi-task execution

TAGS & WORKSTREAMS:
- 'add-tag --from-branch' → create tag from git branch
- 'use-tag <name>' → switch active tag context
- 'delete-tag <name>' → remove tag
- Most commands accept '--tag=<name>' flag

RULES & INIT:
- 'init' → create project structure
- 'init --rules=<cursor,roo,windsurf,cline>' → apply specific rule profiles
- 'manage-rules' → update rule configurations

## Example workflows

STANDARD PRD-TO-COMPLETION FLOW:
1. Initialize: '@taskmaster-ai initialize taskmaster-ai in my project'
2. Place PRD: save requirement doc to .taskmaster/docs/prd.txt
3. Parse: '@taskmaster-ai parse-prd .taskmaster/docs/prd.txt'
4. Review: '@taskmaster-ai list --subtasks' to see full hierarchy
5. Check complexity: '@taskmaster-ai analyze-complexity'
6. Expand complex: '@taskmaster-ai expand --id=5' for high-complexity tasks
7. Work cycle: '@taskmaster-ai next' → implement → test → '@taskmaster-ai complete --id=N' → repeat
8. Research when stuck: '@taskmaster-ai research "JWT authentication best practices"'

GIT BRANCH WORKSTREAM:
1. Create feature branch: 'git checkout -b feature/user-auth'
2. Tag from branch: '@taskmaster-ai add-tag --from-branch'
3. Work in isolation: all task operations now scoped to tag
4. Switch contexts: '@taskmaster-ai use-tag <other-tag>' for parallel work
5. Merge and cleanup: after merging, '@taskmaster-ai delete-tag feature/user-auth'

AUTONOMOUS EXECUTION:
1. Set up tasks: parse PRD and review task list
2. Launch loop mode: '@taskmaster-ai loop'
3. System executes tasks sequentially with dependency respect
4. Monitor progress through editor AI chat

LIMITED TASK GENERATION:
'@taskmaster-ai parse-prd scripts/firecrawl-scraper-prd.txt --num-tasks=12' → prevents overwhelming initial task count for gradual planning approach

## Output format

Task Master maintains state in .taskmaster/ directory as JSON files. Each task contains: id (integer), title (string), description (string), status (pending|in-progress|completed|blocked), priority (low|medium|high), complexity (1-10 score), dependencies (array of task IDs), subtasks (nested array), tags (array of workstream identifiers), timestamps (created, updated, completed). Commands return JSON-formatted responses through MCP protocol but are presented conversationally in editor chat. List commands show table-formatted output. Show commands display full task details with dependency tree visualization. Research command outputs findings with interactive follow-up prompts and save menu (save to task/subtask, save to file with timestamp slug, or continue exploring). Complexity analysis returns scored list sorted by difficulty. Next command returns single highest-priority unblocked task. All state changes persist immediately to .taskmaster/tasks.json and related metadata files.

## Common pitfalls

AUTHENTICATION: Forgetting to set API keys in BOTH .env (for CLI) and MCP config (for editor)—symptoms include 'no API key' errors when invoking through chat. Using the tool without any API key and without Claude Code CLI installed. Not adding .mcp.json to .gitignore, exposing keys to version control.

WORKFLOW: Skipping 'analyze-complexity' before implementation—leads to underestimating task scope. Not using 'expand' on high-complexity tasks (8+), resulting in vague implementation targets. Marking tasks complete without verifying dependencies, breaking task chain. Working across multiple features without tag isolation, causing task context pollution.

PRD QUALITY: Feeding vague or under-specified PRDs—task quality is directly proportional to PRD detail. Using '--num-tasks' too aggressively and fragmenting coherent features. Not placing PRDs in .taskmaster/docs/, causing path resolution issues.

CONFUSION WITH OTHER TOOLS: Expecting vulnerability scanning, code analysis, or security testing capabilities—Task Master is ONLY for development task management. Assuming it replaces full project management platforms—it's optimized for AI-editor integration, not stakeholder reporting or sprint planning.

MCP INTEGRATION: Not enabling the MCP server in editor settings after adding config. Using incompatible editors without MCP support. Invoking commands without '@taskmaster-ai' prefix in editors that require it.

STATE MANAGEMENT: Manually editing .taskmaster/ JSON files and breaking schema. Not running 'init' before other commands in new projects. Deleting .taskmaster/ directory without re-initializing.

## References

https://glama.ai/mcp/servers/eyaltoledano/claude-task-master
https://github.com/eyaltoledano/claude-task-master
https://github.com/eyaltoledano/claude-task-master/blob/main/docs/tutorial.md
https://github.com/eyaltoledano/claude-task-master/blob/main/docs/command-reference.md
https://nikiforovall.blog/claude-code-rules/tips-and-tricks/extras/taskmaster
https://samelogic.com/blog/claude-task-master-just-fixed-our-vibe-coding-workflow-heres-what-happened
https://github.com/tylerhuntington222/claude-task-master-gemini/blob/main/docs/tutorial.md
