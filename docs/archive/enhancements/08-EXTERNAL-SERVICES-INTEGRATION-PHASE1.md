# Phase 1: Empire C2 Integration - Tier 2 Priority

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)  
**Priority:** 🟡 Tier 2 - Beta Enhancement  
**Timeline:** Week 1 (December 9-15, 2025)  
**Phase:** 1 of 3 (Empire C2)  
**Total Items:** 35  
**Last Updated:** December 9, 2025

---

## Overview

This document provides comprehensive technical specifications for integrating Empire C2 Framework into the RTPI platform. Empire C2 will be containerized using Docker and fully managed through the RTPI web interface, enabling red team operations with command and control capabilities.

### Purpose
- **Containerize Empire C2** using BC Security's official Docker image
- **Integrate with RTPI** through API bridge and database sharing
- **Enable per-user token management** for secure multi-user access
- **Implement dynamic listener proxy** through Kasm nginx
- **Provide comprehensive UI** for C2 operations management
- **Track Empire agents** as part of RTPI operations

### Success Criteria
- ✅ Empire C2 running in Docker container
- ✅ Shared PostgreSQL database with schema separation
- ✅ Per-user API token auto-generation working
- ✅ Empire accessible and manageable through RTPI UI
- ✅ Dynamic listener proxy routing through Kasm nginx
- ✅ Empire agent tracking in RTPI operations
- ✅ All integrations tested and documented

### Scope
**IN SCOPE:**
- Empire C2 Docker containerization
- Database schema integration
- API bridge implementation
- Dynamic listener proxy system
- UI components for Empire management
- Agent tracking and session management
- Documentation and testing

**OUT OF SCOPE (Future Phases):**
- Kasm Workspaces integration (Phase 2)
- SysReptor plugin (v2.5)
- Ollama AI integration (Phase 3)
- Kubernetes migration (v2.5+)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Docker Configuration](#docker-configuration)
4. [API Bridge Implementation](#api-bridge-implementation)
5. [Dynamic Listener Proxy](#dynamic-listener-proxy)
6. [Agent Configuration](#agent-configuration)
7. [UI Integration](#ui-integration)
8. [Testing Requirements](#testing-requirements)
9. [Implementation Checklist](#implementation-checklist)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         RTPI Platform                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐                     │
│  │   Frontend   │────────▶│   Backend    │                     │
│  │  React App   │         │  Express.js  │                     │
│  └──────────────┘         └──────┬───────┘                     │
│                                   │                              │
│                                   ▼                              │
│                          ┌────────────────┐                     │
│                          │  RTPI Gateway  │                     │
│                          │  API Router    │                     │
│                          └────────┬───────┘                     │
│                                   │                              │
│                    ┌──────────────┼──────────────┐             │
│                    │              │              │              │
│                    ▼              ▼              ▼              │
│         ┌────────────────┐ ┌───────────┐ ┌──────────────┐     │
│         │ Empire Executor│ │ PostgreSQL│ │ Kasm Nginx   │     │
│         │   (API Client) │ │  Shared   │ │ Proxy Router │     │
│         └────────┬───────┘ └─────┬─────┘ └──────┬───────┘     │
│                  │               │               │              │
└──────────────────┼───────────────┼───────────────┼──────────────┘
                   │               │               │
                   ▼               ▼               ▼
          ┌────────────────┐ ┌─────────────┐ ┌──────────────┐
          │  Empire Server │ │  Schemas:   │ │  Listeners:  │
          │   Container    │ │  - rtpi_main│ │  - HTTP      │
          │                │ │  - empire_c2│ │  - HTTPS     │
          │  Port: 1337    │ │             │ │  Dynamic     │
          │  Port: 5001    │ │             │ │  Routing     │
          └────────────────┘ └─────────────┘ └──────────────┘
```

### Component Relationships

1. **RTPI Frontend** → User interface for Empire management
2. **RTPI Backend** → Express.js API server
3. **RTPI Gateway** → Routes requests to appropriate services
4. **Empire Executor** → TypeScript client for Empire REST API
5. **PostgreSQL** → Shared database with separate schemas
6. **Kasm Nginx Proxy** → Dynamic routing for Empire listeners
7. **Empire Server** → Containerized C2 framework

### Data Flow

#### Creating a Listener
```
User → RTPI UI → Backend API → Empire Executor → Empire Server
                              ↓
                    Kasm Nginx (register proxy route)
                              ↓
                    Cloudflare DNS (if production)
```

#### Empire Agent Check-In
```
Implant → Kasm Nginx Proxy → Empire Listener → Empire Server
                                                     ↓
                                            PostgreSQL (empire_c2 schema)
                                                     ↓
                                            RTPI tracks in empire_sessions
```

### Port Allocation

| Service | Internal Port | External Port | Purpose |
|---------|--------------|---------------|---------|
| RTPI Frontend | 3000 | 3000 | React development |
| RTPI Backend | 5000 | 5000 | Express API |
| Empire REST API | 1337 | 1337 | C2 Management API |
| Empire UI | 5000 | 5001 | Web interface (adjusted) |
| Kasm Proxy | 8443 | 8443 | Main HTTPS proxy |
| PostgreSQL | 5432 | 5432 | Database |
| Redis | 6379 | 6379 | Cache |

---

## Database Schema

### Overview

Empire C2 requires PostgreSQL for storing its data. Instead of creating a separate database instance, we'll use RTPI's existing PostgreSQL container with **schema separation**. This approach:

- ✅ Reduces infrastructure complexity
- ✅ Simplifies backup and maintenance
- ✅ Enables cross-schema queries if needed
- ✅ Uses existing database monitoring and health checks

### Schema Architecture

```
PostgreSQL Container (postgres:16-alpine)
├── Database: rtpi_main
│   ├── Schema: public (RTPI tables)
│   │   ├── users
│   │   ├── operations
│   │   ├── targets
│   │   ├── vulnerabilities
│   │   ├── agents
│   │   └── ... (all existing RTPI tables)
│   │
│   └── Schema: empire_c2 (Empire tables)
│       ├── agents (Empire's agent table)
│       ├── listeners
│       ├── stagers
│       ├── credentials
│       ├── tasks
│       └── ... (all Empire tables)
│
└── RTPI Tracking Tables (public schema)
    ├── empire_sessions (links Empire agents to RTPI)
    ├── empire_user_tokens (per-user API tokens)
    └── empire_listeners (tracks listener configurations)
```

### Migration Script

**File:** `rtpi/migrations/0011_add_empire_integration.sql`

```sql
-- ============================================================================
-- Empire C2 Integration - Database Schema
-- Migration: 0011_add_empire_integration.sql
-- Created: December 9, 2025
-- ============================================================================

-- Create empire_c2 schema for Empire's tables
CREATE SCHEMA IF NOT EXISTS empire_c2;

-- Grant permissions to RTPI user
GRANT ALL PRIVILEGES ON SCHEMA empire_c2 TO rtpi;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA empire_c2 TO rtpi;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA empire_c2 TO rtpi;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA empire_c2 
GRANT ALL PRIVILEGES ON TABLES TO rtpi;

ALTER DEFAULT PRIVILEGES IN SCHEMA empire_c2 
GRANT ALL PRIVILEGES ON SEQUENCES TO rtpi;

-- ============================================================================
-- RTPI Tracking Tables (in public schema)
-- ============================================================================

-- Track Empire agent sessions and link to RTPI operations
CREATE TABLE empire_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Empire identifiers
  empire_agent_id TEXT NOT NULL,
  empire_session_id TEXT,
  empire_listener_id TEXT,
  
  -- RTPI relationships
  operation_id UUID REFERENCES operations(id) ON DELETE SET NULL,
  target_id UUID REFERENCES targets(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Agent details
  hostname TEXT,
  username TEXT,
  internal_ip TEXT,
  external_ip TEXT,
  os_details JSONB,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'lost', 'killed', 'exited'
  check_in_time TIMESTAMP,
  last_seen TIMESTAMP,
  
  -- Additional metadata
  implant_type TEXT, -- 'powershell', 'python', 'csharp', etc.
  architecture TEXT, -- 'x64', 'x86'
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_empire_sessions_agent_id ON empire_sessions(empire_agent_id);
CREATE INDEX idx_empire_sessions_operation_id ON empire_sessions(operation_id);
CREATE INDEX idx_empire_sessions_status ON empire_sessions(status);
CREATE INDEX idx_empire_sessions_last_seen ON empire_sessions(last_seen DESC);

-- ============================================================================
-- Per-User Empire API Token Management
-- ============================================================================

CREATE TABLE empire_user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User relationship
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Empire token details
  empire_token TEXT NOT NULL UNIQUE,
  empire_username TEXT NOT NULL,
  
  -- Token metadata
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMP,
  expires_at TIMESTAMP,
  
  -- Permissions
  permissions JSONB DEFAULT '{"listeners": true, "agents": true, "modules": true}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_empire_user_tokens_user_id ON empire_user_tokens(user_id);
CREATE INDEX idx_empire_user_tokens_active ON empire_user_tokens(is_active) 
WHERE is_active = true;

-- ============================================================================
-- Empire Listener Tracking (for dynamic proxy routing)
-- ============================================================================

CREATE TABLE empire_listeners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Empire identifiers
  empire_listener_id TEXT NOT NULL UNIQUE,
  listener_name TEXT NOT NULL,
  listener_type TEXT NOT NULL, -- 'http', 'https', 'meterpreter', etc.
  
  -- Network configuration
  bind_ip TEXT DEFAULT '0.0.0.0',
  port INTEGER NOT NULL,
  
  -- Proxy configuration (for Kasm nginx integration)
  proxy_enabled BOOLEAN DEFAULT false,
  proxy_subdomain TEXT, -- e.g., 'listener-abc123.kasm.attck.nexus'
  proxy_port INTEGER,
  
  -- RTPI relationships
  operation_id UUID REFERENCES operations(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'stopped', 'error'
  
  -- Configuration details
  config JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  stopped_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_empire_listeners_empire_id ON empire_listeners(empire_listener_id);
CREATE INDEX idx_empire_listeners_status ON empire_listeners(status);
CREATE INDEX idx_empire_listeners_operation_id ON empire_listeners(operation_id);

-- ============================================================================
-- Update trigger for empire_sessions.updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_empire_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER empire_sessions_updated_at
BEFORE UPDATE ON empire_sessions
FOR EACH ROW
EXECUTE FUNCTION update_empire_sessions_updated_at();

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON SCHEMA empire_c2 IS 'Dedicated schema for Empire C2 Framework tables';

COMMENT ON TABLE empire_sessions IS 
'Tracks Empire agent sessions and links them to RTPI operations and targets';

COMMENT ON TABLE empire_user_tokens IS 
'Stores per-user Empire API tokens for secure multi-user access';

COMMENT ON TABLE empire_listeners IS 
'Tracks Empire listeners and manages dynamic proxy routing through Kasm nginx';

-- ============================================================================
-- Initial data / seed data (optional)
-- ============================================================================

-- Example: Create initial Empire user tokens for existing admin users
-- This can be run after Empire is deployed
/*
INSERT INTO empire_user_tokens (user_id, empire_token, empire_username, permissions)
SELECT 
  id,
  'GENERATED_TOKEN_' || id,
  username || '_empire',
  '{"listeners": true, "agents": true, "modules": true}'::jsonb
FROM users
WHERE role = 'admin';
*/

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Verify schema was created
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'empire_c2';

-- Verify RTPI tracking tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('empire_sessions', 'empire_user_tokens', 'empire_listeners');

-- ============================================================================
-- End of migration
-- ============================================================================
```

### TypeScript Schema Definitions

Add to `rtpi/shared/schema.ts`:

```typescript
// ============================================================================
// EMPIRE C2 INTEGRATION TABLES
// ============================================================================

export const empireSessionStatusEnum = pgEnum("empire_session_status", [
  "active",
  "lost", 
  "killed",
  "exited"
]);

export const empireListenerStatusEnum = pgEnum("empire_listener_status", [
  "active",
  "stopped",
  "error"
]);

export const empireSessions = pgTable("empire_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Empire identifiers
  empireAgentId: text("empire_agent_id").notNull(),
  empireSessionId: text("empire_session_id"),
  empireListenerId: text("empire_listener_id"),
  
  // RTPI relationships
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "set null" }),
  targetId: uuid("target_id").references(() => targets.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  
  // Agent details
  hostname: text("hostname"),
  username: text("username"),
  internalIp: text("internal_ip"),
  externalIp: text("external_ip"),
  osDetails: json("os_details"),
  
  // Status tracking
  status: empireSessionStatusEnum("status").notNull().default("active"),
  checkInTime: timestamp("check_in_time"),
  lastSeen: timestamp("last_seen"),
  
  // Additional metadata
  implantType: text("implant_type"),
  architecture: text("architecture"),
  metadata: json("metadata").default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const empireUserTokens = pgTable("empire_user_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // User relationship
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Empire token details
  empireToken: text("empire_token").notNull().unique(),
  empireUsername: text("empire_username").notNull(),
  
  // Token metadata
  isActive: boolean("is_active").notNull().default(true),
  lastUsed: timestamp("last_used"),
  expiresAt: timestamp("expires_at"),
  
  // Permissions
  permissions: json("permissions").default({
    listeners: true,
    agents: true,
    modules: true
  }),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

export const empireListeners = pgTable("empire_listeners", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Empire identifiers
  empireListenerId: text("empire_listener_id").notNull().unique(),
  listenerName: text("listener_name").notNull(),
  listenerType: text("listener_type").notNull(),
  
  // Network configuration
  bindIp: text("bind_ip").default("0.0.0.0"),
  port: integer("port").notNull(),
  
  // Proxy configuration
  proxyEnabled: boolean("proxy_enabled").default(false),
  proxySubdomain: text("proxy_subdomain"),
  proxyPort: integer("proxy_port"),
  
  // RTPI relationships
  operationId: uuid("operation_id").references(() => operations.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  
  // Status
  status: empireListenerStatusEnum("status").default("active"),
  
  // Configuration
  config: json("config").default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  stoppedAt: timestamp("stopped_at"),
});
```

### Database Configuration Update

Update `rtpi/.env.example`:

```bash
# ============================================================================
# PostgreSQL Configuration (Shared with Empire C2)
# ============================================================================

# RTPI uses schema: public
# Empire C2 uses schema: empire_c2
DATABASE_URL=postgresql://rtpi:rtpi@postgres:5432/rtpi_main

# Enable schema search path
DATABASE_SCHEMA_PATH=public,empire_c2

# Connection pool settings
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

### Testing the Schema

**Test script:** `rtpi/scripts/test-empire-schema.ts`

```typescript
import { db } from '../server/db';
import { empireSessions, empireUserTokens, empireListeners } from '../shared/schema';

async function testEmpireSchema() {
  console.log('Testing Empire C2 schema...');
  
  try {
    // Test empire_sessions table
    console.log('✓ Testing empire_sessions table...');
    const sessions = await db.select().from(empireSessions).limit(1);
    console.log(`  Found ${sessions.length} sessions`);
    
    // Test empire_user_tokens table
    console.log('✓ Testing empire_user_tokens table...');
    const tokens = await db.select().from(empireUserTokens).limit(1);
    console.log(`  Found ${tokens.length} tokens`);
    
    // Test empire_listeners table
    console.log('✓ Testing empire_listeners table...');
    const listeners = await db.select().from(empireListeners).limit(1);
    console.log(`  Found ${listeners.length} listeners`);
    
    // Test schema exists
    const schemaCheck = await db.execute(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'empire_c2'
    `);
    
    if (schemaCheck.rows.length > 0) {
      console.log('✓ empire_c2 schema exists');
    } else {
      console.error('✗ empire_c2 schema NOT found');
    }
    
    console.log('\n✅ All Empire schema tests passed!');
  } catch (error) {
    console.error('❌ Empire schema test failed:', error);
    throw error;
  }
}

testEmpireSchema();
```

Run with:
```bash
npm run test:empire-schema
```

---

## Docker Configuration

### Overview

Empire C2 will be deployed as a Docker container using the official BC Security image. This section provides complete docker compose configuration, environment setup, and deployment procedures.

### Empire C2 Container Architecture

```
Empire C2 Deployment
├── Empire Server Container
│   ├── REST API (Port 1337)
│   ├── Web UI (Port 5001)
│   └── Listeners (Dynamic ports)
│
├── Shared PostgreSQL
│   ├── empire_c2 schema
│   └── Agent/listener data
│
└── Persistent Volumes
    ├── empire-data (agent data, sessions)
    ├── empire-downloads (harvested files)
    └── empire-modules (custom modules)
```

### Docker Compose Configuration

Add to `rtpi/docker-compose.yml`:

```yaml
services:
  # ============================================================================
  # Empire C2 Server
  # ============================================================================
  
  empire-server:
    image: bcsecurity/empire:latest
    container_name: rtpi-empire-server
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "1337:1337"   # REST API
      - "5001:5000"   # Web UI (remapped to avoid conflict)
    environment:
      # Database connection (empire_c2 schema)
      - EMPIRE_DATABASE_URL=postgresql://rtpi:${POSTGRES_PASSWORD}@postgres:5432/rtpi_main?options=-csearch_path%3Dempire_c2
      
      # API Configuration
      - EMPIRE_API_KEY=${EMPIRE_API_KEY}
      - EMPIRE_API_USERNAME=${EMPIRE_API_USERNAME:-empire}
      - EMPIRE_API_PASSWORD=${EMPIRE_API_PASSWORD}
      
      # Server Configuration
      - EMPIRE_SERVER_HOST=0.0.0.0
      - EMPIRE_SERVER_PORT=1337
      - EMPIRE_STAGING_KEY=${EMPIRE_STAGING_KEY}
      
      # Listener Configuration
      - EMPIRE_LISTENER_BIND_IP=0.0.0.0
      - EMPIRE_LISTENER_EXTERNAL_IP=${EXTERNAL_IP:-127.0.0.1}
      
      # Logging
      - EMPIRE_LOG_LEVEL=${EMPIRE_LOG_LEVEL:-INFO}
      
    volumes:
      # Persistent data storage
      - empire-data:/empire/data
      - empire-downloads:/empire/downloads
      - empire-obfuscated-modules:/empire/obfuscated_module_source
      
      # Optional: Custom modules
      - ./configs/empire/modules:/empire/custom_modules:ro
      
    networks:
      - rtpi-network
    
    restart: unless-stopped
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:1337/api/admin/config"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    
    labels:
      - "com.rtpi.service=empire-c2"
      - "com.rtpi.description=Empire C2 Framework Server"

volumes:
  # Empire C2 persistent storage
  empire-data:
    name: rtpi-empire-data
  empire-downloads:
    name: rtpi-empire-downloads
  empire-obfuscated-modules:
    name: rtpi-empire-modules
```

### Environment Variables

Add to `rtpi/.env.example`:

```bash
# ============================================================================
# Empire C2 Configuration
# ============================================================================

# Empire API Credentials
EMPIRE_API_KEY=your-secure-api-key-here
EMPIRE_API_USERNAME=empire
EMPIRE_API_PASSWORD=your-secure-password-here

# Empire Staging Key (for payload encryption)
EMPIRE_STAGING_KEY=your-staging-key-here

# Network Configuration
EXTERNAL_IP=YOUR_PUBLIC_IP_OR_DOMAIN

# Logging
EMPIRE_LOG_LEVEL=INFO

# Database (shared with RTPI)
POSTGRES_PASSWORD=rtpi
```

### Generate Secure Keys

**Script:** `rtpi/scripts/generate-empire-keys.sh`

```bash
#!/bin/bash
# Generate secure keys for Empire C2 deployment

echo "Generating Empire C2 secure keys..."

# Generate API key (32 characters)
API_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "EMPIRE_API_KEY=$API_KEY"

# Generate API password (32 characters)
API_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "EMPIRE_API_PASSWORD=$API_PASSWORD"

# Generate staging key (32 characters)
STAGING_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "EMPIRE_STAGING_KEY=$STAGING_KEY"

echo ""
echo "Add these to your .env file:"
echo "----------------------------"
echo "EMPIRE_API_KEY=$API_KEY"
echo "EMPIRE_API_PASSWORD=$API_PASSWORD"
echo "EMPIRE_STAGING_KEY=$STAGING_KEY"
```

Make executable:
```bash
chmod +x rtpi/scripts/generate-empire-keys.sh
```

### Initial Deployment

**Step 1: Generate Keys**
```bash
cd rtpi
./scripts/generate-empire-keys.sh >> .env
```

**Step 2: Run Database Migration**
```bash
# Apply Empire schema migration
npm run db:migrate

# Or manually:
psql $DATABASE_URL -f migrations/0011_add_empire_integration.sql
```

**Step 3: Start Empire Container**
```bash
# Start just Empire (for testing)
docker compose up -d empire-server

# Or start all services
docker compose up -d
```

**Step 4: Verify Deployment**
```bash
# Check container status
docker compose ps empire-server

# Check logs
docker compose logs -f empire-server

# Test API connection
curl -k https://localhost:1337/api/admin/config \
  -H "Authorization: Bearer $EMPIRE_API_KEY"
```

### Container Management Commands

```bash
# Start Empire
docker compose up -d empire-server

# Stop Empire
docker compose stop empire-server

# Restart Empire
docker compose restart empire-server

# View logs
docker compose logs -f empire-server

# Execute commands in container
docker compose exec empire-server bash

# Access Empire CLI
docker compose exec empire-server python3 /empire/client

# Check Empire status
docker compose exec empire-server curl -s http://localhost:1337/api/admin/config
```

### Volume Management

#### Backup Empire Data
```bash
# Backup all Empire volumes
docker run --rm \
  -v rtpi-empire-data:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/empire-data-$(date +%Y%m%d).tar.gz -C /source .

docker run --rm \
  -v rtpi-empire-downloads:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/empire-downloads-$(date +%Y%m%d).tar.gz -C /source .
```

#### Restore Empire Data
```bash
# Restore from backup
docker run --rm \
  -v rtpi-empire-data:/target \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/empire-data-20251209.tar.gz -C /target
```

#### Clean Empire Data (CAUTION!)
```bash
# Remove all Empire data (loses all agents!)
docker compose down empire-server
docker volume rm rtpi-empire-data rtpi-empire-downloads rtpi-empire-modules
docker compose up -d empire-server
```

### Network Configuration

#### Expose Listener Ports
For Empire listeners to be accessible, additional ports must be exposed:

```yaml
# Dynamic listener port range
empire-server:
  ports:
    - "1337:1337"       # API
    - "5001:5000"       # UI
    - "8080-8090:8080-8090"  # Listener range (HTTP/HTTPS)
    - "9090-9100:9090-9100"  # Additional listener range
```

#### Firewall Rules (Production)
```bash
# Allow Empire API (internal only)
sudo ufw allow from 172.16.0.0/12 to any port 1337

# Allow listeners (external access)
sudo ufw allow 8080:8090/tcp comment "Empire Listeners"
```

### Health Monitoring

#### Healthcheck Configuration
The Empire container includes a healthcheck that:
- Tests API endpoint every 30 seconds
- Times out after 10 seconds
- Retries 3 times before marking unhealthy
- Allows 60 seconds startup time

#### Custom Health Check Script
**File:** `rtpi/scripts/check-empire-health.sh`

```bash
#!/bin/bash
# Empire C2 health check script

API_KEY=${EMPIRE_API_KEY}
EMPIRE_URL="http://localhost:1337"

# Check if Empire API responds
response=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  "$EMPIRE_URL/api/admin/config")

if [ "$response" = "200" ]; then
  echo "✓ Empire C2 is healthy"
  
  # Get listener count
  listeners=$(curl -s \
    -H "Authorization: Bearer $API_KEY" \
    "$EMPIRE_URL/api/listeners" | jq '. | length')
  
  # Get agent count
  agents=$(curl -s \
    -H "Authorization: Bearer $API_KEY" \
    "$EMPIRE_URL/api/agents" | jq '. | length')
  
  echo "  Listeners: $listeners"
  echo "  Agents: $agents"
  exit 0
else
  echo "✗ Empire C2 is unhealthy (HTTP $response)"
  exit 1
fi
```

### Troubleshooting

#### Container Won't Start

**Problem:** Empire container fails to start
**Check:**
```bash
# View detailed logs
docker compose logs empire-server

# Check if database is ready
docker compose ps postgres

# Verify environment variables
docker compose config | grep -A 20 empire-server
```

**Common Issues:**
- Database not ready → Wait for `postgres` health check
- Port conflict → Check if ports 1337 or 5001 are in use
- Invalid credentials → Regenerate keys with `generate-empire-keys.sh`

#### Database Connection Failed

**Problem:** Empire can't connect to PostgreSQL
**Solution:**
```bash
# Test database connection
docker compose exec postgres psql -U rtpi -d rtpi_main -c "\dn"

# Verify empire_c2 schema exists
docker compose exec postgres psql -U rtpi -d rtpi_main -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'empire_c2';"

# If schema missing, run migration
npm run db:migrate
```

#### API Authentication Failed

**Problem:** Can't authenticate with Empire API
**Solution:**
```bash
# Verify API key in container
docker compose exec empire-server printenv | grep EMPIRE_API

# Test authentication
curl -v -H "Authorization: Bearer $EMPIRE_API_KEY" \
  http://localhost:1337/api/admin/config

# Reset API key
./scripts/generate-empire-keys.sh
docker compose restart empire-server
```

#### Agents Not Checking In

**Problem:** Empire agents deployed but not connecting
**Check:**
1. Listener is running:
   ```bash
   curl -H "Authorization: Bearer $EMPIRE_API_KEY" \
     http://localhost:1337/api/listeners
   ```
2. Listener port is exposed in docker-compose
3. Firewall allows listener port
4. External IP is correct in environment variables

### Production Deployment Considerations

#### Security Hardening
```yaml
empire-server:
  # ... existing config ...
  
  security_opt:
    - no-new-privileges:true
  
  cap_drop:
    - ALL
  
  cap_add:
    - NET_BIND_SERVICE  # For binding to privileged ports
  
  read_only: false  # Empire needs write access for agents
  
  tmpfs:
    - /tmp
```

#### Resource Limits
```yaml
empire-server:
  # ... existing config ...
  
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
      reservations:
        cpus: '0.5'
        memory: 512M
```

#### Logging Configuration
```yaml
empire-server:
  # ... existing config ...
  
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

### Integration with Existing RTPI Services

#### Update Main docker-compose.yml
Ensure Empire depends on RTPI core services:

```yaml
empire-server:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  networks:
    - rtpi-network
```

#### Add to RTPI Health Monitoring
The RTPI health monitoring system should track Empire:

```typescript
// server/services/health-monitor.ts
const empireHealth = await checkEmpireHealth();
// Track in health_checks table
```

---

## API Bridge Implementation

### Overview

The API Bridge is a TypeScript service that acts as a client for the Empire C2 REST API. It provides a clean interface for RTPI to interact with Empire, handles authentication, manages per-user tokens, and tracks Empire sessions in the RTPI database.

### Architecture

```
RTPI Application
      ↓
Empire Executor (API Client)
      ↓
Per-User Token Manager
      ↓
Empire REST API (port 1337)
      ↓
Empire C2 Server
```

### Empire Executor Service

**File:** `rtpi/server/services/empire-executor.ts`

```typescript
import axios, { AxiosInstance } from 'axios';
import { db } from '../db';
import { empireUserTokens, empireSessions, empireListeners } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Empire API Client Configuration
// ============================================================================

interface EmpireConfig {
  baseURL: string;
  apiKey: string;
  timeout?: number;
}

interface EmpireListener {
  id: string;
  name: string;
  module: string;
  listener_type: string;
  listener_category: string;
  enabled: boolean;
  options: Record<string, any>;
}

interface EmpireAgent {
  ID: string;
  session_id: string;
  listener: string;
  name: string;
  language: string;
  language_version: string;
  delay: number;
  jitter: number;
  external_ip: string;
  internal_ip: string;
  username: string;
  high_integrity: number;
  process_name: string;
  process_id: number;
  hostname: string;
  os_details: string;
  session_key: string;
  checkin_time: string;
  lastseen_time: string;
  parent: string | null;
  children: string | null;
  servers: string | null;
  profile: string;
  functions: string | null;
  kill_date: string;
  working_hours: string;
  lost_limit: number;
  taskings: any[];
  results: any[];
}

interface EmpireStager {
  id: string;
  name: string;
  module: string;
  options: Record<string, any>;
  output: string;
}

// ============================================================================
// Empire Executor Class
// ============================================================================

export class EmpireExecutor {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;

  constructor(config: EmpireConfig) {
    this.baseURL = config.baseURL || process.env.EMPIRE_BASE_URL || 'http://empire-server:1337';
    this.apiKey = config.apiKey || process.env.EMPIRE_API_KEY || '';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[Empire API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[Empire API] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[Empire API] Response error:', error.response?.data || error.message);
        throw new Error(`Empire API error: ${error.response?.data?.detail || error.message}`);
      }
    );
  }

  // ==========================================================================
  // User Token Management
  // ==========================================================================

  /**
   * Get or create Empire API token for a user
   */
  async getUserToken(userId: string): Promise<string> {
    // Check if user already has an active token
    const existingToken = await db
      .select()
      .from(empireUserTokens)
      .where(
        and(
          eq(empireUserTokens.userId, userId),
          eq(empireUserTokens.isActive, true)
        )
      )
      .limit(1);

    if (existingToken.length > 0) {
      // Update last used timestamp
      await db
        .update(empireUserTokens)
        .set({ lastUsed: new Date() })
        .where(eq(empireUserTokens.id, existingToken[0].id));

      return existingToken[0].empireToken;
    }

    // Create new token for user
    const newToken = await this.createUserToken(userId);
    return newToken;
  }

  /**
   * Create new Empire API token for user
   */
  private async createUserToken(userId: string): Promise<string> {
    // Generate unique token (in production, this would create an actual Empire user)
    const token = `rtpi_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const username = `rtpi_user_${userId.substring(0, 8)}`;

    // Store in database
    await db.insert(empireUserTokens).values({
      userId,
      empireToken: token,
      empireUsername: username,
      isActive: true,
      permissions: {
        listeners: true,
        agents: true,
        modules: true
      }
    });

    console.log(`[Empire] Created new token for user ${userId}`);
    return token;
  }

  /**
   * Revoke user's Empire token
   */
  async revokeUserToken(userId: string): Promise<void> {
    await db
      .update(empireUserTokens)
      .set({
        isActive: false,
        revokedAt: new Date()
      })
      .where(eq(empireUserTokens.userId, userId));

    console.log(`[Empire] Revoked token for user ${userId}`);
  }

  // ==========================================================================
  // Listener Management
  // ==========================================================================

  /**
   * Get all listeners
   */
  async getListeners(): Promise<EmpireListener[]> {
    const response = await this.client.get('/api/listeners');
    return response.data.listeners || [];
  }

  /**
   * Get specific listener
   */
  async getListener(listenerId: string): Promise<EmpireListener> {
    const response = await this.client.get(`/api/listeners/${listenerId}`);
    return response.data;
  }

  /**
   * Create new listener
   */
  async createListener(options: {
    name: string;
    listenerType: string;
    port: number;
    host?: string;
    operationId?: string;
    userId?: string;
  }): Promise<EmpireListener> {
    const listenerConfig = {
      Name: options.name,
      Host: options.host || `http://0.0.0.0:${options.port}`,
      Port: options.port,
      DefaultDelay: 5,
      DefaultJitter: 0.0,
      DefaultLostLimit: 60,
      DefaultProfile: '/admin/get.php,/news.php,/login/process.php|Mozilla/5.0'
    };

    const response = await this.client.post(
      `/api/listeners/${options.listenerType}`,
      listenerConfig
    );

    const listener = response.data;

    // Track in RTPI database
    if (listener.id) {
      await db.insert(empireListeners).values({
        empireListenerId: listener.id,
        listenerName: options.name,
        listenerType: options.listenerType,
        port: options.port,
        operationId: options.operationId || null,
        createdBy: options.userId || null,
        status: 'active',
        config: listenerConfig
      });
    }

    console.log(`[Empire] Created listener: ${options.name} on port ${options.port}`);
    return listener;
  }

  /**
   * Delete listener
   */
  async deleteListener(listenerId: string): Promise<void> {
    await this.client.delete(`/api/listeners/${listenerId}`);

    // Update RTPI database
    await db
      .update(empireListeners)
      .set({
        status: 'stopped',
        stoppedAt: new Date()
      })
      .where(eq(empireListeners.empireListenerId, listenerId));

    console.log(`[Empire] Deleted listener: ${listenerId}`);
  }

  // ==========================================================================
  // Agent Management
  // ==========================================================================

  /**
   * Get all agents
   */
  async getAgents(): Promise<EmpireAgent[]> {
    const response = await this.client.get('/api/agents');
    return response.data.agents || [];
  }

  /**
   * Get specific agent
   */
  async getAgent(agentId: string): Promise<EmpireAgent> {
    const response = await this.client.get(`/api/agents/${agentId}`);
    return response.data;
  }

  /**
   * Execute shell command on agent
   */
  async executeCommand(agentId: string, command: string): Promise<any> {
    const response = await this.client.post(`/api/agents/${agentId}/shell`, {
      command
    });
    return response.data;
  }

  /**
   * Kill agent
   */
  async killAgent(agentId: string): Promise<void> {
    await this.client.delete(`/api/agents/${agentId}`);

    // Update RTPI tracking
    await db
      .update(empireSessions)
      .set({
        status: 'killed',
        updatedAt: new Date()
      })
      .where(eq(empireSessions.empireAgentId, agentId));

    console.log(`[Empire] Killed agent: ${agentId}`);
  }

  // ==========================================================================
  // Stager Management
  // ==========================================================================

  /**
   * Get available stagers
   */
  async getStagers(): Promise<string[]> {
    const response = await this.client.get('/api/stagers');
    return response.data.stagers || [];
  }

  /**
   * Generate stager
   */
  async generateStager(options: {
    stagerType: string;
    listener: string;
    outFile?: string;
    base64?: boolean;
  }): Promise<EmpireStager> {
    const response = await this.client.post('/api/stagers', {
      StagerName: options.stagerType,
      Listener: options.listener,
      OutFile: options.outFile,
      Base64: options.base64 || true
    });

    console.log(`[Empire] Generated ${options.stagerType} stager for listener ${options.listener}`);
    return response.data;
  }

  // ==========================================================================
  // Module Management
  // ==========================================================================

  /**
   * Get available modules
   */
  async getModules(): Promise<any[]> {
    const response = await this.client.get('/api/modules');
    return response.data.modules || [];
  }

  /**
   * Execute module on agent
   */
  async executeModule(agentId: string, moduleName: string, options: Record<string, any> = {}): Promise<any> {
    const response = await this.client.post(`/api/modules/${moduleName}`, {
      Agent: agentId,
      ...options
    });

    console.log(`[Empire] Executed module ${moduleName} on agent ${agentId}`);
    return response.data;
  }

  // ==========================================================================
  // Credential Management
  // ==========================================================================

  /**
   * Get harvested credentials
   */
  async getCredentials(): Promise<any[]> {
    const response = await this.client.get('/api/creds');
    return response.data.creds || [];
  }

  /**
   * Add credential
   */
  async addCredential(credential: {
    credtype: string;
    domain: string;
    username: string;
    password: string;
    host?: string;
    notes?: string;
  }): Promise<any> {
    const response = await this.client.post('/api/creds', credential);
    console.log(`[Empire] Added credential: ${credential.domain}\\${credential.username}`);
    return response.data;
  }

  // ==========================================================================
  // Session Synchronization
  // ==========================================================================

  /**
   * Sync Empire agents to RTPI database
   */
  async syncAgentsToRTPI(operationId?: string): Promise<void> {
    const agents = await this.getAgents();

    for (const agent of agents) {
      // Check if session already exists
      const existing = await db
        .select()
        .from(empireSessions)
        .where(eq(empireSessions.empireAgentId, agent.ID))
        .limit(1);

      if (existing.length === 0) {
        // Create new session tracking
        await db.insert(empireSessions).values({
          empireAgentId: agent.ID,
          empireSessionId: agent.session_id,
          empireListenerId: agent.listener,
          operationId: operationId || null,
          hostname: agent.hostname,
          username: agent.username,
          internalIp: agent.internal_ip,
          externalIp: agent.external_ip,
          osDetails: {
            os: agent.os_details,
            language: agent.language,
            languageVersion: agent.language_version,
            processName: agent.process_name,
            processPid: agent.process_id
          },
          status: 'active',
          checkInTime: new Date(agent.checkin_time),
          lastSeen: new Date(agent.lastseen_time),
          implantType: agent.language,
          architecture: agent.high_integrity ? 'x64' : 'x86',
          metadata: {
            delay: agent.delay,
            jitter: agent.jitter,
            killDate: agent.kill_date,
            workingHours: agent.working_hours
          }
        });

        console.log(`[Empire] Synced new agent to RTPI: ${agent.name}`);
      } else {
        // Update existing session
        await db
          .update(empireSessions)
          .set({
            lastSeen: new Date(agent.lastseen_time),
            status: 'active',
            updatedAt: new Date()
          })
          .where(eq(empireSessions.empireAgentId, agent.ID));
      }
    }

    console.log(`[Empire] Synced ${agents.length} agents to RTPI`);
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Check if Empire is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/admin/config');
      return response.status === 200;
    } catch (error) {
      console.error('[Empire] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get Empire version info
   */
  async getVersion(): Promise<any> {
    const response = await this.client.get('/api/version');
    return response.data;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let empireExecutor: EmpireExecutor | null = null;

export function getEmpireExecutor(): EmpireExecutor {
  if (!empireExecutor) {
    empireExecutor = new EmpireExecutor({
      baseURL: process.env.EMPIRE_BASE_URL || 'http://empire-server:1337',
      apiKey: process.env.EMPIRE_API_KEY || '',
      timeout: 30000
    });
  }
  return empireExecutor;
}
```

### RTPI API Endpoints

**File:** `rtpi/server/api/v1/empire.ts`

```typescript
import { Router } from 'express';
import { getEmpireExecutor } from '../../services/empire-executor';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();
const empire = getEmpireExecutor();

// All Empire routes require authentication
router.use(requireAuth);

// ============================================================================
// Listener Endpoints
// ============================================================================

/**
 * GET /api/v1/empire/listeners
 * Get all Empire listeners
 */
router.get('/listeners', async (req, res) => {
  try {
    const listeners = await empire.getListeners();
    res.json({ listeners });
  } catch (error) {
    console.error('Error fetching listeners:', error);
    res.status(500).json({ error: 'Failed to fetch listeners' });
  }
});

/**
 * POST /api/v1/empire/listeners
 * Create new listener
 */
router.post('/listeners', requireRole(['admin', 'operator']), async (req, res) => {
  try {
    const { name, listenerType, port, host, operationId } = req.body;

    if (!name || !listenerType || !port) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const listener = await empire.createListener({
      name,
      listenerType,
      port,
      host,
      operationId,
      userId: req.user!.id
    });

    res.status(201).json({ listener });
  } catch (error) {
    console.error('Error creating listener:', error);
    res.status(500).json({ error: 'Failed to create listener' });
  }
});

/**
 * DELETE /api/v1/empire/listeners/:id
 * Delete listener
 */
router.delete('/listeners/:id', requireRole(['admin', 'operator']), async (req, res) => {
  try {
    await empire.deleteListener(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting listener:', error);
    res.status(500).json({ error: 'Failed to delete listener' });
  }
});

// ============================================================================
// Agent Endpoints
// ============================================================================

/**
 * GET /api/v1/empire/agents
 * Get all Empire agents
 */
router.get('/agents', async (req, res) => {
  try {
    const agents = await empire.getAgents();
    res.json({ agents });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * GET /api/v1/empire/agents/:id
 * Get specific agent
 */
router.get('/agents/:id', async (req, res) => {
  try {
    const agent = await empire.getAgent(req.params.id);
    res.json({ agent });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

/**
 * POST /api/v1/empire/agents/:id/execute
 * Execute command on agent
 */
router.post('/agents/:id/execute', requireRole(['admin', 'operator']), async (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const result = await empire.executeCommand(req.params.id, command);
    res.json({ result });
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: 'Failed to execute command' });
  }
});

/**
 * DELETE /api/v1/empire/agents/:id
 * Kill agent
 */
router.delete('/agents/:id', requireRole(['admin', 'operator']), async (req, res) => {
  try {
    await empire.killAgent(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error killing agent:', error);
    res.status(500).json({ error: 'Failed to kill agent' });
  }
});

// ============================================================================
// Stager Endpoints
// ============================================================================

/**
 * GET /api/v1/empire/stagers
 * Get available stagers
 */
router.get('/stagers', async (req, res) => {
  try {
    const stagers = await empire.getStagers();
    res.json({ stagers });
  } catch (error) {
    console.error('Error fetching stagers:', error);
    res.status(500).json({ error: 'Failed to fetch stagers' });
  }
});

/**
 * POST /api/v1/empire/stagers/generate
 * Generate stager
 */
router.post('/stagers/generate', requireRole(['admin', 'operator']), async (req, res) => {
  try {
    const { stagerType, listener, outFile, base64 } = req.body;

    if (!stagerType || !listener) {
      return res.status(400).json({ error: 'Stager type and listener are required' });
    }

    const stager = await empire.generateStager({
      stagerType,
      listener,
      outFile,
      base64
    });

    res.json({ stager });
  } catch (error) {
    console.error('Error generating stager:', error);
    res.status(500).json({ error: 'Failed to generate stager' });
  }
});

// ============================================================================
// Module Endpoints
// ============================================================================

/**
 * GET /api/v1/empire/modules
 * Get available modules
 */
router.get('/modules', async (req, res) => {
  try {
    const modules = await empire.getModules();
    res.json({ modules });
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

/**
 * POST /api/v1/empire/modules/execute
 * Execute module on agent
 */
router.post('/modules/execute', requireRole(['admin', 'operator']), async (req, res) => {
  try {
    const { agentId, moduleName, options } = req.body;

    if (!agentId || !moduleName) {
      return res.status(400).json({ error: 'Agent ID and module name are required' });
    }

    const result = await empire.executeModule(agentId, moduleName, options);
    res.json({ result });
  } catch (error) {
    console.error('Error executing module:', error);
    res.status(500).json({ error: 'Failed to execute module' });
  }
});

// ============================================================================
// Credential Endpoints
// ============================================================================

/**
 * GET /api/v1/empire/credentials
 * Get harvested credentials
 */
router.get('/credentials', async (req, res) => {
  try {
    const credentials = await empire.getCredentials();
    res.json({ credentials });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

// ============================================================================
// Sync Endpoints
// ============================================================================

/**
 * POST /api/v1/empire/sync
 * Sync Empire agents to RTPI
 */
router.post('/sync', requireRole(['admin', 'operator']), async (req, res) => {
  try {
    const { operationId } = req.body;
    await empire.syncAgentsToRTPI(operationId);
    res.json({ success: true, message: 'Agents synced successfully' });
  } catch (error) {
    console.error('Error syncing agents:', error);
    res.status(500).json({ error: 'Failed to sync agents' });
  }
});

// ============================================================================
// Health Check
// ============================================================================

/**
 * GET /api/v1/empire/health
 * Check Empire health
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await empire.healthCheck();
    const version = isHealthy ? await empire.getVersion() : null;

    res.json({
      healthy: isHealthy,
      version,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
```

### Register Empire Routes

Add to `rtpi/server/index.ts`:

```typescript
import empireRoutes from './api/v1/empire';

// ... existing routes ...

// Empire C2 routes
app.use('/api/v1/empire', empireRoutes);
```

### Testing the API Bridge

**Test script:** `rtpi/scripts/test-empire-api.ts`

```typescript
import { getEmpireExecutor } from '../server/services/empire-executor';

async function testEmpireAPI() {
  console.log('Testing Empire API Bridge...\n');

  const empire = getEmpireExecutor();

  try {
    // Test 1: Health check
    console.log('Test 1: Health Check');
    const isHealthy = await empire.healthCheck();
    console.log(`✓ Empire is ${isHealthy ? 'healthy' : 'unhealthy'}\n`);

    if (!isHealthy) {
      console.error('❌ Empire is not healthy, stopping tests');
      return;
    }

    // Test 2: Get version
    console.log('Test 2: Get Version');
    const version = await empire.getVersion();
    console.log(`✓ Empire version: ${JSON.stringify(version)}\n`);

    // Test 3: Get listeners
    console.log('Test 3: Get Listeners');
    const listeners = await empire.getListeners();
    console.log(`✓ Found ${listeners.length} listeners\n`);

    // Test 4: Get agents
    console.log('Test 4: Get Agents');
    const agents = await empire.getAgents();
    console.log(`✓ Found ${agents.length} agents\n`);

    // Test 5: Get stagers
    console.log('Test 5: Get Available Stagers');
    const stagers = await empire.getStagers();
    console.log(`✓ Found ${stagers.length} stager types\n`);

    // Test 6: Get modules
    console.log('Test 6: Get Available Modules');
    const modules = await empire.getModules();
    console.log(`✓ Found ${modules.length} modules\n`);

    // Test 7: Get credentials
    console.log('Test 7: Get Credentials');
    const creds = await empire.getCredentials();
    console.log(`✓ Found ${creds.length} credentials\n`);

    console.log('✅ All Empire API tests passed!');
  } catch (error) {
    console.error('❌ Empire API test failed:', error);
    throw error;
  }
}

testEmpireAPI();
```

Run with:
```bash
npm run test:empire-api
```

---

## Dynamic Listener Proxy

### Overview

The Dynamic Listener Proxy automatically routes Empire C2 listeners through the Kasm nginx proxy, providing secure external access with optional Cloudflare DNS integration. This enables Empire listeners to be accessible from the internet while maintaining a single entry point through the Kasm proxy.

### Architecture

```
External Implant → Cloudflare (optional) → Kasm Nginx Proxy → Empire Listener
                                              ↓
                                    Dynamic Route Registration
                                              ↓
                                    listener-abc123.kasm.attck.nexus:8443
```

### How It Works

1. User creates Empire listener through RTPI UI
2. RTPI registers dynamic proxy route in Kasm nginx
3. (Optional) Creates Cloudflare DNS record in production
4. Implants connect to proxy subdomain
5. Nginx forwards to Empire listener port
6. Empire handles C2 communications

### Kasm Nginx Configuration Manager

**File:** `rtpi/server/services/kasm-nginx-manager.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { db } from '../db';
import { empireListeners } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const execAsync = promisify(exec);

// ============================================================================
// Kasm Nginx Configuration Manager
// ============================================================================

interface ProxyRoute {
  subdomain: string;
  port: number;
  target: string;
  ssl?: boolean;
}

export class KasmNginxManager {
  private configPath: string;
  private nginxContainer: string;

  constructor(
    configPath: string = '/etc/nginx/conf.d',
    nginxContainer: string = 'kasm-proxy'
  ) {
    this.configPath = configPath;
    this.nginxContainer = nginxContainer;
  }

  /**
   * Register a new proxy route for Empire listener
   */
  async registerListenerRoute(listenerId: string, listenerName: string, port: number): Promise<string> {
    // Generate unique subdomain
    const subdomain = `listener-${listenerId.substring(0, 8)}`;
    const domain = process.env.KASM_DOMAIN || 'kasm.attck.nexus';
    const fullDomain = `${subdomain}.${domain}`;

    // Create nginx configuration
    const config = this.generateNginxConfig({
      subdomain: fullDomain,
      port,
      target: `http://empire-server:${port}`,
      ssl: true
    });

    // Write config file
    const configFile = `${this.configPath}/empire-listener-${listenerId}.conf`;
    await this.writeNginxConfig(configFile, config);

    // Reload nginx
    await this.reloadNginx();

    // Update database
    await db
      .update(empireListeners)
      .set({
        proxyEnabled: true,
        proxySubdomain: fullDomain,
        proxyPort: 8443
      })
      .where(eq(empireListeners.empireListenerId, listenerId));

    // (Optional) Create Cloudflare DNS record in production
    if (process.env.NODE_ENV === 'production' && process.env.CLOUDFLARE_API_TOKEN) {
      await this.createCloudflareDNS(subdomain, domain);
    }

    console.log(`[Kasm Nginx] Registered proxy route: ${fullDomain} → empire-server:${port}`);
    return fullDomain;
  }

  /**
   * Remove proxy route for Empire listener
   */
  async removeListenerRoute(listenerId: string): Promise<void> {
    const configFile = `${this.configPath}/empire-listener-${listenerId}.conf`;

    // Get listener details for cleanup
    const listener = await db
      .select()
      .from(empireListeners)
      .where(eq(empireListeners.empireListenerId, listenerId))
      .limit(1);

    // Remove nginx config
    await this.removeNginxConfig(configFile);

    // Reload nginx
    await this.reloadNginx();

    // (Optional) Remove Cloudflare DNS record
    if (listener.length > 0 && listener[0].proxySubdomain) {
      const subdomain = listener[0].proxySubdomain.split('.')[0];
      await this.removeCloudflareDNS(subdomain);
    }

    // Update database
    await db
      .update(empireListeners)
      .set({
        proxyEnabled: false,
        proxySubdomain: null,
        proxyPort: null
      })
      .where(eq(empireListeners.empireListenerId, listenerId));

    console.log(`[Kasm Nginx] Removed proxy route for listener: ${listenerId}`);
  }

  /**
   * Generate nginx configuration for listener
   */
  private generateNginxConfig(route: ProxyRoute): string {
    return `
# Empire Listener Proxy Configuration
# Generated: ${new Date().toISOString()}
# Subdomain: ${route.subdomain}

server {
    listen 8443 ssl;
    server_name ${route.subdomain};

    # SSL Configuration (using Kasm certs)
    ssl_certificate /opt/kasm/current/certs/kasm.crt;
    ssl_certificate_key /opt/kasm/current/certs/kasm.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Proxy settings
    location / {
        proxy_pass ${route.target};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Empire C2 specific settings
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts for long-polling agents
        proxy_connect_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
        
        # Buffer settings
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Access logging
    access_log /var/log/nginx/empire-${route.port}-access.log;
    error_log /var/log/nginx/empire-${route.port}-error.log;
}
`;
  }

  /**
   * Write nginx configuration file
   */
  private async writeNginxConfig(filePath: string, content: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      // In development, write to local configs directory
      const localPath = `./configs/kasm/listeners/${filePath.split('/').pop()}`;
      await fs.mkdir('./configs/kasm/listeners', { recursive: true });
      await fs.writeFile(localPath, content);
      console.log(`[Dev] Written nginx config to ${localPath}`);
    } else {
      // In production, write directly to nginx container
      await execAsync(`docker exec ${this.nginxContainer} sh -c 'echo "${content.replace(/"/g, '\\"')}" > ${filePath}'`);
    }
  }

  /**
   * Remove nginx configuration file
   */
  private async removeNginxConfig(filePath: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      const localPath = `./configs/kasm/listeners/${filePath.split('/').pop()}`;
      await fs.unlink(localPath).catch(() => {});
    } else {
      await execAsync(`docker exec ${this.nginxContainer} rm -f ${filePath}`);
    }
  }

  /**
   * Reload nginx configuration
   */
  private async reloadNginx(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Dev] Nginx reload skipped in development');
      return;
    }

    try {
      // Test configuration first
      await execAsync(`docker exec ${this.nginxContainer} nginx -t`);
      
      // Reload if test passes
      await execAsync(`docker exec ${this.nginxContainer} nginx -s reload`);
      console.log('[Kasm Nginx] Configuration reloaded successfully');
    } catch (error) {
      console.error('[Kasm Nginx] Failed to reload configuration:', error);
      throw new Error('Failed to reload nginx configuration');
    }
  }

  /**
   * Create Cloudflare DNS record for listener
   */
  private async createCloudflareDNS(subdomain: string, domain: string): Promise<void> {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;

    if (!apiToken || !zoneId) {
      console.warn('[Cloudflare] API token or zone ID not configured, skipping DNS');
      return;
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'CNAME',
            name: `${subdomain}.${domain}`,
            content: domain,
            ttl: 300,
            proxied: true
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Cloudflare API error: ${response.statusText}`);
      }

      console.log(`[Cloudflare] Created DNS record: ${subdomain}.${domain}`);
    } catch (error) {
      console.error('[Cloudflare] Failed to create DNS record:', error);
      // Don't throw - DNS is optional
    }
  }

  /**
   * Remove Cloudflare DNS record
   */
  private async removeCloudflareDNS(subdomain: string): Promise<void> {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;

    if (!apiToken || !zoneId) {
      return;
    }

    try {
      // Get DNS record ID
      const listResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${subdomain}`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const listData = await listResponse.json();
      const recordId = listData.result?.[0]?.id;

      if (recordId) {
        // Delete DNS record
        await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log(`[Cloudflare] Deleted DNS record: ${subdomain}`);
      }
    } catch (error) {
      console.error('[Cloudflare] Failed to delete DNS record:', error);
      // Don't throw - DNS cleanup is optional
    }
  }

  /**
   * List all active proxy routes
   */
  async listRoutes(): Promise<any[]> {
    const listeners = await db
      .select()
      .from(empireListeners)
      .where(eq(empireListeners.proxyEnabled, true));

    return listeners.map(listener => ({
      listenerId: listener.empireListenerId,
      listenerName: listener.listenerName,
      subdomain: listener.proxySubdomain,
      port: listener.port,
      proxyPort: listener.proxyPort,
      status: listener.status
    }));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let kasmNginxManager: KasmNginxManager | null = null;

export function getKasmNginxManager(): KasmNginxManager {
  if (!kasmNginxManager) {
    kasmNginxManager = new KasmNginxManager();
  }
  return kasmNginxManager;
}
```

### Integration with Empire Executor

Update `empire-executor.ts` to automatically register proxy routes:

```typescript
// Add to Empire Executor createListener method

async createListener(options: {
  name: string;
  listenerType: string;
  port: number;
  host?: string;
  operationId?: string;
  userId?: string;
  enableProxy?: boolean;  // NEW
}): Promise<EmpireListener> {
  // ... existing listener creation code ...

  // Automatically register proxy route if enabled
  if (options.enableProxy !== false) {  // Default to true
    const kasmNginx = getKasmNginxManager();
    const proxyDomain = await kasmNginx.registerListenerRoute(
      listener.id,
      options.name,
      options.port
    );
    
    console.log(`[Empire] Listener accessible at: https://${proxyDomain}`);
  }

  return listener;
}
```

### Environment Variables

Add to `.env.example`:

```bash
# ============================================================================
# Kasm Nginx Proxy Configuration
# ============================================================================

KASM_DOMAIN=kasm.attck.nexus
KASM_NGINX_CONTAINER=kasm-proxy

# Cloudflare DNS Integration (Production only)
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
CLOUDFLARE_ZONE_ID=your-zone-id
```

### Testing the Dynamic Proxy

**Test script:** `rtpi/scripts/test-listener-proxy.sh`

```bash
#!/bin/bash
# Test Empire listener proxy routing

set -e

echo "Testing Dynamic Listener Proxy..."

# Configuration
LISTENER_NAME="test_http_listener"
LISTENER_PORT=8080
EMPIRE_API="http://localhost:1337"
API_KEY=${EMPIRE_API_KEY}

# 1. Create Empire listener
echo "1. Creating Empire listener on port ${LISTENER_PORT}..."
curl -X POST "${EMPIRE_API}/api/listeners/http" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"Name\": \"${LISTENER_NAME}\",
    \"Port\": ${LISTENER_PORT},
    \"Host\": \"http://0.0.0.0:${LISTENER_PORT}\"
  }"

# 2. Get listener ID
echo "2. Getting listener ID..."
LISTENER_ID=$(curl -s "${EMPIRE_API}/api/listeners" \
  -H "Authorization: Bearer ${API_KEY}" | \
  jq -r ".listeners[] | select(.name==\"${LISTENER_NAME}\") | .id")

echo "   Listener ID: ${LISTENER_ID}"

# 3. Verify proxy route was created
echo "3. Checking proxy route..."
PROXY_SUBDOMAIN="listener-${LISTENER_ID:0:8}.kasm.attck.nexus"
echo "   Proxy subdomain: ${PROXY_SUBDOMAIN}"

# 4. Test proxy connection
echo "4. Testing proxy connection..."
curl -k -I "https://${PROXY_SUBDOMAIN}:8443" || echo "   (Expected: connection to Empire listener)"

# 5. Verify nginx configuration
echo "5. Verifying nginx configuration..."
docker exec kasm-proxy cat /etc/nginx/conf.d/empire-listener-${LISTENER_ID}.conf

echo "✅ Dynamic proxy test complete!"
```

### Manual Testing Procedure

1. **Create Listener with Proxy:**
```bash
curl -X POST http://localhost:5000/api/v1/empire/listeners \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_listener",
    "listenerType": "http",
    "port": 8080,
    "enableProxy": true
  }'
```

2. **Verify Proxy Route:**
```bash
# Check nginx configuration
docker exec kasm-proxy ls -la /etc/nginx/conf.d/ | grep empire

# Test connection
curl -k https://listener-abc123.kasm.attck.nexus:8443
```

3. **Check Database:**
```sql
SELECT 
  listener_name,
  port,
  proxy_enabled,
  proxy_subdomain,
  proxy_port,
  status
FROM empire_listeners
WHERE proxy_enabled = true;
```

4. **Delete Listener:**
```bash
curl -X DELETE http://localhost:5000/api/v1/empire/listeners/LISTENER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

5. **Verify Cleanup:**
```bash
# Nginx config should be removed
docker exec kasm-proxy ls -la /etc/nginx/conf.d/ | grep empire

# Database should show proxy_enabled = false
```

### Troubleshooting

#### Proxy Route Not Working

**Problem:** Can't connect to listener through proxy
**Check:**
```bash
# Verify nginx config exists
docker exec kasm-proxy cat /etc/nginx/conf.d/empire-listener-*.conf

# Check nginx error logs
docker exec kasm-proxy tail -f /var/log/nginx/error.log

# Test Empire listener directly
curl http://localhost:8080

# Test nginx reload
docker exec kasm-proxy nginx -t
```

#### Cloudflare DNS Not Creating

**Problem:** DNS record not appearing in Cloudflare
**Check:**
```bash
# Verify environment variables
echo $CLOUDFLARE_API_TOKEN
echo $CLOUDFLARE_ZONE_ID

# Check RTPI logs for Cloudflare errors
docker compose logs rtpi-backend | grep Cloudflare

# Manually create DNS record
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CNAME",
    "name": "listener-test",
    "content": "kasm.attck.nexus"
  }'
```

---

## Agent Configuration

### Overview

The Empire C2 Agent is a specialized RTPI agent that orchestrates Empire framework operations. It provides intelligent automation for C2 tasks, integrates with the workflow system, and enables AI-powered decision making for post-exploitation activities.

### Agent Definition

**Create in RTPI agents table:**

```typescript
// File: rtpi/server/seed-data/empire-agent.ts

import { db } from '../db';
import { agents } from '../../shared/schema';

export async function createEmpireAgent() {
  const empireAgent = await db.insert(agents).values({
    name: "Empire C2 Manager",
    type: "custom",
    status: "idle",
    config: {
      // AI Model Configuration
      model: "gpt-4",
      
      // System Prompt
      systemPrompt: `You are an expert Empire C2 Framework operator with deep knowledge of:

## Core Capabilities
- Creating and managing listeners (HTTP, HTTPS, Meterpreter)
- Generating stagers and payloads for various platforms (Windows, Linux, macOS)
- Managing implanted agents and coordinating multi-agent operations
- Executing post-exploitation modules (privilege escalation, lateral movement, persistence)
- Harvesting credentials and sensitive data
- Performing reconnaissance and enumeration
- Coordinating complex multi-stage attacks

## Operating Principles
1. **Operational Security**: Always consider OPSEC implications
2. **Stealth**: Minimize noise and detection risk
3. **Persistence**: Establish and maintain access
4. **Documentation**: Track all actions and findings
5. **Escalation**: Systematically escalate privileges
6. **Lateral Movement**: Expand access across the network

## Available Tools
You have access to Empire C2 through RTPI's API integration. You can:
- Create listeners on specified ports
- Generate platform-specific stagers (PowerShell, Python, C#)
- Execute shell commands on compromised hosts
- Run Empire modules for specific tasks
- Harvest and manage credentials
- Track and coordinate multiple agents

## Workflow Integration
You work within RTPI's agent workflow system:
- Receive tasks from the workflow orchestrator
- Coordinate with other RTPI agents (reconnaissance, exploitation)
- Report findings to RTPI's vulnerability database
- Link compromised hosts to operations and targets

Always operate within the scope of the assigned operation and follow rules of engagement.`,

      // Capabilities
      capabilities: [
        "c2_management",
        "payload_generation",
        "post_exploitation",
        "credential_harvesting",
        "lateral_movement",
        "persistence_establishment",
        "privilege_escalation",
        "reconnaissance",
        "multi_agent_coordination"
      ],

      // Tool Settings
      toolSettings: {
        empireApiUrl: process.env.EMPIRE_BASE_URL || "http://empire-server:1337",
        empireApiKey: process.env.EMPIRE_API_KEY,
        
        // Default listener configuration
        defaultListenerType: "http",
        defaultListenerPort: 8080,
        defaultProfile: "/admin/get.php,/news.php,/login/process.php|Mozilla/5.0",
        
        // Default stager settings
        preferredStagerTypes: {
          windows: "multi/launcher",
          linux: "multi/bash",
          macos: "osx/launcher"
        },
        
        // Operational settings
        defaultDelay: 5,
        defaultJitter: 0.2,
        maxAgentsPerOperation: 50,
        agentCheckInterval: 30000, // 30 seconds
        
        // Module preferences
        preferredModules: {
          enum: "situational_awareness/host/winenum",
          privesc: "privesc/windows/bypassuac",
          persistence: "persistence/elevated/registry",
          lateralMovement: "lateral_movement/invoke_wmi"
        }
      },

      // Loop Configuration (for multi-agent coordination)
      loopEnabled: false,
      loopPartnerId: null,
      maxLoopIterations: 10,
      loopExitCondition: "task_complete",

      // Workflow Configuration
      flowOrder: 3, // Runs after reconnaissance and exploitation agents
      enabledTools: [
        "empire_api",
        "network_scanner",
        "credential_harvester"
      ]
    },

    // Capabilities array
    capabilities: [
      "c2_management",
      "payload_generation",
      "post_exploitation"
    ]
  }).returning();

  console.log('✅ Empire C2 Agent created:', empireAgent[0].id);
  return empireAgent[0];
}
```

### Agent Seed Script

**File:** `rtpi/scripts/seed-empire-agent.ts`

```typescript
import { createEmpireAgent } from '../server/seed-data/empire-agent';

async function main() {
  console.log('Seeding Empire C2 Agent...');
  
  try {
    await createEmpireAgent();
    console.log('✅ Empire C2 Agent seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed Empire C2 Agent:', error);
    process.exit(1);
  }
}

main();
```

Run with:
```bash
npm run seed:empire-agent
```

### Agent Workflow Integration

**Example: Post-Exploitation Workflow**

```typescript
// File: rtpi/server/workflows/post-exploitation-workflow.ts

import { getEmpireExecutor } from '../services/empire-executor';
import { db } from '../db';
import { agentWorkflows, workflowTasks } from '../../shared/schema';

export async function createPostExploitationWorkflow(
  targetId: string,
  operationId: string,
  userId: string
) {
  const empire = getEmpireExecutor();

  // Create workflow
  const workflow = await db.insert(agentWorkflows).values({
    name: 'Post-Exploitation - Empire C2',
    workflowType: 'post_exploitation',
    targetId,
    operationId,
    createdBy: userId,
    status: 'pending'
  }).returning();

  // Task 1: Create listener
  await db.insert(workflowTasks).values({
    workflowId: workflow[0].id,
    agentId: EMPIRE_AGENT_ID, // From agents table
    taskType: 'custom',
    taskName: 'Create HTTP Listener',
    sequenceOrder: 1,
    inputData: {
      listenerType: 'http',
      port: 8080,
      name: `op_${operationId}_listener`
    }
  });

  // Task 2: Generate stager
  await db.insert(workflowTasks).values({
    workflowId: workflow[0].id,
    agentId: EMPIRE_AGENT_ID,
    taskType: 'custom',
    taskName: 'Generate PowerShell Stager',
    sequenceOrder: 2,
    inputData: {
      stagerType: 'multi/launcher',
      listener: `op_${operationId}_listener`
    }
  });

  // Task 3: Wait for agent check-in
  await db.insert(workflowTasks).values({
    workflowId: workflow[0].id,
    agentId: EMPIRE_AGENT_ID,
    taskType: 'analyze',
    taskName: 'Monitor for Agent Check-in',
    sequenceOrder: 3,
    inputData: {
      timeout: 3600000, // 1 hour
      autoSync: true
    }
  });

  // Task 4: Execute reconnaissance module
  await db.insert(workflowTasks).values({
    workflowId: workflow[0].id,
    agentId: EMPIRE_AGENT_ID,
    taskType: 'analyze',
    taskName: 'Execute Reconnaissance',
    sequenceOrder: 4,
    inputData: {
      module: 'situational_awareness/host/winenum'
    }
  });

  console.log(`Created post-exploitation workflow: ${workflow[0].id}`);
  return workflow[0];
}
```

### Agent Tools Integration

Register Empire tools with the agent:

```typescript
// Add to security_tools table
await db.insert(securityTools).values({
  name: 'Empire C2 Framework',
  category: 'post_exploitation',
  description: 'PowerShell and Python post-exploitation agent framework',
  status: 'running',
  endpoint: 'http://empire-server:1337',
  version: '5.0.0',
  metadata: {
    languages: ['powershell', 'python', 'csharp'],
    platforms: ['windows', 'linux', 'macos'],
    modules: 400+,
    stagers: 20+
  }
});
```

### Agent Monitoring

**Background job to monitor Empire agents:**

```typescript
// File: rtpi/server/jobs/empire-agent-monitor.ts

import { getEmpireExecutor } from '../services/empire-executor';
import { db } from '../db';
import { empireSessions } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export async function monitorEmpireAgents() {
  const empire = getEmpireExecutor();

  try {
    // Get all agents from Empire
    const empireAgents = await empire.getAgents();
    const empireAgentIds = new Set(empireAgents.map(a => a.ID));

    // Sync active agents
    await empire.syncAgentsToRTPI();

    // Mark agents as lost if they haven't checked in
    const rtpiSessions = await db
      .select()
      .from(empireSessions)
      .where(eq(empireSessions.status, 'active'));

    for (const session of rtpiSessions) {
      if (!empireAgentIds.has(session.empireAgentId)) {
        // Agent not found in Empire - mark as lost
        await db
          .update(empireSessions)
          .set({
            status: 'lost',
            updatedAt: new Date()
          })
          .where(eq(empireSessions.id, session.id));

        console.log(`[Monitor] Marked agent as lost: ${session.empireAgentId}`);
      }
    }

    console.log(`[Monitor] Checked ${empireAgents.length} Empire agents`);
  } catch (error) {
    console.error('[Monitor] Empire agent monitoring failed:', error);
  }
}

// Run every 30 seconds
setInterval(monitorEmpireAgents, 30000);
```

### Add Monitoring to Server

**Update `rtpi/server/index.ts`:**

```typescript
import { monitorEmpireAgents } from './jobs/empire-agent-monitor';

// ... existing code ...

// Start background jobs
if (process.env.NODE_ENV !== 'test') {
  // Start Empire agent monitoring
  monitorEmpireAgents();
  console.log('✓ Started Empire agent monitoring');
}
```

---

## UI Integration

### Overview

The UI Integration provides a comprehensive React-based interface for managing Empire C2 operations within RTPI. Users can create listeners, generate stagers, monitor agents, and execute commands through a modern, intuitive interface.

### Page Structure

Add Empire C2 management to the Infrastructure page or create a dedicated Empire page.

### Empire Management Component

**File:** `rtpi/client/src/components/empire/EmpireManager.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface EmpireListener {
  id: string;
  name: string;
  listener_type: string;
  enabled: boolean;
  options: any;
}

interface EmpireAgent {
  ID: string;
  name: string;
  hostname: string;
  username: string;
  internal_ip: string;
  external_ip: string;
  lastseen_time: string;
  high_integrity: number;
}

export function EmpireManager() {
  const [listeners, setListeners] = useState<EmpireListener[]>([]);
  const [agents, setAgents] = useState<EmpireAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmpireData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadEmpireData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadEmpireData() {
    try {
      const [listenersRes, agentsRes] = await Promise.all([
        fetch('/api/v1/empire/listeners'),
        fetch('/api/v1/empire/agents')
      ]);

      const listenersData = await listenersRes.json();
      const agentsData = await agentsRes.json();

      setListeners(listenersData.listeners || []);
      setAgents(agentsData.agents || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load Empire data:', error);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Empire C2</h2>
          <p className="text-muted-foreground">
            Manage listeners, agents, and post-exploitation operations
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={agents.length > 0 ? "default" : "secondary"}>
            {agents.length} Active Agents
          </Badge>
          <Badge variant={listeners.length > 0 ? "default" : "secondary"}>
            {listeners.length} Listeners
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="listeners" className="w-full">
        <TabsList>
          <TabsTrigger value="listeners">Listeners</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="stagers">Stagers</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
        </TabsList>

        <TabsContent value="listeners">
          <ListenersTab listeners={listeners} onRefresh={loadEmpireData} />
        </TabsContent>

        <TabsContent value="agents">
          <AgentsTab agents={agents} onRefresh={loadEmpireData} />
        </TabsContent>

        <TabsContent value="stagers">
          <StagersTab onRefresh={loadEmpireData} />
        </TabsContent>

        <TabsContent value="modules">
          <ModulesTab agents={agents} />
        </TabsContent>

        <TabsContent value="credentials">
          <CredentialsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Listeners Tab Component

**File:** `rtpi/client/src/components/empire/ListenersTab.tsx`

```typescript
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Trash2, Copy } from 'lucide-react';

export function ListenersTab({ listeners, onRefresh }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [listenerForm, setListenerForm] = useState({
    name: '',
    listenerType: 'http',
    port: 8080
  });

  async function createListener() {
    try {
      const response = await fetch('/api/v1/empire/listeners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...listenerForm,
          enableProxy: true
        })
      });

      if (response.ok) {
        setShowCreateDialog(false);
        setListenerForm({ name: '', listenerType: 'http', port: 8080 });
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to create listener:', error);
    }
  }

  async function deleteListener(listenerId: string) {
    if (!confirm('Delete this listener? Active agents will be disconnected.')) {
      return;
    }

    try {
      await fetch(`/api/v1/empire/listeners/${listenerId}`, {
        method: 'DELETE'
      });
      onRefresh();
    } catch (error) {
      console.error('Failed to delete listener:', error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="text-lg font-semibold">Active Listeners</h3>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Play className="mr-2 h-4 w-4" />
              Create Listener
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Empire Listener</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Listener Name</Label>
                <Input
                  value={listenerForm.name}
                  onChange={(e) => setListenerForm({ ...listenerForm, name: e.target.value })}
                  placeholder="http_listener_01"
                />
              </div>
              <div>
                <Label>Listener Type</Label>
                <Select
                  value={listenerForm.listenerType}
                  onValueChange={(value) => setListenerForm({ ...listenerForm, listenerType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                    <SelectItem value="meterpreter">Meterpreter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Port</Label>
                <Input
                  type="number"
                  value={listenerForm.port}
                  onChange={(e) => setListenerForm({ ...listenerForm, port: parseInt(e.target.value) })}
                />
              </div>
              <Button onClick={createListener} className="w-full">
                Create Listener
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {listeners.map(listener => (
          <Card key={listener.id}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{listener.name}</h4>
                    <Badge variant={listener.enabled ? "default" : "secondary"}>
                      {listener.enabled ? 'Active' : 'Stopped'}
                    </Badge>
                    <Badge variant="outline">{listener.listener_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Port: {listener.options?.Port}
                  </p>
                  {listener.options?.ProxyDomain && (
                    <p className="text-sm">
                      <span className="font-medium">Proxy URL:</span>{' '}
                      <code className="bg-muted px-1 rounded">
                        https://{listener.options.ProxyDomain}:8443
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2"
                        onClick={() => navigator.clipboard.writeText(`https://${listener.options.ProxyDomain}:8443`)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteListener(listener.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {listeners.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No listeners running. Create one to begin C2 operations.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

### Agents Tab Component

**File:** `rtpi/client/src/components/empire/AgentsTab.tsx`

```typescript
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Terminal, Skull, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function AgentsTab({ agents, onRefresh }) {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [command, setCommand] = useState('');
  const [commandResult, setCommandResult] = useState('');

  async function executeCommand(agentId: string) {
    try {
      const response = await fetch(`/api/v1/empire/agents/${agentId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      const data = await response.json();
      setCommandResult(JSON.stringify(data.result, null, 2));
      setCommand('');
    } catch (error) {
      console.error('Failed to execute command:', error);
      setCommandResult(`Error: ${error.message}`);
    }
  }

  async function killAgent(agentId: string) {
    if (!confirm('Kill this agent? This action cannot be undone.')) {
      return;
    }

    try {
      await fetch(`/api/v1/empire/agents/${agentId}`, {
        method: 'DELETE'
      });
      onRefresh();
      setSelectedAgent(null);
    } catch (error) {
      console.error('Failed to kill agent:', error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="text-lg font-semibold">Active Agents ({agents.length})</h3>
        <Button onClick={onRefresh} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map(agent => (
          <Card key={agent.ID} className="cursor-pointer hover:border-primary" onClick={() => setSelectedAgent(agent)}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{agent.name}</h4>
                  {agent.high_integrity === 1 && (
                    <Badge variant="destructive">High Integrity</Badge>
                  )}
                </div>
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Host:</span> {agent.hostname}</p>
                  <p><span className="font-medium">User:</span> {agent.username}</p>
                  <p><span className="font-medium">IP:</span> {agent.internal_ip}</p>
                  <p className="text-muted-foreground">
                    Last seen {formatDistanceToNow(new Date(agent.lastseen_time))} ago
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {agents.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="pt-6 text-center text-muted-foreground">
              No agents connected. Deploy a stager to establish C2 connection.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Agent Detail Dialog */}
      <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Agent: {selectedAgent?.name}</DialogTitle>
          </DialogHeader>
          {selectedAgent && (
            <div className="space-y-4">
              {/* Agent Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Agent Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">Hostname:</span> {selectedAgent.hostname}</div>
                  <div><span className="font-medium">Username:</span> {selectedAgent.username}</div>
                  <div><span className="font-medium">Internal IP:</span> {selectedAgent.internal_ip}</div>
                  <div><span className="font-medium">External IP:</span> {selectedAgent.external_ip}</div>
                  <div><span className="font-medium">Language:</span> {selectedAgent.language}</div>
                  <div><span className="font-medium">Process:</span> {selectedAgent.process_name}</div>
                </CardContent>
              </Card>

              {/* Command Execution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Execute Command
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Textarea
                    placeholder="whoami"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={() => executeCommand(selectedAgent.ID)} className="w-full">
                    <Terminal className="mr-2 h-4 w-4" />
                    Execute
                  </Button>
                  {commandResult && (
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60">
                      {commandResult}
                    </pre>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="destructive" onClick={() => killAgent(selectedAgent.ID)}>
                  <Skull className="mr-2 h-4 w-4" />
                  Kill Agent
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

### Stagers Tab Component

**File:** `rtpi/client/src/components/empire/StagersTab.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Download } from 'lucide-react';

export function StagersTab({ onRefresh }) {
  const [stagerTypes, setStagerTypes] = useState([]);
  const [listeners, setListeners] = useState([]);
  const [selectedStager, setSelectedStager] = useState('multi/launcher');
  const [selectedListener, setSelectedListener] = useState('');
  const [generatedStager, setGeneratedStager] = useState('');

  useEffect(() => {
    loadStagerData();
  }, []);

  async function loadStagerData() {
    try {
      const [stagersRes, listenersRes] = await Promise.all([
        fetch('/api/v1/empire/stagers'),
        fetch('/api/v1/empire/listeners')
      ]);

      const stagersData = await stagersRes.json();
      const listenersData = await listenersRes.json();

      setStagerTypes(stagersData.stagers || []);
      setListeners(listenersData.listeners || []);
      
      if (listenersData.listeners?.length > 0) {
        setSelectedListener(listenersData.listeners[0].name);
      }
    } catch (error) {
      console.error('Failed to load stager data:', error);
    }
  }

  async function generateStager() {
    try {
      const response = await fetch('/api/v1/empire/stagers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagerType: selectedStager,
          listener: selectedListener,
          base64: true
        })
      });

      const data = await response.json();
      setGeneratedStager(data.stager.output);
    } catch (error) {
      console.error('Failed to generate stager:', error);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(generatedStager);
  }

  function downloadStager() {
    const blob = new Blob([generatedStager], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedStager.replace('/', '_')}_stager.txt`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate Stager</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Stager Type</Label>
              <Select value={selectedStager} onValueChange={setSelectedStager}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stagerTypes.map(stager => (
                    <SelectItem key={stager} value={stager}>
                      {stager}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Listener</Label>
              <Select value={selectedListener} onValueChange={setSelectedListener}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {listeners.map(listener => (
                    <SelectItem key={listener.id} value={listener.name}>
                      {listener.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={generateStager} className="w-full">
            Generate Stager
          </Button>

          {generatedStager && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Generated Payload</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    <Copy className="mr-2 h-3 w-3" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadStager}>
                    <Download className="mr-2 h-3 w-3" />
                    Download
                  </Button>
                </div>
              </div>
              <Textarea
                value={generatedStager}
                readOnly
                rows={10}
                className="font-mono text-xs"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Infrastructure Page Integration

Add Empire status to the existing Infrastructure page:

**File:** `rtpi/client/src/pages/Infrastructure.tsx`

```typescript
import { EmpireManager } from '@/components/empire/EmpireManager';

export function Infrastructure() {
  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* Existing infrastructure components */}
      
      {/* Empire C2 Section */}
      <section>
        <EmpireManager />
      </section>
      
      {/* Other infrastructure components */}
    </div>
  );
}
```

### Add Empire to Sidebar Navigation

**File:** `rtpi/client/src/components/Sidebar.tsx`

```typescript
import { Crown } from 'lucide-react'; // Empire icon

const navigation = [
  // ... existing items ...
  {
    name: 'Empire C2',
    href: '/empire',
    icon: Crown,
    roles: ['admin', 'operator']
  },
  // ... rest of items ...
];
```

### Create Dedicated Empire Page (Optional)

**File:** `rtpi/client/src/pages/Empire.tsx`

```typescript
import { EmpireManager } from '@/components/empire/EmpireManager';

export function EmpirePage() {
  return (
    <div className="container mx-auto py-6">
      <EmpireManager />
    </div>
  );
}
```

Add route:
```typescript
// In App.tsx or router config
import { EmpirePage } from '@/pages/Empire';

{
  path: '/empire',
  element: <EmpirePage />,
  requiredRole: ['admin', 'operator']
}
```

### Operation Integration

Add Empire session tracking to operation details:

**File:** `rtpi/client/src/components/operations/OperationEmpireSessions.tsx`

```typescript
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function OperationEmpireSessions({ operationId }) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    loadSessions();
  }, [operationId]);

  async function loadSessions() {
    try {
      const response = await fetch(`/api/v1/operations/${operationId}/empire-sessions`);
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to load Empire sessions:', error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Empire C2 Agents</CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length > 0 ? (
          <div className="space-y-2">
            {sessions.map(session => (
              <div key={session.id} className="flex justify-between items-center p-2 border rounded">
                <div className="text-sm">
                  <p className="font-medium">{session.hostname}</p>
                  <p className="text-muted-foreground">{session.username}@{session.internal_ip}</p>
                </div>
                <Badge variant={
                  session.status === 'active' ? 'default' :
                  session.status === 'lost' ? 'destructive' :
                  'secondary'
                }>
                  {session.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No Empire agents for this operation</p>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Testing Requirements

### Overview

Comprehensive testing is essential for Empire C2 integration. This section defines testing requirements across unit, integration, and end-to-end levels.

### Test Coverage Goals

| Test Type | Target Coverage | Priority |
|-----------|----------------|----------|
| Unit Tests | 80%+ | 🔴 High |
| Integration Tests | 70%+ | 🟡 Medium |
| E2E Tests | 60%+ | 🟡 Medium |

### Unit Tests

**File:** `rtpi/tests/unit/empire-executor.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmpireExecutor } from '../../server/services/empire-executor';

describe('EmpireExecutor', () => {
  let executor: EmpireExecutor;

  beforeEach(() => {
    executor = new EmpireExecutor({
      baseURL: 'http://localhost:1337',
      apiKey: 'test-key'
    });
  });

  describe('User Token Management', () => {
    it('should create new token for user', async () => {
      const token = await executor.getUserToken('user-123');
      expect(token).toBeDefined();
      expect(token).toContain('rtpi_user-123');
    });

    it('should reuse existing active token', async () => {
      const token1 = await executor.getUserToken('user-123');
      const token2 = await executor.getUserToken('user-123');
      expect(token1).toBe(token2);
    });

    it('should revoke user token', async () => {
      await executor.revokeUserToken('user-123');
      // Verify token is marked inactive
    });
  });

  describe('Listener Management', () => {
    it('should create HTTP listener', async () => {
      const listener = await executor.createListener({
        name: 'test_listener',
        listenerType: 'http',
        port: 8080
      });
      expect(listener).toBeDefined();
      expect(listener.name).toBe('test_listener');
    });

    it('should list all listeners', async () => {
      const listeners = await executor.getListeners();
      expect(Array.isArray(listeners)).toBe(true);
    });

    it('should delete listener', async () => {
      await executor.deleteListener('listener-id');
      // Verify listener is removed
    });
  });

  describe('Agent Management', () => {
    it('should get all agents', async () => {
      const agents = await executor.getAgents();
      expect(Array.isArray(agents)).toBe(true);
    });

    it('should execute command on agent', async () => {
      const result = await executor.executeCommand('agent-id', 'whoami');
      expect(result).toBeDefined();
    });

    it('should sync agents to RTPI database', async () => {
      await executor.syncAgentsToRTPI('operation-id');
      // Verify agents are in database
    });
  });

  describe('Stager Generation', () => {
    it('should generate PowerShell stager', async () => {
      const stager = await executor.generateStager({
        stagerType: 'multi/launcher',
        listener: 'test_listener',
        base64: true
      });
      expect(stager.output).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const isHealthy = await executor.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});
```

**File:** `rtpi/tests/unit/kasm-nginx-manager.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { KasmNginxManager } from '../../server/services/kasm-nginx-manager';

describe('KasmNginxManager', () => {
  let manager: KasmNginxManager;

  beforeEach(() => {
    manager = new KasmNginxManager();
  });

  it('should register listener route', async () => {
    const domain = await manager.registerListenerRoute('listener-123', 'test', 8080);
    expect(domain).toContain('listener-');
    expect(domain).toContain('.kasm.attck.nexus');
  });

  it('should remove listener route', async () => {
    await manager.removeListenerRoute('listener-123');
    // Verify route removed
  });

  it('should generate valid nginx config', () => {
    // Test nginx config generation
  });

  it('should list all active routes', async () => {
    const routes = await manager.listRoutes();
    expect(Array.isArray(routes)).toBe(true);
  });
});
```

### Integration Tests

**File:** `rtpi/tests/integration/empire-integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getEmpireExecutor } from '../../server/services/empire-executor';
import { getKasmNginxManager } from '../../server/services/kasm-nginx-manager';

describe('Empire Integration Tests', () => {
  let empire: ReturnType<typeof getEmpireExecutor>;
  let nginx: ReturnType<typeof getKasmNginxManager>;

  beforeAll(async () => {
    empire = getEmpireExecutor();
    nginx = getKasmNginxManager();
    
    // Ensure Empire is healthy
    const isHealthy = await empire.healthCheck();
    if (!isHealthy) {
      throw new Error('Empire is not healthy - cannot run integration tests');
    }
  });

  it('should create listener with automatic proxy', async () => {
    // Create listener
    const listener = await empire.createListener({
      name: 'integration_test_listener',
      listenerType: 'http',
      port: 8085,
      enableProxy: true
    });

    expect(listener).toBeDefined();

    // Verify proxy route was created
    const routes = await nginx.listRoutes();
    const route = routes.find(r => r.listenerId === listener.id);
    expect(route).toBeDefined();
    expect(route?.proxyEnabled).toBe(true);

    // Cleanup
    await empire.deleteListener(listener.id);
  });

  it('should sync agents to database', async () => {
    await empire.syncAgentsToRTPI('test-operation-id');
    
    // Verify agents in database
    // Check empire_sessions table
  });

  it('should generate and execute stager', async () => {
    // Create listener first
    const listener = await empire.createListener({
      name: 'stager_test_listener',
      listenerType: 'http',
      port: 8086
    });

    // Generate stager
    const stager = await empire.generateStager({
      stagerType: 'multi/launcher',
      listener: listener.name,
      base64: true
    });

    expect(stager.output).toBeDefined();
    expect(stager.output.length).toBeGreaterThan(0);

    // Cleanup
    await empire.deleteListener(listener.id);
  });
});
```

### End-to-End Tests

**File:** `rtpi/tests/e2e/empire-workflow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Empire C2 Workflow', () => {
  test('should complete full listener creation workflow', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Navigate to Empire page
    await page.click('text=Empire C2');
    await expect(page).toHaveURL(/.*empire/);

    // Create listener
    await page.click('text=Create Listener');
    await page.fill('[name="name"]', 'e2e_test_listener');
    await page.selectOption('[name="listenerType"]', 'http');
    await page.fill('[name="port"]', '8087');
    await page.click('button:has-text("Create Listener")');

    // Verify listener created
    await expect(page.locator('text=e2e_test_listener')).toBeVisible();
    await expect(page.locator('text=Active')).toBeVisible();

    // Generate stager
    await page.click('text=Stagers');

---

## VERIFICATION SUMMARY (2026-02-04)

### External Services Integration Status

**✅ Phase 1: Core Integrations - OPERATIONAL**
- ✅ **Metasploit:** Executor service exists (`server/services/metasploit-executor.ts`), terminal UI not implemented
- ✅ **BBOT:** Full integration (`server/services/bbot-executor.ts` 21,579 bytes)
- ✅ **Nuclei:** Complete integration (`server/services/nuclei-executor.ts` 18,563 bytes)
- ✅ **Docker Executor:** Base service operational (`server/services/docker-executor.ts` 15,042 bytes)

**✅ Phase 2: Kasm Workspaces - 100% COMPLETE**
- ✅ **Let's Encrypt Integration:** `server/services/ssl-certificate-manager.ts:1-50` with Certbot, HTTP-01/DNS-01 challenges
- ✅ **Burp Suite Dynamic Build:** `server/services/burp-image-builder.ts:1-50` dynamic Docker image builder with license key support

**✅ Phase 3: Tool Ecosystem - OPERATIONAL**
- ✅ **Tool Registry:** Tool Connector Agent discovers 20+ tools
- ✅ **Attack Workbench:** REST API client (`server/services/attack-workbench-client.ts`)
- ✅ **Workflow Integration:** All tools integrated with workflow orchestrator

### Overall Assessment
**Status:** External services integration substantially complete. All major scanning tools (BBOT, Nuclei, Metasploit), Kasm Workspaces with Let's Encrypt, and Burp Suite dynamic builds fully operational. ATT&CK Workbench sync functional.

**Last Updated:** February 4, 2026
