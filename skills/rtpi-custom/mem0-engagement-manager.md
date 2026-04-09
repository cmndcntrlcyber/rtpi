---
name: mem0 Engagement Manager
description: Manage persistent memory scopes for red team engagements using mem0 with pgvector and Neo4j graph store
domain: platform
tags:
  - memory
  - engagement
  - graph-store
  - pgvector
mitre_techniques: []
---

# mem0 Engagement Manager

Provides engagement-scoped, agent-scoped, and session-scoped memory management.

## Memory Scopes

- **Engagement-level** (`user_id`): Persists across all sessions for a target
- **Agent-specialized** (`agent_id`): Per-agent knowledge bases with cross-agent querying
- **Session memory** (`run_id`): Individual operation phases for audit trails
- **Graph memory** (Neo4j): Knowledge graph linking hosts, services, CVEs, attack paths

## Key Operations

- Store findings with structured metadata (severity, confidence, domain, technique)
- Semantic search across engagement history
- Cross-agent queries (e.g., exploit agent retrieves recon findings)
- Attack path graph queries between hosts
- Critical vulnerability aggregation
