# SSL Automation Guide

## Overview

RTPI provides automated SSL/TLS certificate management for Kasm Workspaces and Empire C2 listeners using Let's Encrypt. This guide covers certificate provisioning, automatic renewal, and troubleshooting.

**Phase:** Enhancement 07 - Phase 2 (SSL Automation)
**Items:** #KW-11 to #KW-15
**Certificate Authority:** Let's Encrypt
**Supported Challenges:** HTTP-01, DNS-01 (Cloudflare)

---

## Architecture

### Components

1. **Certbot Container** (`rtpi-certbot`)
   - Manages certificate lifecycle
   - Supports HTTP-01 and DNS-01 challenges
   - Auto-renewal every 12 hours

2. **SSL Certificate Manager** (`server/services/ssl-certificate-manager.ts`)
   - REST API for certificate management
   - Integration with nginx proxy
   - Certificate monitoring and rotation

3. **Nginx Proxy** (`rtpi-kasm-proxy`)
   - SSL termination for workspaces and listeners
   - Automatic HTTPS redirect
   - WebSocket support over TLS

### Certificate Storage

```
/etc/letsencrypt/
├── live/
│   └── {domain}/
│       ├── fullchain.pem      # Certificate + Chain
│       ├── privkey.pem         # Private key
│       ├── cert.pem            # Certificate only
│       └── chain.pem           # CA chain
├── archive/                    # All certificate versions
├── renewal/                    # Renewal configuration
└── cloudflare.ini             # Cloudflare API credentials
```

---

## Getting Started

### Prerequisites

1. **Domain Name**
   - Must point to your server's public IP
   - For wildcard certs: DNS-01 challenge required

2. **Email Address**
   - Used for Let's Encrypt notifications
   - Certificate expiry warnings

3. **Cloudflare Account** (for DNS-01 only)
   - API token with DNS edit permissions
   - Zone DNS edit access

### Environment Variables

Add to `.env` file:

```bash
# SSL Configuration
CERTBOT_EMAIL=admin@example.com
KASM_SERVER_HOSTNAME=kasm.attck.nexus
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here

# Container names
CERTBOT_CONTAINER=rtpi-certbot
KASM_NGINX_CONTAINER=rtpi-kasm-proxy
```

---

## Certificate Provisioning

### Method 1: Using API (#KW-11)

#### HTTP-01 Challenge (Single Domain)

```bash
curl -X POST http://localhost:3001/api/v1/ssl-certificates \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "kasm.attck.nexus",
    "email": "admin@example.com",
    "challengeType": "http-01"
  }'
```

**Requirements:**
- Port 80 must be accessible from internet
- Domain must resolve to server IP
- Nginx must serve `.well-known/acme-challenge/`

#### DNS-01 Challenge (Wildcard Certificate) (#KW-12)

```bash
curl -X POST http://localhost:3001/api/v1/ssl-certificates \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "attck.nexus",
    "email": "admin@example.com",
    "challengeType": "dns-01",
    "cloudflareApiToken": "your_token_here"
  }'
```

**Requirements:**
- Cloudflare API token
- DNS managed by Cloudflare
- Creates wildcard: `*.attck.nexus`

#### Dry Run (Testing)

```bash
curl -X POST http://localhost:3001/api/v1/ssl-certificates \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "kasm.attck.nexus",
    "email": "admin@example.com",
    "challengeType": "http-01",
    "dryRun": true
  }'
```

### Method 2: Using Shell Script

#### Basic Usage

```bash
# HTTP-01 challenge
./scripts/ssl/setup-ssl.sh \
  -d kasm.attck.nexus \
  -e admin@example.com

# DNS-01 challenge with wildcard
./scripts/ssl/setup-ssl.sh \
  -d attck.nexus \
  -e admin@example.com \
  -w \
  -k your_cloudflare_token

# Dry run
./scripts/ssl/setup-ssl.sh \
  -d kasm.attck.nexus \
  -e admin@example.com \
  -n
```

#### Script Options

```
-d DOMAIN        Domain name (required)
-e EMAIL         Email for Let's Encrypt (required)
-t TYPE          Challenge type: http-01 or dns-01 (default: http-01)
-k TOKEN         Cloudflare API token (required for dns-01)
-w               Wildcard certificate (implies dns-01)
-n               Dry run (test without issuing certificate)
-h               Show help message
```

---

## Certificate Renewal (#KW-13)

### Automatic Renewal

Certificates auto-renew **30 days before expiry**. The certbot container runs renewal checks every 12 hours.

**Renewal Process:**
1. Certbot checks all certificates
2. Renews those expiring within 30 days
3. Copies new certificates to nginx
4. Reloads nginx configuration

**Monitor Renewal:**

```bash
# View certbot logs
docker logs rtpi-certbot

# Check renewal status
docker exec rtpi-certbot certbot certificates
```

### Manual Renewal

#### Renew All Expiring Certificates

```bash
# Via API
curl -X POST http://localhost:3001/api/v1/ssl-certificates/renew \
  -H "Content-Type: application/json" \
  -d '{"daysBeforeExpiry": 30}'

# Via Docker
docker exec rtpi-certbot certbot renew
```

#### Renew Specific Certificate

```bash
# Via API
curl -X POST http://localhost:3001/api/v1/ssl-certificates/kasm.attck.nexus/renew

# Via Docker
docker exec rtpi-certbot certbot renew --cert-name kasm.attck.nexus
```

#### Force Renewal (Testing)

```bash
# Via API
curl -X POST http://localhost:3001/api/v1/ssl-certificates/renew/force

# Via Docker
docker exec rtpi-certbot certbot renew --force-renewal
```

---

## Nginx SSL Configuration (#KW-14)

### SSL Termination

Nginx handles SSL termination for all Kasm workspaces and Empire listeners.

**Security Features:**
- TLS 1.2 and 1.3 only
- Strong cipher suites (Mozilla Intermediate)
- HSTS with 2-year max-age
- OCSP stapling
- HTTP to HTTPS redirect
- WebSocket over TLS

### Generate Nginx Configuration

```bash
# Via API
curl http://localhost:3001/api/v1/ssl-certificates/kasm.attck.nexus/nginx-config

# Returns nginx SSL configuration template
```

### Manual Configuration

Edit `/etc/nginx/conf.d/ssl-{domain}.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name kasm.attck.nexus;

    ssl_certificate /etc/nginx/certs/kasm.attck.nexus.crt;
    ssl_certificate_key /etc/nginx/certs/kasm.attck.nexus.key;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:...';
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Proxy to backend
    location / {
        proxy_pass http://kasm-api:443;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Reload Nginx

```bash
# Via API
curl -X POST http://localhost:3001/api/v1/ssl-certificates/nginx/reload

# Via Docker
docker exec rtpi-kasm-proxy nginx -s reload
```

---

## Certificate Management

### List All Certificates

```bash
# Via API
curl http://localhost:3001/api/v1/ssl-certificates

# Returns:
# [
#   {
#     "domain": "kasm.attck.nexus",
#     "issuer": "Let's Encrypt",
#     "validFrom": "2025-01-01T00:00:00Z",
#     "validUntil": "2025-04-01T00:00:00Z",
#     "daysRemaining": 60,
#     "status": "valid"
#   }
# ]
```

### Get Certificate Details

```bash
# Via API
curl http://localhost:3001/api/v1/ssl-certificates/kasm.attck.nexus

# Via Docker
docker exec rtpi-certbot certbot certificates --cert-name kasm.attck.nexus
```

### Revoke Certificate

```bash
# Via API
curl -X DELETE http://localhost:3001/api/v1/ssl-certificates/kasm.attck.nexus \
  -H "Content-Type: application/json" \
  -d '{"reason": "keyCompromise"}'

# Revocation reasons:
# - unspecified
# - keyCompromise
# - cACompromise
# - affiliationChanged
# - superseded
# - cessationOfOperation
```

---

## Testing Certificate Rotation (#KW-15)

### Automated Test Script

```bash
./scripts/ssl/test-rotation.sh kasm.attck.nexus
```

**Test Coverage:**
1. Container status check
2. Current certificate information
3. Renewal dry run
4. Nginx configuration validation
5. Nginx reload capability
6. Certificate file permissions
7. Certificate expiry verification
8. Certificate chain validation
9. Auto-renewal configuration

### Manual Testing

#### Test 1: Verify Certificate

```bash
# Check certificate details
openssl s_client -connect kasm.attck.nexus:443 -servername kasm.attck.nexus < /dev/null 2>&1 | \
  openssl x509 -noout -text

# Check expiry date
echo | openssl s_client -connect kasm.attck.nexus:443 2>/dev/null | \
  openssl x509 -noout -dates
```

#### Test 2: Test Renewal Process

```bash
# Dry run renewal
docker exec rtpi-certbot certbot renew --dry-run

# Force renewal (creates new cert immediately)
docker exec rtpi-certbot certbot renew --force-renewal
```

#### Test 3: Test Nginx Reload

```bash
# Test configuration
docker exec rtpi-kasm-proxy nginx -t

# Reload nginx
docker exec rtpi-kasm-proxy nginx -s reload

# Check nginx is serving HTTPS
curl -k https://kasm.attck.nexus/health
```

#### Test 4: SSL/TLS Quality

```bash
# Test SSL configuration (requires external access)
curl https://www.ssllabs.com/ssltest/analyze.html?d=kasm.attck.nexus

# Test cipher suites
nmap --script ssl-enum-ciphers -p 443 kasm.attck.nexus
```

---

## Health Monitoring

### SSL Health Check

```bash
curl http://localhost:3001/api/v1/ssl-certificates/health/check
```

**Response:**

```json
{
  "status": "healthy",
  "certbot": {
    "installed": true,
    "version": "2.7.0"
  },
  "certificates": {
    "total": 2,
    "valid": 2,
    "expiringSoon": 0,
    "expired": 0
  },
  "warnings": [],
  "timestamp": "2025-12-26T12:00:00Z"
}
```

### Certificate Expiry Monitoring

```bash
# Get expiring certificates (within 30 days)
curl http://localhost:3001/api/v1/ssl-certificates | \
  jq '.[] | select(.daysRemaining <= 30)'

# List all certificate expiry dates
docker exec rtpi-certbot certbot certificates | grep "Expiry Date"
```

---

## Troubleshooting

### Issue 1: Certificate Request Failed

**Symptoms:**
- API returns 500 error
- Certbot logs show "Failed authorization procedure"

**Solutions:**

1. **HTTP-01 Challenge Issues:**
   ```bash
   # Check port 80 is accessible
   curl -I http://kasm.attck.nexus/.well-known/acme-challenge/test

   # Verify DNS resolution
   dig kasm.attck.nexus +short

   # Check firewall
   sudo iptables -L -n | grep 80
   ```

2. **DNS-01 Challenge Issues:**
   ```bash
   # Verify Cloudflare API token
   curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"

   # Check DNS propagation
   dig _acme-challenge.kasm.attck.nexus TXT +short
   ```

3. **Rate Limiting:**
   - Let's Encrypt limits: 50 certificates per domain per week
   - Use `--dry-run` for testing
   - Wait 1 week if hit rate limit

### Issue 2: Auto-Renewal Not Working

**Symptoms:**
- Certificates expire
- Renewal logs show errors

**Solutions:**

1. **Check Certbot Container:**
   ```bash
   # Verify container is running
   docker ps | grep certbot

   # Check logs
   docker logs rtpi-certbot --tail 100

   # Restart container
   docker compose --profile certbot restart certbot
   ```

2. **Test Renewal Manually:**
   ```bash
   # Dry run
   docker exec rtpi-certbot certbot renew --dry-run

   # Force renewal
   docker exec rtpi-certbot certbot renew --force-renewal
   ```

3. **Check Renewal Configuration:**
   ```bash
   # View renewal config
   docker exec rtpi-certbot cat /etc/letsencrypt/renewal/kasm.attck.nexus.conf

   # Verify webroot or DNS credentials
   ```

### Issue 3: Nginx Not Using New Certificate

**Symptoms:**
- Certificate renewed but old cert still served
- Browser shows expired certificate

**Solutions:**

1. **Verify Certificate Copy:**
   ```bash
   # Check certificate files in nginx
   docker exec rtpi-kasm-proxy ls -la /etc/nginx/certs/

   # Compare with Let's Encrypt cert
   docker exec rtpi-certbot openssl x509 -in /etc/letsencrypt/live/kasm.attck.nexus/fullchain.pem -noout -dates
   docker exec rtpi-kasm-proxy openssl x509 -in /etc/nginx/certs/kasm.attck.nexus.crt -noout -dates
   ```

2. **Reload Nginx:**
   ```bash
   # Test nginx config
   docker exec rtpi-kasm-proxy nginx -t

   # Reload nginx
   docker exec rtpi-kasm-proxy nginx -s reload

   # Restart if needed
   docker compose restart kasm-proxy
   ```

3. **Check Nginx Configuration:**
   ```bash
   # Verify SSL cert paths
   docker exec rtpi-kasm-proxy nginx -T | grep ssl_certificate

   # Ensure correct domain configuration
   docker exec rtpi-kasm-proxy cat /etc/nginx/conf.d/ssl-kasm.attck.nexus.conf
   ```

### Issue 4: SSL Connection Errors

**Symptoms:**
- Browser shows "connection not secure"
- TLS handshake failures

**Solutions:**

1. **Check Certificate Chain:**
   ```bash
   # Verify full chain
   openssl s_client -connect kasm.attck.nexus:443 -showcerts

   # Check for intermediate certificates
   curl https://kasm.attck.nexus -v 2>&1 | grep "SSL certificate"
   ```

2. **Test Cipher Compatibility:**
   ```bash
   # Test TLS 1.2
   openssl s_client -connect kasm.attck.nexus:443 -tls1_2

   # Test TLS 1.3
   openssl s_client -connect kasm.attck.nexus:443 -tls1_3
   ```

3. **Verify OCSP Stapling:**
   ```bash
   # Check OCSP response
   openssl s_client -connect kasm.attck.nexus:443 -status
   ```

---

## Security Best Practices

1. **Certificate Storage:**
   - Private keys never leave the server
   - Certbot container has read-only access to nginx certs
   - Use Docker secrets for production

2. **API Token Security:**
   - Store Cloudflare token in `.env` (not in git)
   - Use token with minimal permissions (DNS edit only)
   - Rotate tokens regularly

3. **HSTS Configuration:**
   - 2-year max-age for production
   - Include subdomains
   - Consider HSTS preload list

4. **Certificate Monitoring:**
   - Set up alerts for certificates expiring within 14 days
   - Monitor renewal logs daily
   - Test renewal process monthly

5. **Backup:**
   - Backup `/etc/letsencrypt/` directory
   - Store private keys securely offline
   - Document recovery procedures

---

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ssl-certificates` | Request new certificate |
| GET | `/api/v1/ssl-certificates` | List all certificates |
| GET | `/api/v1/ssl-certificates/:domain` | Get certificate info |
| DELETE | `/api/v1/ssl-certificates/:domain` | Revoke certificate |
| POST | `/api/v1/ssl-certificates/renew` | Renew expiring certificates |
| POST | `/api/v1/ssl-certificates/:domain/renew` | Renew specific certificate |
| POST | `/api/v1/ssl-certificates/renew/force` | Force renew all |
| POST | `/api/v1/ssl-certificates/nginx/reload` | Reload nginx |
| GET | `/api/v1/ssl-certificates/:domain/nginx-config` | Get nginx config |
| POST | `/api/v1/ssl-certificates/:domain/test-rotation` | Test rotation |
| GET | `/api/v1/ssl-certificates/status/certbot` | Get certbot status |
| GET | `/api/v1/ssl-certificates/health/check` | Health check |

### Example Workflows

#### Full Certificate Setup

```bash
# 1. Request certificate
curl -X POST http://localhost:3001/api/v1/ssl-certificates \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "kasm.attck.nexus",
    "email": "admin@example.com",
    "challengeType": "http-01"
  }'

# 2. Get nginx configuration
curl http://localhost:3001/api/v1/ssl-certificates/kasm.attck.nexus/nginx-config \
  > /tmp/ssl-kasm.conf

# 3. Apply to nginx (manual step)
docker cp /tmp/ssl-kasm.conf rtpi-kasm-proxy:/etc/nginx/conf.d/

# 4. Reload nginx
curl -X POST http://localhost:3001/api/v1/ssl-certificates/nginx/reload

# 5. Verify certificate
curl https://kasm.attck.nexus/health
```

---

## Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot User Guide](https://eff-certbot.readthedocs.io/)
- [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [SSL Labs Server Test](https://www.ssllabs.com/ssltest/)
