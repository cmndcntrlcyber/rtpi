"""
RTPI mem0 Service Configuration
Reads from environment variables set in docker-compose.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Mem0Settings(BaseSettings):
    """Configuration for the mem0 memory service."""

    # LLM Provider (for fact extraction)
    llm_provider: str = "ollama"
    llm_model: str = "qwen2.5-coder:7b"
    llm_base_url: str = "http://ollama:11434"
    llm_temperature: float = 0.1

    # Embedder
    embedder_provider: str = "ollama"
    embedder_model: str = "nomic-embed-text"
    embedder_base_url: str = "http://ollama:11434"

    # Vector Store (pgvector)
    vector_provider: str = "pgvector"
    vector_host: str = "postgres"
    vector_port: int = 5432
    vector_dbname: str = "rtpi_memory"
    vector_user: str = "rtpi"
    vector_password: str = "changeme"
    vector_collection: str = "rtpi_findings"

    # Graph Store (Neo4j)
    graph_provider: str = "neo4j"
    graph_url: str = "bolt://neo4j:7687"
    graph_user: str = "neo4j"
    graph_password: str = "changeme"

    # Optional external LLM APIs (fallback)
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None

    class Config:
        env_prefix = "MEM0_"

    def to_mem0_config(self) -> dict:
        """Build mem0 configuration dict from settings."""
        config = {
            "llm": {
                "provider": self.llm_provider,
                "config": {
                    "model": self.llm_model,
                    "temperature": self.llm_temperature,
                },
            },
            "embedder": {
                "provider": self.embedder_provider,
                "config": {
                    "model": self.embedder_model,
                },
            },
            "vector_store": {
                "provider": self.vector_provider,
                "config": {
                    "host": self.vector_host,
                    "port": self.vector_port,
                    "dbname": self.vector_dbname,
                    "user": self.vector_user,
                    "password": self.vector_password,
                    "collection_name": self.vector_collection,
                },
            },
            "graph_store": {
                "provider": self.graph_provider,
                "config": {
                    "url": self.graph_url,
                    "username": self.graph_user,
                    "password": self.graph_password,
                },
            },
            "custom_fact_extraction_prompt": SECURITY_FACT_EXTRACTION_PROMPT,
            "version": "v1.1",
        }

        # Add Ollama base URLs when using Ollama provider
        if self.llm_provider == "ollama":
            config["llm"]["config"]["ollama_base_url"] = self.llm_base_url
        if self.embedder_provider == "ollama":
            config["embedder"]["config"]["ollama_base_url"] = self.embedder_base_url

        return config


SECURITY_FACT_EXTRACTION_PROMPT = """Extract ALL security-relevant facts from the text.

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
-> Facts: Host(10.0.0.5) --RUNS--> Service(Apache/2.4.49, port=443) --VULNERABLE_TO--> CVE(CVE-2021-41773)
"""


settings = Mem0Settings()
