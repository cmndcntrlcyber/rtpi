# Archived Documentation

This directory contains historical development documentation that is preserved for reference but is not essential for day-to-day deployment, maintenance, or troubleshooting of the RTPI platform.

**Archive Date:** December 3, 2025

---

## Directory Structure

```
archive/
├── README.md                     (this file)
├── implementation-history/       (feature implementation completion notes)
└── m8-testing-sessions/          (M8 milestone testing session documentation)
```

---

## Implementation History

Historical documentation for completed feature implementations. These documents capture the development process and decisions made during feature development.

| Document | Description | Original Date |
|----------|-------------|---------------|
| [AGENT-TOOL-CONNECTOR-IMPLEMENTATION.md](implementation-history/AGENT-TOOL-CONNECTOR-IMPLEMENTATION.md) | Agent-to-tool connector service implementation | Nov 2025 |
| [AI-POWERED-PENTEST-REPORTING.md](implementation-history/AI-POWERED-PENTEST-REPORTING.md) | AI-powered vulnerability enrichment and reporting | Nov 2025 |
| [MCP-INTEGRATION-COMPLETE.md](implementation-history/MCP-INTEGRATION-COMPLETE.md) | MCP (Model Context Protocol) server integration | Nov 2025 |
| [OPERATIONS-IMPLEMENTATION-COMPLETE.md](implementation-history/OPERATIONS-IMPLEMENTATION-COMPLETE.md) | Operations management system implementation | Nov 2025 |
| [REPAIR-SESSION-COMPLETE.md](implementation-history/REPAIR-SESSION-COMPLETE.md) | System repair session and fixes applied | Nov 2025 |
| [REPORT-GENERATION-ENHANCEMENTS.md](implementation-history/REPORT-GENERATION-ENHANCEMENTS.md) | Report generation feature enhancements | Nov 2025 |
| [REPORTS-IMPLEMENTATION-COMPLETE.md](implementation-history/REPORTS-IMPLEMENTATION-COMPLETE.md) | Reports system implementation | Nov 2025 |
| [TARGETS-IMPLEMENTATION-COMPLETE.md](implementation-history/TARGETS-IMPLEMENTATION-COMPLETE.md) | Target management system implementation | Nov 2025 |
| [VULNERABILITIES-IMPLEMENTATION-COMPLETE.md](implementation-history/VULNERABILITIES-IMPLEMENTATION-COMPLETE.md) | Vulnerability tracking system implementation | Nov 2025 |

---

## M8 Testing Sessions

Documentation from the M8 milestone testing sessions, tracking test coverage expansion and quality assurance efforts.

| Document | Description | Original Date |
|----------|-------------|---------------|
| [M8-CURRENT-STATUS.md](m8-testing-sessions/M8-CURRENT-STATUS.md) | M8 testing current status snapshot | Nov 2025 |
| [M8-IMPLEMENTATION-PLAN.md](m8-testing-sessions/M8-IMPLEMENTATION-PLAN.md) | M8 testing implementation roadmap | Nov 2025 |
| [M8-SESSION-1-COMPLETE.md](m8-testing-sessions/M8-SESSION-1-COMPLETE.md) | Session 1 completion summary | Nov 2025 |
| [M8-SESSIONS-1-2-SUMMARY.md](m8-testing-sessions/M8-SESSIONS-1-2-SUMMARY.md) | Sessions 1-2 combined summary | Nov 2025 |
| [M8-SESSIONS-COMPLETE.md](m8-testing-sessions/M8-SESSIONS-COMPLETE.md) | All M8 sessions completion summary | Nov 2025 |
| [M8-TESTING-STATUS.md](m8-testing-sessions/M8-TESTING-STATUS.md) | M8 testing status and metrics | Nov 2025 |

---

## Why These Were Archived

These documents represent **historical development milestones** rather than operational documentation. They are valuable for:

- Understanding the evolution of the codebase
- Reference for similar future implementations
- Audit trail of development decisions
- Onboarding context for new team members

However, they are **not required** for:

- Production deployment
- System maintenance
- Troubleshooting issues
- Day-to-day operations

---

## Active Operational Documentation

For current operational documentation, see the parent `docs/` directory:

| Document | Purpose |
|----------|---------|
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Production deployment guide |
| [DEPLOYMENT-FIXES.md](../DEPLOYMENT-FIXES.md) | Deployment configuration fixes |
| [API.md](../API.md) | REST API reference |
| [DEVELOPMENT.md](../DEVELOPMENT.md) | Development environment setup |
| [MCP-SERVER-TROUBLESHOOTING.md](../MCP-SERVER-TROUBLESHOOTING.md) | MCP server troubleshooting |
| [RTPI-TOOLS-IMPLEMENTATION.md](../RTPI-TOOLS-IMPLEMENTATION.md) | Security tools usage and setup |
| [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md) | Roadmap and planned features |

---

## Restoring Archived Documents

If you need to restore any archived document to the main docs directory:

```bash
# Example: Restore a specific document
mv docs/archive/implementation-history/OPERATIONS-IMPLEMENTATION-COMPLETE.md docs/
```

---

*This archive was created as part of documentation consolidation to streamline the operational documentation structure.*
