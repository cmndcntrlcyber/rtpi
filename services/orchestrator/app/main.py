"""
RTPI LangGraph Orchestrator API
=================================
Exposes the pentest workflow graph as a REST API.
Manages engagements, approvals, and workflow execution.
"""

import uuid
import structlog
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Any

from .config import settings
from .graph import build_rtpi_graph
from .skills.discovery import build_index

logger = structlog.get_logger()

# Compiled LangGraph — initialized at startup
workflow = None

# Active engagement states (in production: backed by Redis)
active_engagements: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize orchestrator on startup."""
    global workflow
    logger.info("Building skill index", skills_dir=settings.skills_dir)
    build_index(settings.skills_dir)

    logger.info("Compiling LangGraph workflow")
    workflow = build_rtpi_graph()
    logger.info("Orchestrator ready")
    yield
    logger.info("Shutting down orchestrator")


app = FastAPI(
    title="RTPI Orchestrator",
    description="LangGraph-powered pentest workflow orchestration",
    version="2.5.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------

class StartEngagementRequest(BaseModel):
    """Request to start a new pentest engagement."""
    engagement_id: Optional[str] = Field(None, description="Custom ID or auto-generated")
    targets: list[str] = Field(..., description="Target hosts/networks/URLs")
    scope_constraints: list[str] = Field(default_factory=list, description="Rules of engagement")


class StartEngagementResponse(BaseModel):
    engagement_id: str
    session_id: str
    status: str
    targets: list[str]


class ApprovalRequest(BaseModel):
    """Operator approval for exploitation phase."""
    engagement_id: str
    approved: bool
    notes: Optional[str] = None


class EngagementStatusResponse(BaseModel):
    engagement_id: str
    phase: str
    approval_needed: bool
    finding_count: int
    messages: list[dict]


class SkillSearchRequest(BaseModel):
    query: str
    domain: Optional[str] = None
    mitre_technique: Optional[str] = None
    limit: int = Field(10, ge=1, le=50)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    return {
        "status": "healthy" if workflow is not None else "unhealthy",
        "workflow_compiled": workflow is not None,
        "version": "2.5.0",
    }


# ---------------------------------------------------------------------------
# Engagement Management
# ---------------------------------------------------------------------------

@app.post("/engagements/start", response_model=StartEngagementResponse)
async def start_engagement(req: StartEngagementRequest):
    """Start a new pentest engagement workflow."""
    if workflow is None:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")

    engagement_id = req.engagement_id or f"eng-{uuid.uuid4().hex[:8]}"
    session_id = f"session-{uuid.uuid4().hex[:8]}"

    initial_state = {
        "engagement_id": engagement_id,
        "session_id": session_id,
        "targets": req.targets,
        "scope_constraints": req.scope_constraints,
        "phase": "planning",
        "findings": [],
        "skills_used": [],
        "messages": [],
        "errors": [],
        "phase_history": [],
        "approval_needed": False,
        "operator_approved": False,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }

    active_engagements[engagement_id] = initial_state

    logger.info(
        "Engagement started",
        engagement=engagement_id,
        targets=req.targets,
    )

    # TODO: In production, invoke workflow asynchronously
    # For now, store initial state and let the operator drive phases
    # via the /engagements/{id}/advance endpoint

    return StartEngagementResponse(
        engagement_id=engagement_id,
        session_id=session_id,
        status="planning",
        targets=req.targets,
    )


@app.get("/engagements/{engagement_id}", response_model=EngagementStatusResponse)
async def get_engagement_status(engagement_id: str):
    """Get current status of an engagement."""
    state = active_engagements.get(engagement_id)
    if not state:
        raise HTTPException(status_code=404, detail="Engagement not found")

    return EngagementStatusResponse(
        engagement_id=engagement_id,
        phase=state.get("phase", "unknown"),
        approval_needed=state.get("approval_needed", False),
        finding_count=len(state.get("findings", [])),
        messages=state.get("messages", [])[-10:],  # Last 10 messages
    )


@app.post("/engagements/{engagement_id}/approve")
async def approve_exploitation(engagement_id: str, req: ApprovalRequest):
    """Approve or deny exploitation for an engagement."""
    state = active_engagements.get(engagement_id)
    if not state:
        raise HTTPException(status_code=404, detail="Engagement not found")
    if not state.get("approval_needed"):
        raise HTTPException(status_code=400, detail="No approval pending")

    state["operator_approved"] = req.approved
    state["approval_needed"] = False

    logger.info(
        "Exploitation approval",
        engagement=engagement_id,
        approved=req.approved,
        notes=req.notes,
    )

    return {
        "engagement_id": engagement_id,
        "approved": req.approved,
        "next_phase": "exploitation" if req.approved else "reporting",
    }


@app.post("/engagements/{engagement_id}/advance")
async def advance_engagement(engagement_id: str):
    """Advance the engagement to the next phase."""
    state = active_engagements.get(engagement_id)
    if not state:
        raise HTTPException(status_code=404, detail="Engagement not found")

    if state.get("approval_needed"):
        raise HTTPException(status_code=400, detail="Approval required before advancing")

    if state.get("phase") == "complete":
        raise HTTPException(status_code=400, detail="Engagement already complete")

    # TODO: Invoke the next LangGraph node based on current phase
    # In production this runs the compiled graph with checkpointing
    current_phase = state.get("phase", "planning")
    logger.info("Advancing engagement", engagement=engagement_id, from_phase=current_phase)

    return {
        "engagement_id": engagement_id,
        "current_phase": current_phase,
        "status": "advancing",
    }


@app.get("/engagements")
async def list_engagements():
    """List all active engagements."""
    return {
        "engagements": [
            {
                "engagement_id": eid,
                "phase": state.get("phase"),
                "target_count": len(state.get("targets", [])),
                "finding_count": len(state.get("findings", [])),
                "started_at": state.get("started_at"),
            }
            for eid, state in active_engagements.items()
        ]
    }


# ---------------------------------------------------------------------------
# Skill Discovery
# ---------------------------------------------------------------------------

@app.post("/skills/search")
async def search_skills(req: SkillSearchRequest):
    """Search the unified skills library."""
    from .skills.discovery import find_skills

    results = find_skills(
        query=req.query,
        domain=req.domain,
        mitre_technique=req.mitre_technique,
        limit=req.limit,
    )
    return {"results": results, "total": len(results)}


@app.get("/skills/{skill_name}")
async def get_skill(skill_name: str):
    """Get full content of a specific skill."""
    from .skills.discovery import get_skill_content

    content = get_skill_content(skill_name)
    if content is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"name": skill_name, "content": content}


# ---------------------------------------------------------------------------
# Tool Execution
# ---------------------------------------------------------------------------

class ToolExecRequest(BaseModel):
    """Request to execute a tool inside a mapped container."""
    agent_role: str = Field(..., description="Agent role from AgentRole enum")
    tool_name: str = Field(..., description="Tool name from tool registry")
    params: dict[str, str] = Field(..., description="Template parameters (target, args, etc.)")
    timeout: Optional[int] = Field(None, description="Override default timeout")


class BatchToolExecRequest(BaseModel):
    """Request to execute multiple tools in parallel."""
    agent_role: str
    tools: list[dict[str, Any]] = Field(..., description="List of {tool_name, params} dicts")
    max_concurrent: int = Field(5, ge=1, le=20)


@app.post("/tools/execute")
async def execute_single_tool(req: ToolExecRequest):
    """Execute a single tool inside its mapped container."""
    from .tool_registry import AgentRole
    from .container_executor import execute_tool

    try:
        role = AgentRole(req.agent_role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown agent role: {req.agent_role}")

    result = await execute_tool(role, req.tool_name, req.params, req.timeout)
    return {
        "tool": result.tool_name,
        "container": result.container,
        "command": result.command,
        "exit_code": result.exit_code,
        "success": result.success,
        "stdout": result.stdout[:10000],  # Truncate large output
        "stderr": result.stderr[:5000],
        "parsed_output": result.parsed_output,
        "duration_seconds": result.duration_seconds,
        "error": result.error,
    }


@app.post("/tools/execute-batch")
async def execute_batch_tools(req: BatchToolExecRequest):
    """Execute multiple tools in parallel inside their mapped containers."""
    from .tool_registry import AgentRole
    from .container_executor import execute_tools_parallel

    try:
        role = AgentRole(req.agent_role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown agent role: {req.agent_role}")

    tool_params = [(t["tool_name"], t["params"]) for t in req.tools]
    results = await execute_tools_parallel(role, tool_params, req.max_concurrent)

    return {
        "results": [
            {
                "tool": r.tool_name,
                "container": r.container,
                "success": r.success,
                "exit_code": r.exit_code,
                "duration_seconds": r.duration_seconds,
                "error": r.error,
                "stdout_preview": r.stdout[:2000],
                "parsed_output": r.parsed_output,
            }
            for r in results
        ],
        "total": len(results),
        "succeeded": sum(1 for r in results if r.success),
    }


@app.get("/tools/registry")
async def list_tool_registry():
    """List all registered tools grouped by agent role."""
    from .tool_registry import AGENT_REGISTRY

    return {
        role.value: {
            "primary_container": mapping.primary_container,
            "supporting_containers": mapping.supporting_containers,
            "tools": [
                {
                    "name": t.name,
                    "container": t.container,
                    "description": t.description,
                    "timeout": t.timeout,
                    "parse_format": t.parse_format,
                }
                for t in mapping.tools
            ],
            "skills_domains": mapping.skills_domains,
            "mitre_tactics": mapping.mitre_tactics,
        }
        for role, mapping in AGENT_REGISTRY.items()
    }


@app.get("/tools/containers/health")
async def check_all_containers():
    """Check health of all tool containers."""
    from .tool_registry import get_all_containers
    from .container_executor import check_container_health

    containers = get_all_containers()
    import asyncio
    results = await asyncio.gather(*[check_container_health(c) for c in containers])
    return {
        "containers": results,
        "total": len(results),
        "healthy": sum(1 for r in results if r.get("healthy")),
    }


@app.get("/tools/containers/{agent_role}/health")
async def check_agent_containers(agent_role: str):
    """Check health of all containers for a specific agent role."""
    from .tool_registry import AgentRole
    from .container_executor import check_all_agent_containers

    try:
        role = AgentRole(agent_role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown agent role: {agent_role}")

    results = await check_all_agent_containers(role)
    return {"agent": agent_role, "containers": results}
