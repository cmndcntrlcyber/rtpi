"""
RTPI Orchestrator Configuration
"""

from pydantic_settings import BaseSettings
from typing import Optional


class OrchestratorSettings(BaseSettings):
    """Configuration for the LangGraph orchestrator service."""

    # mem0 API
    mem0_api_url: str = "http://mem0-api:8000"

    # LLM (Ollama default, external optional)
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "qwen2.5-coder:7b"
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None

    # Tool container endpoints
    metasploit_host: str = "attackbox"
    metasploit_port: int = 55553

    # Redis for state checkpointing
    redis_url: str = "redis://redis:6379"

    # Skills directory (mounted volume)
    skills_dir: str = "/app/skills"

    # Execution safety
    require_human_approval_for_exploit: bool = True
    max_parallel_agents: int = 5
    tool_execution_timeout: int = 300

    class Config:
        env_prefix = ""


settings = OrchestratorSettings()
