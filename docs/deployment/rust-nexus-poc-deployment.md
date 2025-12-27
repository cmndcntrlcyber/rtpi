# rust-nexus Agentic Implants - POC Deployment Guide

**Phase 5: Security & Testing - #AI-30**
**Version:** 1.0.0
**Last Updated:** 2025-12-27

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Security Hardening](#security-hardening)
5. [Deployment Steps](#deployment-steps)
6. [Testing & Validation](#testing--validation)
7. [Operational Procedures](#operational-procedures)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides step-by-step instructions for deploying a Proof-of-Concept (POC) environment for the rust-nexus Agentic Implants system. This deployment implements all security hardening features from Phase 5.

### Deployment Scope

- **rust-nexus Controller** - WebSocket server with mTLS
- **Certificate Authority** - mTLS certificate management
- **Distributed Workflow Orchestrator** - Multi-implant coordination
- **Security Hardening** - E2E encryption, certificate pinning, protocol hardening
- **Monitoring & Logging** - Comprehensive audit trails

### Security Posture

✅ **mTLS Authentication** - Mutual TLS for all implant connections
✅ **End-to-End Encryption** - AES-256-GCM for all payloads
✅ **Certificate Pinning** - Prevent MITM attacks
✅ **Protocol Hardening** - Rate limiting, replay protection, sequence validation
✅ **Binary Obfuscation** - Anti-debugging and anti-tampering
✅ **Autonomy Controls** - Graduated safety limits (1-10 levels)
✅ **Kill Switches** - Emergency workflow termination
✅ **Audit Logging** - Complete operational transparency

---

## Prerequisites

### System Requirements

**Server (rust-nexus Controller)**:
- OS: Ubuntu 22.04 LTS or RHEL 8+
- CPU: 4+ cores
- RAM: 8GB+
- Disk: 50GB+ SSD
- Network: Static IP, ports 8443 (HTTPS/WSS)

**Database**:
- PostgreSQL 14+
- Redis 6+

**Tools**:
- Node.js 18+
- npm 9+
- OpenSSL 1.1.1+
- Docker & Docker Compose (optional)

### Network Configuration

```
[Internet] -> [Firewall] -> [rust-nexus Controller:8443]
                                    |
                                    v
                          [PostgreSQL:5432]
                          [Redis:6379]
```

**Required Ports**:
- `8443/tcp` - rust-nexus WebSocket Server (mTLS)
- `5432/tcp` - PostgreSQL (internal only)
- `6379/tcp` - Redis (internal only)

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────┐
│              rust-nexus Controller                  │
│                                                     │
│  ┌──────────────────┐  ┌─────────────────────┐    │
│  │  WebSocket       │  │  Distributed         │    │
│  │  Server (mTLS)   │  │  Workflow            │    │
│  │                  │  │  Orchestrator        │    │
│  └────────┬─────────┘  └──────────┬──────────┘    │
│           │                       │                │
│  ┌────────▼───────────────────────▼──────────┐    │
│  │      Security Hardening Layer             │    │
│  │  - E2E Encryption  - Protocol Hardening   │    │
│  │  - Cert Pinning    - Rate Limiting        │    │
│  └────────┬──────────────────────────────────┘    │
│           │                                        │
│  ┌────────▼────────┐  ┌────────────────┐          │
│  │ Task Distributor│  │ Audit Logger   │          │
│  └─────────────────┘  └────────────────┘          │
└─────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│   PostgreSQL + Redis    │
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│    rust-nexus Implants  │
│   (Remote Execution)    │
└─────────────────────────┘
```

---

## Security Hardening

### 1. End-to-End Encryption

**Implementation**: AES-256-GCM authenticated encryption

```typescript
// Server-side key generation
import { endToEndEncryption } from "./server/services/rust-nexus-security";

const sharedKey = endToEndEncryption.generateKey();

// Encrypt task payload
const encryptedPayload = endToEndEncryption.encryptTaskPayload(
  taskData,
  sharedKey
);

// Decrypt on implant side
const decryptedTask = endToEndEncryption.decryptTaskPayload(
  encryptedPayload,
  sharedKey
);
```

**Key Management**:
- Keys derived using PBKDF2 (100,000 iterations)
- Ephemeral session keys using ECDH key exchange
- Key rotation every 24 hours

### 2. Certificate Pinning

**Implementation**: SHA-256 fingerprint pinning + SPKI hash pinning

```bash
# Pin certificate during setup
npx tsx scripts/pin-certificate.ts \
  --cert /path/to/cert.pem \
  --fingerprint abc123...
```

**Validation**:
```typescript
import { certificatePinning } from "./server/services/rust-nexus-security";

// Verify certificate on connection
const isValid = certificatePinning.verifyCertificate(fingerprint);

// Verify public key hash (HPKP)
const isPinned = certificatePinning.verifyPublicKeyHash(pkHash);
```

### 3. Protocol Hardening

**Features**:
- Message size limits (1 MB max)
- Rate limiting (100 msg/sec per connection)
- Timestamp validation (±30s clock skew)
- Sequence number tracking
- Replay attack protection (1000 message window)
- HMAC message signatures

**Configuration**:
```typescript
const protocolConfig = {
  maxMessageSize: 1024 * 1024,
  maxMessagesPerSecond: 100,
  requireSequenceNumbers: true,
  requireTimestamps: true,
  maxClockSkewMs: 30000,
  enableReplayProtection: true,
  replayWindowSize: 1000,
};
```

### 4. Autonomy Levels & Safety Limits

**Level 1-2 (Supervised)**:
- Max 2 concurrent implants
- Max 3 tasks per implant
- Reconnaissance only
- Approval required for all exploitation

**Level 5 (Semi-Autonomous)**:
- Max 5 concurrent implants
- Max 5 tasks per implant
- Limited exploitation allowed
- Approval for privilege escalation

**Level 10 (Fully Autonomous)**:
- Max 20 concurrent implants
- Max 20 tasks per implant
- All capabilities enabled
- No approval required

---

## Deployment Steps

### Step 1: Environment Setup

```bash
# Clone repository
cd /opt
git clone https://github.com/your-org/rtpi.git
cd rtpi

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.production
```

**Configure `.env.production`**:
```bash
# Database
DATABASE_URL="postgresql://rtpi:password@localhost:5432/rtpi"
REDIS_URL="redis://localhost:6379"

# rust-nexus Controller
RUST_NEXUS_PORT=8443
RUST_NEXUS_TLS_CERT=/opt/rtpi/certs/server-cert.pem
RUST_NEXUS_TLS_KEY=/opt/rtpi/certs/server-key.pem
RUST_NEXUS_TLS_CA=/opt/rtpi/certs/ca-cert.pem

# Security
RUST_NEXUS_HMAC_KEY="<generate-random-256-bit-key>"
RUST_NEXUS_ENCRYPTION_KEY="<generate-random-256-bit-key>"

# Autonomy
DEFAULT_AUTONOMY_LEVEL=5
ENABLE_KILL_SWITCH=true
```

### Step 2: Certificate Authority Setup

```bash
# Generate CA and certificates
npx tsx server/services/rust-nexus/setup-mtls-ca.ts

# Output:
# - certs/ca-cert.pem
# - certs/ca-key.pem
# - certs/server-cert.pem
# - certs/server-key.pem
```

### Step 3: Database Initialization

```bash
# Start database services
docker compose up -d postgres redis

# Run migrations
npm run db:push

# Verify schema
npm run db:studio
```

### Step 4: Build Application

```bash
# Build frontend and backend
npm run build

# Output: dist/client and compiled server files
```

### Step 5: Start rust-nexus Controller

```bash
# Production mode
NODE_ENV=production npm run start:server

# Verify startup
curl -k https://localhost:8443/health
# Expected: {"status":"ok","service":"rust-nexus-controller"}
```

### Step 6: Provision Implants

```bash
# Generate implant certificate and config
npx tsx scripts/provision-implant.ts \
  --name "implant-001" \
  --type "reconnaissance" \
  --output /opt/implants/implant-001

# Output:
# - implant-001-cert.pem
# - implant-001-key.pem
# - implant-001-config.json
```

**Implant Configuration** (`implant-001-config.json`):
```json
{
  "implantName": "implant-001",
  "implantType": "reconnaissance",
  "serverUrl": "wss://controller.example.com:8443",
  "certificate": "implant-001-cert.pem",
  "privateKey": "implant-001-key.pem",
  "caCertificate": "ca-cert.pem",
  "capabilities": [
    "network_scan",
    "port_scan",
    "service_enumeration",
    "command_execution"
  ],
  "autonomyLevel": 5,
  "heartbeatInterval": 30000
}
```

### Step 7: Deploy Implant

```bash
# Copy files to target system
scp -r /opt/implants/implant-001 user@target:/opt/rust-nexus

# On target system
cd /opt/rust-nexus/implant-001
./rust-nexus-implant --config implant-001-config.json
```

---

## Testing & Validation

### Security Tests

```bash
# Run integration tests
npm test -- rust-nexus-integration.test.ts

# Test suite includes:
# - E2E encryption/decryption
# - Certificate pinning validation
# - Protocol hardening checks
# - Replay attack detection
# - Rate limiting enforcement
# - Message signature verification
```

### Functional Tests

**Test 1: Implant Registration**
```bash
# Check implant connected
curl -k https://localhost:8443/api/v1/rust-nexus/implants \
  -H "Authorization: Bearer <token>"

# Expected: List of registered implants
```

**Test 2: Task Execution**
```bash
# Create test task
curl -k -X POST https://localhost:8443/api/v1/rust-nexus/implants/<id>/tasks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "command_execution",
    "taskName": "Test Command",
    "command": "whoami",
    "priority": 5
  }'

# Check task status
curl -k https://localhost:8443/api/v1/rust-nexus/tasks/<task-id>
```

**Test 3: Distributed Workflow**
```bash
# Execute multi-implant workflow
curl -k -X POST https://localhost:8443/api/v1/rust-nexus/workflows/distributed \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "test-workflow-001",
    "autonomy_level": 5,
    "tasks": [
      {
        "taskId": "task-1",
        "taskName": "Network Scan",
        "command": "nmap -sn 192.168.1.0/24",
        "requiredCapabilities": ["network_scan"]
      },
      {
        "taskId": "task-2",
        "taskName": "Service Enum",
        "command": "nmap -sV -p- <target>",
        "requiredCapabilities": ["service_enumeration"],
        "dependsOn": ["task-1"]
      }
    ]
  }'
```

**Test 4: Kill Switch**
```bash
# Activate emergency kill switch
curl -k -X POST https://localhost:8443/api/v1/rust-nexus/workflows/<id>/kill-switch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "user_initiated",
    "details": {"operator": "admin", "reason": "testing"}
  }'

# Verify all tasks cancelled
curl -k https://localhost:8443/api/v1/rust-nexus/workflows/<id>
```

### Security Validation

**Certificate Pinning Test**:
```bash
# Should fail with unpinned certificate
openssl s_client -connect localhost:8443 \
  -cert untrusted-cert.pem \
  -key untrusted-key.pem

# Expected: Connection refused
```

**Replay Attack Test**:
```bash
# Capture message
MESSAGE=$(curl -k https://localhost:8443/api/... 2>&1 | grep messageId)

# Replay same message
# Expected: Replay attack detected error
```

**Rate Limiting Test**:
```bash
# Send 150 messages rapidly (exceeds 100/sec limit)
for i in {1..150}; do
  curl -k https://localhost:8443/api/v1/rust-nexus/stats &
done

# Expected: Some requests return 429 Too Many Requests
```

---

## Operational Procedures

### Daily Operations

**Morning Checks**:
```bash
# Check controller health
curl -k https://localhost:8443/health

# Check connected implants
curl -k https://localhost:8443/api/v1/rust-nexus/connections

# Review audit logs
docker logs rust-nexus-controller | grep -i audit | tail -100
```

**Task Management**:
```bash
# View task queue
curl -k https://localhost:8443/api/v1/rust-nexus/tasks/queue/prioritized

# Get queue statistics
curl -k https://localhost:8443/api/v1/rust-nexus/tasks/queue/stats

# Trigger manual task assignment
curl -k -X POST https://localhost:8443/api/v1/rust-nexus/tasks/assign
```

### Monitoring

**Key Metrics**:
- Implant connection count
- Task success rate
- Average task execution time
- Failed task retry count
- Kill switch activations
- Security violations (replay attacks, rate limits)

**Log Files**:
```bash
# Controller logs
/var/log/rtpi/rust-nexus-controller.log

# Audit logs
/var/log/rtpi/rust-nexus-audit.log

# Security events
/var/log/rtpi/rust-nexus-security.log
```

### Backup & Recovery

**Daily Backups**:
```bash
# Database backup
pg_dump -h localhost -U rtpi rtpi > /backup/rtpi-$(date +%Y%m%d).sql

# Certificate backup
tar -czf /backup/certs-$(date +%Y%m%d).tar.gz /opt/rtpi/certs
```

**Recovery**:
```bash
# Restore database
psql -h localhost -U rtpi rtpi < /backup/rtpi-20251227.sql

# Restore certificates
tar -xzf /backup/certs-20251227.tar.gz -C /opt/rtpi
```

---

## Troubleshooting

### Implant Connection Issues

**Problem**: Implant fails to connect

**Solution**:
```bash
# Check certificate validity
openssl x509 -in implant-cert.pem -noout -dates

# Verify certificate pinned on server
curl -k https://localhost:8443/api/v1/rust-nexus/certificates

# Check firewall rules
sudo iptables -L -n | grep 8443

# Review server logs
docker logs rust-nexus-controller | grep -i certificate
```

### Task Execution Failures

**Problem**: Tasks stuck in "queued" status

**Solution**:
```bash
# Check task distributor
curl -k https://localhost:8443/api/v1/rust-nexus/tasks/queue/stats

# Manually trigger assignment
curl -k -X POST https://localhost:8443/api/v1/rust-nexus/tasks/assign

# Check implant load
curl -k https://localhost:8443/api/v1/rust-nexus/implants | jq '.[] | {name, status, currentLoad}'
```

### Security Violations

**Problem**: Replay attack detected

**Action**:
```bash
# Review audit logs
grep "replay_attack" /var/log/rtpi/rust-nexus-audit.log

# Identify source
grep "<messageId>" /var/log/rtpi/rust-nexus-security.log

# Block offending IP (if external attack)
sudo iptables -A INPUT -s <ip> -j DROP
```

---

## Appendix

### A. Security Checklist

- [ ] mTLS certificates generated and pinned
- [ ] Encryption keys configured and secured
- [ ] Rate limiting enabled
- [ ] Replay protection active
- [ ] Kill switches tested
- [ ] Audit logging verified
- [ ] Firewall rules configured
- [ ] Database access restricted
- [ ] Backup procedures tested

### B. Performance Tuning

**High Load Optimization**:
```bash
# Increase max concurrent implants (autonomy level 7+)
DEFAULT_AUTONOMY_LEVEL=7

# Increase task distributor frequency
TASK_DISTRIBUTION_INTERVAL=5000  # 5 seconds

# Scale PostgreSQL
max_connections = 200
shared_buffers = 4GB
work_mem = 16MB
```

### C. Compliance & Auditing

All operations are logged with:
- Timestamp (ISO 8601)
- User/Operator ID
- Action performed
- Target implant/workflow
- Result (success/failure)
- Autonomy decision rationale

**Audit Log Format**:
```json
{
  "timestamp": "2025-12-27T10:30:45.123Z",
  "eventType": "TASK_EXECUTED",
  "workflowId": "wf-001",
  "implantId": "impl-001",
  "taskId": "task-001",
  "userId": "user-123",
  "autonomyLevel": 5,
  "result": "success",
  "metadata": {
    "command": "whoami",
    "executionTimeMs": 245
  }
}
```

---

## Support

For issues and questions:
- **Documentation**: https://docs.rust-nexus.io
- **GitHub**: https://github.com/your-org/rust-nexus/issues
- **Security**: security@rust-nexus.io (PGP key available)

---

**End of POC Deployment Guide**
