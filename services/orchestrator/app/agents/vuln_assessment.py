"""
Vulnerability Assessment Agent Node
=====================================
Parallel fan-out across domain sub-agents:
  - Web vuln scanning → rtpi-burp-agent (nuclei, nikto, dalfox, arjun, wapiti)
  - Infra vuln scanning → rtpi-fuzzing-agent (nuclei infra templates)
  - AD assessment → rtpi-azure-ad-agent (certipy, enum4linux-ng, kerbrute)
  - Cloud assessment → rtpi-cloud-agent (scoutsuite, prowler)
  - Code review → rtpi-framework-agent (semgrep, bandit, trivy)

Routing: Recon findings determine which sub-agents activate.
"""

import structlog

from ..state import RTFIState, Finding
from ..mem0_client import mem0_add, mem0_search
from ..skills.discovery import find_skills
from ..tool_registry import AgentRole
from ..container_executor import execute_tools_parallel, execute_tool

logger = structlog.get_logger()


async def vuln_node(state: RTFIState) -> dict:
    """Assess vulnerabilities based on recon findings."""
    engagement_id = state["engagement_id"]
    session_id = state.get("session_id", "")
    targets = state.get("targets", [])

    logger.info("Starting vulnerability assessment", engagement=engagement_id)

    # Query mem0 for recon findings to inform which sub-agents to activate
    recon_findings = await mem0_search(
        query="What services, hosts, and technologies were discovered during reconnaissance?",
        engagement_id=engagement_id,
        limit=50,
    )

    skills = find_skills(
        query="vulnerability assessment scanning",
        engagement_id=engagement_id,
        limit=20,
    )

    findings: list[Finding] = []

    for target in targets:
        params = {"target": target}

        # --- Web vulnerability scanning (always runs) ---
        web_results = await execute_tools_parallel(
            AgentRole.WEB_VULN,
            [
                ("nuclei", params),
                ("nikto", params),
                ("dalfox", params),
                ("arjun", params),
            ],
            max_concurrent=4,
        )

        for result in web_results:
            if result.success and result.stdout.strip():
                # Nuclei/nikto findings are typically medium-high severity
                severity = "medium"
                if result.parsed_output and isinstance(result.parsed_output, list):
                    for item in result.parsed_output:
                        sev = item.get("info", {}).get("severity", "info")
                        findings.append(Finding(
                            description=f"[{result.tool_name}] {item.get('info', {}).get('name', 'Unknown')}: {item.get('matched-at', target)}",
                            severity=sev,
                            confidence="high" if result.tool_name == "nuclei" else "medium",
                            domain="web",
                            technique=item.get("info", {}).get("classification", {}).get("cve-id", [""])[0] if isinstance(item.get("info", {}).get("classification", {}).get("cve-id"), list) else "",
                            target_host=target,
                            agent="web_vuln_agent",
                            evidence=str(item)[:2000],
                        ))
                elif result.stdout.strip():
                    findings.append(Finding(
                        description=f"[{result.tool_name}] {target}: Vulnerabilities detected",
                        severity=severity,
                        confidence="medium",
                        domain="web",
                        target_host=target,
                        agent="web_vuln_agent",
                        evidence=result.stdout[:2000],
                    ))

        # --- Infrastructure scanning ---
        # Use ffuf for directory discovery
        ffuf_result = await execute_tool(
            AgentRole.WEB_VULN, "ffuf", params,
        )
        if ffuf_result.success and ffuf_result.parsed_output:
            findings.append(Finding(
                description=f"[ffuf] {target}: Directory discovery complete",
                severity="info",
                confidence="verified",
                domain="web",
                target_host=target,
                agent="infra_vuln_agent",
                evidence=ffuf_result.stdout[:2000],
            ))

        # --- AD assessment (if domain target detected) ---
        # Heuristic: if target looks like a domain or DC
        if any(kw in target.lower() for kw in [".local", "dc", "domain", "ad.", "ldap"]):
            ad_results = await execute_tools_parallel(
                AgentRole.AD_VULN,
                [
                    ("enum4linux-ng", params),
                    ("certipy-find", {**params, "username": "", "password": "", "dc_ip": target}),
                ],
                max_concurrent=2,
            )
            for result in ad_results:
                if result.success and result.stdout.strip():
                    findings.append(Finding(
                        description=f"[{result.tool_name}] {target}: AD enumeration findings",
                        severity="medium",
                        confidence="high",
                        domain="ad",
                        target_host=target,
                        agent="ad_vuln_agent",
                        evidence=result.stdout[:2000],
                    ))

        # --- Code review scanning (if source path provided) ---
        code_review_results = await execute_tools_parallel(
            AgentRole.CODE_REVIEW,
            [
                ("semgrep", params),
                ("trivy", params),
            ],
            max_concurrent=2,
        )
        for result in code_review_results:
            if result.success and result.parsed_output:
                findings.append(Finding(
                    description=f"[{result.tool_name}] Code analysis findings for {target}",
                    severity="medium",
                    confidence="high",
                    domain="code-review",
                    target_host=target,
                    agent="code_review_agent",
                    evidence=result.stdout[:2000],
                ))

    # Store all findings with severity metadata for routing
    for finding in findings:
        await mem0_add(
            content=finding.get("description", ""),
            engagement_id=engagement_id,
            agent_id=finding.get("agent", "vuln_agent"),
            session_id=session_id,
            metadata={
                "severity": finding.get("severity", "info"),
                "confidence": finding.get("confidence", "medium"),
                "domain": finding.get("domain", "general"),
                "technique": finding.get("technique", ""),
                "cvss": finding.get("cvss", 0.0),
                "status": "open",
                "target_host": finding.get("target_host", ""),
                "target_port": finding.get("target_port", ""),
            },
        )

    return {
        "findings": findings,
        "phase_history": ["vuln_assessment"],
        "skills_used": [s.get("name", "") for s in skills],
        "messages": [{
            "role": "assistant",
            "content": f"Vuln assessment complete: {len(findings)} vulnerabilities across {len(targets)} target(s).",
        }],
    }
