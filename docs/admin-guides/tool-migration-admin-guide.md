# Tool Migration - Administrator Guide

**Version:** 1.0
**Last Updated:** 2025-12-26
**Audience:** RTPI Administrators

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Deployment](#deployment)
3. [Configuration](#configuration)
4. [Database Management](#database-management)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Troubleshooting](#troubleshooting)
7. [Security Considerations](#security-considerations)
8. [Performance Tuning](#performance-tuning)
9. [Backup & Recovery](#backup--recovery)
10. [Upgrade Procedures](#upgrade-procedures)
11. [Advanced Administration](#advanced-administration)
12. [Testing & Validation](#testing--validation)
13. [API Reference](#api-reference)
14. [Support & Resources](#support--resources)

---

## Architecture Overview

### Components

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   RTPI UI   │────────▶│  Tool Migration  │────────▶│  PostgreSQL │
│ (React)     │         │  API (Express)   │         │ (security_  │
└─────────────┘         └──────────────────┘         │  tools)     │
                                │                     └─────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │ Python Tools     │
                        │ (offsec-team)    │
                        │ + TypeScript     │
                        │   Wrappers       │
                        └──────────────────┘
```

**Component Responsibilities:**

- **RTPI UI**: ToolMigration page with analysis, migration, and catalog views
- **Tool Migration API**: REST endpoints for tool analysis and migration orchestration
- **Tool Analyzer Service**: Python AST parsing, dependency extraction, complexity estimation
- **Migration Service**: Wrapper generation, dependency installation, testing, DB registration
- **Database**: security_tools table with migration metadata in JSONB
- **Python Environment**: Execution environment for migrated tools
- **File System**: `/server/services/python-tools/` for TypeScript wrappers

### Migration Workflow

```
┌──────────┐    ┌─────────────┐    ┌────────────┐    ┌─────────┐    ┌──────────┐
│ Analysis │───▶│   Wrapper   │───▶│Dependencies│───▶│ Testing │───▶│ Database │
│  Phase   │    │ Generation  │    │Installation│    │  Phase  │    │Register  │
└──────────┘    └─────────────┘    └────────────┘    └─────────┘    └──────────┘
      │                 │                  │               │              │
      │                 │                  │               │              │
      v                 v                  v               v              v
  Extract           Generate          pip install       pytest        INSERT INTO
  metadata          TypeScript        packages          (optional)    security_tools
  methods           wrapper class                                     WITH metadata
  dependencies      with spawn()
  complexity
```

**Step-by-Step Flow:**

1. **Analysis Phase**:
   - Parse Python file using AST
   - Extract class name, methods, parameters, return types
   - Identify dependencies (import statements)
   - Estimate complexity based on class name patterns
   - Calculate estimated migration days

2. **Wrapper Generation**:
   - Create TypeScript class in `/server/services/python-tools/`
   - Implement `spawn()` based execution bridge
   - Map Python methods to TypeScript methods
   - Generate parameter validation

3. **Dependency Installation** (optional):
   - Execute `pip install <packages>`
   - Validate installation success
   - Log installation output

4. **Testing Phase** (optional):
   - Run pytest on Python tool
   - Capture test results
   - Non-blocking - continues if tests fail

5. **Database Registration**:
   - Insert into security_tools table
   - Store metadata JSONB with migration details
   - Set status to 'available'

### Database Schema

**security_tools Table:**

```sql
CREATE TABLE security_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,  -- 'scanning', 'web-application', etc.
  description TEXT,
  status tool_status NOT NULL DEFAULT 'available',
  command TEXT,            -- Python execution command
  docker_image TEXT,       -- Optional Docker image
  endpoint TEXT,           -- Optional web endpoint
  config_path TEXT,        -- Config file path
  version TEXT,
  last_used TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  metadata JSONB,          -- Migration tracking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Tool Status Enum:**
```sql
CREATE TYPE tool_status AS ENUM (
  'available',    -- Ready for execution
  'running',      -- Currently executing
  'stopped',      -- Stopped/paused
  'error'         -- Error state
);
```

**Metadata JSONB Structure:**
```json
{
  "source": "offsec-team",
  "migrated": true,
  "migrationDate": "2025-12-26T15:30:00Z",
  "className": "WebVulnerabilityTester",
  "pythonModule": "/home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py",
  "wrapperPath": "server/services/python-tools/WebVulnerabilityTester.ts",
  "complexity": "medium",
  "estimatedMigrationDays": 3,
  "hasTests": true,
  "requiresExternalServices": false,
  "externalServiceNotes": "",
  "methods": [
    {
      "name": "test_sql_injection",
      "params": ["url", "params"],
      "returnType": "Dict[str, Any]"
    }
  ],
  "dependencies": [
    {"name": "requests", "version": ">=2.28.0", "installMethod": "pip"},
    {"name": "pydantic", "version": ">=2.0.0", "installMethod": "pip"}
  ],
  "category_source": "bug_hunter"
}
```

### API Endpoints

**Base Path:** `/api/v1/tool-migration`

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/analyze` | GET | Analyze all offsec-team tools | Yes |
| `/analyze-file` | POST | Analyze specific Python file | Yes |
| `/analyze-directory` | POST | Analyze tools in directory | Yes |
| `/migrate` | POST | Migrate single tool | Yes |
| `/migrate-batch` | POST | Batch migrate multiple tools | Yes |
| `/status/:toolName` | GET | Check migration status | Yes |
| `/recommendations` | GET | Get recommended tools | Yes |

---

## Deployment

### Prerequisites

**System Requirements:**
- **Node.js**: 18+ (TypeScript execution)
- **Python**: 3.8+ (tool execution)
- **PostgreSQL**: 14+ (database)
- **pip**: Latest version (dependency management)
- **RAM**: 2GB+ (tool execution)
- **Disk Space**: 10GB+ (tools + dependencies)
- **OS**: Linux, macOS, or Windows with WSL2

**Verification Commands:**
```bash
# Check Node.js version
node --version
# Should output: v18.x.x or higher

# Check Python version
python3 --version
# Should output: Python 3.8.x or higher

# Check pip
pip --version
# Should output: pip 23.x.x or similar

# Check PostgreSQL
psql --version
# Should output: psql (PostgreSQL) 14.x or higher

# Check npm
npm --version
# Should output: 10.x.x or higher
```

### Installation Steps

**1. Database Setup:**

The security_tools table already exists from RTPI core installation. Verify:

```bash
# Connect to database
docker exec -it rtpi-postgres psql -U rtpi -d rtpi_main

# Verify table exists
\d security_tools

# Check columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'security_tools';

# Exit psql
\q
```

Expected output should show 15 columns including `id`, `name`, `category`, `status`, `metadata`, etc.

**2. Backend Services Deployment:**

Tool migration services are part of RTPI core. No separate deployment needed.

```bash
# Verify services are loaded
cd /home/cmndcntrl/rtpi

# Check tool analyzer exists
ls -la server/services/tool-analyzer.ts

# Check migration service exists
ls -la server/services/tool-migration-service.ts

# Check API routes exist
ls -la server/api/v1/tool-migration.ts

# Verify API server is running
curl -s http://localhost:3001/health | jq '.'
```

**3. offsec-team Repository Setup:**

```bash
# Verify repository location
ls -la /home/cmndcntrl/rtpi/tools/offsec-team/

# Check repository structure
ls /home/cmndcntrl/rtpi/tools/offsec-team/tools/
# Expected: bug_hunter, burpsuite_operator, daedelu5, nexus_kamuy, rt_dev

# Verify tools are accessible
ls /home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/
# Should list Python files including WebVulnerabilityTester.py

# Check git status (if it's a git repo)
cd /home/cmndcntrl/rtpi/tools/offsec-team/ && git status
```

**4. Python Environment Setup:**

```bash
# Create virtual environment (recommended)
cd /home/cmndcntrl/rtpi
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install common dependencies (optional)
pip install requests pydantic pytest beautifulsoup4

# Verify installations
pip list | grep -E "(requests|pydantic|pytest)"
```

**5. Wrapper Directory Setup:**

```bash
# Ensure wrapper directory exists
mkdir -p /home/cmndcntrl/rtpi/server/services/python-tools

# Set permissions
chmod 755 /home/cmndcntrl/rtpi/server/services/python-tools

# Verify ownership
ls -ld /home/cmndcntrl/rtpi/server/services/python-tools
```

**6. Verify API Endpoints:**

```bash
# Test analyze endpoint
curl -s http://localhost:3001/api/v1/tool-migration/analyze | jq '.data.summary'

# Expected output:
# {
#   "totalTools": 40,
#   "categoryCounts": {...},
#   "complexityCounts": {...}
# }
```

---

## Configuration

### Environment Variables

**Required Variables** (`.env`):
```bash
# Database connection
DATABASE_URL=postgresql://rtpi:password@localhost:5432/rtpi_main

# Session configuration
SESSION_SECRET=your-secure-session-secret
REDIS_URL=redis://localhost:6379
```

**Optional Variables**:
```bash
# Python executable path (defaults to 'python3')
PYTHON_PATH=/usr/bin/python3

# Tool migration settings
TOOL_MIGRATION_TIMEOUT=300000        # 5 minutes in milliseconds
TOOL_MIGRATION_MAX_RETRIES=3
TOOL_MIGRATION_BATCH_SIZE=5

# Dependency installation timeout
PIP_INSTALL_TIMEOUT=600000           # 10 minutes
```

### Python Environment Configuration

**Recommended: Virtual Environment**
```bash
# Create virtualenv
python3 -m venv /home/cmndcntrl/rtpi/venv

# Activate in shell profile
echo 'source /home/cmndcntrl/rtpi/venv/bin/activate' >> ~/.bashrc

# Activate now
source /home/cmndcntrl/rtpi/venv/bin/activate

# Install dependencies
pip install requests pydantic pytest beautifulsoup4 lxml
```

**System-wide Python** (not recommended for production):
```bash
# Install dependencies globally
pip3 install requests pydantic pytest beautifulsoup4

# Set Python path explicitly
export PYTHON_PATH=/usr/bin/python3
```

### Migration Options Configuration

**Default Options** (from `tool-migration-service.ts`):
```typescript
const DEFAULT_OPTIONS: MigrationOptions = {
  installDependencies: true,    // Auto-install pip packages
  runTests: false,              // Skip tests by default (faster)
  registerInDatabase: true,     // Always register in DB
  generateWrapper: true,        // Always generate wrapper
  overwriteExisting: false,     // Prevent accidental overwrites
};
```

**Customizing via API**:
```bash
curl -X POST http://localhost:3001/api/v1/tool-migration/migrate \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  -d '{
    "filePath": "/home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py",
    "options": {
      "installDependencies": true,
      "runTests": true,
      "registerInDatabase": true,
      "generateWrapper": true,
      "overwriteExisting": false
    }
  }'
```

### Tool Analyzer Configuration

**Complexity Indicators** (defined in `tool-analyzer.ts`):
```typescript
const COMPLEXITY_INDICATORS = {
  'API Client': 3,      // Tools with API integration
  'Orchestrator': 4,    // Coordination tools
  'Manager': 3,         // Management tools
  'Analyzer': 2,        // Analysis tools
  'Tester': 2,          // Testing tools
  'Generator': 1,       // Simple generation tools
  'Processor': 2,       // Processing tools
  'Bridge': 3,          // Integration bridges
  'Intelligence': 2,    // Intelligence tools
  'Coordinator': 4,     // Advanced coordination
};
```

**Category Mapping**:
```typescript
const CATEGORY_MAPPING: Record<string, ToolCategory> = {
  'bug_hunter': 'scanning',
  'burpsuite_operator': 'web-application',
  'daedelu5': 'other',
  'nexus_kamuy': 'other',
  'rt_dev': 'other',
};
```

**Priority Scoring**:
```typescript
// Category priorities
'scanning': +3,
'web-application': +3,
'network-analysis': +2,
'reporting': +2,
'research': +1,

// Complexity bonus (inverse - simpler = higher priority)
'low': +3,
'medium': +2,
'high': +1,
'very-high': 0,

// Feature bonuses
hasTests: +2,
noExternalServices: +1,

// High-value tools (specific names)
'WebVulnerabilityTester': +5,
'BurpSuiteAPIClient': +4,
'VulnerabilityReportGenerator': +4,
```

---

## Database Management

### Schema Validation

**Check Table Structure:**
```bash
# Connect to database
docker exec -it rtpi-postgres psql -U rtpi -d rtpi_main

# Describe security_tools table
\d security_tools

# Expected columns:
# id, name, category, description, status, command, docker_image,
# endpoint, config_path, version, last_used, usage_count, metadata,
# created_at, updated_at
```

**Verify Indexes:**
```sql
-- List indexes on security_tools
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'security_tools';
```

**Check Constraints:**
```sql
-- Check unique constraint on name
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'security_tools'::regclass;
```

### Data Inspection Queries

**Count Migrated Tools:**
```sql
-- Total migrated tools
SELECT COUNT(*)
FROM security_tools
WHERE metadata->>'source' = 'offsec-team';
```

**Tools by Category:**
```sql
SELECT category, COUNT(*) as count
FROM security_tools
WHERE metadata->>'source' = 'offsec-team'
GROUP BY category
ORDER BY count DESC;

-- Example output:
--    category     | count
-- ----------------+-------
-- scanning        |     8
-- web-application |     8
-- other           |    24
```

**Tools by Complexity:**
```sql
SELECT
  metadata->>'complexity' as complexity,
  COUNT(*) as count
FROM security_tools
WHERE metadata->>'source' = 'offsec-team'
GROUP BY metadata->>'complexity'
ORDER BY
  CASE metadata->>'complexity'
    WHEN 'low' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'high' THEN 3
    WHEN 'very-high' THEN 4
  END;
```

**Tools Requiring External Services:**
```sql
SELECT
  name,
  category,
  metadata->>'externalServiceNotes' as requirements
FROM security_tools
WHERE metadata->>'requiresExternalServices' = 'true'
  AND metadata->>'source' = 'offsec-team';
```

**Recent Migrations:**
```sql
SELECT
  name,
  category,
  metadata->>'complexity' as complexity,
  metadata->>'migrationDate' as migrated_at,
  status
FROM security_tools
WHERE metadata->>'source' = 'offsec-team'
ORDER BY created_at DESC
LIMIT 20;
```

**Failed or Error Status Tools:**
```sql
SELECT
  name,
  status,
  metadata->>'wrapperPath' as wrapper,
  updated_at
FROM security_tools
WHERE status IN ('error', 'unavailable')
  AND metadata->>'source' = 'offsec-team';
```

**Tools Never Used:**
```sql
SELECT
  name,
  category,
  created_at,
  (NOW() - created_at) as age
FROM security_tools
WHERE metadata->>'source' = 'offsec-team'
  AND (usage_count = 0 OR usage_count IS NULL)
ORDER BY created_at DESC;
```

### Data Maintenance

**Delete Specific Tool:**
```sql
-- Before deletion, backup the tool data
SELECT * FROM security_tools
WHERE name = 'WebVulnerabilityTester'
  AND metadata->>'source' = 'offsec-team';

-- Delete tool
DELETE FROM security_tools
WHERE name = 'WebVulnerabilityTester'
  AND metadata->>'source' = 'offsec-team';
```

**Reset Tool for Re-migration:**
```bash
# Option A: Delete from database (then re-migrate via API)
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "DELETE FROM security_tools WHERE name = 'WebVulnerabilityTester';"

# Option B: Use overwriteExisting option in migration API
curl -X POST http://localhost:3001/api/v1/tool-migration/migrate \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/path/to/tool.py", "options": {"overwriteExisting": true}}'
```

**Clean Up All Migrated Tools:**
```sql
-- CAUTION: This removes ALL offsec-team tools!
DELETE FROM security_tools
WHERE metadata->>'source' = 'offsec-team';
```

**Update Tool Status Manually:**
```sql
-- Set tool to available
UPDATE security_tools
SET status = 'available',
    updated_at = NOW()
WHERE name = 'WebVulnerabilityTester';

-- Set tool to error with reason in metadata
UPDATE security_tools
SET status = 'error',
    metadata = metadata || '{"errorReason": "Wrapper compilation failed"}',
    updated_at = NOW()
WHERE name = 'BrokenTool';
```

### Database Performance

**Create Recommended Indexes:**
```sql
-- Index on source for faster filtering
CREATE INDEX IF NOT EXISTS idx_security_tools_source
ON security_tools((metadata->>'source'));

-- Index on status for health checks
CREATE INDEX IF NOT EXISTS idx_security_tools_status
ON security_tools(status)
WHERE metadata->>'source' = 'offsec-team';

-- Index on complexity for reporting
CREATE INDEX IF NOT EXISTS idx_security_tools_complexity
ON security_tools((metadata->>'complexity'));

-- Analyze table to update statistics
ANALYZE security_tools;
```

**Vacuum and Maintenance:**
```sql
-- Vacuum to reclaim space after deletions
VACUUM ANALYZE security_tools;

-- Check table size
SELECT
  pg_size_pretty(pg_total_relation_size('security_tools')) as total_size,
  pg_size_pretty(pg_relation_size('security_tools')) as table_size,
  pg_size_pretty(pg_indexes_size('security_tools')) as indexes_size;
```

---

## Monitoring & Maintenance

### Health Checks

**API Endpoint Verification:**
```bash
# Check analyze endpoint
curl -s http://localhost:3001/api/v1/tool-migration/analyze | jq '.success'
# Expected: true

# Check specific tool status
curl -s http://localhost:3001/api/v1/tool-migration/status/WebVulnerabilityTester | jq '.'
# Expected: {"exists": true, "installed": true, "toolId": "...", ...}

# Check recommendations
curl -s http://localhost:3001/api/v1/tool-migration/recommendations | jq '.data.recommended | length'
# Expected: number of recommended tools
```

**Database Connectivity:**
```bash
# Verify database is ready
docker exec rtpi-postgres pg_isready -U rtpi
# Expected: /var/run/postgresql:5432 - accepting connections

# Count migrated tools
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT COUNT(*) FROM security_tools WHERE metadata->>'source' = 'offsec-team';"
```

**Python Environment Check:**
```bash
# Verify Python version
python3 --version
# Expected: Python 3.8.x or higher

# Check installed packages for migrated tools
pip list | grep -E "(requests|pydantic|pytest)"

# Test Python tool execution directly
python3 /home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py --help
```

**Wrapper Directory Check:**
```bash
# List all generated wrappers
ls -la /home/cmndcntrl/rtpi/server/services/python-tools/

# Count wrappers
ls /home/cmndcntrl/rtpi/server/services/python-tools/*.ts 2>/dev/null | wc -l

# Check disk usage
du -sh /home/cmndcntrl/rtpi/server/services/python-tools/
```

### Logging

**Backend Logs Location:**
```bash
# View API server logs (includes migration logs)
docker logs rtpi-api -f --tail 100

# Filter for migration-specific logs
docker logs rtpi-api 2>&1 | grep -i "migration\|tool-analyzer\|wrapper"

# Check for errors
docker logs rtpi-api 2>&1 | grep -i "error\|failed\|exception"

# Save logs to file
docker logs rtpi-api > /tmp/rtpi-api-logs.txt 2>&1
```

**Migration Service Logging:**

The migration service logs these events:
- Dependency installation output/errors
- Wrapper generation success/failure
- Test execution results (if enabled)
- Database registration confirmation
- Step-by-step progress for each migration

**Enable Debug Logging** (edit service files):
```typescript
// Add to tool-analyzer.ts or tool-migration-service.ts
console.log('[Tool Analyzer] Analyzing:', toolFilePath);
console.log('[Migration] Starting migration for:', analysis.toolName);
console.log('[Wrapper] Generated wrapper at:', wrapperPath);
console.log('[Database] Registered tool with ID:', toolId);
console.log('[Dependencies] Installing:', dependencies.join(', '));
console.log('[Tests] Running pytest for:', analysis.toolName);
```

### Metrics to Monitor

**Migration Success Rate:**
```sql
-- Overall success rate
SELECT
  COUNT(*) FILTER (WHERE status = 'available') as successful,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE status = 'available') * 100.0 / COUNT(*), 2) as success_rate
FROM security_tools
WHERE metadata->>'source' = 'offsec-team';
```

**Success by Complexity:**
```sql
SELECT
  metadata->>'complexity' as complexity,
  COUNT(*) FILTER (WHERE status = 'available') as successful,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE status = 'available') * 100.0 / COUNT(*), 2) as success_rate
FROM security_tools
WHERE metadata->>'source' = 'offsec-team'
GROUP BY metadata->>'complexity'
ORDER BY
  CASE metadata->>'complexity'
    WHEN 'low' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'high' THEN 3
    WHEN 'very-high' THEN 4
  END;
```

**Tool Usage Statistics:**
```sql
-- Most used migrated tools
SELECT
  name,
  category,
  usage_count,
  last_used,
  (NOW() - last_used) as time_since_last_use
FROM security_tools
WHERE metadata->>'source' = 'offsec-team'
  AND usage_count > 0
ORDER BY usage_count DESC
LIMIT 10;
```

**Migration Timeline:**
```sql
-- Migrations per day (last 30 days)
SELECT
  DATE(created_at) as migration_date,
  COUNT(*) as tools_migrated
FROM security_tools
WHERE metadata->>'source' = 'offsec-team'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY migration_date DESC;
```

### Alerting Recommendations

**Critical Alerts** (immediate action required):
1. **Migration API Unavailable** - `/analyze` returns 500 or times out
2. **Database Connection Lost** - security_tools queries fail
3. **Python Environment Missing** - python3 command fails
4. **Wrapper Generation Failures** - Multiple consecutive migration failures
5. **Disk Space Low** - Less than 1GB free in wrapper directory

**Warning Alerts** (investigate within 24 hours):
1. **Dependency Installation Failures** - pip install fails for multiple tools
2. **Test Failures** - More than 30% of tools fail tests
3. **Low Success Rate** - Overall success rate below 80%
4. **Orphaned Tools** - Tools in DB without wrapper files
5. **High Error Count** - More than 5 tools in 'error' status

**Example Alert Script:**
```bash
#!/bin/bash
# /usr/local/bin/check-migration-health.sh

# Check API health
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/tool-migration/analyze)
if [ "$RESPONSE" != "200" ]; then
  echo "CRITICAL: Tool Migration API unhealthy (HTTP $RESPONSE)" | mail -s "Alert: Tool Migration" admin@example.com
fi

# Check for error status tools
ERROR_TOOLS=$(docker exec rtpi-postgres psql -U rtpi -d rtpi_main -t -c \
  "SELECT COUNT(*) FROM security_tools WHERE status = 'error' AND metadata->>'source' = 'offsec-team'")
if [ "$ERROR_TOOLS" -gt 5 ]; then
  echo "WARNING: $ERROR_TOOLS tools in error status" | mail -s "Alert: Tool Errors" admin@example.com
fi

# Check disk space
DISK_FREE=$(df /home/cmndcntrl/rtpi/server/services/python-tools/ | tail -1 | awk '{print $4}')
if [ "$DISK_FREE" -lt 1048576 ]; then  # Less than 1GB in KB
  echo "WARNING: Low disk space in wrapper directory" | mail -s "Alert: Disk Space" admin@example.com
fi
```

**Add to crontab:**
```bash
# Run health check every 5 minutes
*/5 * * * * /usr/local/bin/check-migration-health.sh
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: "Tool already exists" Error

**Error Message:**
```
Error: Tool WebVulnerabilityTester already exists in database. Use overwriteExisting option to replace.
```

**Diagnosis:**
```bash
# Check if tool exists
curl -s http://localhost:3001/api/v1/tool-migration/status/WebVulnerabilityTester | jq '.'

# Check database
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT id, name, status, created_at FROM security_tools WHERE name = 'WebVulnerabilityTester';"
```

**Solutions:**

**Option A: Use overwriteExisting (recommended)**
```bash
curl -X POST http://localhost:3001/api/v1/tool-migration/migrate \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py",
    "options": { "overwriteExisting": true }
  }'
```

**Option B: Delete existing tool first**
```sql
-- Connect to database
docker exec -it rtpi-postgres psql -U rtpi -d rtpi_main

-- Delete tool
DELETE FROM security_tools WHERE name = 'WebVulnerabilityTester';
```

**Option C: Rename the tool**
```sql
-- If you want to keep both versions
UPDATE security_tools
SET name = 'WebVulnerabilityTester_old'
WHERE name = 'WebVulnerabilityTester';
```

#### Issue 2: Dependency Installation Failed

**Error Message:**
```
Warning: Dependency installation failed: pip install requests failed with code 1
```

**Diagnosis:**
```bash
# Check Python and pip
python3 --version
pip --version

# Test pip connectivity
ping pypi.org

# Try manual installation
pip install requests pydantic

# Check for permission issues
ls -la $(which pip)

# Check Python path
echo $PYTHON_PATH
which python3
```

**Solutions:**

**Option A: Fix Python environment**
```bash
# Ensure pip is up to date
python3 -m pip install --upgrade pip

# Try with sudo (if permission denied)
sudo pip install requests pydantic

# Use virtual environment
python3 -m venv /home/cmndcntrl/rtpi/venv
source /home/cmndcntrl/rtpi/venv/bin/activate
pip install requests pydantic
```

**Option B: Use system Python**
```bash
# Set explicit Python path
export PYTHON_PATH=/usr/bin/python3

# Add to .env
echo "PYTHON_PATH=/usr/bin/python3" >> /home/cmndcntrl/rtpi/.env
```

**Option C: Pre-install common dependencies**
```bash
# Install all common packages at once
pip install requests pydantic pytest beautifulsoup4 lxml urllib3
```

**Option D: Migrate without dependency installation**
```bash
# Disable automatic dependency installation
curl -X POST http://localhost:3001/api/v1/tool-migration/migrate \
  -d '{
    "filePath": "/path/to/tool.py",
    "options": {"installDependencies": false}
  }'

# Install dependencies manually later
pip install <package-names>
```

#### Issue 3: Wrapper Generation Failed

**Error Message:**
```
Error: Wrapper generation failed: EACCES: permission denied, mkdir '/server/services/python-tools'
```

**Diagnosis:**
```bash
# Check directory permissions
ls -la /home/cmndcntrl/rtpi/server/services/

# Check if directory exists
ls -la /home/cmndcntrl/rtpi/server/services/python-tools/

# Check disk space
df -h /home/cmndcntrl/rtpi/

# Check ownership
stat /home/cmndcntrl/rtpi/server/services/
```

**Solutions:**

**Option A: Create directory with correct permissions**
```bash
mkdir -p /home/cmndcntrl/rtpi/server/services/python-tools
chmod 755 /home/cmndcntrl/rtpi/server/services/python-tools
```

**Option B: Fix ownership**
```bash
sudo chown -R $USER:$USER /home/cmndcntrl/rtpi/server/services/
```

**Option C: Check disk space**
```bash
# If disk is full, clean up
docker system prune -a
npm cache clean --force
```

#### Issue 4: Tool Execution Fails After Migration

**Error Message:**
```
Error: Python execution failed: ModuleNotFoundError: No module named 'requests'
```

**Diagnosis:**
```bash
# Check if dependencies are installed
pip list | grep requests

# Check Python path used by RTPI
echo $PYTHON_PATH
which python3

# Test tool directly
python3 /home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py

# Check wrapper code
cat /home/cmndcntrl/rtpi/server/services/python-tools/WebVulnerabilityTester.ts | grep "spawn"
```

**Solutions:**

**Option A: Install missing dependencies**
```bash
# Check tool's dependencies
curl -s http://localhost:3001/api/v1/tool-migration/analyze-file \
  -d '{"filePath": "/path/to/tool.py"}' | jq '.data.dependencies'

# Install them
pip install requests pydantic
```

**Option B: Re-migrate with dependency installation**
```bash
curl -X POST http://localhost:3001/api/v1/tool-migration/migrate \
  -d '{
    "filePath": "/path/to/tool.py",
    "options": {
      "installDependencies": true,
      "overwriteExisting": true
    }
  }'
```

**Option C: Verify Python path in wrapper**
```bash
# Check what Python is being used
cat /home/cmndcntrl/rtpi/server/services/python-tools/WebVulnerabilityTester.ts | grep pythonPath

# Should use the same Python where packages are installed
which python3
```

#### Issue 5: Tool Status Shows "error"

**Diagnosis:**
```sql
-- Check tool details
SELECT name, status, metadata, updated_at
FROM security_tools
WHERE name = 'ToolName'
  AND metadata->>'source' = 'offsec-team';
```

**Check wrapper file:**
```bash
# Verify wrapper exists
ls -la /home/cmndcntrl/rtpi/server/services/python-tools/ToolName.ts

# Check Python source exists
find /home/cmndcntrl/rtpi/tools/offsec-team -name "ToolName.py"

# Test wrapper compilation
cd /home/cmndcntrl/rtpi
npx tsc server/services/python-tools/ToolName.ts --noEmit

# Check for syntax errors
npx eslint server/services/python-tools/ToolName.ts
```

**Solutions:**

**Option A: Re-migrate tool**
```sql
-- Delete from database
DELETE FROM security_tools WHERE name = 'ToolName';
```
```bash
# Migrate again via API
curl -X POST http://localhost:3001/api/v1/tool-migration/migrate \
  -d '{"filePath": "/path/to/ToolName.py"}'
```

**Option B: Manual status update** (only if tool actually works)
```sql
UPDATE security_tools
SET status = 'available',
    metadata = metadata || '{"manualFix": true}',
    updated_at = NOW()
WHERE name = 'ToolName';
```

**Option C: Delete and regenerate wrapper**
```bash
# Delete wrapper file
rm /home/cmndcntrl/rtpi/server/services/python-tools/ToolName.ts

# Re-migrate to regenerate
curl -X POST http://localhost:3001/api/v1/tool-migration/migrate \
  -d '{"filePath": "/path/to/ToolName.py", "options": {"overwriteExisting": true}}'
```

### Advanced Troubleshooting

**Enable Verbose Migration Logging:**

Edit `/home/cmndcntrl/rtpi/server/services/tool-migration-service.ts`:
```typescript
// Add detailed logging at each step
console.log('[Migration] Starting:', analysis.toolName);
console.log('[Migration] Analysis:', JSON.stringify(analysis, null, 2));
console.log('[Migration] Options:', JSON.stringify(options, null, 2));
console.log('[Migration] Step 1 - Dependencies:', result);
console.log('[Migration] Step 2 - Wrapper:', wrapperPath);
console.log('[Migration] Step 3 - Tests:', testResult);
console.log('[Migration] Step 4 - Database:', toolId);
console.log('[Migration] Complete:', analysis.toolName);
```

**Check Database Locks:**
```sql
-- Find blocking queries
SELECT
  pid,
  usename,
  pg_blocking_pids(pid) as blocked_by,
  query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;

-- Kill blocking process (use carefully!)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE query LIKE '%security_tools%'
  AND pid != pg_backend_pid();
```

**Wrapper File Corruption:**
```bash
# Validate all TypeScript files
npx tsc server/services/python-tools/*.ts --noEmit

# Find specific errors
for file in server/services/python-tools/*.ts; do
  echo "Checking $file..."
  npx tsc "$file" --noEmit 2>&1 | grep -i error
done

# Delete all wrappers and start fresh (CAUTION!)
rm -rf /home/cmndcntrl/rtpi/server/services/python-tools/*.ts
# Then re-migrate all tools
```

**Performance Issues During Migration:**
```bash
# Monitor system resources
htop  # or top

# Monitor database during migration
watch -n 1 "docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  \"SELECT * FROM pg_stat_activity WHERE query LIKE '%security_tools%';\""

# Check for high memory usage
ps aux | grep node | sort -k 4 -r | head -5

# Reduce batch size if migrations timeout
# Edit migration call to use smaller batches
```

---

## Security Considerations

### Python Code Execution Risks

**Risk**: Arbitrary Python code execution through migrated tools

**Mitigations**:

1. **Code Review**: Manually review all tools from offsec-team before migration
   ```bash
   # Review tool code
   cat /home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py
   ```

2. **Sandboxing**: Run tools in isolated Python environments
   ```bash
   # Use virtual environment
   python3 -m venv /home/cmndcntrl/rtpi/venv-sandbox
   source /home/cmndcntrl/rtpi/venv-sandbox/bin/activate
   ```

3. **Permission Restrictions**: Limit file system access
   ```typescript
   // In wrapper generation, add security options
   const proc = spawn(pythonPath, ['-c', script], {
     cwd: '/tmp',  // Restrict working directory
     env: {},      // Minimal environment
     timeout: 300000
   });
   ```

4. **Timeout Enforcement**: Always set execution timeouts
   ```typescript
   // Default timeout: 5 minutes (300,000 ms)
   const TOOL_EXECUTION_TIMEOUT = 300000;
   ```

### Dependency Management Security

**Risk**: Malicious or vulnerable Python packages

**Mitigations**:

1. **Dependency Review**: Check all dependencies before installation
   ```bash
   # Review dependencies
   curl -s http://localhost:3001/api/v1/tool-migration/analyze-file \
     -d '{"filePath": "/path/to/tool.py"}' | jq '.data.dependencies'
   ```

2. **Version Pinning**: Pin specific versions
   ```bash
   # Create requirements.txt with exact versions
   echo "requests==2.31.0" > requirements.txt
   echo "pydantic==2.5.0" >> requirements.txt
   pip install -r requirements.txt
   ```

3. **Vulnerability Scanning**: Use pip-audit or safety
   ```bash
   # Install safety
   pip install safety

   # Scan for vulnerabilities
   safety check

   # Or use pip-audit
   pip install pip-audit
   pip-audit
   ```

4. **Minimal Dependencies**: Only install required packages
   ```bash
   # Review actual imports in tool
   grep "^import\|^from" /path/to/tool.py

   # Only install what's actually used
   pip install <minimal-set>
   ```

### Access Control

**API Security**:

1. **Authentication Required**: All migration endpoints require authentication
2. **Role-Based Access Control**: Only admins can migrate tools
3. **Rate Limiting**: Prevent API abuse
4. **Audit Logging**: Log all migration activities

**Implementation**:
```typescript
// In server/api/v1/tool-migration.ts
router.use(requireAuth);  // All routes require authentication
router.use(requireAdmin); // All routes require admin role

// Add audit logging
router.post('/migrate', async (req, res) => {
  await auditLog.create({
    user_id: req.user.id,
    action: 'tool_migration',
    tool_name: req.body.toolName,
    timestamp: new Date()
  });
  // ... migration logic
});
```

**Database Security**:
```sql
-- Create read-only user for monitoring
CREATE ROLE migration_readonly WITH LOGIN PASSWORD 'secure_password';
GRANT SELECT ON security_tools TO migration_readonly;

-- Create audit log table
CREATE TABLE migration_audit_log (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  action TEXT,
  tool_name TEXT,
  options JSONB,
  result TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Grant admin user write access
GRANT INSERT ON migration_audit_log TO rtpi_admin;
```

### File System Security

**Wrapper Directory Protection**:
```bash
# Restrict permissions (read-write for owner only)
chmod 755 /home/cmndcntrl/rtpi/server/services/python-tools/
chmod 644 /home/cmndcntrl/rtpi/server/services/python-tools/*.ts

# Verify ownership
ls -la /home/cmndcntrl/rtpi/server/services/python-tools/
```

**Python Tools Isolation**:
```yaml
# In docker-compose.yml, mount offsec-team as read-only
volumes:
  - ./tools/offsec-team:/app/tools/offsec-team:ro
```

**Prevent Path Traversal**:
```typescript
// In migration service, validate file paths
import path from 'path';

function validateToolPath(toolPath: string): boolean {
  const basePath = '/home/cmndcntrl/rtpi/tools/offsec-team';
  const resolvedPath = path.resolve(toolPath);
  return resolvedPath.startsWith(basePath);
}
```

---

## Performance Tuning

### Database Optimization

**Recommended Indexes**:
```sql
-- Index on source for faster filtering
CREATE INDEX IF NOT EXISTS idx_security_tools_source
ON security_tools((metadata->>'source'));

-- Index on status for health checks
CREATE INDEX IF NOT EXISTS idx_security_tools_status
ON security_tools(status)
WHERE metadata->>'source' = 'offsec-team';

-- Index on complexity for reporting
CREATE INDEX IF NOT EXISTS idx_security_tools_complexity
ON security_tools((metadata->>'complexity'));

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_security_tools_source_status
ON security_tools((metadata->>'source'), status);

-- Analyze tables
ANALYZE security_tools;
```

**Query Performance Analysis**:
```sql
-- Enable query timing
\timing on

-- Explain query plan
EXPLAIN ANALYZE
SELECT * FROM security_tools
WHERE metadata->>'source' = 'offsec-team'
  AND status = 'available';

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'security_tools'
ORDER BY idx_scan DESC;
```

### Migration Performance

**Batch Migration Optimization**:

Current implementation is sequential. For better performance:

```typescript
// Parallel migration with concurrency limit
import pLimit from 'p-limit';

export async function batchMigrateToolsParallel(
  analyses: PythonToolAnalysis[],
  options: MigrationOptions = {},
  concurrency: number = 3  // Max concurrent migrations
): Promise<MigrationResult[]> {
  const limit = pLimit(concurrency);

  const promises = analyses.map(analysis =>
    limit(() => migrateTool(analysis, options))
  );

  return Promise.all(promises);
}
```

**Caching Analysis Results**:
```typescript
// Add caching layer for tool analysis
const analysisCache = new Map<string, {
  analysis: PythonToolAnalysis;
  timestamp: number;
}>();

const CACHE_TTL = 3600000; // 1 hour

export async function analyzePythonToolCached(
  toolFilePath: string
): Promise<PythonToolAnalysis> {
  const cached = analysisCache.get(toolFilePath);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.analysis;
  }

  const analysis = await analyzePythonTool(toolFilePath);
  analysisCache.set(toolFilePath, {
    analysis,
    timestamp: Date.now()
  });

  return analysis;
}
```

### Wrapper Execution Performance

**Optimization Strategies**:

1. **Reuse Python Processes**: Keep Python processes alive for repeated executions
2. **Preload Modules**: Import commonly used modules at startup
3. **Connection Pooling**: For tools that use databases or external APIs
4. **Result Caching**: Cache tool execution results when appropriate

**Example: Process Pool**:
```typescript
// Create a pool of Python processes
import { Worker } from 'worker_threads';

class PythonProcessPool {
  private workers: Worker[] = [];
  private readonly poolSize = 5;

  async execute(toolName: string, params: any): Promise<any> {
    // Get available worker or create new one
    const worker = this.getAvailableWorker();
    return worker.execute(toolName, params);
  }
}
```

---

## Backup & Recovery

### Full Backup Procedure

**Backup Script** (`/usr/local/bin/backup-tool-migration.sh`):
```bash
#!/bin/bash
# Backup tool migration data

BACKUP_DIR=/backup/tool-migration/$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

echo "Starting tool migration backup..."

# 1. Database backup (migrated tools only)
echo "Backing up database..."
docker exec rtpi-postgres pg_dump -U rtpi -d rtpi_main \
  --table security_tools \
  --data-only \
  --column-inserts \
  --inserts \
  > $BACKUP_DIR/security_tools.sql

# 2. Wrapper files backup
echo "Backing up wrapper files..."
cp -r /home/cmndcntrl/rtpi/server/services/python-tools $BACKUP_DIR/

# 3. Configuration backup
echo "Backing up configuration..."
cp /home/cmndcntrl/rtpi/.env $BACKUP_DIR/ 2>/dev/null || echo "No .env file"

# 4. Tool scripts backup
echo "Backing up scripts..."
mkdir -p $BACKUP_DIR/scripts
cp /home/cmndcntrl/rtpi/scripts/migrate-tool.ts $BACKUP_DIR/scripts/ 2>/dev/null
cp /home/cmndcntrl/rtpi/scripts/list-migrated-tools.ts $BACKUP_DIR/scripts/ 2>/dev/null

# 5. Metadata file
echo "Creating metadata..."
cat > $BACKUP_DIR/backup-metadata.json <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "rtpi_version": "$(cd /home/cmndcntrl/rtpi && git describe --tags 2>/dev/null || echo 'unknown')",
  "tool_count": $(docker exec rtpi-postgres psql -U rtpi -d rtpi_main -t -c \
    "SELECT COUNT(*) FROM security_tools WHERE metadata->>'source' = 'offsec-team';")
}
EOF

# 6. Compress backup
echo "Compressing backup..."
cd $(dirname $BACKUP_DIR)
tar -czf $(basename $BACKUP_DIR).tar.gz $(basename $BACKUP_DIR)
rm -rf $BACKUP_DIR

echo "Backup completed: $(dirname $BACKUP_DIR)/$(basename $BACKUP_DIR).tar.gz"
ls -lh $(dirname $BACKUP_DIR)/$(basename $BACKUP_DIR).tar.gz
```

**Make script executable and run**:
```bash
chmod +x /usr/local/bin/backup-tool-migration.sh
/usr/local/bin/backup-tool-migration.sh
```

**Automated Daily Backups** (crontab):
```bash
# Add to crontab
crontab -e

# Add this line (runs at 2 AM daily)
0 2 * * * /usr/local/bin/backup-tool-migration.sh >> /var/log/tool-migration-backup.log 2>&1
```

### Recovery Procedure

**Recovery Script** (`/usr/local/bin/restore-tool-migration.sh`):
```bash
#!/bin/bash
# Restore tool migration from backup

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-file.tar.gz>"
  exit 1
fi

BACKUP_FILE=$1
RESTORE_DIR=/tmp/restore-tool-migration

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "Starting restoration from: $BACKUP_FILE"

# 1. Extract backup
echo "Extracting backup..."
mkdir -p $RESTORE_DIR
tar -xzf $BACKUP_FILE -C $RESTORE_DIR

# Find the extracted directory
BACKUP_DIR=$(find $RESTORE_DIR -maxdepth 1 -type d | tail -1)

# 2. Confirm restoration
echo "Backup metadata:"
cat $BACKUP_DIR/backup-metadata.json
echo ""
read -p "Continue with restoration? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Restoration cancelled"
  rm -rf $RESTORE_DIR
  exit 0
fi

# 3. Stop services (optional, for safety)
echo "Stopping services..."
cd /home/cmndcntrl/rtpi
npm run stop 2>/dev/null || true

# 4. Restore database
echo "Restoring database..."
docker exec -i rtpi-postgres psql -U rtpi -d rtpi_main \
  < $BACKUP_DIR/security_tools.sql

# 5. Restore wrapper files
echo "Restoring wrapper files..."
rm -rf /home/cmndcntrl/rtpi/server/services/python-tools/*.ts
cp -r $BACKUP_DIR/python-tools/* /home/cmndcntrl/rtpi/server/services/python-tools/

# 6. Rebuild TypeScript
echo "Rebuilding TypeScript..."
cd /home/cmndcntrl/rtpi
npm run build

# 7. Restart services
echo "Restarting services..."
docker compose restart

# 8. Verify restoration
echo "Verifying restoration..."
sleep 5
TOOL_COUNT=$(docker exec rtpi-postgres psql -U rtpi -d rtpi_main -t -c \
  "SELECT COUNT(*) FROM security_tools WHERE metadata->>'source' = 'offsec-team';")
echo "Restored $TOOL_COUNT tools"

# 9. Cleanup
rm -rf $RESTORE_DIR

echo "Restoration completed successfully!"
```

**Make script executable**:
```bash
chmod +x /usr/local/bin/restore-tool-migration.sh
```

**Usage**:
```bash
# Restore from backup
/usr/local/bin/restore-tool-migration.sh /backup/tool-migration/20251226_140000.tar.gz
```

---

## Upgrade Procedures

### Upgrading RTPI with Migrated Tools

**Pre-Upgrade Checklist**:
```bash
# 1. Backup current state
/usr/local/bin/backup-tool-migration.sh

# 2. Record current tool count
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT COUNT(*) FROM security_tools WHERE metadata->>'source' = 'offsec-team';" \
  > /tmp/pre-upgrade-tool-count.txt

# 3. Export tool list
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -t -c \
  "SELECT name FROM security_tools WHERE metadata->>'source' = 'offsec-team' ORDER BY name;" \
  > /tmp/pre-upgrade-tool-list.txt
```

**Upgrade Procedure**:
```bash
# 1. Stop services
cd /home/cmndcntrl/rtpi
docker compose down

# 2. Pull latest code
git fetch origin
git pull origin main

# 3. Check for schema changes
git diff HEAD@{1} shared/schema.ts | grep -A 10 "security_tools"

# 4. Update dependencies
npm install

# 5. Run database migrations
npm run db:push

# 6. Rebuild
npm run build

# 7. Start services
docker compose up -d

# 8. Verify migrated tools still work
curl -s http://localhost:3001/api/v1/tool-migration/analyze | jq '.data.summary'
```

**Post-Upgrade Verification**:
```bash
# Compare tool counts
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT COUNT(*) FROM security_tools WHERE metadata->>'source' = 'offsec-team';"

# Verify tools are still available
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT name, status FROM security_tools WHERE metadata->>'source' = 'offsec-team' ORDER BY name;"

# Test random tool
curl -s http://localhost:3001/api/v1/tool-migration/status/WebVulnerabilityTester | jq '.data.exists'
```

### Re-migrating Tools After offsec-team Updates

**When to Re-migrate**:
- offsec-team repository is updated with new tool versions
- Bug fixes in existing tools
- New methods added to tools
- Dependency updates

**Update Procedure**:
```bash
# 1. Pull latest offsec-team changes
cd /home/cmndcntrl/rtpi/tools/offsec-team
git pull origin main

# 2. Re-analyze tools to identify changes
curl -s http://localhost:3001/api/v1/tool-migration/analyze > /tmp/new-analysis.json

# 3. Compare with previous analysis (manual review)
# Look for changes in methods, dependencies, complexity

# 4. Re-migrate updated tools with overwriteExisting
for tool in UpdatedTool1 UpdatedTool2; do
  TOOL_PATH=$(find /home/cmndcntrl/rtpi/tools/offsec-team -name "$tool.py")
  curl -X POST http://localhost:3001/api/v1/tool-migration/migrate \
    -H "Content-Type: application/json" \
    -d "{\"filePath\": \"$TOOL_PATH\", \"options\": {\"overwriteExisting\": true}}"
done

# 5. Verify re-migration
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT name, status, updated_at FROM security_tools WHERE name IN ('UpdatedTool1', 'UpdatedTool2');"
```

---

## Advanced Administration

### Bulk Operations

**Migrate All Tools in a Category**:
```bash
# Via API
curl -X POST http://localhost:3001/api/v1/tool-migration/migrate-batch \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{
    "category": "bug_hunter",
    "options": {
      "installDependencies": true,
      "runTests": false,
      "registerInDatabase": true
    }
  }'
```

**Re-migrate All Existing Tools**:
```bash
#!/bin/bash
# re-migrate-all.sh

# Get list of all migrated tools
TOOLS=$(docker exec rtpi-postgres psql -U rtpi -d rtpi_main -t -c \
  "SELECT name FROM security_tools WHERE metadata->>'source' = 'offsec-team';")

# Re-migrate each tool
for tool in $TOOLS; do
  echo "Re-migrating: $tool"

  # Find tool path
  TOOL_PATH=$(find /home/cmndcntrl/rtpi/tools/offsec-team -name "$tool.py" | head -1)

  if [ -z "$TOOL_PATH" ]; then
    echo "  Warning: Could not find $tool.py"
    continue
  fi

  # Migrate with overwrite
  curl -X POST http://localhost:3001/api/v1/tool-migration/migrate \
    -H "Content-Type: application/json" \
    -d "{
      \"filePath\": \"$TOOL_PATH\",
      \"options\": {
        \"overwriteExisting\": true,
        \"installDependencies\": true
      }
    }"

  echo "  Completed: $tool"
  sleep 2  # Rate limit
done

echo "All tools re-migrated"
```

### Custom Migration Scripts

**Selective Migration with Custom Logic**:
```typescript
// scripts/custom-migrate.ts
import { analyzePythonTool } from '../server/services/tool-analyzer';
import { migrateTool } from '../server/services/tool-migration-service';
import path from 'path';

async function customMigrate(toolPath: string) {
  try {
    // 1. Analyze tool
    const analysis = await analyzePythonTool(toolPath);
    console.log(`Analyzing: ${analysis.toolName}`);

    // 2. Custom validation logic
    if (analysis.complexity === 'very-high') {
      console.log(`Skipping very-high complexity tool: ${analysis.toolName}`);
      return;
    }

    if (analysis.dependencies.length > 10) {
      console.log(`Skipping tool with too many dependencies: ${analysis.toolName}`);
      return;
    }

    // 3. Migrate with custom options
    const result = await migrateTool(analysis, {
      installDependencies: true,
      runTests: analysis.hasTests,  // Only run tests if available
      registerInDatabase: true,
      overwriteExisting: false,
    });

    console.log(`Migration result for ${analysis.toolName}:`, result.success ? 'SUCCESS' : 'FAILED');

  } catch (error) {
    console.error(`Error migrating ${toolPath}:`, error);
  }
}

// Run for specific tool or all tools in directory
const toolPath = process.argv[2];
if (toolPath) {
  customMigrate(toolPath);
} else {
  console.error('Usage: npx tsx scripts/custom-migrate.ts <path-to-tool.py>');
}
```

**Usage**:
```bash
# Migrate single tool with custom logic
npx tsx scripts/custom-migrate.ts /home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py

# Migrate all tools in a directory
for tool in /home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/*.py; do
  npx tsx scripts/custom-migrate.ts "$tool"
done
```

### Monitoring Dashboard

**Create Migration Metrics Endpoint**:
```typescript
// Add to /server/api/v1/tool-migration.ts
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'error') as errors,
        COUNT(*) FILTER (WHERE metadata->>'hasTests' = 'true') as with_tests,
        COUNT(*) FILTER (WHERE metadata->>'requiresExternalServices' = 'true') as requires_services,
        AVG((metadata->>'estimatedMigrationDays')::numeric) as avg_complexity
      FROM security_tools
      WHERE metadata->>'source' = 'offsec-team'
    `);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Query metrics**:
```bash
curl -s http://localhost:3001/api/v1/tool-migration/metrics | jq '.'
```

---

## Testing & Validation

### Validating Individual Tool

**Complete Validation Checklist**:
```bash
#!/bin/bash
# validate-tool.sh <tool-name>

TOOL_NAME=$1

echo "=== Validating Tool: $TOOL_NAME ==="

# 1. Check database entry
echo "1. Checking database..."
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT name, status, metadata->>'wrapperPath' as wrapper
   FROM security_tools
   WHERE name = '$TOOL_NAME';"

# 2. Verify wrapper file exists
echo "2. Checking wrapper file..."
WRAPPER="/home/cmndcntrl/rtpi/server/services/python-tools/${TOOL_NAME}.ts"
if [ -f "$WRAPPER" ]; then
  echo "  ✓ Wrapper exists: $WRAPPER"
  ls -lh "$WRAPPER"
else
  echo "  ✗ Wrapper not found: $WRAPPER"
fi

# 3. Test TypeScript compilation
echo "3. Testing TypeScript compilation..."
cd /home/cmndcntrl/rtpi
npx tsc "$WRAPPER" --noEmit
if [ $? -eq 0 ]; then
  echo "  ✓ TypeScript compiles successfully"
else
  echo "  ✗ TypeScript compilation failed"
fi

# 4. Find Python source
echo "4. Checking Python source..."
PY_SOURCE=$(find /home/cmndcntrl/rtpi/tools/offsec-team -name "${TOOL_NAME}.py")
if [ -f "$PY_SOURCE" ]; then
  echo "  ✓ Python source found: $PY_SOURCE"
else
  echo "  ✗ Python source not found"
fi

# 5. Test Python execution
echo "5. Testing Python execution..."
if [ -f "$PY_SOURCE" ]; then
  python3 "$PY_SOURCE" --help 2>&1 | head -5
fi

echo "=== Validation Complete ==="
```

**Usage**:
```bash
chmod +x validate-tool.sh
./validate-tool.sh WebVulnerabilityTester
```

### Running Unit Tests

```bash
# Run all tool migration tests
cd /home/cmndcntrl/rtpi
npm test -- server/services/__tests__/tool-migration.test.ts

# Run specific test suite
npm test -- server/services/__tests__/tool-migration.test.ts -t "analyzePythonTool"

# Run integration tests
npm test -- server/services/__tests__/tool-migration-integration.test.ts

# Run API tests
npm test -- server/api/__tests__/tool-migration-api.test.ts

# Run all tests with coverage
npm test -- --coverage
```

**Expected Test Results**:
```
✓ Tool Analyzer
  ✓ analyzePythonTool
    ✓ should extract tool name correctly
    ✓ should extract class name
    ✓ should identify correct category
    ✓ should extract methods
    ✓ should extract dependencies
    ✓ should estimate complexity
  ✓ generateToolConfig
    ✓ should generate valid RTPI tool configuration
  ✓ analyzeToolsDirectory
    ✓ should analyze all tools in directory
```

### Running E2E Tests

```bash
# Run tool migration E2E tests
npm run test:e2e -- tests/e2e/tool-migration.spec.ts

# Run specific test
npm run test:e2e -- tests/e2e/tool-migration.spec.ts -g "should display Tool Migration page"

# Run with headed browser (visual debugging)
npm run test:e2e -- tests/e2e/tool-migration.spec.ts --headed

# Generate HTML report
npm run test:e2e -- tests/e2e/tool-migration.spec.ts --reporter=html
```

---

## API Reference

### Base URL
```
http://localhost:3001/api/v1/tool-migration
```

### Authentication
All endpoints require session-based authentication via `connect.sid` cookie.

### Endpoints

#### 1. GET /analyze
Analyze all tools in offsec-team repository.

**Request:**
```bash
curl -s http://localhost:3001/api/v1/tool-migration/analyze
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalTools": 40,
      "categoryCounts": {
        "scanning": 8,
        "web-application": 8,
        "other": 24
      },
      "complexityCounts": {
        "low": 5,
        "medium": 20,
        "high": 12,
        "very-high": 3
      }
    },
    "toolsByCategory": {
      "bug_hunter": [...],
      "burpsuite_operator": [...]
    }
  }
}
```

#### 2. POST /analyze-file
Analyze a specific Python tool file.

**Request:**
```bash
curl -X POST http://localhost:3001/api/v1/tool-migration/analyze-file \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "toolName": "WebVulnerabilityTester",
    "className": "WebVulnerabilityTester",
    "category": "scanning",
    "description": "Tests for SQL injection, XSS, and command injection vulnerabilities",
    "methods": [...],
    "dependencies": [...],
    "complexity": "medium",
    "estimatedMigrationDays": 3
  }
}
```

#### 3. POST /migrate
Migrate a single tool.

**Request:**
```bash
curl -X POST http://localhost:3001/api/v1/tool-migration/migrate \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/home/cmndcntrl/rtpi/tools/offsec-team/tools/bug_hunter/WebVulnerabilityTester.py",
    "options": {
      "installDependencies": true,
      "runTests": false,
      "registerInDatabase": true,
      "generateWrapper": true,
      "overwriteExisting": false
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "toolName": "WebVulnerabilityTester",
    "success": true,
    "steps": [
      {"step": "dependencies", "success": true, "message": "Installed 2 dependencies"},
      {"step": "wrapper", "success": true, "message": "Generated wrapper at ..."},
      {"step": "database", "success": true, "message": "Registered with ID ..."}
    ]
  }
}
```

#### 4. POST /migrate-batch
Batch migrate multiple tools.

**Request:**
```bash
curl -X POST http://localhost:3001/api/v1/tool-migration/migrate-batch \
  -H "Content-Type: application/json" \
  -d '{
    "category": "bug_hunter",
    "options": {
      "installDependencies": true,
      "runTests": false,
      "registerInDatabase": true
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 8,
      "successful": 7,
      "failed": 1
    },
    "results": [...]
  }
}
```

#### 5. GET /status/:toolName
Check migration status of a specific tool.

**Request:**
```bash
curl -s http://localhost:3001/api/v1/tool-migration/status/WebVulnerabilityTester
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exists": true,
    "installed": true,
    "toolId": "uuid-here",
    "config": {...}
  }
}
```

#### 6. GET /recommendations
Get recommended tools for migration based on priority scoring.

**Request:**
```bash
curl -s http://localhost:3001/api/v1/tool-migration/recommendations
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommended": [
      {
        "toolName": "WebVulnerabilityTester",
        "priority": 15,
        "category": "scanning",
        "complexity": "medium"
      }
    ],
    "criteria": {
      "categoryBonus": {...},
      "complexityBonus": {...}
    }
  }
}
```

---

## Support & Resources

### Documentation

**User Documentation:**
- Tool Migration User Guide: `/docs/user-guides/tool-migration-user-guide.md`

**Technical Documentation:**
- Tool Extraction Plan: `/docs/offsec-team-extraction-plan.md`
- Tool Analysis Results: `/docs/offsec-team-analysis.md`
- Master Tracker: `/docs/tracking/master-tracker.md` (Enhancement 05)

### Source Code

**Core Services:**
- Tool Analyzer: `/server/services/tool-analyzer.ts` (592 lines)
- Migration Service: `/server/services/tool-migration-service.ts` (553 lines)
- API Routes: `/server/api/v1/tool-migration.ts` (385 lines)

**Database:**
- Schema Definition: `/shared/schema.ts` (security_tools table)

**Tests:**
- Unit Tests: `/server/services/__tests__/tool-migration.test.ts` (268 lines)
- Integration Tests: `/server/services/__tests__/tool-migration-integration.test.ts` (562 lines)
- API Tests: `/server/api/__tests__/tool-migration-api.test.ts` (440 lines)
- E2E Tests: `/tests/e2e/tool-migration.spec.ts`

**UI Components:**
- Tool Migration Page: `/client/src/pages/ToolMigration.tsx`
- Tool Analyzer Dialog: `/client/src/components/tools/ToolAnalyzer.tsx`
- Migration Progress: `/client/src/components/tools/MigrationProgress.tsx`
- Tool Catalog: `/client/src/components/tools/ToolCatalog.tsx`

### Getting Help

**Logs and Debugging:**
```bash
# Check API logs
docker logs rtpi-api -f

# Check database logs
docker logs rtpi-postgres -f

# Check for errors
docker logs rtpi-api 2>&1 | grep -i "error\|migration"
```

**Common Commands:**
```bash
# List all migrated tools
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT name, status FROM security_tools WHERE metadata->>'source' = 'offsec-team';"

# Check migration health
curl -s http://localhost:3001/api/v1/tool-migration/analyze | jq '.success'

# Validate specific tool
npx tsx scripts/list-migrated-tools.ts
```

**Contact:**
- GitHub Issues: File bug reports or feature requests
- Internal Documentation: Check `/docs/` for additional guides
- Project README: `/README.md`

---

## Appendix

### Glossary

- **Tool Migration**: Process of converting Python tools to TypeScript-wrapped executables
- **Wrapper**: TypeScript class that spawns Python process for tool execution
- **offsec-team**: Source repository containing 40 security tools
- **Complexity**: Estimated difficulty of migration (low, medium, high, very-high)
- **Category**: Tool classification (scanning, web-application, network-analysis, etc.)

### Change Log

- **v1.0** (2025-12-26): Initial release
  - Complete admin guide for tool migration system
  - 14 sections covering all administrative aspects
  - Integration with Phase 4 & 5 implementation

---

**End of Tool Migration Administrator Guide**
