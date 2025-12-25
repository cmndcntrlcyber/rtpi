# Empire C2 Integration - Troubleshooting Guide

## Quick Diagnostics

Run these commands first to gather information:

```bash
# Check service status
docker ps | grep -E "empire|postgres|redis"

# Check API connectivity
curl -s http://localhost:3001/api/v1/ | jq .

# Check database connectivity
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c "SELECT COUNT(*) FROM empire_servers;"

# Check Empire endpoint
curl -k https://localhost:1337/api/ 2>&1 | head -5

# View recent logs
docker logs rtpi-api --tail 50 | grep -i empire
```

## Connection Issues

### Problem: Server Shows "Disconnected"

**Symptoms:**
- Server card shows red "disconnected" status
- "Check Connection" button fails
- Error: "Failed to connect to Empire server"

**Diagnosis:**

```bash
# 1. Test direct connectivity
curl -k https://<EMPIRE_HOST>:<PORT>/api/

# 2. Check firewall
sudo ufw status | grep 1337

# 3. Verify Empire is running
docker ps | grep empire
# OR
sudo systemctl status empire
```

**Solutions:**

**If Empire is not running:**
```bash
# Docker deployment
docker compose up -d empire

# System service
sudo systemctl start empire
sudo systemctl enable empire
```

**If firewall blocks connection:**
```bash
# Allow from RTPI server
sudo ufw allow from <RTPI_IP> to any port 1337 proto tcp

# Or allow from all (less secure)
sudo ufw allow 1337/tcp
```

**If SSL certificate issues:**
```typescript
// Temporarily disable certificate validation (development only)
// server/services/empire-executor.ts
const apiClient = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,  // Add this line
  }),
});
```

### Problem: "Invalid Credentials" Error

**Symptoms:**
- Connection check fails with authentication error
- Logs show "401 Unauthorized"

**Diagnosis:**

```bash
# Test credentials directly
curl -k -X POST https://localhost:1337/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"empireadmin","password":"<PASSWORD>"}'
```

**Solutions:**

1. **Reset Empire admin password:**

```bash
# Access Empire container
docker exec -it rtpi-empire bash

# Run Empire setup
cd /opt/Empire
python3 empire --reset-admin --username admin --password NewPassword123!
```

2. **Update password in RTPI:**
   - Navigate to Servers tab
   - Click "Edit" on the server
   - Update admin password
   - Click "Save"

3. **Refresh authentication token:**
   - Click "Refresh Token" button on server card

### Problem: "Token Expired" Error

**Symptoms:**
- Operations fail after working previously
- Error: "Token expired" or "Invalid token"

**Quick Fix:**

```bash
# Clear token cache via API
curl -X DELETE http://localhost:3001/api/v1/empire/tokens/<SERVER_ID>/clear

# Or via database
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "DELETE FROM empire_user_tokens WHERE server_id = '<SERVER_ID>';"
```

**UI Fix:**
1. Go to Servers tab
2. Find the server
3. Click "Refresh Token"
4. Try the operation again

## Agent Issues

### Problem: Agents Not Appearing

**Symptoms:**
- Agents tab shows "No active agents"
- Agents exist in Empire but not in RTPI

**Solution:**

1. **Manual sync:**
   - Click "Sync to Database" button
   - Wait for sync to complete
   - Click "Refresh"

2. **Verify Empire has agents:**

```bash
# Via API
curl -k -H "Authorization: Bearer <TOKEN>" \
  https://localhost:1337/api/agents

# Via database (if Empire uses PostgreSQL)
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT COUNT(*) FROM empire_agents;"
```

3. **Check sync errors:**

```bash
# View RTPI logs
docker logs rtpi-api --tail 100 | grep "sync.*agents"
```

### Problem: Agent Shows as "Lost"

**Symptoms:**
- Agent status shows gray "Lost" badge
- Last seen time is over 1 hour ago

**Diagnosis:**

```bash
# Check agent last callback
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT name, hostname, lastseen_time, NOW() - lastseen_time as offline_duration
   FROM empire_agents
   WHERE status = 'lost';"
```

**Solutions:**

1. **Agent may be legitimately dead:**
   - Target system powered off
   - Network disconnected
   - Agent process killed

2. **Clean up lost agents:**

```sql
-- Remove agents lost for > 24 hours
DELETE FROM empire_agents
WHERE lastseen_time < NOW() - INTERVAL '24 hours'
  AND status = 'lost';
```

3. **Check listener status:**
   - Verify listener is still running
   - Check listener port is accessible
   - Review listener logs

### Problem: Cannot Execute Tasks

**Symptoms:**
- Task submission fails
- Error: "Agent not found" or "Failed to execute task"

**Diagnosis:**

1. **Verify agent is active:**

```sql
SELECT name, status, lastseen_time
FROM empire_agents
WHERE name = '<AGENT_NAME>';
```

2. **Check task queue:**

```bash
# Via Empire API
curl -k -H "Authorization: Bearer <TOKEN>" \
  https://localhost:1337/api/agents/<AGENT_NAME>/tasks
```

**Solutions:**

1. **Agent not checked in recently:**
   - Wait for next callback (check delay/jitter settings)
   - Task will execute on next check-in

2. **Task format invalid:**
   - Verify command syntax
   - Check module name spelling
   - Ensure required parameters provided

3. **Clear stuck tasks:**

```sql
-- Cancel old pending tasks
UPDATE empire_tasks
SET status = 'cancelled'
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '1 hour';
```

## Listener Issues

### Problem: Cannot Create Listener

**Symptoms:**
- Create Listener button fails
- Error: "Port already in use" or "Failed to create listener"

**Diagnosis:**

```bash
# Check if port is in use
sudo lsof -i :8080

# Or
sudo netstat -tulpn | grep :8080
```

**Solutions:**

1. **Port conflict:**
   - Choose a different port
   - Stop conflicting service
   - Update firewall rules for new port

2. **Empire API not responsive:**

```bash
# Restart Empire
docker restart rtpi-empire

# Check Empire logs
docker logs rtpi-empire --tail 50
```

3. **Invalid configuration:**
   - Verify staging key format
   - Check certificate path exists
   - Ensure host is valid IP/hostname

### Problem: Listener Stops Unexpectedly

**Symptoms:**
- Listener shows as stopped in RTPI
- Agents stop calling back

**Diagnosis:**

```bash
# Check Empire listener status
curl -k -H "Authorization: Bearer <TOKEN>" \
  https://localhost:1337/api/listeners

# Check network connectivity
nc -zv <LISTENER_HOST> <LISTENER_PORT>
```

**Solutions:**

1. **Restart listener:**
   - Navigate to Listeners tab
   - Delete old listener
   - Create new listener with same settings

2. **Check Empire resource limits:**

```bash
# Check Empire container resources
docker stats rtpi-empire

# Increase resources if needed (docker-compose.yml)
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '2'
```

## Credential Issues

### Problem: No Credentials Displayed

**Symptoms:**
- Credentials tab shows empty
- Credentials harvested in Empire but not in RTPI

**Solution:**

1. **Sync credentials:**
   - Click "Sync from Empire" button
   - Wait for sync to complete
   - Click "Refresh"

2. **Verify credentials exist in Empire:**

```bash
curl -k -H "Authorization: Bearer <TOKEN>" \
  https://localhost:1337/api/creds
```

3. **Check sync errors:**

```bash
docker logs rtpi-api --tail 100 | grep "credentials"
```

### Problem: Cannot Copy Credentials

**Symptoms:**
- Copy button doesn't work
- No feedback when clicking copy

**Solutions:**

1. **Browser clipboard permissions:**
   - Check browser settings
   - Allow clipboard access for localhost
   - Try in different browser

2. **Manual copy:**
   - Click eye icon to show secret
   - Select text manually
   - Copy with Ctrl+C / Cmd+C

## Database Issues

### Problem: Foreign Key Constraint Errors

**Symptoms:**
- Error: "violates foreign key constraint"
- Cannot delete servers or agents

**Diagnosis:**

```sql
-- Check references
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name LIKE 'empire_%'
  AND tc.constraint_type = 'FOREIGN KEY';
```

**Solution:**

```sql
-- Delete with CASCADE (will delete related records)
DELETE FROM empire_servers WHERE id = '<SERVER_ID>';

-- Or delete children first
DELETE FROM empire_agents WHERE server_id = '<SERVER_ID>';
DELETE FROM empire_listeners WHERE server_id = '<SERVER_ID>';
-- ... then delete server
DELETE FROM empire_servers WHERE id = '<SERVER_ID>';
```

### Problem: Schema Out of Sync

**Symptoms:**
- Error: "column does not exist"
- Missing tables or columns

**Solution:**

```bash
# Re-apply schema
npm run db:push

# Check for migration issues
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c "\d empire_servers"

# If needed, drop and recreate (⚠️ DATA LOSS)
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:push
```

## AI Agent Integration Issues

### Problem: Empire Not Included in Workflow

**Symptoms:**
- Workflow runs but no Empire tasks executed
- No Empire section in execution plan

**Diagnosis:**

```sql
-- Check if Empire infrastructure is detected
SELECT COUNT(*) FROM empire_servers WHERE status = 'connected';
SELECT COUNT(*) FROM empire_agents WHERE status = 'active';
```

**Solutions:**

1. **Ensure server is connected:**
   - Check server status
   - Run connection check
   - Verify token is valid

2. **Ensure agents are synced:**
   - Run "Sync to Database"
   - Verify agents appear in Agents tab

3. **Check workflow logs:**

```bash
# View workflow execution logs
docker logs rtpi-api | grep -A 5 "Empire infrastructure"
```

### Problem: Empire Tasks Fail in Workflow

**Symptoms:**
- Workflow shows Empire tasks as failed
- Error in workflow logs

**Diagnosis:**

```bash
# Check workflow task status
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT id, task_name, status, error_message
   FROM workflow_tasks
   WHERE task_name LIKE '%Empire%'
   ORDER BY created_at DESC LIMIT 5;"
```

**Solutions:**

1. **Agent not available:**
   - Verify agent is still active
   - Check agent last seen time
   - Re-sync agents if needed

2. **Module not found:**
   - Verify module name spelling
   - Check module is available on Empire server
   - Try with different module

3. **Timeout:**
   - Increase workflow timeout in configuration
   - Check network latency

## UI Issues

### Problem: Empire Tab Not Loading

**Symptoms:**
- Empire tab shows loading spinner indefinitely
- Console errors in browser

**Diagnosis:**

```bash
# Check browser console (F12)
# Look for errors like:
# - "Failed to fetch"
# - "Network error"
# - "CORS error"

# Check API endpoint
curl http://localhost:3001/api/v1/empire/servers
```

**Solutions:**

1. **API not responding:**

```bash
# Restart backend
docker restart rtpi-api

# Check backend logs
docker logs rtpi-api --tail 50
```

2. **Frontend build issue:**

```bash
# Rebuild frontend
npm run build

# Restart frontend server
# (if running separately)
npm run dev:frontend
```

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - Clear site data in DevTools
   - Try incognito/private mode

### Problem: Dialogs Not Opening

**Symptoms:**
- Click "Add Server" but dialog doesn't appear
- No error messages shown

**Solutions:**

1. **Z-index issue:**
   - Check browser console for CSS warnings
   - Try disabling browser extensions
   - Test in different browser

2. **JavaScript error:**
   - Check browser console for errors
   - Verify all components loaded
   - Check network tab for failed requests

## Performance Issues

### Problem: Slow API Responses

**Symptoms:**
- Long delays when loading pages
- Timeouts on operations

**Diagnosis:**

```bash
# Check database query performance
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT query, calls, total_time, mean_time
   FROM pg_stat_statements
   WHERE query LIKE '%empire%'
   ORDER BY mean_time DESC LIMIT 10;"

# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s \
  http://localhost:3001/api/v1/empire/servers
```

**Solutions:**

1. **Add database indexes:**

```sql
CREATE INDEX IF NOT EXISTS idx_empire_agents_lastseen
ON empire_agents(lastseen_time DESC);

CREATE INDEX IF NOT EXISTS idx_empire_tasks_status
ON empire_tasks(status);
```

2. **Clear old data:**

```sql
-- Remove old tasks
DELETE FROM empire_tasks
WHERE created_at < NOW() - INTERVAL '7 days';

-- Archive old credentials
-- (see Admin Guide for archival procedures)
```

3. **Increase connection pool:**

```typescript
// server/db/index.ts
const pool = new Pool({
  max: 20,  // Increase from default
  idleTimeoutMillis: 30000,
});
```

## Getting Additional Help

### Collect Diagnostic Information

```bash
#!/bin/bash
# collect-empire-diagnostics.sh

echo "=== System Info ===" > empire-diag.txt
uname -a >> empire-diag.txt
docker --version >> empire-diag.txt

echo -e "\n=== Container Status ===" >> empire-diag.txt
docker ps | grep -E "empire|postgres|redis" >> empire-diag.txt

echo -e "\n=== Database Status ===" >> empire-diag.txt
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c "\dt empire_*" >> empire-diag.txt

echo -e "\n=== Server Status ===" >> empire-diag.txt
docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c \
  "SELECT id, name, status, last_heartbeat FROM empire_servers;" >> empire-diag.txt

echo -e "\n=== Recent Logs ===" >> empire-diag.txt
docker logs rtpi-api --tail 100 | grep -i empire >> empire-diag.txt

echo "Diagnostic information saved to empire-diag.txt"
```

### Resources

- **GitHub Issues:** https://github.com/anthropics/rtpi/issues
- **User Guide:** `/docs/user-guides/empire-c2-user-guide.md`
- **Admin Guide:** `/docs/admin-guides/empire-c2-admin-guide.md`
- **Security Audit:** `/docs/security/empire-security-audit.md`
- **Empire Wiki:** https://bc-security.gitbook.io/empire-wiki/

### Reporting Issues

When reporting issues, include:
1. RTPI version (`git rev-parse HEAD`)
2. Empire version (from UI or `docker logs rtpi-empire | head`)
3. Error messages (from browser console and server logs)
4. Steps to reproduce
5. Diagnostic output (use script above)

**Version:** 1.0.0-beta.1
**Last Updated:** 2025-12-25
