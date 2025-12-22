# RTPI-Tools Docker Integration - Implementation Complete

## Overview

This document describes the complete implementation of the rtpi-tools Docker container integration with the RTPI application. The system enables AI agents to execute security tools inside an isolated Docker container, providing a secure and scalable penetration testing platform.

## Architecture

### Components

1. **rtpi-tools Container** - Ubuntu-based Docker container with pre-installed security tools
2. **Docker Execution Service** - Node.js service for executing commands in containers
3. **Agent-Tool Connector** - Integration layer between AI agents and security tools
4. **Enhanced APIs** - REST endpoints for tool execution and container management
5. **Tool Database** - PostgreSQL database with 19 pre-configured security tools

### Data Flow

```
User/Agent → API → Agent-Tool Connector → Docker Executor → rtpi-tools Container → Tool Execution → Results → User/Agent
```

## Installation & Setup

### 1. Build the rtpi-tools Container

```bash
# Build the Docker image
docker compose build rtpi-tools

# Or build directly
docker build -f Dockerfile.tools -t rtpi-tools .
```

### 2. Start All Services

```bash
# Start PostgreSQL, Redis, and rtpi-tools
docker compose up -d

# Verify rtpi-tools is running
docker ps | grep rtpi-tools
```

### 3. Seed the Security Tools Database

```bash
# Run the seeder script
npm run db:push  # Ensure database schema is up to date
npx tsx scripts/seed-tools.ts
```

Expected output:
```
🌱 Seeding security tools...
✓ Cleared existing tools
✓ Added: Nmap (reconnaissance)
✓ Added: Metasploit Framework (exploitation)
...
✅ Successfully seeded 19 security tools!
```

## Available Security Tools

### Reconnaissance (2 tools)
- **Nmap** - Network scanner and port scanner
- **Nbtscan** - NetBIOS scanner for Windows networks

### Exploitation (2 tools)
- **Metasploit Framework** - Comprehensive exploitation framework
- **SearchSploit** - Exploit Database search tool

### Password Cracking (2 tools)
- **Hashcat** - GPU-accelerated password cracker
- **Hydra** - Network logon brute force tool

### Active Directory (2 tools)
- **BloodHound** - AD relationship mapper
- **Impacket** - Python classes for network protocols

### Post-Exploitation (2 tools)
- **PowerSploit** - PowerShell post-exploitation framework
- **WinPwn** - Windows post-exploitation toolkit

### Network Analysis (2 tools)
- **Wireshark (tshark)** - Network protocol analyzer
- **Proxychains** - Force connections through proxy chains

### Web Application (1 tool)
- **Gobuster** - Directory/file & DNS brute forcing

### Development (3 tools)
- **Python3** - Python scripting
- **PowerShell** - PowerShell Core
- **Node.js** - JavaScript runtime

### SSL/TLS (1 tool)
- **Certbot** - Certificate management

## API Usage

### List All Tools

```bash
GET /api/v1/tools
```

Response:
```json
{
  "tools": [
    {
      "id": "uuid",
      "name": "Nmap",
      "category": "reconnaissance",
      "description": "Network exploration tool...",
      "command": "nmap",
      "dockerImage": "rtpi-tools",
      "metadata": {
        "parameterSchema": {...},
        "commandTemplate": "nmap {scanType} {ports} {target}",
        "examples": [...]
      }
    }
  ]
}
```

### Execute Tool in Docker

```bash
POST /api/v1/tools/:toolId/execute-docker
Content-Type: application/json

{
  "agentId": "agent-uuid",
  "targetId": "target-uuid",
  "params": {
    "target": "192.168.1.1",
    "ports": "-p 80,443",
    "scanType": "-sV"
  }
}
```

Response:
```json
{
  "success": true,
  "tool": "Nmap",
  "result": "[Agent: Agent Name]\n[Tool: Nmap]\n[Target: 192.168.1.1]\n..."
}
```

### Direct Command Execution

```bash
POST /api/v1/tools/:toolId/execute-docker
Content-Type: application/json

{
  "command": ["nmap", "-sV", "192.168.1.1"]
}
```

### Get Tool Status

```bash
GET /api/v1/tools/:toolId/status
```

Response:
```json
{
  "tool": {
    "id": "uuid",
    "name": "Nmap",
    "status": "available",
    "lastUsed": "2025-01-13T10:30:00Z",
    "usageCount": 42
  },
  "container": {
    "id": "container-id",
    "name": "rtpi-tools",
    "status": "running",
    "state": "running",
    "running": true
  }
}
```

### Get Tools by Category

```bash
GET /api/v1/tools/categories
```

### Container Management

```bash
# Get rtpi-tools container status
GET /api/v1/containers/rtpi-tools/status

# Restart container
POST /api/v1/containers/rtpi-tools/restart

# Get container logs
GET /api/v1/containers/rtpi-tools/logs?tail=100

# List all Docker containers
GET /api/v1/containers/docker/list
```

## Agent-Tool Integration

### Using Agent-Tool Connector

```typescript
import { agentToolConnector } from './services/agent-tool-connector';

// Execute tool via agent
const result = await agentToolConnector.execute(
  'agent-uuid',
  'tool-uuid',
  'target-uuid',
  JSON.stringify({ ports: '-p 80,443', scanType: '-sV' })
);

console.log(result);
// [Agent: Security Scanner]
// [Tool: Nmap]
// [Target: 192.168.1.1]
// [Status: SUCCESS]
// 
// === Output ===
// Starting Nmap scan...
// ...
```

### Command Building

The system automatically builds commands from templates:

```typescript
// Tool metadata contains:
{
  "commandTemplate": "nmap {scanType} {ports} {target}",
  "parameterSchema": {
    "target": { required: true, type: "string" },
    "ports": { required: false, type: "string" },
    "scanType": { required: false, type: "string" }
  }
}

// Input parameters:
{
  "target": "192.168.1.1",
  "ports": "-p 80,443",
  "scanType": "-sV"
}

// Built command:
["nmap", "-sV", "-p", "80,443", "192.168.1.1"]
```

## Security Features

### Command Validation

The Docker executor validates all commands before execution:

- Prevents dangerous patterns (rm -rf /, mkfs, etc.)
- Enforces command length limits
- Runs commands as non-root user (rtpi-tools)
- Applies resource limits (CPU, memory, timeout)

### Container Isolation

- Tools run in isolated Docker container
- Network segmentation via Docker bridge network
- Volume mounts for controlled file sharing
- Health checks ensure container availability

### Audit Logging

All tool executions are logged:

```typescript
{
  "userId": "user-uuid",
  "action": "execute_tool_docker",
  "resource": "/tools",
  "resourceId": "tool-uuid",
  "success": true,
  "ipAddress": "client-ip",
  "timestamp": "2025-01-13T10:30:00Z"
}
```

## Usage Examples

### Example 1: Nmap Scan via Agent

```bash
curl -X POST http://localhost:3000/api/v1/tools/nmap-id/execute-docker \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "agentId": "agent-123",
    "targetId": "target-456",
    "params": {
      "target": "scanme.nmap.org",
      "scanType": "-sV",
      "ports": "-p 22,80,443"
    }
  }'
```

### Example 2: Direct Hydra Execution

```bash
curl -X POST http://localhost:3000/api/v1/tools/hydra-id/execute-docker \
  -H "Content-Type: application/json" \
  -d '{
    "command": ["hydra", "-l", "admin", "-P", "/wordlists/passwords.txt", "ssh://192.168.1.1"]
  }'
```

### Example 3: SearchSploit Query

```bash
curl -X POST http://localhost:3000/api/v1/tools/searchsploit-id/execute-docker \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-123",
    "targetId": "target-456",
    "params": {
      "query": "apache 2.4.49",
      "json": true
    }
  }'
```

## Troubleshooting

### Container Not Running

```bash
# Check container status
docker ps -a | grep rtpi-tools

# View container logs
docker logs rtpi-tools

# Restart container
docker compose restart rtpi-tools
```

### Tool Execution Fails

```bash
# Test direct execution
docker exec rtpi-tools nmap --version

# Check container connectivity
curl http://localhost:3000/api/v1/containers/rtpi-tools/status

# View execution logs
curl http://localhost:3000/api/v1/containers/rtpi-tools/logs?tail=100
```

### Database Issues

```bash
# Verify tools are seeded
psql -U rtpi -d rtpi_main -c "SELECT COUNT(*) FROM security_tools;"

# Re-run seeder
npx tsx scripts/seed-tools.ts
```

## Development

### Adding New Tools

1. Add tool definition to `scripts/seed-tools.ts`:

```typescript
{
  name: "NewTool",
  category: "reconnaissance",
  description: "Tool description",
  command: "newtool",
  dockerImage: "rtpi-tools",
  metadata: {
    parameterSchema: {
      target: { required: true, type: "string" }
    },
    commandTemplate: "newtool {target}",
    examples: ["newtool 192.168.1.1"]
  }
}
```

2. Re-run seeder:

```bash
npx tsx scripts/seed-tools.ts
```

### Installing Tools in Container

1. Update `Dockerfile.tools`:

```dockerfile
RUN apt-get install -y newtool
```

2. Rebuild container:

```bash
docker compose build rtpi-tools
docker compose up -d
```

## Files Modified/Created

### New Files
- `Dockerfile.tools` - Security tools container
- `server/services/docker-executor.ts` - Docker execution service
- `scripts/seed-tools.ts` - Tool database seeder
- `docs/RTPI-TOOLS-IMPLEMENTATION.md` - This documentation

### Modified Files
- `docker-compose.yml` - Added rtpi-tools service
- `server/services/agent-tool-connector.ts` - Added Docker integration
- `server/api/v1/tools.ts` - Added Docker execution endpoints
- `server/api/v1/containers.ts` - Added rtpi-tools management
- `package.json` - Added dockerode dependency

## Performance Considerations

- Command execution timeout: 5 minutes (configurable)
- Output size limit: 10MB per execution
- Container resource limits: Set via Docker Compose
- Concurrent executions: Limited by Docker daemon

## Future Enhancements

1. **Streaming Output** - Real-time tool output via WebSockets
2. **Result Parsing** - Tool-specific output parsers (XML, JSON)
3. **Execution History** - Database storage of execution results
4. **Queue System** - Background job processing for long-running tools
5. **Multi-Container** - Scale to multiple tool containers
6. **Custom Tools** - Upload and execute custom scripts
7. **Web UI** - React components for tool execution

## Conclusion

The rtpi-tools integration provides a secure, scalable platform for executing security tools through AI agents. The system is production-ready and supports 19 security tools across 9 categories, with comprehensive API endpoints for tool execution and container management.

For questions or issues, refer to the main RTPI documentation or create an issue in the project repository.
