# Agent-Tool Connector System - Implementation Complete

## Date
November 13, 2025 - 3:16 AM CST

## Overview

Successfully adapted attack-node's agent loop system for RTPI, creating a reusable backend connector that can link any AI agent with any security tool.

## Architecture Components

### 1. Agent-Tool Connector Service
**File:** `server/services/agent-tool-connector.ts` (335 lines)

**Purpose:** Generic connector that links AI agents with security tools

**Key Features:**
- ✅ Connects ANY agent type with ANY tool
- ✅ Builds context from agent + tool + target
- ✅ Executes based on agent type (OpenAI, Anthropic, MCP, Custom)
- ✅ Returns formatted results

**Agent Types Supported:**
- `openai` - OpenAI GPT models
- `anthropic` - Anthropic Claude models
- `mcp_server` - MCP server agents
- `custom` - Custom agent implementations

**Usage:**
```typescript
await agentToolConnector.execute(agentId, toolId, targetId, input);
```

### 2. Agent Loop Service
**File:** `server/services/agent-tool-connector.ts` (same file)

**Purpose:** Manages iterative agent-to-agent communication for payload refinement

**Key Features:**
- ✅ Agent pair loops (A ↔ B iterative conversation)
- ✅ Configurable max iterations (default: 5)
- ✅ Exit conditions (functional_poc, vulnerability_confirmed, exploit_successful)
- ✅ Status tracking (running/completed/failed/max_iterations_reached)
- ✅ Iteration history with success tracking

**Loop Configuration:**
```typescript
{
  loopEnabled: true,
  loopPartnerId: "agent-uuid",
  maxLoopIterations: 5,
  loopExitCondition: "functional_poc"
}
```

**Exit Conditions:**
- `functional_poc` - Working proof of concept developed
- `vulnerability_confirmed` - Vulnerability verified
- `exploit_successful` - Exploit working

### 3. Agent Loop API
**File:** `server/api/v1/agent-loops.ts` (95 lines)

**Endpoints:**
- `GET /api/v1/agent-loops` - List active loops
- `GET /api/v1/agent-loops/:id` - Get loop details
- `POST /api/v1/agent-loops/start` - Start new loop
- `POST /api/v1/agent-loops/:id/stop` - Stop running loop

**Request Example:**
```json
POST /api/v1/agent-loops/start
{
  "agentId": "uuid",
  "targetId": "uuid",
  "initialInput": "Analyze this target for SQL injection vulnerabilities"
}
```

**Response:**
```json
{
  "loop": {
    "id": "loop_xxx_yyy_1234567890",
    "agentId": "uuid",
    "partnerId": "uuid",
    "targetId": "uuid",
    "currentIteration": 0,
    "maxIterations": 5,
    "exitCondition": "functional_poc",
    "status": "running",
    "iterations": [],
    "startedAt": "2025-11-13T..."
  }
}
```

## Data Flow

### Agent-Tool Execution
```
1. User triggers agent + tool + target
2. Connector fetches agent config from database
3. Connector fetches tool config from database
4. Connector fetches target info from database
5. Builds execution context
6. Routes to appropriate agent executor
7. Agent processes with tool guidance
8. Returns analysis/results
```

### Agent Loop Execution
```
1. Agent A receives initial input + target
2. Agent A analyzes and generates output
3. Output becomes input for Agent B
4. Agent B refines/enhances
5. Output becomes input for Agent A
6. Continues until exit condition OR max iterations
7. Returns complete iteration history
```

## Database Integration

### Agents Table
```sql
agents (
  id uuid,
  name text,
  type agent_type_enum,  -- openai, anthropic, mcp_server, custom
  status agent_status_enum,  -- idle, running, error, stopped
  config json,  -- { systemPrompt, loopEnabled, loopPartnerId, ... }
  capabilities json,
  ...
)
```

**Config Structure:**
```json
{
  "systemPrompt": "You are a security researcher...",
  "loopEnabled": true,
  "loopPartnerId": "uuid-of-partner-agent",
  "maxLoopIterations": 5,
  "loopExitCondition": "functional_poc",
  "temperature": 0.7,
  "model": "gpt-4"
}
```

### Security Tools Table
```sql
security_tools (
  id uuid,
  name text,
  category text,  -- reconnaissance, exploitation, etc.
  description text,
  command text,  -- CLI command
  dockerImage text,  -- Docker image if containerized
  endpoint text,  -- URL if web-based
  ...
)
```

### Targets Table
```sql
targets (
  id uuid,
  name text,
  type target_type_enum,  -- ip, domain, url, network, range
  value text,  -- actual target (192.168.1.1, example.com, etc.)
  operationId uuid,
  ...
)
```

## Security Considerations

### API Keys Not Displayed
**In attack-node (old):**
- ❌ Shows endpoint URL
- ❌ Shows API key (masked)

**In rtpi (new):**
- ✅ Keys stored in database only
- ✅ Never sent to frontend
- ✅ Only admins can set keys
- ✅ UI shows agent capabilities, not credentials

### Audit Logging
All loop operations logged:
- `start_agent_loop` - When loop starts
- `stop_agent_loop` - When loop stops
- Includes user ID, timestamp, success status

## Frontend Integration (Next Steps)

**To complete, need to:**
1. Update `client/src/pages/Agents.tsx`:
   - Remove endpoint/API key display
   - Add loop configuration UI
   - Add "Start Loop" button
   - Show active loops with real-time status

2. Create `client/src/components/agents/AgentLoopMonitor.tsx`:
   - Display active loops
   - Show iteration progress
   - Stop loop button
   - Iteration history

3. Update agent cards to show:
   - ✅ Name, type, status
   - ✅ Capabilities
   - ✅ Loop partner (if configured)
   - ❌ NO endpoint URL
   - ❌ NO API keys

## API Usage Examples

### Start Agent Loop
```typescript
const response = await api.post("/agent-loops/start", {
  agentId: "agent-uuid-1",
  targetId: "target-uuid",
  initialInput: "Develop SQL injection POC for login form"
});
```

### Monitor Loop Progress
```typescript
const { loops } = await api.get("/agent-loops");

loops.forEach(loop => {
  console.log(`Loop ${loop.id}: ${loop.currentIteration}/${loop.maxIterations}`);
  console.log(`Status: ${loop.status}`);
  loop.iterations.forEach(iter => {
    console.log(`  Iteration ${iter.iteration}: ${iter.success ? '✓' : '✗'}`);
  });
});
```

### Stop Loop
```typescript
await api.post(`/agent-loops/${loopId}/stop`);
```

## Status: Backend Complete ✅

**Backend Implementation:**
- ✅ Agent-Tool Connector (generic, reusable)
- ✅ Agent Loop Service (iterative refinement)
- ✅ API Endpoints (full CRUD)
- ✅ Database Integration
- ✅ Security (admin-only, audit logging)
- ✅ Error Handling

**Frontend Implementation:**
- ⏳ Pending - Need to update Agents page
- ⏳ Pending - Remove sensitive data display
- ⏳ Pending - Add loop configuration UI
- ⏳ Pending - Add loop monitoring

## Files Created

**Backend (3 files):**
1. ✨ `server/services/agent-tool-connector.ts` (335 lines)
   - AgentToolConnector class
   - AgentLoopService class
   - Loop execution logic

2. ✨ `server/api/v1/agent-loops.ts` (95 lines)
   - GET /agent-loops
   - GET /agent-loops/:id
   - POST /agent-loops/start
   - POST /agent-loops/:id/stop

3. ✨ `server/api/v1/settings.ts` (63 lines)
   - GET /settings/llm
   - POST /settings/llm

**Modified:**
- 📝 `server/index.ts` (Registered new endpoints)
- 📝 `client/src/pages/Settings.tsx` (Added LLM keys UI)

**Documentation:**
- ✨ `docs/AGENT-TOOL-CONNECTOR-IMPLEMENTATION.md` (THIS FILE)

## Next Steps (Frontend)

To complete the agent-tool connector UI:

1. **Update Agents page:**
   - Hide endpoint/API key fields
   - Show only: name, type, status, capabilities
   - Add loop configuration section
   - Add "Start Loop" button for loop-enabled agents

2. **Add Active Loops section:**
   - Real-time loop monitoring
   - Progress bars (iteration X of Y)
   - Stop button
   - Iteration history viewer

3. **Create Agent Status Component:**
   - Minimal card design
   - Status indicator (online/offline/error)
   - Capabilities list
   - NO sensitive data

---

*Backend implementation completed: November 13, 2025 - 3:16 AM CST*
*Total backend code: ~493 lines (3 new files, 2 modified)*
*Frontend adaptation: Pending*
