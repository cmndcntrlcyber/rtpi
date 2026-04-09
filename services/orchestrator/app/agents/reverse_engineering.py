"""
Reverse Engineering Agent Node
================================
Handles binary analysis, malware RE, protocol RE, firmware analysis.

Containers:
  Primary: rtpi-maldev-agent (radare2, gdb, angr, pwntools, capstone, yara, binwalk)
  Supporting: rtpi-ghidra (headless decompilation)
              rtpi-aflplusplus (coverage-guided fuzzing)

Plugin sources: /reverse-binary, /reverse-malware, /reverse-protocol,
                /reverse-firmware, /reverse-obfuscation
"""

import structlog

from ..state import RTFIState, Finding
from ..mem0_client import mem0_add
from ..skills.discovery import find_skills
from ..tool_registry import AgentRole
from ..container_executor import execute_tool, execute_tools_parallel

logger = structlog.get_logger()


async def rev_eng_node(state: RTFIState) -> dict:
    """Analyze binaries, protocols, or firmware discovered during exploitation."""
    engagement_id = state["engagement_id"]
    session_id = state.get("session_id", "")

    logger.info("Starting reverse engineering", engagement=engagement_id)

    skills = find_skills(
        query="reverse engineering binary malware protocol firmware",
        domain="reverse-engineering",
        limit=20,
    )

    findings: list[Finding] = []

    # Get binary/sample paths from exploitation findings
    exploit_findings = [
        f for f in state.get("findings", [])
        if f.get("domain") in ("reverse-engineering", "binary", "firmware", "protocol", "exploitation")
    ]

    for finding in exploit_findings:
        target = finding.get("target_host", "unknown")
        # Assume samples are in /shared/samples/<target>/
        binary = f"/samples/{target}/sample.bin"

        # Phase 1: Initial triage — YARA + binwalk + radare2
        triage_results = await execute_tools_parallel(
            AgentRole.REV_ENG,
            [
                ("yara", {"binary": binary}),
                ("binwalk", {"binary": binary}),
                ("radare2", {"binary": binary, "args": "iI; afl; pdf @main"}),
            ],
            max_concurrent=3,
        )

        for result in triage_results:
            if result.success and result.stdout.strip():
                findings.append(Finding(
                    description=f"[{result.tool_name}] RE triage for {target}: {result.stdout[:300]}",
                    severity="high",
                    confidence="high",
                    domain="reverse-engineering",
                    target_host=target,
                    agent="re_agent",
                    evidence=result.stdout[:2000],
                ))

        # Phase 2: Deep analysis — Ghidra headless decompilation
        ghidra_result = await execute_tool(
            AgentRole.REV_ENG,
            "ghidra-analyze",
            {"binary": binary},
        )
        if ghidra_result.success:
            findings.append(Finding(
                description=f"[ghidra] Decompilation complete for {target} sample",
                severity="high",
                confidence="high",
                domain="reverse-engineering",
                target_host=target,
                agent="re_agent",
                evidence=ghidra_result.stdout[:2000],
            ))

    # Store findings with graph relationships
    for f in findings:
        await mem0_add(
            content=f.get("description", ""),
            engagement_id=engagement_id,
            agent_id="re_agent",
            session_id=session_id,
            metadata={
                "severity": f.get("severity", "high"),
                "confidence": f.get("confidence", "high"),
                "domain": "reverse-engineering",
                "technique": f.get("technique", ""),
                "target_host": f.get("target_host", ""),
            },
        )

    return {
        "phase_history": ["reverse_engineering"],
        "findings": findings,
        "skills_used": [s.get("name", "") for s in skills],
        "messages": [{
            "role": "assistant",
            "content": f"RE analysis complete: {len(findings)} findings.",
        }],
    }
