"""
RTPI LangGraph Orchestration Graph
====================================
Implements the state machine from langgraph-state-machine.mermaid.
Each node wraps a domain agent; edges define the pentest workflow.
"""

from langgraph.graph import StateGraph, END

from .state import RTFIState
from .agents.planning import planning_node
from .agents.recon import recon_node
from .agents.vuln_assessment import vuln_node
from .agents.exploitation import exploit_node
from .agents.post_exploitation import post_exploit_node
from .agents.reverse_engineering import rev_eng_node
from .agents.reporting import reporting_node
from .agents.human_approval import human_approval_node


# ---------------------------------------------------------------------------
# Conditional Routing Functions
# ---------------------------------------------------------------------------

def severity_router(state: RTFIState) -> str:
    """Route based on finding severity after vuln assessment."""
    findings = state.get("findings", [])
    critical_high = [
        f for f in findings
        if f.get("severity") in ("critical", "high")
        and f.get("agent") in ("vuln_agent", "web_vuln_agent", "infra_vuln_agent", "ad_vuln_agent", "cloud_vuln_agent")
    ]
    if critical_high:
        return "human_approval"
    return "reporting"


def approval_router(state: RTFIState) -> str:
    """Route based on operator approval decision."""
    if state.get("operator_approved"):
        return "exploitation"
    return "reporting"


def binary_check_router(state: RTFIState) -> str:
    """Route to RE pipeline if custom binaries/protocols were found."""
    findings = state.get("findings", [])
    re_needed = any(
        f.get("domain") in ("reverse-engineering", "binary", "firmware", "protocol")
        for f in findings
    )
    if re_needed:
        return "reverse_engineering"
    return "post_exploitation"


def post_exploit_router(state: RTFIState) -> str:
    """After post-exploitation, always go to reporting."""
    return "reporting"


# ---------------------------------------------------------------------------
# Graph Builder
# ---------------------------------------------------------------------------

def build_rtpi_graph() -> StateGraph:
    """
    Build the main RTPI pentest workflow graph.

    Flow:
        planning -> recon -> vuln_assessment
            -> [critical/high] -> human_approval
                -> [approved] -> exploitation
                    -> [binary found] -> reverse_engineering -> post_exploitation
                    -> [standard]     -> post_exploitation
                -> [declined] -> reporting
            -> [medium/low/info] -> reporting
        post_exploitation -> reporting -> END
    """
    graph = StateGraph(RTFIState)

    # Register nodes
    graph.add_node("planning", planning_node)
    graph.add_node("recon", recon_node)
    graph.add_node("vuln_assessment", vuln_node)
    graph.add_node("human_approval", human_approval_node)
    graph.add_node("exploitation", exploit_node)
    graph.add_node("reverse_engineering", rev_eng_node)
    graph.add_node("post_exploitation", post_exploit_node)
    graph.add_node("reporting", reporting_node)

    # Define edges
    graph.set_entry_point("planning")
    graph.add_edge("planning", "recon")
    graph.add_edge("recon", "vuln_assessment")

    # Conditional: vuln severity determines next step
    graph.add_conditional_edges("vuln_assessment", severity_router, {
        "human_approval": "human_approval",
        "reporting": "reporting",
    })

    # Conditional: operator approval gates exploitation
    graph.add_conditional_edges("human_approval", approval_router, {
        "exploitation": "exploitation",
        "reporting": "reporting",
    })

    # Conditional: exploitation may need RE
    graph.add_conditional_edges("exploitation", binary_check_router, {
        "reverse_engineering": "reverse_engineering",
        "post_exploitation": "post_exploitation",
    })

    graph.add_edge("reverse_engineering", "post_exploitation")
    graph.add_edge("post_exploitation", "reporting")
    graph.add_edge("reporting", END)

    return graph.compile()
