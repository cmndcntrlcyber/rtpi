<img width="2048" height="2048" alt="image" src="https://github.com/user-attachments/assets/b93f59d5-7f06-43ad-b0f7-4f0255f4f695" />

# Red Team Portable Infrastructure (RTPI)

Unified platform for red team operations, combining attack-node, MCP-Nexus, and pen_attack-node capabilities.

## Quick Start

### Prerequisites
- **Node.js 20+** (check with `node -v`, install via [nvm](https://github.com/nvm-sh/nvm))
- **Docker & Docker Compose**

### Setup

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start database and Redis services
docker compose up -d postgres redis

# 4. Run database migrations
npm run db:push

# 5. Create default admin user
npm run db:create-admin

# 6. Start development servers (two terminals)

# Terminal 1: Backend API
npm run dev

# Terminal 2: Frontend UI
npm run dev:frontend
```

### Port Configuration

Default ports are configured to avoid conflicts with common local services:
- **PostgreSQL:** `5434` (instead of 5432)
- **Redis:** `6381` (instead of 6379)

### Access

- **Frontend UI:** http://localhost:5000
- **Backend API:** http://localhost:3001
- **API Documentation:** http://localhost:3001/api/v1
- **Default credentials:** admin / Admin123!@

> **Security Note:** Change the default admin password after first login!

**Note:** Always access the full application through the frontend URL. The backend API serves JSON responses only.

### Default MCP Servers

When `FF_DEFAULT_MCP_SERVERS=true`, the backend seeds 11 built-in MCP servers into the `mcp_servers` table on first boot ([catalog source](server/services/mcp/default-servers-catalog.ts)). The seed is idempotent — re-runs only fill in missing rows and never overwrite operator edits. Eight servers boot ready; three need a key set on the row before they can start:

| seed_key | Boot ready | Required env var |
|---|---|---|
| `default:playwright`, `default:fetch`, `default:chrome-devtools`, `default:filesystem`, `default:sequential-thinking`, `default:memory`, `default:searchcode`, `default:task-master`, `default:arxiv` | ✅ | — |
| `default:github` | needs config | `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `default:tavily` | needs config | `TAVILY_API_KEY` |

Set the missing values in `.env` (or per-row via the future `PATCH /api/v1/mcp-servers/:id/secrets` once Phase 3 ships) before starting those servers. The lifecycle endpoints (`/start`, `/stop`, `/restart`) work on managed and user-created rows alike. See [docs/enhancements/2.9/v2.9.3-default-mcp-integrations.md](docs/enhancements/2.9/v2.9.3-default-mcp-integrations.md) for the full rollout (REST `/catalog`, `/reset`, frontend panel, etc. — out of scope for the current phase).

### Optional Compose Profiles

Several integrations ship as opt-in services gated behind Docker Compose profiles — they do **not** start with the default `docker compose up`. Bring them up with `docker compose --profile <name> up -d`.

| Profile | Service | Purpose |
|---|---|---|
| `sysreptor` | SysReptor + Caddy + Redis | Penetration-testing reporting platform (UI on :7777). |
| `kasm` | Kasm Workspaces stack | Browser-based desktop streaming for analyst workspaces. |
| `docmost` | Docmost + Redis | Wiki-style team documentation (UI on :13000). |
| `vllm` | vLLM (Qwen3.5-9B) | OpenAI-compatible inference for agent workloads (GPU required). |
| `pdf` | Headless Chromium | App-side PDF generation for reports. |
| `vpn` | VPN Manager | OpenVPN / WireGuard tunnel host (v2.9.2 Phase 1 — container only; UI/backend land in later phases). |
| `gpu` / `cpu` | Ollama | Local LLM inference (pick one based on hardware). |
| `management` | Portainer | Container management UI on :9443. |

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for per-profile configuration.

## Available Commands

```bash
# Development
npm run dev              # Start backend API server
npm run dev:frontend     # Start frontend UI server

# Testing
npm test                 # Run unit tests
npm run test:e2e         # Run E2E tests

# Building
npm run build            # Build frontend for production

# Database
npm run db:generate      # Generate migrations
npm run db:push          # Apply migrations
npm run db:studio        # Open database studio
npm run db:create-admin  # Create default admin user

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

## Agent Harness Optimization

RTPI includes a 5-phase harness optimization system that reduces wasted agent cycles, makes reasoning inspectable, and enables agents to learn across sessions. All features are opt-in via feature flags.

### Enabling

Add to `.env` and restart the backend:

```bash
# Phase 1: Intent Accuracy — probe targets before LLM, classify errors, gate premature completion
FF_INTENT_ACCURACY_ENGINE=true

# Phase 2: Knowledge — unified memory router, experiential learning, periodic curation
FF_MEMORY_ROUTER=true

# Phase 3: Judgment — structured reasoning state, multi-tier escalation, operator steering
FF_JUDGMENT_SPACE=true

# Phase 4: Personas — persistent agent profiles that evolve with performance
FF_AGENT_PERSONAS=true

# Phase 4: Skills — track skill usage outcomes, auto-improve underperformers
FF_SKILL_SELF_IMPROVEMENT=true

# Phase 4: Sessions — index completed sessions for cross-task recall
FF_CROSS_SESSION_LEARNING=true

# Phase 5: Loop Engineering — context framing, maker/checker, budget planning, dead-loop detection
FF_LOOP_ENGINEERING=true
```

After enabling, apply schema and seed data:

```bash
npm run db:push                              # Create 4 new tables
npx tsx server/scripts/data/seed-personas.ts # Seed 7 agent personas (idempotent)
```

### Architecture

```
Intent Engine (pre-LLM) → Judgment Space → Memory Router → Persona Manager
         │                      │                │                │
         v                      v                v                v
   Loop Engine: context framing, maker/checker, budget planning, safety controls
         │                      │
         v                      v
   Tool Execution Loop          Agent Workflow Orchestrator
```

### Steering API

Operators can steer agents mid-task via the REST API:

```bash
# Inject a constraint
curl -X POST /api/v1/agent-workflows/:id/steer \
  -d '{"action":"inject_constraint","value":"avoid exploitation","reason":"scope change"}'

# Force next tool selection
curl -X POST /api/v1/agent-workflows/:id/steer \
  -d '{"action":"force_tool","value":"nmap","reason":"need port scan first"}'

# View steering state
curl /api/v1/agent-workflows/:id/steering-state
```

See [docs/optimization/harness-optimization.md](docs/optimization/harness-optimization.md) for the full plan, research sources, and implementation details.

## Documentation

- [Development Guide](docs/DEVELOPMENT.md)
- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Harness Optimization Plan](docs/optimization/harness-optimization.md)

## License

MIT License - See LICENSE file for details

# Demo Images
## Operations Management
<img width="1894" height="865" alt="image" src="https://github.com/user-attachments/assets/58cd1d9f-1bbb-44f5-a532-962aa9ba2c6b" />

## Target Management
<img width="1894" height="701" alt="image" src="https://github.com/user-attachments/assets/0d1b3f43-faeb-4dfc-8abd-9fa263b273ef" />

## AI Provider Integration
<img width="1894" height="886" alt="image" src="https://github.com/user-attachments/assets/29c598dd-db9d-4631-8b79-115942568954" />

## Dynamic Agent Configuration
<img width="1894" height="886" alt="image" src="https://github.com/user-attachments/assets/e42b6e53-8786-42ee-a1d5-03f17e4c6dfb" />

## Agent Workflow
<img width="980" height="668" alt="image" src="https://github.com/user-attachments/assets/a8ef8f02-0f5f-4d33-9620-7ded1d1e454e" />

## Agentic Report Production
<img width="980" height="668" alt="image" src="https://github.com/user-attachments/assets/d112c365-b994-4c95-a5ba-10b33391bee9" />

## Dynamic Tool Management
<img width="1894" height="886" alt="image" src="https://github.com/user-attachments/assets/6bfa969e-a4b0-49cd-acf8-a304607988e0" />

## Tool Workflows
<img width="1894" height="886" alt="image" src="https://github.com/user-attachments/assets/af335a70-53be-4e2a-b44c-3d30945496e2" />

## Logic Monitoring
<img width="992" height="865" alt="image" src="https://github.com/user-attachments/assets/9a683d9a-afed-477f-b3ee-09038bab88b7" />
