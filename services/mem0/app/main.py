"""
RTPI mem0 API Service
=====================
Exposes mem0's memory operations as a REST API for the TypeScript backend.
Handles engagement-scoped, agent-scoped, and session-scoped memory.
"""

import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from mem0 import Memory

from .config import settings
from .models import (
    AddMemoryRequest,
    AddMemoryResponse,
    SearchMemoryRequest,
    SearchMemoryResponse,
    GetMemoryResponse,
    DeleteMemoryRequest,
    HealthResponse,
    MemoryStatsResponse,
)

logger = structlog.get_logger()

# Global memory instance — initialized at startup
memory: Memory | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize mem0 on startup, cleanup on shutdown."""
    global memory
    logger.info("Initializing mem0 memory backend", config=settings.llm_provider)
    try:
        mem0_config = settings.to_mem0_config()
        memory = Memory.from_config(mem0_config)
        logger.info("mem0 initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize mem0", error=str(e))
        raise
    yield
    logger.info("Shutting down mem0 service")


app = FastAPI(
    title="RTPI Memory Service",
    description="mem0-backed persistent memory for red team engagements",
    version="2.5.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Health & Stats
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Service health check."""
    return HealthResponse(
        status="healthy" if memory is not None else "unhealthy",
        mem0_initialized=memory is not None,
        version="2.5.0",
    )


@app.get("/stats", response_model=MemoryStatsResponse)
async def memory_stats(engagement_id: str | None = None):
    """Get memory statistics, optionally scoped to an engagement."""
    if memory is None:
        raise HTTPException(status_code=503, detail="mem0 not initialized")
    try:
        if engagement_id:
            all_memories = memory.get_all(user_id=engagement_id)
        else:
            all_memories = memory.get_all()
        return MemoryStatsResponse(
            total_memories=len(all_memories.get("results", [])),
            engagement_id=engagement_id,
        )
    except Exception as e:
        logger.error("Failed to get stats", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Memory CRUD
# ---------------------------------------------------------------------------

@app.post("/memory/add", response_model=AddMemoryResponse)
async def add_memory(req: AddMemoryRequest):
    """
    Store a finding or observation in mem0.

    Scoping:
      - user_id  = engagement ID (e.g., "acme-2026-q2")
      - agent_id = agent role   (e.g., "recon_agent")
      - run_id   = session ID   (e.g., "scan-001")
    """
    if memory is None:
        raise HTTPException(status_code=503, detail="mem0 not initialized")

    try:
        messages = [{"role": "assistant", "content": req.content}]
        kwargs = {
            "user_id": req.engagement_id,
        }
        if req.agent_id:
            kwargs["agent_id"] = req.agent_id
        if req.session_id:
            kwargs["run_id"] = req.session_id
        if req.metadata:
            kwargs["metadata"] = req.metadata

        result = memory.add(messages=messages, **kwargs)
        logger.info(
            "Memory added",
            engagement=req.engagement_id,
            agent=req.agent_id,
        )
        return AddMemoryResponse(
            success=True,
            memory_id=result.get("id") if isinstance(result, dict) else None,
            result=result,
        )
    except Exception as e:
        logger.error("Failed to add memory", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/memory/search", response_model=SearchMemoryResponse)
async def search_memory(req: SearchMemoryRequest):
    """
    Semantic search across engagement memories.
    Supports metadata filters for severity, domain, technique, etc.
    """
    if memory is None:
        raise HTTPException(status_code=503, detail="mem0 not initialized")

    try:
        kwargs = {
            "query": req.query,
            "user_id": req.engagement_id,
            "limit": req.limit,
        }
        if req.agent_id:
            kwargs["agent_id"] = req.agent_id
        if req.filters:
            kwargs["filters"] = req.filters

        results = memory.search(**kwargs)
        return SearchMemoryResponse(
            results=results.get("results", []) if isinstance(results, dict) else results,
            query=req.query,
            engagement_id=req.engagement_id,
        )
    except Exception as e:
        logger.error("Failed to search memory", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memory/all/{engagement_id}", response_model=GetMemoryResponse)
async def get_all_memories(engagement_id: str, agent_id: str | None = None):
    """Retrieve all memories for an engagement, optionally filtered by agent."""
    if memory is None:
        raise HTTPException(status_code=503, detail="mem0 not initialized")

    try:
        kwargs = {"user_id": engagement_id}
        if agent_id:
            kwargs["agent_id"] = agent_id
        results = memory.get_all(**kwargs)
        return GetMemoryResponse(
            memories=results.get("results", []) if isinstance(results, dict) else results,
            engagement_id=engagement_id,
            agent_id=agent_id,
        )
    except Exception as e:
        logger.error("Failed to get memories", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/memory/{memory_id}")
async def delete_memory(memory_id: str):
    """Delete a specific memory by ID."""
    if memory is None:
        raise HTTPException(status_code=503, detail="mem0 not initialized")

    try:
        memory.delete(memory_id)
        return {"success": True, "deleted": memory_id}
    except Exception as e:
        logger.error("Failed to delete memory", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/memory/delete-engagement")
async def delete_engagement_memories(req: DeleteMemoryRequest):
    """Delete all memories for an engagement (use with caution)."""
    if memory is None:
        raise HTTPException(status_code=503, detail="mem0 not initialized")

    try:
        memory.delete_all(user_id=req.engagement_id)
        logger.warning("All memories deleted", engagement=req.engagement_id)
        return {"success": True, "engagement_id": req.engagement_id}
    except Exception as e:
        logger.error("Failed to delete engagement memories", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Graph-Specific Queries
# ---------------------------------------------------------------------------

@app.post("/memory/attack-paths")
async def get_attack_paths(
    engagement_id: str,
    source: str | None = None,
    destination: str | None = None,
):
    """Query graph memory for attack paths between hosts."""
    if memory is None:
        raise HTTPException(status_code=503, detail="mem0 not initialized")

    query = "Show all attack paths and lateral movement chains"
    if source and destination:
        query = f"What attack paths exist from {source} to {destination}?"
    elif source:
        query = f"What attack paths originate from {source}?"

    try:
        results = memory.search(
            query=query,
            user_id=engagement_id,
            limit=50,
        )
        return {
            "paths": results.get("results", []) if isinstance(results, dict) else results,
            "engagement_id": engagement_id,
            "source": source,
            "destination": destination,
        }
    except Exception as e:
        logger.error("Failed to query attack paths", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/memory/critical-vulns")
async def get_critical_vulns(engagement_id: str):
    """Retrieve all open critical/high vulnerabilities for an engagement."""
    if memory is None:
        raise HTTPException(status_code=503, detail="mem0 not initialized")

    try:
        results = memory.search(
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
        return {
            "vulnerabilities": results.get("results", []) if isinstance(results, dict) else results,
            "engagement_id": engagement_id,
        }
    except Exception as e:
        logger.error("Failed to query critical vulns", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
