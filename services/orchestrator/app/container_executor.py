"""
Container Executor Service
============================
Executes tools inside Docker containers via the Docker socket.
The orchestrator runs commands in existing offsec-agent containers
using `docker exec`, captures output, and returns structured results.
"""

import asyncio
import json
import structlog
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import docker
from docker.errors import NotFound, APIError

from .tool_registry import ToolDefinition, AgentRole, get_agent_mapping, get_tool

logger = structlog.get_logger()

# Docker client — initialized lazily
_docker_client: docker.DockerClient | None = None


def _get_docker() -> docker.DockerClient:
    """Get or create Docker client from socket."""
    global _docker_client
    if _docker_client is None:
        _docker_client = docker.from_env()
    return _docker_client


@dataclass
class ToolResult:
    """Result from a tool execution inside a container."""
    tool_name: str
    container: str
    command: str
    exit_code: int
    stdout: str
    stderr: str
    started_at: str
    completed_at: str
    duration_seconds: float
    parsed_output: Optional[dict | list] = None
    error: Optional[str] = None

    @property
    def success(self) -> bool:
        return self.exit_code == 0


async def execute_tool(
    agent_role: AgentRole,
    tool_name: str,
    params: dict[str, str],
    timeout_override: Optional[int] = None,
) -> ToolResult:
    """
    Execute a registered tool inside its mapped container.

    Args:
        agent_role: Which agent is requesting the tool
        tool_name: Name of the tool from the registry
        params: Template parameters (target, args, username, etc.)
        timeout_override: Override the default timeout

    Returns:
        ToolResult with stdout, stderr, exit code, and optionally parsed output
    """
    tool = get_tool(agent_role, tool_name)
    if tool is None:
        return ToolResult(
            tool_name=tool_name,
            container="",
            command="",
            exit_code=-1,
            stdout="",
            stderr=f"Tool '{tool_name}' not found for agent '{agent_role.value}'",
            started_at=datetime.now(timezone.utc).isoformat(),
            completed_at=datetime.now(timezone.utc).isoformat(),
            duration_seconds=0,
            error=f"Tool not registered",
        )

    # Build the command from the template
    try:
        command = tool.command_template.format(**params)
    except KeyError as e:
        return ToolResult(
            tool_name=tool_name,
            container=tool.container,
            command=tool.command_template,
            exit_code=-1,
            stdout="",
            stderr=f"Missing parameter: {e}",
            started_at=datetime.now(timezone.utc).isoformat(),
            completed_at=datetime.now(timezone.utc).isoformat(),
            duration_seconds=0,
            error=f"Missing template parameter: {e}",
        )

    timeout = timeout_override or tool.timeout
    started_at = datetime.now(timezone.utc)

    logger.info(
        "Executing tool",
        tool=tool_name,
        container=tool.container,
        agent=agent_role.value,
    )

    # Run in executor to avoid blocking the event loop
    result = await asyncio.get_event_loop().run_in_executor(
        None,
        _docker_exec,
        tool.container,
        command,
        timeout,
    )

    completed_at = datetime.now(timezone.utc)
    duration = (completed_at - started_at).total_seconds()

    tool_result = ToolResult(
        tool_name=tool_name,
        container=tool.container,
        command=command,
        exit_code=result["exit_code"],
        stdout=result["stdout"],
        stderr=result["stderr"],
        started_at=started_at.isoformat(),
        completed_at=completed_at.isoformat(),
        duration_seconds=duration,
        error=result.get("error"),
    )

    # Try to parse structured output
    if tool_result.success and tool.parse_format != "text":
        tool_result.parsed_output = _try_parse(
            tool_result.stdout,
            tool.parse_format,
        )

    logger.info(
        "Tool execution complete",
        tool=tool_name,
        exit_code=tool_result.exit_code,
        duration=f"{duration:.1f}s",
    )

    return tool_result


def _docker_exec(
    container_name: str,
    command: str,
    timeout: int,
) -> dict:
    """
    Execute a command inside a running Docker container.
    Runs synchronously (called from executor).
    """
    client = _get_docker()

    try:
        container = client.containers.get(container_name)
    except NotFound:
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Container '{container_name}' not found",
            "error": "container_not_found",
        }
    except APIError as e:
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e),
            "error": "docker_api_error",
        }

    if container.status != "running":
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Container '{container_name}' is {container.status}, not running",
            "error": "container_not_running",
        }

    try:
        exec_result = container.exec_run(
            cmd=["bash", "-c", command],
            demux=True,
            environment={
                "TERM": "dumb",
                "COLUMNS": "200",
            },
        )

        stdout = ""
        stderr = ""
        if exec_result.output:
            if isinstance(exec_result.output, tuple):
                stdout = (exec_result.output[0] or b"").decode("utf-8", errors="replace")
                stderr = (exec_result.output[1] or b"").decode("utf-8", errors="replace")
            else:
                stdout = exec_result.output.decode("utf-8", errors="replace")

        return {
            "exit_code": exec_result.exit_code,
            "stdout": stdout,
            "stderr": stderr,
        }

    except APIError as e:
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e),
            "error": "exec_failed",
        }


def _try_parse(output: str, fmt: str) -> dict | list | None:
    """Attempt to parse tool output into structured data."""
    if fmt == "json":
        try:
            return json.loads(output)
        except json.JSONDecodeError:
            # Try JSONL (one JSON object per line)
            lines = []
            for line in output.strip().split("\n"):
                line = line.strip()
                if line:
                    try:
                        lines.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
            return lines if lines else None

    if fmt == "nmap-xml":
        # Return raw XML — the agent node's parser handles it
        return {"format": "nmap-xml", "raw": output}

    if fmt == "xml":
        return {"format": "xml", "raw": output}

    return None


# ---------------------------------------------------------------------------
# Batch Execution (parallel fan-out)
# ---------------------------------------------------------------------------

async def execute_tools_parallel(
    agent_role: AgentRole,
    tool_params: list[tuple[str, dict[str, str]]],
    max_concurrent: int = 5,
) -> list[ToolResult]:
    """
    Execute multiple tools in parallel with concurrency limit.

    Args:
        agent_role: Agent requesting the tools
        tool_params: List of (tool_name, params) tuples
        max_concurrent: Max simultaneous executions

    Returns:
        List of ToolResults in the same order as input
    """
    semaphore = asyncio.Semaphore(max_concurrent)

    async def _bounded_exec(tool_name: str, params: dict) -> ToolResult:
        async with semaphore:
            return await execute_tool(agent_role, tool_name, params)

    tasks = [
        _bounded_exec(tool_name, params)
        for tool_name, params in tool_params
    ]

    return await asyncio.gather(*tasks)


# ---------------------------------------------------------------------------
# Container Health Check
# ---------------------------------------------------------------------------

async def check_container_health(container_name: str) -> dict:
    """Check if a tool container is running and accessible."""
    result = await asyncio.get_event_loop().run_in_executor(
        None,
        _check_container,
        container_name,
    )
    return result


def _check_container(container_name: str) -> dict:
    """Synchronous container health check."""
    client = _get_docker()
    try:
        container = client.containers.get(container_name)
        return {
            "container": container_name,
            "status": container.status,
            "healthy": container.status == "running",
            "image": container.image.tags[0] if container.image.tags else "unknown",
        }
    except NotFound:
        return {
            "container": container_name,
            "status": "not_found",
            "healthy": False,
        }
    except APIError as e:
        return {
            "container": container_name,
            "status": "error",
            "healthy": False,
            "error": str(e),
        }


async def check_all_agent_containers(agent_role: AgentRole) -> list[dict]:
    """Check health of all containers mapped to an agent role."""
    mapping = get_agent_mapping(agent_role)
    containers = [mapping.primary_container] + mapping.supporting_containers
    tasks = [check_container_health(c) for c in containers]
    return await asyncio.gather(*tasks)
