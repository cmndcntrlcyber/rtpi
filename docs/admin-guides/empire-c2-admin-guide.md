# Empire C2 Integration - Administrator Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Deployment](#deployment)
3. [Database Management](#database-management)
4. [Configuration](#configuration)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Backup & Recovery](#backup--recovery)
7. [Security Hardening](#security-hardening)
8. [Performance Tuning](#performance-tuning)
9. [Upgrade Procedures](#upgrade-procedures)

## Architecture Overview

### Components

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   RTPI UI   │────────▶│  RTPI API    │────────▶│  PostgreSQL │
└─────────────┘         │   (Express)   │         └─────────────┘
                        └──────────────┘                │
                                │                       │
                                │                       ▼
                                │               ┌──────────────┐
                                │               │ Empire Tables│
                                │               │ - servers    │
                                │               │ - agents     │
                                │               │ - tasks      │
                                ▼               │ - credentials│
                        ┌──────────────┐        └──────────────┘
                        │ Empire C2    │
                        │REST API      │
                        │(Port 1337)   │
                        └──────────────┘
```

### Database Schema

**9 Tables Created:**
1. `empire_servers` - Server configurations
2. `empire_user_tokens` - Authentication tokens
3. `empire_listeners` - Listener configurations
4. `empire_stagers` - Stager artifacts
5. `empire_agents` - Agent information
6. `empire_tasks` - Task queue
7. `empire_modules` - Available modules
8. `empire_credentials` - Harvested credentials
9. `empire_events` - Event log

**Foreign Key Relationships:**
- All tables reference `empire_servers` with CASCADE delete
- `empire_agents` references `targets` and `operations` (optional)
- `empire_tasks` references `empire_agents` with CASCADE delete

### API Endpoints

**Base Path:** `/api/v1/empire`

**Server Management:**
- `GET /servers` - List all servers
- `POST /servers` - Create server
- `GET /servers/:id` - Get server details
- `PATCH /servers/:id` - Update server
- `DELETE /servers/:id` - Delete server
- `POST /servers/:id/check-connection` - Test connection

**Listener Management:**
- `GET /servers/:id/listeners` - List listeners
- `POST /servers/:id/listeners` - Create listener
- `DELETE /servers/:id/listeners/:name` - Stop listener

**Agent Management:**
- `GET /servers/:id/agents` - List agents
- `POST /servers/:id/agents/sync` - Sync to database
- `DELETE /servers/:id/agents/:name` - Kill agent

**Task Execution:**
- `POST /servers/:id/agents/:name/tasks` - Execute shell command
- `POST /servers/:id/agents/:name/modules/:module` - Execute module
- `GET /servers/:id/agents/:name/tasks/:taskId` - Get task results

**Credential Management:**
- `GET /servers/:id/credentials` - List credentials
- `GET /servers/:id/db/credentials` - Get from database
- `POST /servers/:id/credentials/sync` - Sync to database

**Module Management:**
- `GET /servers/:id/modules` - List available modules

## Deployment

### Docker Deployment

Empire C2 is defined in `docker-compose.yml` but can be deployed separately.

**Option 1: Integrated Deployment**

```bash
# Start all services including Empire
docker compose up -d

# Verify Empire is running
docker ps | grep empire
curl -k https://localhost:1337/api/
```

**Option 2: External Empire Server**

If you have an existing Empire server:

1. Ensure REST API is enabled
2. Note the URL and credentials
3. Configure firewall to allow RTPI → Empire connection
4. Add server through RTPI UI

### Manual Deployment

**Prerequisites:**
- Empire 4.x or later installed
- REST API enabled in Empire config
- Admin account created

**Empire Configuration:**

```bash
# Edit Empire config
vim /opt/Empire/empire/server/config.yaml

# Enable REST API
api:
  enabled: true
  port: 1337
  host: 0.0.0.0

# Restart Empire
cd /opt/Empire
sudo systemctl restart empire
```

### Network Configuration

**Ports Required:**
- `1337` - Empire REST API
- `5001` - Empire Web UI (optional)
- `8080-8100` - Dynamic listener ports

**Firewall Rules:**

```bash
# Allow RTPI to Empire
sudo ufw allow from <RTPI_IP> to any port 1337 proto tcp

# Allow listener ports
sudo ufw allow 8080:8100/tcp
```

## Database Management

### Schema Validation

```bash
# Validate schema
npm run db:push

# Check tables exist
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c "\dt empire_*"

# Verify foreign keys
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c "\d empire_agents"
```

### Data Inspection

```sql
-- Count records
SELECT
  'servers' as table_name, COUNT(*) FROM empire_servers
UNION ALL
SELECT 'agents', COUNT(*) FROM empire_agents
UNION ALL
SELECT 'credentials', COUNT(*) FROM empire_credentials;

-- Check server status
SELECT id, name, status, last_heartbeat
FROM empire_servers
ORDER BY updated_at DESC;

-- View active agents
SELECT name, hostname, internal_ip, status, lastseen_time
FROM empire_agents
WHERE status = 'active'
ORDER BY lastseen_time DESC;
```

### Data Retention

**Recommended Retention Policies:**

```sql
-- Delete old tasks (older than 30 days)
DELETE FROM empire_tasks
WHERE created_at < NOW() - INTERVAL '30 days';

-- Delete lost agents (no callback in 7 days)
DELETE FROM empire_agents
WHERE lastseen_time < NOW() - INTERVAL '7 days'
  AND status = 'lost';

-- Archive old credentials
INSERT INTO empire_credentials_archive
SELECT * FROM empire_credentials
WHERE harvested_at < NOW() - INTERVAL '90 days';

DELETE FROM empire_credentials
WHERE harvested_at < NOW() - INTERVAL '90 days';
```

### Database Backup

```bash
# Backup Empire tables only
docker exec rtpi-postgres pg_dump -U rtpi -d rtpi_main \
  -t empire_servers \
  -t empire_agents \
  -t empire_credentials \
  -t empire_tasks \
  > empire_backup_$(date +%Y%m%d).sql

# Restore backup
docker exec -i rtpi-postgres psql -U rtpi -d rtpi_main < empire_backup_20251225.sql
```

## Configuration

### Environment Variables

```bash
# .env file
DATABASE_URL=postgresql://rtpi:password@localhost:5432/rtpi_main

# Empire-specific (optional)
EMPIRE_DEFAULT_USERNAME=empireadmin
EMPIRE_DEFAULT_PASSWORD=SecurePassword123!
EMPIRE_CONNECTION_TIMEOUT=10000
EMPIRE_MAX_RETRIES=3

# Encryption (REQUIRED for production)
ENCRYPTION_KEY=64_character_hex_key_here  # openssl rand -hex 32
```

### Server Configuration Defaults

Edit `server/api/v1/empire.ts` to change defaults:

```typescript
const [server] = await db.insert(empireServers).values({
  port: port || 1337,  // Default port
  restApiPort: restApiPort || 1337,
  adminUsername: adminUsername || "empireadmin",
  isActive: true,  // Auto-activate new servers
  status: "disconnected",
});
```

### Client Configuration

Edit `server/services/empire-executor.ts` for API client settings:

```typescript
const apiClient = axios.create({
  baseURL: server.restApiUrl,
  timeout: 10000,  // 10 second timeout
  httpsAgent: new https.Agent({
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  }),
});
```

## Monitoring & Maintenance

### Health Checks

```bash
# Check Empire connectivity
curl -X POST http://localhost:3001/api/v1/empire/servers/<SERVER_ID>/check-connection \
  -H "Cookie: connect.sid=<SESSION_COOKIE>"

# Verify database connectivity
docker exec rtpi-postgres pg_isready -U rtpi

# Check API health
curl http://localhost:3001/api/v1/health
```

### Logging

**Enable Debug Logging:**

```typescript
// server/services/empire-executor.ts
console.log('[Empire] Request:', method, endpoint);
console.log('[Empire] Response:', response.status, response.data);
```

**Log Locations:**
- RTPI API logs: `stdout` (Docker logs)
- Empire logs: `/opt/Empire/empire/server/data/empire.log`
- PostgreSQL logs: Docker volume `postgres_data`

**View Logs:**

```bash
# RTPI API logs
docker logs rtpi-api -f --tail 100

# Empire logs (if running in Docker)
docker logs rtpi-empire -f --tail 100

# Database logs
docker logs rtpi-postgres --tail 50
```

### Metrics

**Key Metrics to Monitor:**

```sql
-- Server uptime
SELECT name, status, last_heartbeat,
       NOW() - last_heartbeat as downtime
FROM empire_servers
WHERE status = 'connected';

-- Agent activity
SELECT
  DATE_TRUNC('hour', lastseen_time) as hour,
  COUNT(*) as active_agents
FROM empire_agents
WHERE lastseen_time > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Task completion rate
SELECT
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM empire_tasks
GROUP BY status;
```

### Alerting

**Set up alerts for:**
1. Server disconnections
2. Agent loss (high-value agents)
3. Failed authentication attempts
4. Unusual credential harvesting volume
5. Database connection failures

**Example Alert Script:**

```bash
#!/bin/bash
# Check for disconnected servers

DISCONNECTED=$(docker exec rtpi-postgres psql -U rtpi -d rtpi_main -t -c \
  "SELECT COUNT(*) FROM empire_servers WHERE status = 'disconnected'")

if [ "$DISCONNECTED" -gt 0 ]; then
  echo "ALERT: $DISCONNECTED Empire server(s) disconnected"
  # Send notification (email, Slack, etc.)
fi
```

## Backup & Recovery

### Full Backup Procedure

```bash
#!/bin/bash
# backup-empire.sh

BACKUP_DIR=/backup/empire/$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 1. Database backup
docker exec rtpi-postgres pg_dump -U rtpi -d rtpi_main \
  -t "empire_*" > $BACKUP_DIR/empire_db.sql

# 2. Configuration backup
cp .env $BACKUP_DIR/
cp docker-compose.yml $BACKUP_DIR/

# 3. Empire server data (if applicable)
docker cp rtpi-empire:/opt/Empire/empire/server/data $BACKUP_DIR/empire_data

# 4. Compress backup
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

echo "Backup completed: $BACKUP_DIR.tar.gz"
```

### Recovery Procedure

```bash
#!/bin/bash
# restore-empire.sh

BACKUP_FILE=$1

# Extract backup
tar -xzf $BACKUP_FILE
BACKUP_DIR=$(basename $BACKUP_FILE .tar.gz)

# 1. Stop services
docker compose stop

# 2. Restore database
docker exec -i rtpi-postgres psql -U rtpi -d rtpi_main < $BACKUP_DIR/empire_db.sql

# 3. Restore configuration
cp $BACKUP_DIR/.env .
cp $BACKUP_DIR/docker-compose.yml .

# 4. Start services
docker compose up -d

echo "Restore completed from: $BACKUP_FILE"
```

## Security Hardening

### ⚠️ CRITICAL: Fix Password Storage

**Current Issue:** Passwords are bcrypt-hashed but need to be encrypted for Empire authentication.

**Fix Required:**

```typescript
// server/utils/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encryptPassword(password: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptPassword(encrypted: string): string {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### HTTPS Enforcement

```typescript
// server/api/v1/empire.ts
if (process.env.NODE_ENV === 'production' && !restApiUrl.startsWith('https://')) {
  return res.status(400).json({
    error: 'HTTPS required for Empire connections in production'
  });
}
```

### Rate Limiting

```typescript
// server/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';

export const empireApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many Empire API requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to Empire routes
app.use('/api/v1/empire', empireApiLimiter);
```

### Input Validation

```typescript
// server/validation/empire-schemas.ts
import Joi from 'joi';

export const serverSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  host: Joi.string().hostname().required(),
  port: Joi.number().min(1).max(65535).required(),
  restApiUrl: Joi.string().uri().required(),
  adminUsername: Joi.string().min(1).max(100).required(),
  adminPassword: Joi.string().min(8).required(),
});

export const executeTaskSchema = Joi.object({
  command: Joi.string().min(1).max(10000).required(),
  agentName: Joi.string().pattern(/^[A-Z0-9_]+$/).required(),
});
```

## Performance Tuning

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_empire_agents_status ON empire_agents(status);
CREATE INDEX idx_empire_agents_lastseen ON empire_agents(lastseen_time DESC);
CREATE INDEX idx_empire_tasks_status ON empire_tasks(status);
CREATE INDEX idx_empire_credentials_harvested ON empire_credentials(harvested_at DESC);

-- Vacuum and analyze
VACUUM ANALYZE empire_agents;
VACUUM ANALYZE empire_tasks;
VACUUM ANALYZE empire_credentials;
```

### API Caching

The Empire executor already implements caching for API clients:

```typescript
private apiClients = new Map<string, AxiosInstance>();  // Cached per server/user

clearCache(serverId?: string, userId?: string): void {
  if (serverId && userId) {
    this.apiClients.delete(`${serverId}:${userId}`);
  } else {
    this.apiClients.clear();
  }
}
```

### Connection Pooling

PostgreSQL connection pooling is handled by Drizzle ORM:

```typescript
// server/db/index.ts
export const db = drizzle(pool, { schema });  // Uses pg.Pool
```

## Upgrade Procedures

### Upgrading RTPI

```bash
# 1. Backup current state
./backup-empire.sh

# 2. Pull latest code
git pull origin main

# 3. Update dependencies
npm install

# 4. Run database migrations
npm run db:push

# 5. Rebuild
npm run build

# 6. Restart services
docker compose restart
```

### Upgrading Empire

```bash
# 1. Backup Empire data
docker exec rtpi-empire tar czf /tmp/empire-data.tar.gz /opt/Empire/empire/server/data

# 2. Stop Empire
docker stop rtpi-empire

# 3. Pull latest Empire image
docker pull bcsecurity/empire:latest

# 4. Restart Empire
docker compose up -d empire

# 5. Verify connection in RTPI
curl -X POST http://localhost:3001/api/v1/empire/servers/<ID>/check-connection
```

### Database Schema Updates

```sql
-- Example: Add new column to empire_servers
ALTER TABLE empire_servers
ADD COLUMN notes TEXT DEFAULT '';

-- Update Drizzle schema to match
-- shared/schema.ts
export const empireServers = pgTable("empire_servers", {
  // ... existing columns ...
  notes: text("notes").default(""),
});
```

## Support & Resources

- **GitHub Issues:** https://github.com/anthropics/rtpi/issues
- **Empire Documentation:** https://bc-security.gitbook.io/empire-wiki/
- **Security Audit:** `/docs/security/empire-security-audit.md`
- **User Guide:** `/docs/user-guides/empire-c2-user-guide.md`
- **Troubleshooting:** `/docs/troubleshooting/empire-c2-troubleshooting.md`

**Version:** 1.0.0-beta.1
**Last Updated:** 2025-12-25
