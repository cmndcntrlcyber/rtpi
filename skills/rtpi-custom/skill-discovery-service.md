---
name: Skill Discovery Service
description: Index and retrieve relevant skills from the unified skills directory based on engagement context, domain, and MITRE technique
domain: platform
tags:
  - skill-management
  - orchestration
  - context-loading
mitre_techniques: []
---

# Skill Discovery Service

Indexes all skill files across source repositories and provides context-aware retrieval.

## Supported Formats

- **agentskills.io**: YAML frontmatter + Markdown body (Anthropic-Cybersecurity-Skills)
- **ClaudeAdvancedPlugins**: Markdown system prompts, metadata inferred from directory structure

## Query Methods

- **Keyword search**: Match against name, description, and tags
- **Domain filter**: Restrict to specific security domains
- **MITRE technique**: Find skills covering a specific ATT&CK technique
- **mem0-boosted**: Use engagement context to boost relevant skills

## Integration

The skill discovery service runs inside the orchestrator container and is queried by each LangGraph agent node before execution.
