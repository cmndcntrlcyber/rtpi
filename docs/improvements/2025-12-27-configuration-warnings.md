# Configuration Warnings and Best Practices

**Date Discovered**: 2025-12-27
**Severity**: Low
**Category**: Configuration | Build

## Summary

Multiple configuration warnings were identified during deployment testing. While none of these are blocking issues, they represent technical debt and potential future problems. This document consolidates three related configuration warnings: obsolete docker-compose version attribute, missing Google OAuth configuration, and certbot availability.

## Warning Details

### 1. Docker Compose Version Attribute (Obsolete)

**Warning Output**:
```
WARN[0000] /home/cmndcntrl/rtpi/docker-compose.yml: version is obsolete
```

**Current Configuration**:
**File**: `/home/cmndcntrl/rtpi/docker-compose.yml`
**Line**: 1

```yaml
version: "3.8"  # Obsolete in Docker Compose v2

services:
  postgres:
    # ... service configuration
```

**Environment**:
- Docker Compose version: v2.x (Compose V2)
- Specification: Compose file format 3.8

**Root Cause**:
- Docker Compose V2 (released 2020) deprecated the `version` attribute
- The `version` field was used in Compose V1 to determine available features
- In Compose V2, the specification version is automatically determined from the features used
- The warning is informational and doesn't affect functionality

**Impact**:
- **Current**: None - works perfectly, just shows a warning
- **Future**: May be removed in future Docker Compose versions
- **CI/CD**: Warning noise in build logs

**Fix**:
```yaml
# Before
version: "3.8"

services:
  postgres:
    # ...

# After - Simply remove the version line
services:
  postgres:
    # ...
```

**Prevention**:
- Keep docker-compose.yml aligned with current Docker Compose best practices
- Review Docker Compose release notes for deprecations
- Use `docker-compose config` to validate configuration

---

### 2. Google OAuth Not Configured

**Warning Context**: From deployment status report

**Description**:
Google OAuth authentication is available in the RTPI authentication system but not configured with credentials. The system supports multiple authentication methods:
- Local username/password (Working)
- API Key authentication (Working)
- Google OAuth 2.0 (Not configured)

**Environment Variables Missing**:
```bash
GOOGLE_CLIENT_ID=<not set>
GOOGLE_CLIENT_SECRET=<not set>
GOOGLE_CALLBACK_URL=<not set>
```

**Current Behavior**:
- OAuth routes exist but return errors when used
- Login page may show Google OAuth option but it's non-functional
- Users can only authenticate with local accounts

**Impact**:
- **Current**: Low - local auth works fine for development
- **Production**: Medium - SSO/OAuth is best practice for production deployments
- **User Experience**: Confusing if OAuth button is shown but doesn't work

**Fix Options**:

**Option 1: Configure Google OAuth (Recommended for Production)**

1. Create Google Cloud Project and OAuth 2.0 Client ID
2. Add environment variables:
   ```bash
   # .env
   GOOGLE_CLIENT_ID="xxxxx-xxxxx.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxx"
   GOOGLE_CALLBACK_URL="http://localhost:3001/api/v1/auth/google/callback"
   ```

3. Update allowed redirect URIs in Google Cloud Console

**Option 2: Disable OAuth UI Elements (Development)**

If OAuth isn't needed, hide the UI elements:

```typescript
// client/src/components/auth/LoginForm.tsx
const ENABLE_OAUTH = import.meta.env.VITE_ENABLE_GOOGLE_OAUTH === 'true';

return (
  <div>
    {/* Local auth form */}

    {ENABLE_OAUTH && (
      <Button onClick={handleGoogleLogin}>
        Sign in with Google
      </Button>
    )}
  </div>
);
```

**Documentation Needed**:
Create `docs/admin-guides/authentication-setup.md`:
```markdown
# Authentication Configuration

## Local Authentication (Default)
- Enabled by default
- Users managed in PostgreSQL database
- No additional configuration needed

## Google OAuth 2.0 (Optional)
1. Create Google Cloud Project
2. Configure OAuth consent screen
3. Create OAuth 2.0 Client ID
4. Set environment variables:
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_CALLBACK_URL
5. Add authorized redirect URIs
6. Restart application

## API Key Authentication
- For service-to-service communication
- Generated in RTPI admin panel
- Requires `X-API-Key` header
```

---

### 3. Certbot Not Available

**Warning Context**: From deployment status report

**Description**:
Certbot (for Let's Encrypt SSL/TLS certificates) is referenced in docker-compose.yml but marked as unavailable. This affects automated SSL certificate management for Kasm Workspaces and other HTTPS services.

**Docker Compose Configuration**:
```yaml
# docker-compose.yml
certbot:
  image: certbot/dns-cloudflare:latest
  container_name: rtpi-certbot
  profiles:
    - certbot  # Optional profile - only start if SSL automation is needed
  # ... configuration
```

**Current State**:
- Certbot service is defined but in an optional profile
- Not started by default with `docker compose up`
- Manual certificate management required if HTTPS is needed

**Impact**:
- **Development**: None - can use self-signed certificates or HTTP
- **Production**: Medium - HTTPS is required for production deployments
- **Kasm Workspaces**: High - requires valid certificates for secure browser streaming

**When Certbot is Needed**:
1. Production deployment with custom domain
2. Kasm Workspaces browser streaming
3. Public-facing RTPI API endpoints
4. Compliance requirements (e.g., HTTPS-only)

**Fix Options**:

**Option 1: Enable Certbot for Production (Recommended)**

```bash
# Start with certbot profile
docker compose --profile certbot up -d

# Configure environment variables
export CERTBOT_EMAIL="admin@example.com"
export CERTBOT_DOMAIN="rtpi.example.com"
export CLOUDFLARE_API_TOKEN="your-cloudflare-token"

# Certbot will automatically:
# - Request certificates from Let's Encrypt
# - Renew certificates every 12 hours
# - Update Kasm and nginx configurations
```

**Option 2: Use Alternative Certificate Management**

```bash
# Generate self-signed certificates (dev/testing only)
./scripts/ssl/generate-self-signed-certs.sh

# OR: Use an existing certificate
cp /path/to/cert.pem /path/to/kasm-certs/
cp /path/to/key.pem /path/to/kasm-certs/
```

**Option 3: Disable SSL for Development**

```yaml
# docker-compose.yml
kasm-api:
  environment:
    HTTPS_ENABLED: "false"  # Development only!
```

**Documentation Needed**:
Create `docs/admin-guides/ssl-certificate-management.md`:
```markdown
# SSL/TLS Certificate Management

## Automated (Let's Encrypt + Certbot)

### Prerequisites
- Domain name pointing to your server
- Cloudflare account (for DNS-01 challenge)
- OR: Port 80 accessible (for HTTP-01 challenge)

### Setup
1. Set environment variables in `.env`:
   ```
   CERTBOT_EMAIL=your-email@example.com
   KASM_SERVER_HOSTNAME=rtpi.example.com
   CLOUDFLARE_API_TOKEN=your-token
   ```

2. Start certbot service:
   ```bash
   docker compose --profile certbot up -d
   ```

3. Verify certificates:
   ```bash
   docker exec rtpi-certbot certbot certificates
   ```

### Renewal
- Automatic every 12 hours
- Logs: `docker logs rtpi-certbot`

## Manual Certificate Installation
1. Obtain certificate from your CA
2. Copy to certs directory:
   ```bash
   cp fullchain.pem /var/lib/docker/volumes/rtpi_kasm-certs/_data/
   cp privkey.pem /var/lib/docker/volumes/rtpi_kasm-certs/_data/
   ```
3. Restart services:
   ```bash
   docker compose restart kasm-api kasm-proxy
   ```

## Development (Self-Signed)
```bash
./scripts/ssl/generate-self-signed-certs.sh
```
**Warning**: Self-signed certificates will show browser warnings.
```

---

## Consolidated Recommendations

### Immediate Actions (Development)

1. **Remove obsolete docker-compose version**:
   ```bash
   # Edit docker-compose.yml and remove line 1
   sed -i '1d' docker-compose.yml
   ```

2. **Document OAuth as optional**:
   - Add comment in `.env.example` that OAuth is optional
   - Create authentication setup guide

3. **Clarify Certbot usage**:
   - Update README to explain certbot is for production
   - Provide self-signed cert generation script

### Production Checklist

Before deploying to production:

- [ ] Configure Google OAuth credentials (if using SSO)
- [ ] Set up Certbot with valid domain name
- [ ] Configure Cloudflare DNS (if using DNS-01 challenge)
- [ ] Test certificate renewal
- [ ] Verify HTTPS endpoints work correctly
- [ ] Update firewall rules (allow 80, 443)
- [ ] Configure automated certificate monitoring

### Configuration File Updates

**docker-compose.yml**:
```yaml
# Remove this line:
# version: "3.8"

services:
  # ... existing services
```

**.env.example** (create if missing):
```bash
# =============================================================================
# RTPI Environment Configuration Template
# Copy to .env and fill in your values
# =============================================================================

# Database
DATABASE_URL=postgresql://rtpi:rtpi@localhost:5432/rtpi_main
REDIS_URL=redis://localhost:6379

# Authentication (Optional - configure for production)
# GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
# GOOGLE_CALLBACK_URL=http://localhost:3001/api/v1/auth/google/callback

# SSL/TLS Certificates (Production)
# CERTBOT_EMAIL=admin@example.com
# KASM_SERVER_HOSTNAME=rtpi.example.com
# CLOUDFLARE_API_TOKEN=your-cloudflare-token

# Empire C2
EMPIRE_PASSWORD=ChangeMeNow123!

# Kasm Workspaces
KASM_DB_PASSWORD=kasm123secure

# ... other configurations
```

**README.md** additions:
```markdown
## Configuration

### Required
- PostgreSQL and Redis (via Docker Compose)
- Node.js 20.x

### Optional
- Google OAuth 2.0 (for SSO)
- Certbot (for automated SSL certificates)
- GPU (for Ollama AI inference)

See `docs/admin-guides/` for detailed configuration guides.
```

---

## Prevention Strategies

### 1. Dependency Version Monitoring

Add to CI/CD pipeline:
```yaml
# .github/workflows/config-validation.yml
name: Configuration Validation

on: [push, pull_request]

jobs:
  validate-config:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Validate docker-compose
        run: |
          docker compose config --quiet

      - name: Check for deprecated syntax
        run: |
          if grep -q "^version:" docker-compose.yml; then
            echo "Warning: docker-compose version field is deprecated"
            exit 1
          fi

      - name: Validate environment template
        run: |
          # Check .env.example is up to date
          ./scripts/validate-env-template.sh
```

### 2. Configuration Documentation Standards

Create `docs/admin-guides/README.md`:
```markdown
# RTPI Administration Guides

## Core Guides
- [Authentication Setup](./authentication-setup.md)
- [SSL Certificate Management](./ssl-certificate-management.md)
- [Docker Deployment](./docker-deployment.md)
- [Environment Variables](./environment-variables.md)

## Optional Components
- [Kasm Workspaces Setup](./kasm-workspaces-setup.md)
- [Ollama AI Integration](./ollama-setup.md)
- [Empire C2 Configuration](./empire-setup.md)

## Status
- ✅ Required configuration documented
- 🟡 Optional configuration clearly marked
- 📝 Examples provided for all settings
```

### 3. Startup Validation Script

Create `scripts/validate-config.sh`:
```bash
#!/bin/bash
# Validate RTPI configuration before startup

echo "🔍 Validating RTPI configuration..."

# Check for .env file
if [ ! -f .env ]; then
  echo "⚠️  No .env file found. Copying from .env.example..."
  cp .env.example .env
  echo "📝 Please edit .env with your configuration"
  exit 1
fi

# Check required variables
required_vars=("DATABASE_URL" "REDIS_URL")
for var in "${required_vars[@]}"; do
  if ! grep -q "^${var}=" .env; then
    echo "❌ Missing required variable: ${var}"
    exit 1
  fi
done

# Check optional variables with warnings
if ! grep -q "^GOOGLE_CLIENT_ID=" .env || grep -q "^GOOGLE_CLIENT_ID=$" .env; then
  echo "ℹ️  Google OAuth not configured (optional for development)"
fi

if ! grep -q "^CERTBOT_EMAIL=" .env || grep -q "^CERTBOT_EMAIL=$" .env; then
  echo "ℹ️  Certbot not configured (required for production SSL)"
fi

# Validate docker-compose.yml
if docker compose config --quiet 2>&1 | grep -q "version is obsolete"; then
  echo "⚠️  docker-compose.yml uses obsolete 'version' field"
  echo "    Remove 'version: \"3.8\"' from docker-compose.yml"
fi

echo "✅ Configuration validation complete"
```

Add to package.json:
```json
{
  "scripts": {
    "prestart": "bash scripts/validate-config.sh",
    "dev": "bash scripts/validate-config.sh && tsx watch server/index.ts"
  }
}
```

---

## Related Issues

- Docker Compose V2 migration
- OAuth 2.0 integration
- Production SSL/TLS requirements
- Kasm Workspaces HTTPS configuration
- Environment variable management

## Impact Summary

| Issue | Severity | Current Impact | Fix Effort |
|-------|----------|----------------|------------|
| Docker Compose version | Low | Warning noise | 1 minute |
| Google OAuth missing | Low (dev) / Medium (prod) | Local auth only | 15 minutes |
| Certbot unavailable | Low (dev) / High (prod) | Self-signed certs | 30 minutes |

**Total Effort to Resolve**: ~1 hour (including documentation)

**Priority**: Medium - Should fix before production deployment

---

## Testing Checklist

After implementing fixes:

- [ ] `docker compose config` runs without warnings
- [ ] `.env.example` documents all configuration options
- [ ] Admin guides exist for OAuth and SSL setup
- [ ] Startup validation script catches missing config
- [ ] Production deployment checklist is complete
- [ ] CI/CD validates configuration files
