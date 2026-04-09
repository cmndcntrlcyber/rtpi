"""
Human Approval Gate Node
=========================
Pauses the workflow for operator approval before exploitation.
This is a LangGraph interrupt point.

CRITICAL: Never auto-exploit. Operator must confirm scope
and rules of engagement before proceeding.
"""

import structlog

from ..state import RTFIState

logger = structlog.get_logger()


async def human_approval_node(state: RTFIState) -> dict:
    """Pause workflow and request operator approval for exploitation."""
    findings = state.get("findings", [])
    critical_high = [
        f for f in findings
        if f.get("severity") in ("critical", "high")
    ]

    reason = (
        f"{len(critical_high)} critical/high severity vulnerabilities found. "
        "Operator approval required before exploitation phase."
    )

    logger.warning(
        "Human approval required",
        engagement=state.get("engagement_id"),
        critical_count=len(critical_high),
    )

    # In production: this node triggers an interrupt.
    # The orchestrator API exposes an approval endpoint
    # that resumes the graph with operator_approved=True/False.
    return {
        "approval_needed": True,
        "approval_reason": reason,
        "phase_history": ["human_approval"],
        "messages": [{
            "role": "system",
            "content": f"APPROVAL REQUIRED: {reason}",
        }],
    }
