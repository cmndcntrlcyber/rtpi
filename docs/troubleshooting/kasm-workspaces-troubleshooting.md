# Kasm Workspaces Troubleshooting Guide

This guide provides solutions to common issues with Kasm Workspaces in RTPI.

## Table of Contents

- [Workspace Provisioning Issues](#workspace-provisioning-issues)
- [Workspace Startup Problems](#workspace-startup-problems)
- [Performance Issues](#performance-issues)
- [Network and Connectivity](#network-and-connectivity)
- [Resource Quota Issues](#resource-quota-issues)
- [Session Management](#session-management)
- [Docker and Container Issues](#docker-and-container-issues)
- [Database Issues](#database-issues)
- [Debugging and Diagnostics](#debugging-and-diagnostics)

---

## Workspace Provisioning Issues

### Symptom: "Failed to provision workspace"

**Common Causes**:
1. Kasm API is unavailable
2. Resource quotas exceeded
3. Invalid configuration
4. Network connectivity issues

**Diagnosis**:
```bash
# Check Kasm API health
curl -k https://kasm-api:443/api/health

# Check RTPI backend logs
docker logs rtpi-backend | grep -i kasm

# Verify Kasm service status
docker ps | grep kasm
```

**Solutions**:

#### Solution 1: Restart Kasm Services
```bash
docker-compose restart kasm-manager kasm-worker
```

#### Solution 2: Check Resource Quotas
```bash
# View user's current resource usage
tsx scripts/analyze-kasm-performance.ts --verbose
```

#### Solution 3: Verify Configuration
```bash
# Check environment variables
cat .env | grep KASM

# Required variables:
# KASM_ENABLED=true
# KASM_API_URL=https://kasm-api:443
# KASM_API_KEY=your-api-key
# KASM_API_SECRET=your-api-secret
```

### Symptom: "Resource quota exceeded"

**Error Message**: `User has reached maximum workspace limit (5)`

**Solutions**:

#### Solution 1: Terminate Unused Workspaces
```bash
# List user's active workspaces
tsx -e "
import { kasmWorkspaceManager } from './server/services/kasm-workspace-manager';
const workspaces = await kasmWorkspaceManager.listUserWorkspaces('user-id');
console.log(workspaces);
"

# Terminate specific workspace
tsx -e "
import { kasmWorkspaceManager } from './server/services/kasm-workspace-manager';
await kasmWorkspaceManager.terminateWorkspace('workspace-id');
"
```

#### Solution 2: Increase User Quota
```typescript
// In server/services/kasm-workspace-manager.ts
private defaultQuota: ResourceQuota = {
  maxWorkspaces: 10,  // Increase from 5
  maxCpuPerWorkspace: 4,
  maxMemoryPerWorkspace: 8192,
  maxTotalCpu: 32,  // Increase from 16
  maxTotalMemory: 65536,  // Increase from 32768
};
```

---

## Workspace Startup Problems

### Symptom: Workspace stuck in "Starting" state

**Common Causes**:
1. Container failed to start
2. Image pull timeout
3. Resource constraints
4. Network issues

**Diagnosis**:
```bash
# Check workspace status in database
tsx -e "
import { db } from './server/db';
import { kasmWorkspaces } from '@shared/schema';
const [ws] = await db.select().from(kasmWorkspaces).where(eq(kasmWorkspaces.id, 'workspace-id'));
console.log(ws);
"

# Check Kasm session status
docker ps -a | grep <container-id>

# View container logs
docker logs <container-id>
```

**Solutions**:

#### Solution 1: Check Kasm Worker Resources
```bash
# View Docker resource usage
docker stats

# Check available disk space
df -h

# Check available memory
free -h
```

#### Solution 2: Manual Container Restart
```bash
# Restart stuck container
docker restart <container-id>

# Update workspace status
tsx -e "
import { kasmWorkspaceManager } from './server/services/kasm-workspace-manager';
await kasmWorkspaceManager.updateWorkspaceStatus('workspace-id', 'running');
"
```

#### Solution 3: Clean Up and Retry
```bash
# Remove failed container
docker rm -f <container-id>

# Retry provisioning
# User should provision a new workspace through the UI
```

###Symptom: Workspace starts but crashes immediately

**Common Causes**:
1. Corrupted image
2. Missing dependencies
3. Configuration errors
4. Resource limits too low

**Diagnosis**:
```bash
# Check container exit code
docker inspect <container-id> --format='{{.State.ExitCode}}'

# View container logs
docker logs <container-id> --tail 100

# Check for OOM kills
dmesg | grep -i "out of memory"
```

**Solutions**:

#### Solution 1: Re-pull Image
```bash
# Remove corrupted image
docker rmi kasmweb/kali-rolling-desktop:1.17.0

# Pull fresh image
docker pull kasmweb/kali-rolling-desktop:1.17.0
```

#### Solution 2: Increase Resource Limits
```typescript
// When provisioning workspace
{
  cpuLimit: '4',        // Increase from default 2
  memoryLimit: '8192M', // Increase from default 4096M
}
```

### Symptom: "Startup timeout exceeded (>60s)"

**Solutions**:

#### Solution 1: Pre-pull Images
```bash
# On all Kasm worker nodes
docker pull kasmweb/vscode:1.17.0
docker pull kasmweb/burp-suite:1.17.0
docker pull kasmweb/kali-rolling-desktop:1.17.0
docker pull kasmweb/firefox:1.17.0
docker pull kasmweb/empire-client:1.17.0
```

#### Solution 2: Use Optimized Images
```bash
# Build and use optimized images
./scripts/build-optimized-images.sh --all --push

# Update workspace manager to use optimized images
# See: docker/kasm-workspaces/README.md
```

#### Solution 3: Increase Timeout
```typescript
// In server/services/kasm-workspace-manager.ts
private async monitorWorkspaceStartup(workspaceId: string, provisioningStartTime?: number): Promise<void> {
  const maxAttempts = 30; // Increase from 20 (90 seconds instead of 60)
  // ...
}
```

---

## Performance Issues

### Symptom: Slow workspace response time

**Diagnosis**:
```bash
# Run performance analysis
tsx scripts/analyze-kasm-performance.ts --days 1 --verbose

# Check resource utilization
docker stats <container-id>

# Check network latency
ping kasm-api
```

**Solutions**:

See [Kasm Performance Optimization Guide](../admin-guides/kasm-performance-optimization.md)

### Symptom: High CPU usage

**Diagnosis**:
```bash
# Identify high-CPU containers
docker stats --no-stream | sort -k3 -h

# Check process tree
docker exec <container-id> ps aux --sort=-%cpu | head -10
```

**Solutions**:

#### Solution 1: Adjust CPU Limits
```bash
# Update running container
docker update --cpus="2" <container-id>
```

#### Solution 2: Restart Workspace
```bash
# Terminate and re-provision with lower CPU limit
tsx -e "
import { kasmWorkspaceManager } from './server/services/kasm-workspace-manager';
await kasmWorkspaceManager.terminateWorkspace('workspace-id');
"
```

---

## Network and Connectivity

### Symptom: Cannot access workspace URL

**Common Causes**:
1. Kasm proxy not running
2. Firewall blocking access
3. Invalid access URL
4. Session expired

**Diagnosis**:
```bash
# Check Kasm proxy
docker ps | grep kasm-proxy

# Test access URL
curl -I https://kasm-domain:8443

# Check firewall rules
sudo iptables -L -n | grep 8443
```

**Solutions**:

#### Solution 1: Restart Kasm Proxy
```bash
docker-compose restart kasm-proxy
```

#### Solution 2: Verify Access URL
```bash
# Check workspace access URL
tsx -e "
import { db } from './server/db';
import { kasmWorkspaces } from '@shared/schema';
const [ws] = await db.select().from(kasmWorkspaces).where(eq(kasmWorkspaces.id, 'workspace-id'));
console.log('Access URL:', ws.accessUrl);
"
```

#### Solution 3: Open Firewall Ports
```bash
# Allow Kasm proxy port
sudo ufw allow 8443/tcp

# Or for iptables
sudo iptables -A INPUT -p tcp --dport 8443 -j ACCEPT
```

### Symptom: "ERR_CONNECTION_REFUSED" when accessing workspace

**Solutions**:

#### Solution 1: Check Container Port Mapping
```bash
# Verify port mapping
docker port <container-id>
```

#### Solution 2: Verify Network Configuration
```bash
# Check Docker network
docker network inspect kasm-network

# Ensure RTPI and Kasm are on same network
docker network connect kasm-network rtpi-backend
```

---

## Resource Quota Issues

### Symptom: "Total CPU usage would exceed quota"

**Solutions**:

#### Solution 1: Terminate Unused Workspaces
```bash
# List user's workspaces
tsx -e "
import { kasmWorkspaceManager } from './server/services/kasm-workspace-manager';
const usage = await kasmWorkspaceManager.getUserResourceUsage('user-id');
console.log(usage);
"
```

#### Solution 2: Adjust Quotas
```typescript
// In server/services/kasm-workspace-manager.ts
// Increase per-user quotas
private defaultQuota: ResourceQuota = {
  maxWorkspaces: 10,
  maxCpuPerWorkspace: 8,
  maxMemoryPerWorkspace: 16384,
  maxTotalCpu: 32,
  maxTotalMemory: 65536,
};
```

---

## Session Management

### Symptom: Session expires prematurely

**Solutions**:

#### Solution 1: Extend Session Timeout
```typescript
// In createSession method
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours instead of 12
```

#### Solution 2: Implement Session Heartbeat
```typescript
// Client-side: Send heartbeat every 5 minutes
setInterval(async () => {
  await fetch('/api/v1/kasm-workspaces/sessions/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ sessionToken }),
  });
}, 5 * 60 * 1000);
```

### Symptom: Multiple active sessions for same workspace

**Diagnosis**:
```bash
# List active sessions
tsx -e "
import { kasmWorkspaceManager } from './server/services/kasm-workspace-manager';
const sessions = await kasmWorkspaceManager.getActiveSessions('workspace-id');
console.log(sessions);
"
```

**Solutions**:

#### Solution 1: Terminate Extra Sessions
```bash
# Terminate specific session
tsx -e "
import { kasmWorkspaceManager } from './server/services/kasm-workspace-manager';
await kasmWorkspaceManager.terminateSession('session-token');
"
```

---

## Docker and Container Issues

### Symptom: "Error response from daemon: No such container"

**Solutions**:

#### Solution 1: Sync Database with Docker
```bash
# List actual running containers
docker ps --filter "name=kasm-"

# Update workspace statuses
tsx -e "
import { db } from './server/db';
import { kasmWorkspaces } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Mark workspaces as stopped if container doesn't exist
const workspaces = await db.select().from(kasmWorkspaces)
  .where(eq(kasmWorkspaces.status, 'running'));

for (const ws of workspaces) {
  try {
    execSync(\`docker inspect \${ws.kasmContainerId}\`);
  } catch {
    await db.update(kasmWorkspaces)
      .set({ status: 'stopped', terminatedAt: new Date() })
      .where(eq(kasmWorkspaces.id, ws.id));
  }
}
"
```

### Symptom: "Cannot connect to Docker daemon"

**Solutions**:

#### Solution 1: Start Docker Daemon
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

#### Solution 2: Fix Docker Socket Permissions
```bash
sudo chmod 666 /var/run/docker.sock

# Or add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

---

## Database Issues

### Symptom: Orphaned workspaces in database

**Diagnosis**:
```bash
# Find workspaces without containers
tsx -e "
import { db } from './server/db';
import { kasmWorkspaces } from '@shared/schema';
import { isNull, and } from 'drizzle-orm';

const workspaces = await db.select().from(kasmWorkspaces)
  .where(and(
    isNull(kasmWorkspaces.terminatedAt),
    // Add logic to check if container exists
  ));
console.log('Orphaned workspaces:', workspaces.length);
"
```

**Solutions**:

#### Solution 1: Clean Up Orphaned Records
```bash
# Run cleanup script
tsx -e "
import { kasmWorkspaceManager } from './server/services/kasm-workspace-manager';
await kasmWorkspaceManager.cleanupExpiredWorkspaces();
"
```

### Symptom: Database connection pool exhausted

**Solutions**:

#### Solution 1: Increase Pool Size
```typescript
// In server/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(DATABASE_URL, {
  max: 20, // Increase from default 10
  idle_timeout: 20,
  connect_timeout: 10,
});
```

---

## Debugging and Diagnostics

### Enable Debug Logging

```typescript
// In server/services/kasm-workspace-manager.ts
// Add detailed logging
console.log('[KasmWorkspaceManager] DEBUG:', {
  workspaceId,
  status,
  timestamp: new Date().toISOString(),
  // ... other debug info
});
```

### Export Workspace State

```bash
# Export all workspace data for debugging
tsx -e "
import { db } from './server/db';
import { kasmWorkspaces } from '@shared/schema';
import fs from 'fs';

const workspaces = await db.select().from(kasmWorkspaces);
fs.writeFileSync('workspace-dump.json', JSON.stringify(workspaces, null, 2));
console.log('Exported', workspaces.length, 'workspaces to workspace-dump.json');
"
```

### Health Check Script

```bash
#!/bin/bash
# kasm-health-check.sh

echo "=== Kasm Workspace Health Check ==="
echo ""

echo "1. Docker Status:"
docker info > /dev/null 2>&1 && echo "✓ Docker daemon running" || echo "✗ Docker daemon not running"

echo ""
echo "2. Kasm Services:"
docker ps --filter "name=kasm-" --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "3. Resource Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "4. API Health:"
curl -sk https://kasm-api:443/api/health && echo "✓ Kasm API healthy" || echo "✗ Kasm API unhealthy"

echo ""
echo "5. Active Workspaces:"
tsx -e "
import { db } from './server/db';
import { kasmWorkspaces } from '@shared/schema';
import { isNull } from 'drizzle-orm';

const active = await db.select().from(kasmWorkspaces)
  .where(isNull(kasmWorkspaces.terminatedAt));
console.log('Active workspaces:', active.length);
"
```

---

## Getting Help

If you've tried all solutions and still experiencing issues:

1. **Collect Diagnostic Information**:
   ```bash
   # Run health check
   ./scripts/kasm-health-check.sh > diagnostic-output.txt

   # Export workspace data
   tsx scripts/analyze-kasm-performance.ts --export performance.json

   # Collect logs
   docker-compose logs kasm-manager kasm-worker > kasm-logs.txt
   ```

2. **Check Documentation**:
   - [Kasm Performance Optimization](../admin-guides/kasm-performance-optimization.md)
   - [Docker Images README](../../docker/kasm-workspaces/README.md)
   - [Kasm Official Docs](https://www.kasmweb.com/docs)

3. **Contact Support**:
   - Include diagnostic files
   - Describe steps to reproduce
   - Mention any recent changes

---

**Last Updated**: 2025-01-15
**Maintained By**: Platform Engineering Team
**Review Cycle**: Monthly
