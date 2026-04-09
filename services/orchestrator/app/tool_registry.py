"""
RTPI Tool Registry — Agent-to-Container Mapping
=================================================
Maps each LangGraph agent node to its tool containers,
available commands, and execution patterns.

This is the central configuration that tells the orchestrator
which Docker container to exec into for each tool invocation.
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

from .config import settings


class AgentRole(str, Enum):
    """LangGraph agent node identifiers."""
    RECON = "recon_agent"
    WEB_VULN = "web_vuln_agent"
    INFRA_VULN = "infra_vuln_agent"
    AD_VULN = "ad_vuln_agent"
    CLOUD_VULN = "cloud_vuln_agent"
    EXPLOIT = "exploit_agent"
    POST_EXPLOIT = "post_exploit_agent"
    SOCIAL_ENG = "social_eng_agent"
    REV_ENG = "re_agent"
    CODE_REVIEW = "code_review_agent"
    VULN_RESEARCH = "vuln_research_agent"
    LLM_SECURITY = "llm_security_agent"
    REPORTING = "reporting_agent"


@dataclass
class ToolDefinition:
    """A single tool that can be executed inside a container."""
    name: str
    command_template: str          # e.g., "nmap {args}"
    container: str                 # Docker container name
    output_dir: str = "/findings"  # Where results are written
    timeout: int = 300             # Max seconds
    parse_format: str = "text"     # text, json, xml, nmap-xml
    description: str = ""


@dataclass
class AgentToolMapping:
    """Maps an agent role to its available tool containers and tools."""
    role: AgentRole
    primary_container: str
    supporting_containers: list[str] = field(default_factory=list)
    tools: list[ToolDefinition] = field(default_factory=list)
    skills_domains: list[str] = field(default_factory=list)
    mitre_tactics: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Container name resolution (from env vars or defaults)
# ---------------------------------------------------------------------------

def _env(var: str, default: str) -> str:
    """Resolve container name from env or default."""
    import os
    return os.environ.get(var, default)


# ---------------------------------------------------------------------------
# Complete Agent-to-Container Registry
# ---------------------------------------------------------------------------

AGENT_REGISTRY: dict[AgentRole, AgentToolMapping] = {

    # ======================================================================
    # RECON AGENT
    # Primary: offsec-fuzzing (subfinder, httpx, naabu, nuclei, ffuf, etc.)
    # Supporting: offsec-framework (wappalyzer, whatweb, wafw00f)
    #             rtpi-tools (nmap, bbot, nbtscan)
    # ======================================================================
    AgentRole.RECON: AgentToolMapping(
        role=AgentRole.RECON,
        primary_container=_env("CONTAINER_RECON_PRIMARY", "rtpi-fuzzing-agent"),
        supporting_containers=[
            _env("CONTAINER_RECON_FINGERPRINT", "rtpi-framework-agent"),
            _env("CONTAINER_RECON_NETWORK", "rtpi-tools"),
        ],
        tools=[
            # --- Network scanning (rtpi-tools) ---
            ToolDefinition(
                name="nmap",
                command_template="nmap {args} -oX /findings/nmap-{target}.xml {target}",
                container=_env("CONTAINER_RECON_NETWORK", "rtpi-tools"),
                parse_format="nmap-xml",
                timeout=600,
                description="TCP/UDP port scanning with service detection",
            ),
            ToolDefinition(
                name="bbot",
                command_template="bbot -t {target} -f safe -o /findings/bbot-{target}",
                container=_env("CONTAINER_RECON_NETWORK", "rtpi-tools"),
                parse_format="json",
                timeout=900,
                description="BBOT recursive OSINT and attack surface mapping",
            ),
            # --- Subdomain enumeration (offsec-fuzzing) ---
            ToolDefinition(
                name="subfinder",
                command_template="subfinder -d {target} -o /findings/subfinder-{target}.txt",
                container=_env("CONTAINER_RECON_PRIMARY", "rtpi-fuzzing-agent"),
                description="Passive subdomain enumeration",
            ),
            ToolDefinition(
                name="httpx",
                command_template="httpx -l /findings/subfinder-{target}.txt -o /findings/httpx-{target}.json -json",
                container=_env("CONTAINER_RECON_PRIMARY", "rtpi-fuzzing-agent"),
                parse_format="json",
                description="HTTP probe and tech detection",
            ),
            ToolDefinition(
                name="naabu",
                command_template="naabu -host {target} -o /findings/naabu-{target}.txt",
                container=_env("CONTAINER_RECON_PRIMARY", "rtpi-fuzzing-agent"),
                description="Fast port scanner",
            ),
            ToolDefinition(
                name="dnsx",
                command_template="dnsx -l /findings/subfinder-{target}.txt -o /findings/dnsx-{target}.txt -json",
                container=_env("CONTAINER_RECON_PRIMARY", "rtpi-fuzzing-agent"),
                parse_format="json",
                description="DNS resolution and record enumeration",
            ),
            ToolDefinition(
                name="katana",
                command_template="katana -u {target} -o /findings/katana-{target}.txt -jc -d 3",
                container=_env("CONTAINER_RECON_PRIMARY", "rtpi-fuzzing-agent"),
                description="Web crawling and endpoint discovery",
            ),
            ToolDefinition(
                name="amass",
                command_template="amass enum -d {target} -o /findings/amass-{target}.txt",
                container=_env("CONTAINER_RECON_PRIMARY", "rtpi-fuzzing-agent"),
                timeout=900,
                description="Attack surface mapping and subdomain enum",
            ),
            # --- Tech fingerprinting (offsec-framework) ---
            ToolDefinition(
                name="whatweb",
                command_template="whatweb {target} --log-json=/findings/whatweb-{target}.json",
                container=_env("CONTAINER_RECON_FINGERPRINT", "rtpi-framework-agent"),
                parse_format="json",
                description="Web technology fingerprinting",
            ),
            ToolDefinition(
                name="wafw00f",
                command_template="wafw00f {target} -o /findings/wafw00f-{target}.json -f json",
                container=_env("CONTAINER_RECON_FINGERPRINT", "rtpi-framework-agent"),
                parse_format="json",
                description="WAF detection and identification",
            ),
            ToolDefinition(
                name="sslyze",
                command_template="sslyze {target} --json_out=/findings/sslyze-{target}.json",
                container=_env("CONTAINER_RECON_FINGERPRINT", "rtpi-framework-agent"),
                parse_format="json",
                description="SSL/TLS configuration analysis",
            ),
            ToolDefinition(
                name="testssl",
                command_template="testssl.sh --jsonfile /findings/testssl-{target}.json {target}",
                container=_env("CONTAINER_RECON_FINGERPRINT", "rtpi-framework-agent"),
                parse_format="json",
                timeout=600,
                description="TLS/SSL cipher and vulnerability testing",
            ),
        ],
        skills_domains=["offensive", "network"],
        mitre_tactics=["TA0043"],  # Reconnaissance
    ),

    # ======================================================================
    # WEB VULN AGENT
    # Primary: offsec-burp (burp suite, nikto, dalfox, arjun, nuclei-templates)
    # Supporting: offsec-web-injection (catch), offsec-fuzzing (ffuf, wfuzz)
    # ======================================================================
    AgentRole.WEB_VULN: AgentToolMapping(
        role=AgentRole.WEB_VULN,
        primary_container=_env("CONTAINER_WEB_VULN", "rtpi-burp-agent"),
        supporting_containers=[
            "rtpi-web-injection-agent",
            _env("CONTAINER_RECON_PRIMARY", "rtpi-fuzzing-agent"),
        ],
        tools=[
            ToolDefinition(
                name="nuclei",
                command_template="nuclei -u {target} -severity critical,high,medium -o /findings/nuclei-{target}.json -jsonl",
                container=_env("CONTAINER_WEB_VULN", "rtpi-burp-agent"),
                parse_format="json",
                timeout=900,
                description="Template-based vulnerability scanner",
            ),
            ToolDefinition(
                name="nikto",
                command_template="nikto -h {target} -o /findings/nikto-{target}.json -Format json",
                container=_env("CONTAINER_WEB_VULN", "rtpi-burp-agent"),
                parse_format="json",
                timeout=600,
                description="Web server vulnerability scanner",
            ),
            ToolDefinition(
                name="dalfox",
                command_template="dalfox url {target} --format json -o /findings/dalfox-{target}.json",
                container=_env("CONTAINER_WEB_VULN", "rtpi-burp-agent"),
                parse_format="json",
                description="XSS vulnerability scanner with WAF bypass",
            ),
            ToolDefinition(
                name="arjun",
                command_template="arjun -u {target} -oJ /findings/arjun-{target}.json",
                container=_env("CONTAINER_WEB_VULN", "rtpi-burp-agent"),
                parse_format="json",
                description="Hidden HTTP parameter discovery",
            ),
            ToolDefinition(
                name="wapiti",
                command_template="wapiti -u {target} -f json -o /findings/wapiti-{target}.json",
                container=_env("CONTAINER_WEB_VULN", "rtpi-burp-agent"),
                parse_format="json",
                timeout=900,
                description="Web application vulnerability scanner",
            ),
            ToolDefinition(
                name="ffuf",
                command_template="ffuf -u {target}/FUZZ -w /opt/wordlists/common.txt -o /findings/ffuf-{target}.json -of json",
                container=_env("CONTAINER_RECON_PRIMARY", "rtpi-fuzzing-agent"),
                parse_format="json",
                description="Web fuzzer for directory/parameter discovery",
            ),
            ToolDefinition(
                name="gospider",
                command_template="gospider -s {target} -o /findings/gospider-{target} -c 10 -d 3",
                container=_env("CONTAINER_WEB_VULN", "rtpi-burp-agent"),
                description="Fast web spidering",
            ),
        ],
        skills_domains=["offensive", "api-security"],
        mitre_tactics=["TA0043", "TA0001"],  # Reconnaissance, Initial Access
    ),

    # ======================================================================
    # AD VULN AGENT
    # Primary: offsec-azure-ad (BloodHound CE, certipy, impacket, kerbrute, etc.)
    # ======================================================================
    AgentRole.AD_VULN: AgentToolMapping(
        role=AgentRole.AD_VULN,
        primary_container=_env("CONTAINER_AD_VULN", "rtpi-azure-ad-agent"),
        tools=[
            ToolDefinition(
                name="bloodhound-collect",
                command_template="rusthound -d {target} -u {username} -p {password} -o /findings/bloodhound-{target}.json",
                container=_env("CONTAINER_AD_VULN", "rtpi-azure-ad-agent"),
                parse_format="json",
                timeout=600,
                description="BloodHound data collection via RustHound",
            ),
            ToolDefinition(
                name="certipy-find",
                command_template="certipy find -u {username}@{target} -p {password} -dc-ip {dc_ip} -json -output /findings/certipy-{target}",
                container=_env("CONTAINER_AD_VULN", "rtpi-azure-ad-agent"),
                parse_format="json",
                description="ADCS certificate template enumeration (ESC1-ESC11)",
            ),
            ToolDefinition(
                name="kerbrute",
                command_template="kerbrute userenum --dc {dc_ip} -d {target} /opt/tools/usernames.txt -o /findings/kerbrute-{target}.txt",
                container=_env("CONTAINER_AD_VULN", "rtpi-azure-ad-agent"),
                description="Kerberos username enumeration and password spraying",
            ),
            ToolDefinition(
                name="enum4linux-ng",
                command_template="enum4linux-ng -A {target} -oJ /findings/enum4linux-{target}.json",
                container=_env("CONTAINER_AD_VULN", "rtpi-azure-ad-agent"),
                parse_format="json",
                description="SMB/NetBIOS/LDAP enumeration",
            ),
            ToolDefinition(
                name="impacket-secretsdump",
                command_template="impacket-secretsdump {username}:{password}@{target} -outputfile /findings/secrets-{target}",
                container=_env("CONTAINER_AD_VULN", "rtpi-azure-ad-agent"),
                timeout=600,
                description="SAM/LSA/NTDS credential extraction",
            ),
            ToolDefinition(
                name="adidnsdump",
                command_template="adidnsdump -u {username} -p {password} {target} --json -o /findings/adidns-{target}.json",
                container=_env("CONTAINER_AD_VULN", "rtpi-azure-ad-agent"),
                parse_format="json",
                description="AD Integrated DNS record extraction",
            ),
        ],
        skills_domains=["offensive"],
        mitre_tactics=["TA0006", "TA0003", "TA0008"],  # Credential Access, Persistence, Lateral Movement
    ),

    # ======================================================================
    # CLOUD VULN AGENT
    # Primary: offsec-cloud (NEW — ScoutSuite, Prowler, Pacu, CloudFox)
    # Supporting: offsec-azure-ad (Azure CLI, Az module, ScubaGear)
    # ======================================================================
    AgentRole.CLOUD_VULN: AgentToolMapping(
        role=AgentRole.CLOUD_VULN,
        primary_container=_env("CONTAINER_CLOUD_VULN", "rtpi-cloud-agent"),
        supporting_containers=[
            _env("CONTAINER_AD_VULN", "rtpi-azure-ad-agent"),
        ],
        tools=[
            ToolDefinition(
                name="scoutsuite-aws",
                command_template="scout aws --no-browser --report-dir /findings/scoutsuite-aws-{target}",
                container=_env("CONTAINER_CLOUD_VULN", "rtpi-cloud-agent"),
                parse_format="json",
                timeout=1800,
                description="AWS multi-service security audit",
            ),
            ToolDefinition(
                name="scoutsuite-gcp",
                command_template="scout gcp --no-browser --report-dir /findings/scoutsuite-gcp-{target}",
                container=_env("CONTAINER_CLOUD_VULN", "rtpi-cloud-agent"),
                parse_format="json",
                timeout=1800,
                description="GCP multi-service security audit",
            ),
            ToolDefinition(
                name="prowler-aws",
                command_template="prowler aws -M json -o /findings/prowler-aws-{target}",
                container=_env("CONTAINER_CLOUD_VULN", "rtpi-cloud-agent"),
                parse_format="json",
                timeout=1800,
                description="AWS CIS/NIST/PCI-DSS compliance scanner",
            ),
            ToolDefinition(
                name="prowler-gcp",
                command_template="prowler gcp -M json -o /findings/prowler-gcp-{target}",
                container=_env("CONTAINER_CLOUD_VULN", "rtpi-cloud-agent"),
                parse_format="json",
                timeout=1800,
                description="GCP compliance and security scanner",
            ),
            ToolDefinition(
                name="pacu",
                command_template="pacu --command-args '{args}'",
                container=_env("CONTAINER_CLOUD_VULN", "rtpi-cloud-agent"),
                timeout=600,
                description="AWS exploitation framework (IAM privesc, persistence)",
            ),
            ToolDefinition(
                name="cloudfox",
                command_template="cloudfox aws {args} -o /findings/cloudfox-{target}",
                container=_env("CONTAINER_CLOUD_VULN", "rtpi-cloud-agent"),
                parse_format="json",
                description="AWS attack surface enumeration",
            ),
            ToolDefinition(
                name="enumerate-iam",
                command_template="python3 /opt/tools/enumerate-iam/enumerate-iam.py --access-key {access_key} --secret-key {secret_key}",
                container=_env("CONTAINER_CLOUD_VULN", "rtpi-cloud-agent"),
                description="IAM permission brute-force enumeration",
            ),
            # --- Azure tools (offsec-azure-ad) ---
            ToolDefinition(
                name="scubagear",
                command_template="pwsh -c 'Import-Module ScubaGear; Invoke-SCuBA -ProductNames aad -OutPath /findings/scuba-{target}'",
                container=_env("CONTAINER_AD_VULN", "rtpi-azure-ad-agent"),
                timeout=900,
                description="Microsoft 365 security baseline assessment",
            ),
            ToolDefinition(
                name="roadrecon",
                command_template="roadrecon gather -d {target} && roadrecon dump -o /findings/roadrecon-{target}",
                container=_env("CONTAINER_AD_VULN", "rtpi-azure-ad-agent"),
                description="Azure AD tenant enumeration and visualization",
            ),
        ],
        skills_domains=["cloud-security"],
        mitre_tactics=["TA0043", "TA0006", "TA0003"],  # Reconnaissance, Credential Access, Persistence
    ),

    # ======================================================================
    # EXPLOIT AGENT
    # Primary: rtpi-tools (metasploit, hashcat, hydra)
    # Supporting: offsec-maldev (pwntools, ROP tools, shellcode)
    #             offsec-empire (payload generators: donut, ScareCrow, etc.)
    # ======================================================================
    AgentRole.EXPLOIT: AgentToolMapping(
        role=AgentRole.EXPLOIT,
        primary_container=_env("CONTAINER_EXPLOIT_CORE", "rtpi-tools"),
        supporting_containers=[
            _env("CONTAINER_EXPLOIT_BINARY", "rtpi-maldev-agent"),
            _env("CONTAINER_EXPLOIT_PAYLOAD", "rtpi-empire-agent"),
        ],
        tools=[
            ToolDefinition(
                name="msfconsole",
                command_template="msfconsole -q -x '{args}'",
                container=_env("CONTAINER_EXPLOIT_CORE", "rtpi-tools"),
                timeout=600,
                description="Metasploit Framework exploitation",
            ),
            ToolDefinition(
                name="searchsploit",
                command_template="searchsploit {args} --json",
                container=_env("CONTAINER_EXPLOIT_CORE", "rtpi-tools"),
                parse_format="json",
                description="ExploitDB search for known exploits",
            ),
            ToolDefinition(
                name="hashcat",
                command_template="hashcat {args}",
                container=_env("CONTAINER_EXPLOIT_CORE", "rtpi-tools"),
                timeout=3600,
                description="GPU-accelerated password cracking",
            ),
            ToolDefinition(
                name="hydra",
                command_template="hydra {args} -o /findings/hydra-{target}.txt",
                container=_env("CONTAINER_EXPLOIT_CORE", "rtpi-tools"),
                timeout=600,
                description="Online brute-force authentication testing",
            ),
            ToolDefinition(
                name="donut",
                command_template="donut {args}",
                container=_env("CONTAINER_EXPLOIT_PAYLOAD", "rtpi-empire-agent"),
                description="Shellcode generator from .NET/PE/DLL",
            ),
            ToolDefinition(
                name="scarecrow",
                command_template="ScareCrow {args}",
                container=_env("CONTAINER_EXPLOIT_PAYLOAD", "rtpi-empire-agent"),
                description="Payload generator with EDR bypass",
            ),
        ],
        skills_domains=["offensive"],
        mitre_tactics=["TA0001", "TA0002"],  # Initial Access, Execution
    ),

    # ======================================================================
    # POST-EXPLOITATION AGENT
    # Primary: offsec-empire (Empire, crackmapexec, evil-winrm, chisel, etc.)
    # Supporting: C2 frameworks (sliver, c3, loki, adaptix)
    # ======================================================================
    AgentRole.POST_EXPLOIT: AgentToolMapping(
        role=AgentRole.POST_EXPLOIT,
        primary_container=_env("CONTAINER_POSTEX_PRIMARY", "rtpi-empire-agent"),
        supporting_containers=[
            _env("CONTAINER_POSTEX_SLIVER", "rtpi-sliver-agent"),
            _env("CONTAINER_POSTEX_C3", "rtpi-c3-agent"),
            _env("CONTAINER_POSTEX_LOKI", "rtpi-loki-agent"),
            _env("CONTAINER_POSTEX_ADAPTIX", "rtpi-adaptix-agent"),
        ],
        tools=[
            ToolDefinition(
                name="crackmapexec",
                command_template="crackmapexec {protocol} {target} {args}",
                container=_env("CONTAINER_POSTEX_PRIMARY", "rtpi-empire-agent"),
                description="Network auth testing and post-ex (SMB/LDAP/WinRM/SSH)",
            ),
            ToolDefinition(
                name="evil-winrm",
                command_template="evil-winrm -i {target} -u {username} -p {password}",
                container=_env("CONTAINER_POSTEX_PRIMARY", "rtpi-empire-agent"),
                description="WinRM shell for lateral movement",
            ),
            ToolDefinition(
                name="chisel",
                command_template="chisel {args}",
                container=_env("CONTAINER_POSTEX_PRIMARY", "rtpi-empire-agent"),
                description="TCP/UDP tunneling over HTTP",
            ),
            ToolDefinition(
                name="ligolo-ng",
                command_template="ligolo-ng {args}",
                container=_env("CONTAINER_POSTEX_PRIMARY", "rtpi-empire-agent"),
                description="Tunneling/pivoting using a TUN interface",
            ),
            ToolDefinition(
                name="pwncat",
                command_template="pwncat-cs {args}",
                container=_env("CONTAINER_POSTEX_PRIMARY", "rtpi-empire-agent"),
                description="Post-exploitation platform with auto-enumeration",
            ),
            ToolDefinition(
                name="impacket-psexec",
                command_template="impacket-psexec {username}:{password}@{target}",
                container=_env("CONTAINER_POSTEX_PRIMARY", "rtpi-empire-agent"),
                description="Remote command execution via SMB",
            ),
            ToolDefinition(
                name="mimikatz",
                command_template="mimikatz '{args}'",
                container=_env("CONTAINER_POSTEX_PRIMARY", "rtpi-empire-agent"),
                description="Credential extraction from Windows memory",
            ),
        ],
        skills_domains=["offensive"],
        mitre_tactics=["TA0008", "TA0003", "TA0011"],  # Lateral Movement, Persistence, C2
    ),

    # ======================================================================
    # REVERSE ENGINEERING AGENT
    # Primary: offsec-maldev (radare2, angr, pwntools, capstone, unicorn, yara)
    # Supporting: ghidra-headless, aflplusplus
    # ======================================================================
    AgentRole.REV_ENG: AgentToolMapping(
        role=AgentRole.REV_ENG,
        primary_container=_env("CONTAINER_RE_PRIMARY", "rtpi-maldev-agent"),
        supporting_containers=[
            _env("CONTAINER_RE_GHIDRA", "rtpi-ghidra"),
            _env("CONTAINER_RE_FUZZING", "rtpi-aflplusplus"),
        ],
        tools=[
            ToolDefinition(
                name="radare2",
                command_template="r2 -q -c '{args}' {binary}",
                container=_env("CONTAINER_RE_PRIMARY", "rtpi-maldev-agent"),
                description="Binary analysis and disassembly",
            ),
            ToolDefinition(
                name="ghidra-analyze",
                command_template="/opt/ghidra/support/analyzeHeadless /tmp/ghidra-project proj -import {binary} -postScript /scripts/analyze.py -scriptPath /scripts",
                container=_env("CONTAINER_RE_GHIDRA", "rtpi-ghidra"),
                timeout=900,
                description="Ghidra headless decompilation and analysis",
            ),
            ToolDefinition(
                name="binwalk",
                command_template="binwalk -e -M {binary} -C /findings/binwalk-output",
                container=_env("CONTAINER_RE_PRIMARY", "rtpi-maldev-agent"),
                description="Firmware extraction and embedded file analysis",
            ),
            ToolDefinition(
                name="yara",
                command_template="yara -r /opt/tools/yara-rules/ {binary}",
                container=_env("CONTAINER_RE_PRIMARY", "rtpi-maldev-agent"),
                description="Pattern matching for malware identification",
            ),
            ToolDefinition(
                name="aflplusplus",
                command_template="afl-fuzz -i /samples/input -o /findings/afl-output -- {binary}",
                container=_env("CONTAINER_RE_FUZZING", "rtpi-aflplusplus"),
                timeout=3600,
                description="Coverage-guided fuzzing",
            ),
            ToolDefinition(
                name="gdb",
                command_template="gdb -batch -ex '{args}' {binary}",
                container=_env("CONTAINER_RE_PRIMARY", "rtpi-maldev-agent"),
                description="GNU debugger for dynamic analysis",
            ),
        ],
        skills_domains=["reverse-engineering"],
        mitre_tactics=["TA0005", "TA0002"],  # Defense Evasion, Execution
    ),

    # ======================================================================
    # CODE REVIEW / SECURITY ARCHITECTURE AGENT
    # Primary: offsec-framework (semgrep, bandit, trivy, grype, snyk, etc.)
    # ======================================================================
    AgentRole.CODE_REVIEW: AgentToolMapping(
        role=AgentRole.CODE_REVIEW,
        primary_container=_env("CONTAINER_CODEREVIEW", "rtpi-framework-agent"),
        tools=[
            ToolDefinition(
                name="semgrep",
                command_template="semgrep --config auto {target} --json -o /findings/semgrep-output.json",
                container=_env("CONTAINER_CODEREVIEW", "rtpi-framework-agent"),
                parse_format="json",
                timeout=600,
                description="SAST — multi-language pattern matching",
            ),
            ToolDefinition(
                name="bandit",
                command_template="bandit -r {target} -f json -o /findings/bandit-output.json",
                container=_env("CONTAINER_CODEREVIEW", "rtpi-framework-agent"),
                parse_format="json",
                description="Python-specific SAST scanner",
            ),
            ToolDefinition(
                name="trivy",
                command_template="trivy fs {target} --format json --output /findings/trivy-output.json",
                container=_env("CONTAINER_CODEREVIEW", "rtpi-framework-agent"),
                parse_format="json",
                description="Container image and filesystem vulnerability scanner",
            ),
            ToolDefinition(
                name="grype",
                command_template="grype {target} -o json --file /findings/grype-output.json",
                container=_env("CONTAINER_CODEREVIEW", "rtpi-framework-agent"),
                parse_format="json",
                description="Container image vulnerability scanner",
            ),
            ToolDefinition(
                name="osv-scanner",
                command_template="osv-scanner --json -r {target} > /findings/osv-output.json",
                container=_env("CONTAINER_CODEREVIEW", "rtpi-framework-agent"),
                parse_format="json",
                description="OSV.dev vulnerability database scanner",
            ),
            ToolDefinition(
                name="brakeman",
                command_template="brakeman {target} -f json -o /findings/brakeman-output.json",
                container=_env("CONTAINER_CODEREVIEW", "rtpi-framework-agent"),
                parse_format="json",
                description="Ruby on Rails SAST scanner",
            ),
        ],
        skills_domains=["code-review", "devsecops", "supply-chain"],
        mitre_tactics=["TA0043"],
    ),

    # ======================================================================
    # VULN RESEARCH AGENT
    # Primary: offsec-research (masscan, scapy, exploitdb, JupyterLab)
    # Supporting: offsec-maldev (oss-fuzz-gen, winafl, fuzzing tools)
    # ======================================================================
    AgentRole.VULN_RESEARCH: AgentToolMapping(
        role=AgentRole.VULN_RESEARCH,
        primary_container=_env("CONTAINER_VULNRESEARCH", "rtpi-research-agent"),
        supporting_containers=[
            _env("CONTAINER_RE_PRIMARY", "rtpi-maldev-agent"),
            _env("CONTAINER_RE_FUZZING", "rtpi-aflplusplus"),
        ],
        tools=[
            ToolDefinition(
                name="masscan",
                command_template="masscan {target} -p{ports} --rate 10000 -oJ /findings/masscan-{target}.json",
                container=_env("CONTAINER_VULNRESEARCH", "rtpi-research-agent"),
                parse_format="json",
                timeout=600,
                description="High-speed port scanner",
            ),
            ToolDefinition(
                name="searchsploit",
                command_template="searchsploit {args} --json",
                container=_env("CONTAINER_VULNRESEARCH", "rtpi-research-agent"),
                parse_format="json",
                description="ExploitDB local search",
            ),
            ToolDefinition(
                name="scapy",
                command_template="python3 -c 'from scapy.all import *; {args}'",
                container=_env("CONTAINER_VULNRESEARCH", "rtpi-research-agent"),
                description="Packet crafting and protocol testing",
            ),
        ],
        skills_domains=["vulnerability-research"],
        mitre_tactics=["TA0043", "TA0001"],
    ),

    # ======================================================================
    # LLM SECURITY AGENT
    # Primary: offsec-llm-sec (promptfoo, garak, modelscan, deepeval)
    # ======================================================================
    AgentRole.LLM_SECURITY: AgentToolMapping(
        role=AgentRole.LLM_SECURITY,
        primary_container=_env("CONTAINER_LLM_SECURITY", "rtpi-llm-sec-agent"),
        tools=[
            ToolDefinition(
                name="promptfoo",
                command_template="promptfoo eval {args} -o /findings/promptfoo-output.json",
                container=_env("CONTAINER_LLM_SECURITY", "rtpi-llm-sec-agent"),
                parse_format="json",
                description="LLM prompt testing and red teaming",
            ),
            ToolDefinition(
                name="garak",
                command_template="garak {args}",
                container=_env("CONTAINER_LLM_SECURITY", "rtpi-llm-sec-agent"),
                description="LLM vulnerability scanner",
            ),
            ToolDefinition(
                name="modelscan",
                command_template="modelscan scan -p {target}",
                container=_env("CONTAINER_LLM_SECURITY", "rtpi-llm-sec-agent"),
                description="ML model security scanner (pickle/safetensors)",
            ),
        ],
        skills_domains=["general"],
        mitre_tactics=[],
    ),

    # ======================================================================
    # REPORTING AGENT
    # Uses SysReptor + ATT&CK Workbench (external services, not docker exec)
    # ======================================================================
    AgentRole.REPORTING: AgentToolMapping(
        role=AgentRole.REPORTING,
        primary_container="rtpi-sysreptor-app",  # HTTP API, not exec
        supporting_containers=["rtpi-workbench-api"],
        tools=[],  # Reporting agent uses HTTP APIs, not CLI tools
        skills_domains=["reporting"],
        mitre_tactics=[],
    ),
}


# ---------------------------------------------------------------------------
# Lookup Helpers
# ---------------------------------------------------------------------------

def get_agent_mapping(role: AgentRole) -> AgentToolMapping:
    """Get the tool mapping for an agent role."""
    return AGENT_REGISTRY[role]


def get_tool(role: AgentRole, tool_name: str) -> ToolDefinition | None:
    """Look up a specific tool by agent role and tool name."""
    mapping = AGENT_REGISTRY.get(role)
    if not mapping:
        return None
    for tool in mapping.tools:
        if tool.name == tool_name:
            return tool
    return None


def get_all_containers() -> set[str]:
    """Get the set of all container names referenced in the registry."""
    containers = set()
    for mapping in AGENT_REGISTRY.values():
        containers.add(mapping.primary_container)
        containers.update(mapping.supporting_containers)
    return containers


def get_tools_for_container(container_name: str) -> list[ToolDefinition]:
    """Get all tools that execute inside a specific container."""
    tools = []
    for mapping in AGENT_REGISTRY.values():
        for tool in mapping.tools:
            if tool.container == container_name:
                tools.append(tool)
    return tools
