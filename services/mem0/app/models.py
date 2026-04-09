"""
Pydantic models for the mem0 REST API.
"""

from pydantic import BaseModel, Field
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------

class AddMemoryRequest(BaseModel):
    """Request to store a finding/observation in mem0."""
    content: str = Field(..., description="The finding or observation text")
    engagement_id: str = Field(..., description="Engagement scope (user_id)")
    agent_id: Optional[str] = Field(None, description="Agent that produced this finding")
    session_id: Optional[str] = Field(None, description="Session/run scope (run_id)")
    metadata: Optional[dict[str, Any]] = Field(None, description="Structured metadata")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "content": "Host 10.0.0.5 running Apache 2.4.49 on port 443. Vulnerable to CVE-2021-41773 (path traversal RCE).",
                    "engagement_id": "acme-2026-q2",
                    "agent_id": "recon_agent",
                    "session_id": "scan-001",
                    "metadata": {
                        "severity": "critical",
                        "confidence": "verified",
                        "domain": "web",
                        "technique": "T1190",
                        "cvss": 9.8,
                        "status": "open",
                        "target_host": "10.0.0.5",
                        "target_port": "443",
                    },
                }
            ]
        }
    }


class SearchMemoryRequest(BaseModel):
    """Semantic search request across engagement memories."""
    query: str = Field(..., description="Natural language search query")
    engagement_id: str = Field(..., description="Engagement scope")
    agent_id: Optional[str] = Field(None, description="Filter to specific agent's findings")
    filters: Optional[dict[str, Any]] = Field(None, description="Metadata filters (AND/OR)")
    limit: int = Field(20, ge=1, le=200, description="Max results to return")


class DeleteMemoryRequest(BaseModel):
    """Request to delete all memories for an engagement."""
    engagement_id: str = Field(..., description="Engagement to purge")


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    mem0_initialized: bool
    version: str


class MemoryStatsResponse(BaseModel):
    total_memories: int
    engagement_id: Optional[str] = None


class AddMemoryResponse(BaseModel):
    success: bool
    memory_id: Optional[str] = None
    result: Optional[Any] = None


class SearchMemoryResponse(BaseModel):
    results: list[Any]
    query: str
    engagement_id: str


class GetMemoryResponse(BaseModel):
    memories: list[Any]
    engagement_id: str
    agent_id: Optional[str] = None
