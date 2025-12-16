# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RTPI (Red Team Portable Infrastructure) is a unified platform for red team operations combining target management, vulnerability tracking, AI-powered agents, and security tool orchestration. It's a full-stack TypeScript application with a React frontend and Express backend.

## Development Commands

```bash
# Start development (requires two terminals)
npm run dev              # Terminal 1: Backend API server (port 3001)
npm run dev:frontend     # Terminal 2: Frontend UI server (port 5000)

# Testing
npm test                 # Run unit tests with Vitest
npm run test:e2e         # Run E2E tests with Playwright

# Database
npm run db:push          # Apply schema changes to database
npm run db:generate      # Generate migrations
npm run db:studio        # Open Drizzle Studio GUI

# Code quality
npm run lint             # Run ESLint
npm run format           # Format with Prettier
```

## Architecture

### Stack
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + Radix UI components
- **Backend**: Express + TypeScript + Drizzle ORM
- **Database**: PostgreSQL (via Docker)
- **Cache/Sessions**: Redis (via Docker)
- **AI Integration**: OpenAI and Anthropic SDKs for agent capabilities

### Directory Structure
```
server/                 # Backend Express application
  api/v1/              # REST API route handlers
  auth/                # Authentication (local, Google OAuth, API key strategies)
  services/            # Business logic (agent orchestration, tool execution, report generation)
  middleware/          # Rate limiting, CSRF protection

client/src/            # Frontend React application
  pages/               # Page components (Dashboard, Operations, Targets, etc.)
  components/          # Reusable UI components organized by feature
  hooks/               # Custom React hooks for data fetching
  services/            # API client functions
  contexts/            # React context providers (Auth)

shared/                # Shared code between frontend and backend
  schema.ts            # Drizzle ORM database schema (single source of truth)
```

### Key Backend Services
- `agent-workflow-orchestrator.ts`: Coordinates multi-agent penetration test workflows
- `agent-tool-connector.ts`: Bridges AI agents with security tools
- `mcp-server-manager.ts`: Manages Model Context Protocol servers
- `metasploit-executor.ts`: Interfaces with Metasploit Framework
- `bbot-executor.ts`: Runs BBOT reconnaissance scans
- `report-generator.ts`: AI-powered penetration test report generation

### Database Schema
The schema in `shared/schema.ts` defines all tables using Drizzle ORM including:
- User authentication and RBAC (users, sessions, apiKeys)
- Operations management (operations, targets, vulnerabilities)
- Agent system (agents, agentWorkflows, workflowTasks)
- MCP orchestration (devices, mcpServers, certificates)
- Security tools (securityTools, toolUploads)
- Surface assessment (discoveredAssets, discoveredServices, axScanResults)

### API Structure
All API routes are versioned under `/api/v1/`. Routes follow RESTful conventions with session-based authentication via Redis.

### Frontend Patterns
- Uses `wouter` for routing (lightweight alternative to react-router)
- Custom hooks in `hooks/` wrap API calls with loading/error states
- Radix UI primitives styled with TailwindCSS and class-variance-authority
- CVSS calculator implementation in `utils/cvss/`

## Environment Setup

Requires Docker for PostgreSQL and Redis:
```bash
docker compose up -d    # Start database services
npm run db:push         # Initialize schema
```

## Access Points
- Frontend UI: http://localhost:5000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api/v1
