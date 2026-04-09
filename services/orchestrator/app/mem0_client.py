"""
mem0 API Client
================
HTTP client for the mem0 service. Used by all agent nodes
to store and retrieve engagement memories.
"""

import httpx
import structlog
from typing import Any, Optional

from .config import settings

logger = structlog.get_logger()

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=settings.mem0_api_url,
            timeout=30.0,
        )
    return _client


async def mem0_add(
    content: str,
    engagement_id: str,
    agent_id: str | None = None,
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict:
    """Store a finding in mem0."""
    client = _get_client()
    payload = {
        "content": content,
        "engagement_id": engagement_id,
    }
    if agent_id:
        payload["agent_id"] = agent_id
    if session_id:
        payload["session_id"] = session_id
    if metadata:
        payload["metadata"] = metadata

    try:
        resp = await client.post("/memory/add", json=payload)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPError as e:
        logger.error("mem0 add failed", error=str(e))
        return {"success": False, "error": str(e)}


async def mem0_search(
    query: str,
    engagement_id: str,
    agent_id: str | None = None,
    filters: dict | None = None,
    limit: int = 20,
) -> dict:
    """Semantic search across engagement memories."""
    client = _get_client()
    payload = {
        "query": query,
        "engagement_id": engagement_id,
        "limit": limit,
    }
    if agent_id:
        payload["agent_id"] = agent_id
    if filters:
        payload["filters"] = filters

    try:
        resp = await client.post("/memory/search", json=payload)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPError as e:
        logger.error("mem0 search failed", error=str(e))
        return {"results": [], "error": str(e)}


async def mem0_get_all(
    engagement_id: str,
    agent_id: str | None = None,
) -> dict:
    """Get all memories for an engagement."""
    client = _get_client()
    params = {}
    if agent_id:
        params["agent_id"] = agent_id

    try:
        resp = await client.get(f"/memory/all/{engagement_id}", params=params)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPError as e:
        logger.error("mem0 get_all failed", error=str(e))
        return {"memories": [], "error": str(e)}
