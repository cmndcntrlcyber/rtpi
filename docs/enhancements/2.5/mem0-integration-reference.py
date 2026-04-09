"""
RTPI mem0 Integration Reference
================================
Copy and adapt these patterns in your orchestrator service.
"""

# ============================================================
# 1. mem0 Client Configuration
# ============================================================

from mem0 import Memory

rtpi_mem0_config = {
    "llm": {
        "provider": "ollama",
        "config": {
            "model": "qwen2.5-coder:7b",
            "ollama_base_url": "http://ollama:11434",
            "temperature": 0.1,  # Low temp for factual extraction
        }
    },
    "embedder": {
        "provider": "ollama",
        "config": {
            "model": "nomic-embed-text",
            "ollama_base_url": "http://ollama:11434",
        }
    },
    "vector_store": {
        "provider": "pgvector",
        "config": {
            "host": "postgres",
            "port": 5432,
            "dbname": "rtpi_memory",
            "user": "rtpi",
            "password": "CHANGE_ME",
            "collection_name": "rtpi_findings",
        }
    },
    "graph_store": {
        "provider": "neo4j",
        "config": {
            "url": "bolt://neo4j:7687",
            "username": "neo4j",
            "password": "CHANGE_ME",
        }
    },
    "custom_fact_extraction_prompt": """Extract ALL security-relevant facts from the text.

Entity types to capture:
- HOSTS: IP addresses, hostnames, FQDNs, MAC addresses
- SERVICES: port numbers, service names, versions, banners
- VULNERABILITIES: CVE IDs, CWE IDs, CVSS scores, descriptions
- CREDENTIALS: usernames, passwords, hashes, tokens, API keys
- ATTACK_PATHS: exploitation chains, lateral movement routes
- MITRE_TECHNIQUES: ATT&CK technique IDs (T####), tactic names
- BINARIES: file names, hashes (MD5/SHA256), file types, packers
- PROTOCOLS: custom protocols, C2 channels, exfiltration methods
- CERTIFICATES: CN, SAN, issuer, expiry dates
- CONFIGURATIONS: misconfigurations, default settings, weak policies

For each fact, preserve the RELATIONSHIP to other entities.
Example: "Host 10.0.0.5 runs Apache 2.4.49 on port 443 which is vulnerable to CVE-2021-41773"
→ Facts: Host(10.0.0.5) --RUNS--> Service(Apache/2.4.49, port=443) --VULNERABLE_TO--> CVE(CVE-2021-41773)
""",
    "version": "v1.1",
}

memory = Memory.from_config(rtpi_mem0_config)


# ============================================================
# 2. Memory Scope Patterns
# ============================================================

# ENGAGEMENT-LEVEL: Persists across all sessions for a target
def store_finding(finding: dict, engagement_id: str, agent_name: str, session_id: str):
    """Store a security finding with full scope metadata."""
    memory.add(
        messages=[{
            "role": "assistant",
            "content": finding["description"],
        }],
        user_id=engagement_id,      # Engagement scope
        agent_id=agent_name,         # Which agent found this
        run_id=session_id,           # Session scope
        metadata={
            "severity": finding.get("severity", "info"),      # critical/high/medium/low/info
            "confidence": finding.get("confidence", "medium"), # verified/high/medium/uncertain
            "domain": finding.get("domain", "general"),        # web/network/ad/cloud/re/etc
            "technique": finding.get("mitre_id", ""),          # T1190, T1078, etc
            "cvss": finding.get("cvss", 0.0),
            "status": finding.get("status", "open"),           # open/exploited/remediated
            "target_host": finding.get("host", ""),
            "target_port": finding.get("port", ""),
        }
    )


# CROSS-AGENT QUERY: Exploitation agent asks what recon found
def get_recon_findings(engagement_id: str, target_host: str = None):
    """Retrieve reconnaissance findings for exploitation planning."""
    filters = {
        "AND": [
            {"agent_id": {"eq": "recon_agent"}},
        ]
    }
    if target_host:
        filters["AND"].append({"target_host": {"eq": target_host}})

    return memory.search(
        query=f"What services and vulnerabilities were discovered on {target_host or 'all targets'}?",
        user_id=engagement_id,
        filters=filters,
        limit=50,
    )


# GRAPH QUERY: Find attack paths
def get_attack_paths(engagement_id: str, source: str, destination: str):
    """Query graph memory for paths between two hosts."""
    return memory.search(
        query=f"What attack paths exist from {source} to {destination}?",
        user_id=engagement_id,
        limit=20,
    )


# SEVERITY FILTER: Get all unpatched critical vulns
def get_critical_vulns(engagement_id: str):
    """Retrieve all open critical/high vulnerabilities."""
    return memory.search(
        query="List all critical and high severity vulnerabilities that have not been remediated",
        user_id=engagement_id,
        filters={
            "AND": [
                {"severity": {"in": ["critical", "high"]}},
                {"status": {"ne": "remediated"}},
            ]
        },
        limit=100,
    )


# ============================================================
# 3. Agent Integration Patterns
# ============================================================

# Pattern: Recon agent stores Nmap results
RECON_STORE_EXAMPLE = """
nmap_output = run_nmap("-sV -sC -p- 10.0.0.0/24")
for host in parse_nmap(nmap_output):
    for service in host.services:
        store_finding({
            "description": f"Host {host.ip} running {service.name} {service.version} on port {service.port}/{service.protocol}. Banner: {service.banner}",
            "severity": "info",
            "confidence": "verified",  # Nmap confirmed
            "domain": "network",
            "host": host.ip,
            "port": str(service.port),
        }, engagement_id="acme-2026-q2", agent_name="recon_agent", session_id="scan-001")
"""

# Pattern: Exploit agent queries before attacking
EXPLOIT_QUERY_EXAMPLE = """
# Before attempting exploitation, check what we know
target_info = get_recon_findings("acme-2026-q2", target_host="10.0.0.5")
critical_vulns = memory.search(
    query="What critical vulnerabilities exist on 10.0.0.5?",
    user_id="acme-2026-q2",
    filters={"target_host": {"eq": "10.0.0.5"}},
)

# mem0 returns semantically relevant results including:
# - Services discovered by recon agent
# - Vulnerabilities found by vuln agent
# - Any prior exploitation attempts (success/failure)
"""

# Pattern: RE agent stores binary analysis
RE_STORE_EXAMPLE = """
store_finding({
    "description": "Binary sample malware.exe (SHA256: abc123...) identified as Cobalt Strike beacon. Unpacked from UPX. C2 server: evil.example.com:443. Beacon interval: 60s with 20% jitter. Uses HTTPS with custom malleable profile mimicking jquery CDN traffic. Persistence via scheduled task 'WindowsUpdate'.",
    "severity": "critical",
    "confidence": "verified",
    "domain": "reverse-engineering",
    "technique": "T1071.001",  # Application Layer Protocol: Web
    "host": "10.0.0.5",
}, engagement_id="acme-2026-q2", agent_name="re_agent", session_id="re-001")
"""

# Pattern: Reporting agent generates from memory
REPORT_QUERY_EXAMPLE = """
# Get ALL findings for the engagement
all_findings = memory.get_all(user_id="acme-2026-q2")

# Get attack path graph
attack_paths = memory.search(
    query="Show all lateral movement paths and privilege escalation chains",
    user_id="acme-2026-q2",
    limit=200,
)

# Get findings by severity for executive summary
critical = get_critical_vulns("acme-2026-q2")

# Generate report using pentest-report plugin methodology
# with mem0 data as input
"""


# ============================================================
# 4. Skill Discovery Service
# ============================================================

import yaml
import os
from pathlib import Path

class SkillDiscoveryService:
    """Indexes and retrieves relevant skills based on context."""

    def __init__(self, skills_dir: str, memory: Memory):
        self.skills_dir = Path(skills_dir)
        self.memory = memory
        self.index = {}
        self._build_index()

    def _build_index(self):
        """Index all skills from all sources."""
        for skill_file in self.skills_dir.rglob("*.md"):
            try:
                content = skill_file.read_text()
                # Parse YAML frontmatter (agentskills.io format)
                if content.startswith("---"):
                    parts = content.split("---", 2)
                    if len(parts) >= 3:
                        meta = yaml.safe_load(parts[1])
                        self.index[skill_file.stem] = {
                            "name": meta.get("name", skill_file.stem),
                            "description": meta.get("description", ""),
                            "domain": meta.get("domain", "general"),
                            "tags": meta.get("tags", []),
                            "mitre_techniques": meta.get("mitre_techniques", []),
                            "path": str(skill_file),
                            "source": self._detect_source(skill_file),
                        }
                else:
                    # ClaudeAdvancedPlugins format: extract from directory
                    self.index[skill_file.stem] = {
                        "name": skill_file.stem,
                        "description": content[:200],
                        "domain": self._infer_domain(skill_file),
                        "tags": [],
                        "path": str(skill_file),
                        "source": "ClaudeAdvancedPlugins",
                    }
            except Exception:
                continue

    def _detect_source(self, path: Path) -> str:
        parts = str(path).lower()
        if "anthropic" in parts: return "Anthropic-Cybersecurity-Skills"
        if "payload" in parts: return "PayloadsAllTheThings"
        if "plugin" in parts: return "ClaudeAdvancedPlugins"
        return "Custom"

    def _infer_domain(self, path: Path) -> str:
        parts = str(path).lower()
        domain_map = {
            "pentest": "offensive",
            "red-team": "offensive",
            "exploit": "offensive",
            "reverse": "reverse-engineering",
            "crypto": "cryptography",
            "cloud": "cloud-security",
            "api": "api-security",
            "frontend": "development",
            "backend": "development",
            "threat": "threat-modeling",
            "supply": "supply-chain",
            "devsecops": "devsecops",
            "secure-code": "code-review",
            "vuln": "vulnerability-research",
        }
        for key, domain in domain_map.items():
            if key in parts:
                return domain
        return "general"

    def find_skills(
        self,
        query: str,
        engagement_id: str = None,
        domain: str = None,
        mitre_technique: str = None,
        limit: int = 10,
    ) -> list:
        """Find relevant skills using keyword matching + mem0 context."""
        results = []
        query_lower = query.lower()

        for name, meta in self.index.items():
            score = 0
            # Keyword matching
            if query_lower in meta["description"].lower():
                score += 3
            if query_lower in meta["name"].lower():
                score += 5
            for tag in meta.get("tags", []):
                if query_lower in tag.lower():
                    score += 2
            # Domain filter
            if domain and meta["domain"] == domain:
                score += 2
            # MITRE technique filter
            if mitre_technique and mitre_technique in meta.get("mitre_techniques", []):
                score += 4

            if score > 0:
                results.append({**meta, "relevance_score": score})

        # Sort by relevance
        results.sort(key=lambda x: x["relevance_score"], reverse=True)

        # Optionally boost with mem0 context
        if engagement_id:
            context = self.memory.search(
                query=query,
                user_id=engagement_id,
                limit=5,
            )
            # If mem0 reveals specific technologies, boost matching skills
            for ctx in context:
                for result in results:
                    if any(kw in ctx.get("memory", "") for kw in result.get("tags", [])):
                        result["relevance_score"] += 3

            results.sort(key=lambda x: x["relevance_score"], reverse=True)

        return results[:limit]


# ============================================================
# 5. LangGraph Node Template
# ============================================================

from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, Sequence
import operator

class RTFIState(TypedDict):
    """State passed between LangGraph nodes."""
    engagement_id: str
    session_id: str
    targets: list[str]
    phase: str  # recon | vuln | exploit | post-ex | re | report
    findings: Annotated[Sequence[dict], operator.add]
    skills_used: Annotated[Sequence[str], operator.add]
    approval_needed: bool
    operator_approved: bool
    messages: Annotated[Sequence[dict], operator.add]


def build_rtpi_graph(memory: Memory, skill_service: SkillDiscoveryService):
    """Build the main RTPI LangGraph orchestration graph."""

    graph = StateGraph(RTFIState)

    # --- Node: Planning ---
    def planning_node(state: RTFIState) -> RTFIState:
        # Query mem0 for prior engagement context
        prior = memory.search(
            query=f"Previous findings for targets {state['targets']}",
            user_id=state["engagement_id"],
            limit=20,
        )
        # Find relevant skills for the engagement
        skills = skill_service.find_skills(
            query=" ".join(state["targets"]),
            engagement_id=state["engagement_id"],
        )
        return {
            **state,
            "phase": "recon",
            "messages": [{"role": "system", "content": f"Prior context: {len(prior)} memories found. {len(skills)} skills available."}],
        }

    # --- Node: Recon ---
    def recon_node(state: RTFIState) -> RTFIState:
        # Load recon skills
        skills = skill_service.find_skills("reconnaissance scanning enumeration", domain="offensive")
        # Execute recon tools (Nmap, Subfinder, etc.)
        # ... tool execution logic ...
        findings = []  # populated by tool results
        # Store in mem0
        for f in findings:
            store_finding(f, state["engagement_id"], "recon_agent", state["session_id"])
        return {**state, "phase": "vuln", "findings": findings, "skills_used": [s["name"] for s in skills]}

    # --- Node: Vulnerability Assessment ---
    def vuln_node(state: RTFIState) -> RTFIState:
        skills = skill_service.find_skills("vulnerability assessment", engagement_id=state["engagement_id"])
        findings = []  # populated by vuln scanning
        for f in findings:
            store_finding(f, state["engagement_id"], "vuln_agent", state["session_id"])
        return {**state, "findings": findings}

    # --- Node: Severity Router ---
    def severity_router(state: RTFIState) -> str:
        critical = [f for f in state["findings"] if f.get("severity") in ("critical", "high")]
        if critical:
            return "human_approval"
        return "reporting"

    # --- Node: Human Approval Gate ---
    def human_approval_node(state: RTFIState) -> RTFIState:
        # In production: pause and wait for operator input
        # This is a LangGraph interrupt point
        return {**state, "approval_needed": True}

    def approval_router(state: RTFIState) -> str:
        if state.get("operator_approved"):
            return "exploit"
        return "reporting"

    # --- Node: Exploitation ---
    def exploit_node(state: RTFIState) -> RTFIState:
        skills = skill_service.find_skills("exploitation", engagement_id=state["engagement_id"])
        # ... exploitation logic ...
        return {**state, "phase": "post-ex"}

    # --- Node: Reporting ---
    def reporting_node(state: RTFIState) -> RTFIState:
        all_findings = memory.get_all(user_id=state["engagement_id"])
        # Generate report using pentest-report plugin methodology
        return {**state, "phase": "complete"}

    # --- Build Graph ---
    graph.add_node("planning", planning_node)
    graph.add_node("recon", recon_node)
    graph.add_node("vuln", vuln_node)
    graph.add_node("human_approval", human_approval_node)
    graph.add_node("exploit", exploit_node)
    graph.add_node("reporting", reporting_node)

    graph.set_entry_point("planning")
    graph.add_edge("planning", "recon")
    graph.add_edge("recon", "vuln")
    graph.add_conditional_edges("vuln", severity_router, {
        "human_approval": "human_approval",
        "reporting": "reporting",
    })
    graph.add_conditional_edges("human_approval", approval_router, {
        "exploit": "exploit",
        "reporting": "reporting",
    })
    graph.add_edge("exploit", "reporting")
    graph.add_edge("reporting", END)

    return graph.compile()
