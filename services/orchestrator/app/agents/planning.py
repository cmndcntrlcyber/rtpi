"""
Planning Agent Node
====================
First node in the graph. Queries mem0 for prior engagement context,
loads relevant skills, and builds an operation plan.

Plugin sources: /context-keeper, /context-manager
"""

import structlog
from datetime import datetime, timezone

from ..state import RTFIState
from ..mem0_client import mem0_search
from ..skills.discovery import find_skills

logger = structlog.get_logger()


async def planning_node(state: RTFIState) -> dict:
    """Plan the engagement based on targets, scope, and prior context."""
    engagement_id = state["engagement_id"]
    targets = state.get("targets", [])

    logger.info("Planning engagement", engagement=engagement_id, targets=targets)

    # Query mem0 for prior findings on these targets
    prior_context = await mem0_search(
        query=f"Previous findings for targets {', '.join(targets)}",
        engagement_id=engagement_id,
        limit=20,
    )

    # Load relevant skills for initial reconnaissance
    skills = find_skills(
        query=" ".join(targets),
        domain=None,
        limit=15,
    )

    prior_count = len(prior_context.get("results", []))
    skill_count = len(skills)

    return {
        "phase": "recon",
        "phase_history": ["planning"],
        "messages": [{
            "role": "system",
            "content": (
                f"Engagement {engagement_id} planned. "
                f"{prior_count} prior memories found. "
                f"{skill_count} skills available for {len(targets)} target(s)."
            ),
        }],
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
