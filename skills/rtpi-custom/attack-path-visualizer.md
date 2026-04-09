---
name: Attack Path Visualizer
description: Visualize attack paths and lateral movement chains from Neo4j graph memory
domain: platform
tags:
  - visualization
  - attack-paths
  - graph
  - lateral-movement
  - three-js
mitre_techniques:
  - T1021
  - T1550
  - T1558
---

# Attack Path Visualizer

Renders engagement attack paths from mem0's graph memory as interactive visualizations.

## Data Sources

- Neo4j graph relationships between hosts, services, and credentials
- Lateral movement chains from post-exploitation findings
- Privilege escalation paths from AD assessment

## Output Formats

- 3D network topology (Three.js) for dashboard
- SVG/PNG for reports
- JSON graph data for API consumers
