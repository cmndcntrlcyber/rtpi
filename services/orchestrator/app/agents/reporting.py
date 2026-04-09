"""
Reporting Agent Node
=====================
Generates engagement reports from accumulated mem0 findings.
Uses the pentest-report plugin methodology + graph memory for attack paths.

Plugin sources: /pentest-report, /threat-modeler
"""

import structlog

from ..state import RTFIState
from ..mem0_client import mem0_search, mem0_get_all

logger = structlog.get_logger()


async def reporting_node(state: RTFIState) -> dict:
    """Generate engagement report from all accumulated findings."""
    engagement_id = state["engagement_id"]

    logger.info("Generating engagement report", engagement=engagement_id)

    # Gather all findings from mem0
    all_findings = await mem0_get_all(engagement_id=engagement_id)

    # Query attack paths from graph memory
    attack_paths = await mem0_search(
        query="Show all lateral movement paths and privilege escalation chains",
        engagement_id=engagement_id,
        limit=200,
    )

    # Get critical findings for executive summary
    critical_findings = await mem0_search(
        query="List all critical and high severity findings",
        engagement_id=engagement_id,
        limit=100,
    )

    # TODO: Phase C implementation
    # - Aggregate findings by severity, domain, and host
    # - Build executive summary from critical findings
    # - Generate technical narrative using attack path graph
    # - Apply CVSS 3.1 scoring via pentest-report methodology
    # - Map findings to CWE and MITRE ATT&CK
    # - Generate remediation roadmap with priority matrix
    # - Output PDF/HTML report

    total_findings = len(all_findings.get("memories", []))
    total_paths = len(attack_paths.get("results", []))

    return {
        "phase": "complete",
        "phase_history": ["reporting"],
        "messages": [{
            "role": "assistant",
            "content": (
                f"Report generated for engagement {engagement_id}. "
                f"Total findings: {total_findings}. "
                f"Attack paths documented: {total_paths}."
            ),
        }],
    }
