# Kasm Proxy Testing Guide

## Overview

This guide provides testing procedures for the Kasm Nginx Proxy Manager, which handles dynamic proxy routing for Empire C2 listeners and Kasm Workspaces.

**Test Date:** 2025-12-26
**Phase:** Enhancement 07 - Phase 5 (Dynamic Listener Proxy)
**Items:** #KW-30 to #KW-35

---

## Test Prerequisites

### Environment Setup

1. **Docker Services Running:**
   ```bash
   docker ps | grep -E "kasm-proxy|empire|kasm-guac"
   ```

2. **Environment Variables:**
   ```bash
   export KASM_PROXY_ENABLED=true
   export KASM_NGINX_CONTAINER=rtpi-kasm-proxy
   export KASM_DOMAIN=kasm.attck.nexus
   export EMPIRE_HOST=empire-server
   export KASM_GUAC_HOST=kasm-guac
   ```

3. **SSL Certificates:**
   ```bash
   # Check if SSL certs exist
   docker exec rtpi-kasm-proxy ls -la /etc/nginx/ssl/
   ```

---

## Test Suite

### Test 1: Empire Listener Proxy Registration (#KW-32)

**Purpose:** Verify Empire C2 listener proxy routes are created correctly

**Steps:**

1. Create Empire listener via API:
   ```bash
   curl -X POST http://localhost:3001/api/v1/empire/listeners \
     -H "Content-Type: application/json" \
     -d '{
       "name": "test-http-listener",
       "type": "http",
       "port": 8080,
       "host": "0.0.0.0"
     }'
   ```

2. Verify proxy route was registered:
   ```bash
   curl http://localhost:3001/api/v1/kasm-proxy/routes/empire
   ```

3. Check nginx configuration:
   ```bash
   docker exec rtpi-kasm-proxy cat /etc/nginx/conf.d/empire-listener-*.conf
   ```

4. Test proxy route:
   ```bash
   curl -k https://listener-abc123.kasm.attck.nexus:8443/
   ```

**Expected Results:**
- Proxy route appears in API response
- Nginx config file created
- Subdomain format: `listener-{listenerId}.kasm.attck.nexus`
- HTTPS working with SSL
- Traffic proxied to Empire listener

### Test 2: Workspace Proxy Registration (#KW-31)

**Purpose:** Verify Kasm Workspace proxy routes are created

**Steps:**

1. Provision workspace via API:
   ```bash
   curl -X POST http://localhost:3001/api/v1/kasm-workspaces \
     -H "Content-Type: application/json" \
     -d '{
       "workspaceType": "vscode",
       "workspaceName": "test-workspace",
       "cpuLimit": "2",
       "memoryLimit": "4096M"
     }'
   ```

2. List workspace proxy routes:
   ```bash
   curl http://localhost:3001/api/v1/kasm-proxy/routes/workspaces
   ```

3. Verify nginx config:
   ```bash
   docker exec rtpi-kasm-proxy cat /etc/nginx/conf.d/kasm-workspace-*.conf
   ```

4. Test workspace access:
   ```bash
   curl -k https://workspace-def456.kasm.attck.nexus:8443/health
   ```

**Expected Results:**
- Workspace route in API response
- Nginx config with WebSocket support
- Subdomain format: `workspace-{workspaceId}.kasm.attck.nexus`
- Health endpoint returns 200
- Custom headers present: `X-Kasm-Workspace-Proxy: true`

### Test 3: Callback URL Management (#KW-33)

**Purpose:** Test callback URL registration and retrieval

**Steps:**

1. List all callback URLs:
   ```bash
   curl http://localhost:3001/api/v1/kasm-proxy/callbacks
   ```

2. Get specific callback URL:
   ```bash
   curl http://localhost:3001/api/v1/kasm-proxy/callbacks/{listenerId}
   ```

3. Update callback URL:
   ```bash
   curl -X PUT http://localhost:3001/api/v1/kasm-proxy/callbacks/{listenerId} \
     -H "Content-Type: application/json" \
     -d '{
       "callbackUrl": "https://new-listener.kasm.attck.nexus:8443"
     }'
   ```

**Expected Results:**
- All callback URLs listed with routeId mapping
- Individual callback URL retrieval works
- URL updates persist in manager
- URLs follow format: `https://{subdomain}:{port}`

### Test 4: Implant Check-ins Through Proxy (#KW-34)

**Purpose:** Verify Empire implants can check in through proxy

**Manual Test Procedure:**

1. Generate Empire stager with proxy callback URL:
   ```bash
   # Get callback URL from proxy manager
   CALLBACK_URL=$(curl http://localhost:3001/api/v1/kasm-proxy/callbacks/{listenerId} | jq -r '.callbackUrl')

   # Use in stager generation
   curl -X POST http://localhost:3001/api/v1/empire/stagers \
     -H "Content-Type: application/json" \
     -d "{
       \"listenerId\": \"{listenerId}\",
       \"stagerType\": \"multi/launcher\",
       \"host\": \"${CALLBACK_URL}\"
     }"
   ```

2. Execute stager on test system

3. Monitor Empire agents:
   ```bash
   curl http://localhost:3001/api/v1/empire/agents
   ```

4. Check proxy access logs:
   ```bash
   curl http://localhost:3001/api/v1/kasm-proxy/logs?limit=50
   ```

**Expected Results:**
- Stager generated with proxy URL
- Implant successfully checks in via proxy
- Agent appears in Empire
- Access logs show implant traffic
- No connection errors in nginx logs

### Test 5: Access Logging (#KW-35)

**Purpose:** Verify access logs are captured and accessible

**Steps:**

1. Generate traffic:
   ```bash
   for i in {1..10}; do
     curl -k https://listener-abc123.kasm.attck.nexus:8443/health
   done
   ```

2. Retrieve access logs:
   ```bash
   curl http://localhost:3001/api/v1/kasm-proxy/logs?limit=20
   ```

3. Get logs for specific subdomain:
   ```bash
   curl http://localhost:3001/api/v1/kasm-proxy/logs/listener-abc123.kasm.attck.nexus
   ```

4. Check log file directly:
   ```bash
   docker exec rtpi-kasm-proxy tail -20 /var/log/nginx/kasm-proxy-access.log
   ```

5. Test log rotation:
   ```bash
   curl -X POST http://localhost:3001/api/v1/kasm-proxy/logs/rotate \
     -H "Content-Type: application/json" \
     -d '{"daysToKeep": 7}'
   ```

**Expected Results:**
- All requests logged with timestamps
- Logs include: clientIp, method, path, statusCode, userAgent
- Subdomain filtering works
- Log rotation removes old files
- Parsed log format matches nginx combined format

### Test 6: Proxy Statistics

**Purpose:** Verify statistics collection

**Steps:**

1. Get proxy stats:
   ```bash
   curl http://localhost:3001/api/v1/kasm-proxy/stats
   ```

**Expected Results:**
```json
{
  "routeCount": 5,
  "empireListenerRoutes": 2,
  "workspaceRoutes": 3,
  "totalRequests": 150,
  "avgResponseTime": 0
}
```

### Test 7: Proxy Health Check

**Purpose:** Verify proxy service health monitoring

**Steps:**

1. Check proxy health:
   ```bash
   curl http://localhost:3001/api/v1/kasm-proxy/health
   ```

2. Test nginx configuration:
   ```bash
   curl http://localhost:3001/api/v1/kasm-proxy/config/test
   ```

**Expected Results:**
- Health endpoint returns status: "healthy"
- Config test returns valid: true
- Stats included in health response
- Timestamp in ISO format

---

## Integration Tests

### End-to-End Workflow Test

1. **Create Empire Listener → Proxy Route → Implant Check-in**

   ```bash
   # 1. Create listener
   LISTENER_ID=$(curl -X POST http://localhost:3001/api/v1/empire/listeners \
     -H "Content-Type: application/json" \
     -d '{"name":"e2e-test","type":"http","port":8081}' \
     | jq -r '.id')

   # 2. Get callback URL
   CALLBACK=$(curl http://localhost:3001/api/v1/kasm-proxy/callbacks/${LISTENER_ID} \
     | jq -r '.callbackUrl')

   # 3. Generate stager
   curl -X POST http://localhost:3001/api/v1/empire/stagers \
     -H "Content-Type: application/json" \
     -d "{\"listenerId\":\"${LISTENER_ID}\",\"stagerType\":\"multi/launcher\",\"host\":\"${CALLBACK}\"}"

   # 4. Check access logs
   curl http://localhost:3001/api/v1/kasm-proxy/logs?limit=10
   ```

2. **Create Workspace → Proxy Route → Browser Access**

   ```bash
   # 1. Provision workspace
   WORKSPACE_ID=$(curl -X POST http://localhost:3001/api/v1/kasm-workspaces \
     -H "Content-Type: application/json" \
     -d '{"workspaceType":"firefox","cpuLimit":"2","memoryLimit":"4096M"}' \
     | jq -r '.id')

   # 2. Check proxy route
   curl http://localhost:3001/api/v1/kasm-proxy/routes/kasm-workspace/${WORKSPACE_ID}

   # 3. Access workspace (manual browser test)
   # Open browser to: https://workspace-{id}.kasm.attck.nexus:8443

   # 4. Verify access logs
   curl http://localhost:3001/api/v1/kasm-proxy/logs?limit=5
   ```

---

## Performance Tests

### Load Test: Multiple Concurrent Routes

**Goal:** Verify proxy can handle 10+ simultaneous routes

```bash
# Create 10 workspaces in parallel
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/v1/kasm-workspaces \
    -H "Content-Type: application/json" \
    -d "{\"workspaceType\":\"vscode\",\"workspaceName\":\"load-test-${i}\"}" &
done
wait

# Verify all routes created
curl http://localhost:3001/api/v1/kasm-proxy/routes/workspaces | jq '. | length'
```

**Expected:** All 10 routes created successfully within 30 seconds

---

## Troubleshooting

### Common Issues

1. **Proxy route not accessible:**
   - Check DNS: Ensure subdomain resolves
   - Verify nginx config: `docker exec rtpi-kasm-proxy nginx -t`
   - Check firewall: Ensure port 8443 open
   - Review nginx error log: `docker logs rtpi-kasm-proxy`

2. **SSL certificate errors:**
   - Generate self-signed cert if needed
   - Update cert paths in config
   - Restart nginx: `docker exec rtpi-kasm-proxy nginx -s reload`

3. **Access logs not showing:**
   - Verify log file permissions
   - Check log path configuration
   - Ensure nginx writing to correct path

4. **Callback URLs not registered:**
   - Check manager initialization
   - Verify route registration called
   - Review console logs for errors

---

## Test Results Template

```
## Test Execution Summary

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** Development/Production

### Results

| Test | Status | Notes |
|------|--------|-------|
| Empire Listener Proxy | ✅/❌ | |
| Workspace Proxy | ✅/❌ | |
| Callback URL Management | ✅/❌ | |
| Implant Check-ins | ✅/❌ | |
| Access Logging | ✅/❌ | |
| Proxy Statistics | ✅/❌ | |
| Health Check | ✅/❌ | |
| E2E Workflow | ✅/❌ | |
| Load Test (10 routes) | ✅/❌ | |

### Issues Found

1. [Issue description]
2. [Issue description]

### Recommendations

1. [Recommendation]
2. [Recommendation]
```

---

## Automated Test Script

```bash
#!/bin/bash
# kasm-proxy-test.sh - Automated proxy testing

set -e

BASE_URL="http://localhost:3001/api/v1"

echo "=== Kasm Proxy Test Suite ==="

# Test 1: List all routes
echo "Test 1: Listing all proxy routes..."
curl -s ${BASE_URL}/kasm-proxy/routes | jq .
echo "✅ Test 1 passed"

# Test 2: Get proxy stats
echo "Test 2: Getting proxy statistics..."
STATS=$(curl -s ${BASE_URL}/kasm-proxy/stats)
echo $STATS | jq .
ROUTE_COUNT=$(echo $STATS | jq '.routeCount')
echo "Route count: $ROUTE_COUNT"
echo "✅ Test 2 passed"

# Test 3: Health check
echo "Test 3: Checking proxy health..."
HEALTH=$(curl -s ${BASE_URL}/kasm-proxy/health)
echo $HEALTH | jq .
STATUS=$(echo $HEALTH | jq -r '.status')
if [ "$STATUS" = "healthy" ]; then
  echo "✅ Test 3 passed"
else
  echo "❌ Test 3 failed: Proxy unhealthy"
  exit 1
fi

# Test 4: Access logs
echo "Test 4: Retrieving access logs..."
curl -s ${BASE_URL}/kasm-proxy/logs?limit=5 | jq .
echo "✅ Test 4 passed"

# Test 5: Callback URLs
echo "Test 5: Listing callback URLs..."
curl -s ${BASE_URL}/kasm-proxy/callbacks | jq .
echo "✅ Test 5 passed"

echo ""
echo "=== All tests passed! ==="
```

**Usage:**
```bash
chmod +x kasm-proxy-test.sh
./kasm-proxy-test.sh
```
