"""
RTPI LangGraph State Definitions
=================================
Defines the shared state passed between all LangGraph nodes.
Maps directly to the state machine in langgraph-state-machine.mermaid.
"""

from typing import Annotated, Sequence, Literal
from typing_extensions import TypedDict
import operator


# Phase progression matches the pentest lifecycle
Phase = Literal[
    "planning",
    "recon",
    "vuln_assessment",
    "exploitation",
    "post_exploitation",
    "reverse_engineering",
    "reporting",
    "complete",
    "error",
]

# Severity levels for routing decisions
Severity = Literal["critical", "high", "medium", "low", "info"]

# Confidence levels (Hallucination Guard pattern)
Confidence = Literal["verified", "high", "medium", "uncertain"]


class Finding(TypedDict, total=False):
    """A single security finding produced by any agent."""
    description: str
    severity: Severity
    confidence: Confidence
    domain: str                 # web, network, ad, cloud, re, etc.
    technique: str              # MITRE ATT&CK ID (T####)
    cvss: float
    status: str                 # open, exploited, remediated
    target_host: str
    target_port: str
    cve_id: str
    cwe_id: str
    agent: str                  # which agent produced this
    evidence: str               # raw tool output or screenshot path


class RTFIState(TypedDict, total=False):
    """
    Root state for the RTPI LangGraph orchestration graph.

    Annotated fields with operator.add accumulate across nodes
    (findings and messages append rather than overwrite).
    """
    # Engagement scope
    engagement_id: str
    session_id: str
    targets: list[str]
    scope_constraints: list[str]    # Rules of engagement

    # Phase tracking
    phase: Phase
    phase_history: Annotated[Sequence[str], operator.add]

    # Accumulated results
    findings: Annotated[Sequence[Finding], operator.add]
    skills_used: Annotated[Sequence[str], operator.add]

    # Human-in-the-loop
    approval_needed: bool
    approval_reason: str
    operator_approved: bool

    # Agent messaging
    messages: Annotated[Sequence[dict], operator.add]

    # Error handling
    errors: Annotated[Sequence[str], operator.add]

    # Metadata
    started_at: str
    completed_at: str
