"""
Reconnaissance Agent Node
==========================
Parallel fan-out across:
  - Network scanning (Nmap via rtpi-tools)
  - Subdomain enumeration (Subfinder, Amass via rtpi-fuzzing-agent)
  - HTTP probing (httpx, naabu, katana via rtpi-fuzzing-agent)
  - Tech fingerprinting (WhatWeb, wafw00f, sslyze via rtpi-framework-agent)

Containers:
  Primary: rtpi-fuzzing-agent
  Supporting: rtpi-framework-agent, rtpi-tools
"""

import structlog

from ..state import RTFIState, Finding
from ..mem0_client import mem0_add
from ..skills.discovery import find_skills
from ..tool_registry import AgentRole
from ..container_executor import execute_tools_parallel, execute_tool

logger = structlog.get_logger()


async def recon_node(state: RTFIState) -> dict:
    """Execute reconnaissance against all targets."""
    engagement_id = state["engagement_id"]
    session_id = state.get("session_id", "")
    targets = state.get("targets", [])

    logger.info("Starting reconnaissance", targets=targets)

    skills = find_skills(
        query="reconnaissance scanning enumeration discovery",
        domain="offensive",
        limit=20,
    )

    findings: list[Finding] = []

    for target in targets:
        params = {"target": target}

        # Phase 1: Parallel network + subdomain discovery
        phase1_results = await execute_tools_parallel(
            AgentRole.RECON,
            [
                ("nmap", {**params, "args": "-sV -sC --top-ports 1000"}),
                ("subfinder", params),
                ("naabu", params),
                ("whatweb", params),
                ("wafw00f", params),
            ],
            max_concurrent=5,
        )

        for result in phase1_results:
            if result.success and result.stdout.strip():
                findings.append(Finding(
                    description=f"[{result.tool_name}] {target}: {result.stdout[:500]}",
                    severity="info",
                    confidence="verified",
                    domain="network" if result.tool_name in ("nmap", "naabu") else "web",
                    target_host=target,
                    agent="recon_agent",
                    evidence=result.stdout[:2000],
                ))

        # Phase 2: HTTP probing on discovered subdomains (depends on subfinder)
        subfinder_result = next(
            (r for r in phase1_results if r.tool_name == "subfinder" and r.success),
            None,
        )
        if subfinder_result:
            httpx_result = await execute_tool(
                AgentRole.RECON, "httpx", params,
            )
            if httpx_result.success:
                findings.append(Finding(
                    description=f"[httpx] {target}: HTTP probing complete",
                    severity="info",
                    confidence="verified",
                    domain="web",
                    target_host=target,
                    agent="recon_agent",
                    evidence=httpx_result.stdout[:2000],
                ))

        # Phase 3: Deep crawl and TLS analysis
        phase3_results = await execute_tools_parallel(
            AgentRole.RECON,
            [
                ("katana", params),
                ("sslyze", params),
                ("dnsx", params),
            ],
            max_concurrent=3,
        )

        for result in phase3_results:
            if result.success and result.stdout.strip():
                findings.append(Finding(
                    description=f"[{result.tool_name}] {target}: {result.stdout[:500]}",
                    severity="info",
                    confidence="verified",
                    domain="web" if result.tool_name == "katana" else "network",
                    target_host=target,
                    agent="recon_agent",
                    evidence=result.stdout[:2000],
                ))

    # Store all findings in mem0
    for finding in findings:
        await mem0_add(
            content=finding.get("description", ""),
            engagement_id=engagement_id,
            agent_id="recon_agent",
            session_id=session_id,
            metadata={
                "severity": finding.get("severity", "info"),
                "confidence": finding.get("confidence", "verified"),
                "domain": finding.get("domain", "network"),
                "technique": finding.get("technique", ""),
                "target_host": finding.get("target_host", ""),
                "target_port": finding.get("target_port", ""),
            },
        )

    return {
        "phase": "vuln_assessment",
        "phase_history": ["recon"],
        "findings": findings,
        "skills_used": [s.get("name", "") for s in skills],
        "messages": [{
            "role": "assistant",
            "content": f"Recon complete: {len(findings)} findings across {len(targets)} target(s).",
        }],
    }
