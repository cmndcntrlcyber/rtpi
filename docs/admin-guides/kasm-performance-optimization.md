# Kasm Workspace Performance Optimization Guide

## Overview

This guide provides recommendations for optimizing Kasm Workspace startup times to meet the <60-second performance target. Based on performance analysis, workspace startup consists of three main phases:

1. **Quota Check Phase** (~100-500ms): Resource quota validation
2. **Session Creation Phase** (~10-40s): Docker container creation and initialization
3. **Monitoring Phase** (~5-20s): Polling until workspace reaches running state

**Target Performance**: All workspaces should start in < 60 seconds under normal load conditions.

## Performance Monitoring

### Automated Performance Tracking

All workspace provisioning operations are automatically instrumented with performance metrics stored in the workspace metadata:

```typescript
{
  performance: {
    provisioningStartedAt: "2025-01-15T10:00:00.000Z",
    quotaCheckDurationMs: 250,
    sessionCreateDurationMs: 15000,
    totalStartupTimeMs: 45000,
    monitoringDurationMs: 30000,
    statusCheckAttempts: 10,
    averageStatusCheckDurationMs: 150
  }
}
```

### Running Performance Analysis

Use the performance analyzer script to generate reports:

```bash
# Analyze last 7 days
tsx scripts/analyze-kasm-performance.ts

# Analyze specific workspace type
tsx scripts/analyze-kasm-performance.ts --type kali

# Analyze last 30 days with detailed breakdown
tsx scripts/analyze-kasm-performance.ts --days 30 --verbose

# Export results to JSON
tsx scripts/analyze-kasm-performance.ts --export performance-report.json
```

### Interpreting Results

The performance analyzer provides:
- **Overall metrics**: Average, median, P95, P99 startup times
- **Target compliance**: Percentage within <60s goal
- **Phase breakdown**: Time spent in each phase
- **Bottleneck analysis**: Slowest phases ranked by impact
- **Type-specific stats**: Performance by workspace type
- **Recommendations**: Actionable optimization suggestions

## Optimization Strategies

### 1. Docker Image Optimization

**Problem**: Large Docker images take longer to pull and start.

**Solutions**:

#### a) Pre-pull Images on Kasm Workers

```bash
# Pre-pull all workspace images on Kasm worker nodes
docker pull kasmweb/vscode:1.17.0
docker pull kasmweb/burp-suite:1.17.0
docker pull kasmweb/kali-rolling-desktop:1.17.0
docker pull kasmweb/firefox:1.17.0
docker pull kasmweb/empire-client:1.17.0
```

Set up automated image pulling:
```bash
# Add to crontab on Kasm workers
0 2 * * * /usr/local/bin/pull-kasm-images.sh
```

#### b) Use Image Layer Caching

Configure Docker daemon on Kasm workers:
```json
{
  "storage-driver": "overlay2",
  "max-concurrent-downloads": 3,
  "max-concurrent-uploads": 5
}
```

#### c) Create Custom Optimized Images

For frequently used workspaces, create optimized images:

```dockerfile
FROM kasmweb/kali-rolling-desktop:1.17.0

# Remove unnecessary packages
RUN apt-get purge -y \
    libreoffice* \
    thunderbird* \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Add only required tools
RUN apt-get update && apt-get install -y \
    nmap \
    metasploit-framework \
    && apt-get clean
```

**Expected Impact**: 30-50% reduction in startup time

### 2. Resource Quota Optimization

**Problem**: Quota checks can become slow with many active workspaces.

**Solutions**:

#### a) Add Database Indexes

```sql
-- Add index for faster quota queries
CREATE INDEX idx_kasm_workspaces_user_active
ON kasm_workspaces(user_id, terminated_at)
WHERE terminated_at IS NULL;
```

#### b) Cache Quota Results

Implement Redis caching for user quotas:

```typescript
// In kasm-workspace-manager.ts
private async getCachedUserQuota(userId: string): Promise<ResourceUsage> {
  const cacheKey = `quota:${userId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const quota = await this.calculateUserQuota(userId);
  await redis.setex(cacheKey, 60, JSON.stringify(quota)); // Cache for 60s
  return quota;
}
```

**Expected Impact**: 50-80% reduction in quota check time

### 3. Session Creation Optimization

**Problem**: Kasm API session creation is the slowest phase.

**Solutions**:

#### a) Increase Kasm Worker Pool

Add more Docker worker nodes to distribute load:

```yaml
# docker-compose.yml for Kasm cluster
services:
  kasm-worker-1:
    image: kasmweb/worker:latest
    deploy:
      replicas: 3  # Increase replicas
```

#### b) Optimize Docker Daemon Settings

On Kasm worker nodes:

```json
{
  "max-concurrent-downloads": 6,
  "default-shm-size": "2G",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ]
}
```

#### c) Use Workspace Pools

Pre-create workspace containers during off-peak hours:

```typescript
// Implement workspace pooling
async function maintainWorkspacePool() {
  const targetPoolSize = 5;

  for (const type of WORKSPACE_TYPES) {
    const poolCount = await getPooledWorkspaceCount(type);

    if (poolCount < targetPoolSize) {
      await createPooledWorkspace(type);
    }
  }
}

// Run every 5 minutes
setInterval(maintainWorkspacePool, 5 * 60 * 1000);
```

**Expected Impact**: 40-60% reduction in session creation time

### 4. Monitoring Phase Optimization

**Problem**: Status polling introduces overhead.

**Solutions**:

#### a) Optimize Polling Strategy

Implement exponential backoff:

```typescript
// In monitorWorkspaceStartup()
const pollIntervals = [500, 1000, 2000, 3000, 3000]; // ms
let attemptIndex = 0;

const checkStatus = async () => {
  // ... check logic

  if (status !== 'running' && attempts < maxAttempts) {
    const delay = pollIntervals[Math.min(attemptIndex, pollIntervals.length - 1)];
    attemptIndex++;
    setTimeout(checkStatus, delay);
  }
};
```

#### b) Use WebSocket Events

Subscribe to Kasm workspace state changes:

```typescript
kasmWebSocket.on('workspace:status', (event) => {
  if (event.sessionId === workspaceId && event.status === 'running') {
    handleWorkspaceReady(workspaceId);
  }
});
```

**Expected Impact**: 20-40% reduction in monitoring time

### 5. Network Optimization

**Problem**: Network latency between RTPI and Kasm API.

**Solutions**:

#### a) Deploy on Same Network

Ensure RTPI backend and Kasm are on the same Docker network:

```yaml
# docker-compose.yml
networks:
  kasm-network:
    driver: bridge

services:
  rtpi-backend:
    networks:
      - kasm-network

  kasm-manager:
    networks:
      - kasm-network
```

#### b) Use HTTP/2

Enable HTTP/2 in Axios client:

```typescript
import http2 from 'http2';

this.apiClient = axios.create({
  baseURL: this.kasmApiUrl,
  httpAgent: new http2.Agent(),
});
```

**Expected Impact**: 10-20% reduction in API call latency

## Performance Targets by Workspace Type

Based on empirical data and optimization, target startup times by type:

| Workspace Type | Target | Realistic | Optimized |
|---------------|--------|-----------|-----------|
| Firefox       | 30s    | 25-35s    | 15-25s    |
| VS Code       | 35s    | 30-45s    | 20-30s    |
| Burp Suite    | 45s    | 40-55s    | 30-40s    |
| Kali Linux    | 50s    | 45-60s    | 35-50s    |
| Empire C2     | 40s    | 35-50s    | 25-35s    |

## Troubleshooting Slow Startups

### Symptoms: Consistent >60s Startups

**Diagnosis Steps**:

1. Check Docker daemon health:
   ```bash
   docker info
   docker stats
   ```

2. Verify network connectivity:
   ```bash
   ping kasm-api
   curl -I https://kasm-api:443/api/health
   ```

3. Check Kasm worker resources:
   ```bash
   kubectl top nodes  # If using Kubernetes
   docker stats       # If using Docker Swarm
   ```

4. Review performance logs:
   ```bash
   tsx scripts/analyze-kasm-performance.ts --verbose --days 1
   ```

### Symptoms: Intermittent Timeouts

**Common Causes**:
- Resource contention during peak hours
- Network instability
- Docker daemon issues

**Solutions**:
- Implement workspace request queuing
- Add more Kasm workers during peak hours
- Set up health checks and auto-restart

### Symptoms: High Failure Rate

**Common Causes**:
- Image pull failures
- Insufficient resources
- API rate limiting

**Solutions**:
- Pre-pull images
- Increase resource quotas
- Implement retry logic with backoff

## Continuous Monitoring

### Set Up Alerts

Create alerts for performance degradation:

```typescript
// In monitoring service
async function checkPerformance() {
  const stats = await analyzePerformance(1); // Last 1 day

  if (stats.averageStartupTime > 70000) {
    await sendAlert({
      severity: 'warning',
      message: `Average workspace startup time: ${stats.averageStartupTime}ms (>70s)`,
      recommendations: stats.bottlenecks,
    });
  }

  if (stats.failedStarts / stats.totalWorkspaces > 0.1) {
    await sendAlert({
      severity: 'critical',
      message: `High workspace failure rate: ${(stats.failedStarts / stats.totalWorkspaces * 100).toFixed(1)}%`,
    });
  }
}

// Run every hour
setInterval(checkPerformance, 60 * 60 * 1000);
```

### Dashboard Metrics

Track these KPIs on your monitoring dashboard:
- Average startup time (last 24h)
- P95 startup time
- Percentage within 60s target
- Failure rate
- Resource utilization per workspace type

## Best Practices

1. **Regular Performance Reviews**: Run weekly performance analysis
2. **Image Management**: Update and optimize images quarterly
3. **Capacity Planning**: Monitor trends to anticipate resource needs
4. **User Communication**: Set expectations about workspace startup times
5. **Graceful Degradation**: Implement queuing when resources are constrained
6. **Documentation**: Keep troubleshooting runbooks updated

## Additional Resources

- [Kasm Workspaces Documentation](https://www.kasmweb.com/docs)
- [Docker Performance Tuning](https://docs.docker.com/config/containers/resource_constraints/)
- [RTPI Performance Analyzer Script](../../scripts/analyze-kasm-performance.ts)

---

**Last Updated**: 2025-01-15
**Owner**: Platform Engineering Team
**Review Cycle**: Quarterly
