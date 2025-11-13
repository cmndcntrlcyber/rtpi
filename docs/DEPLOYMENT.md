# Deployment Guide

This guide covers deploying the Unified RTPI platform in various environments, from development to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [System Requirements](#system-requirements)
- [Environment Configuration](#environment-configuration)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Database Setup](#database-setup)
- [Security Configuration](#security-configuration)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Scaling](#scaling)

---

## Prerequisites

### Required Software

- **Node.js**: Version 20.x or higher
- **Docker**: Version 24.x or higher
- **Docker Compose**: Version 2.x or higher
- **PostgreSQL**: Version 16.x (if not using Docker)
- **Redis**: Version 7.x (if not using Docker)
- **Git**: For version control

### Optional Tools

- **nginx**: For reverse proxy in production
- **Certbot**: For SSL/TLS certificate management
- **PM2**: For process management (alternative to Docker)

---

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 20 GB available space
- **Network**: 100 Mbps

### Recommended Requirements (Production)

- **CPU**: 4+ cores
- **RAM**: 8+ GB
- **Storage**: 100+ GB SSD
- **Network**: 1 Gbps
- **OS**: Ubuntu 22.04 LTS or similar Linux distribution

### Port Requirements

The following ports must be available:

- `3000` - Application server
- `5432` - PostgreSQL database
- `6379` - Redis cache
- `4444` - rtpi-tools container (Metasploit/tool services)
- `5555` - rtpi-tools container (additional tool services)
- `80` - HTTP (production with reverse proxy)
- `443` - HTTPS (production with reverse proxy)

**Note**: Ports 4444 and 5555 are exposed by the rtpi-tools container for security tool operations but are typically not exposed to the internet.

---

## Environment Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

### Required Variables

#### Server Configuration

```bash
NODE_ENV=production
PORT=3000
```

#### Database Configuration

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=rtpi
DB_PASSWORD=<secure-password>
DB_NAME=rtpi_main
DATABASE_URL=postgresql://rtpi:<secure-password>@localhost:5432/rtpi_main
```

#### Redis Configuration

```bash
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=<secure-password>
```

**Note**: For production deployments with Docker Compose, ensure `REDIS_PASSWORD` is set to secure the Redis instance. The password will be used in the connection URL format: `redis://:<password>@redis:6379`

#### Session Security

```bash
# Generate with: openssl rand -base64 32
SESSION_SECRET=<random-secret-key>
```

#### Authentication

```bash
# Google OAuth (Production Only - Optional)
# For local development, leave these commented out to use local authentication only
# Uncomment and configure for production deployment:
# GOOGLE_CLIENT_ID=<your-production-google-client-id>
# GOOGLE_CLIENT_SECRET=<your-production-google-client-secret>
# GOOGLE_CALLBACK_URL=https://yourdomain.com/api/v1/auth/google/callback

# JWT Tokens
JWT_SECRET=<random-secret-key>
JWT_EXPIRES_IN=24h
```

**Note**: The application works perfectly with local authentication (username/password) only. Google OAuth is optional and primarily intended for production deployments where you want to offer users the convenience of OAuth login.

#### CORS Configuration

```bash
CORS_ORIGIN=https://yourdomain.com
```

#### File Upload

```bash
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=./uploads
```

#### AI Services (Optional)

```bash
OPENAI_API_KEY=<your-openai-api-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

### Generating Secure Secrets

Generate secure random secrets for production:

```bash
# Session secret
openssl rand -base64 32

# JWT secret
openssl rand -base64 64
```

---

## RTPI-Tools Container Setup

The rtpi-tools container provides an isolated environment for executing security tools. This section covers its deployment and configuration.

### Container Overview

The rtpi-tools container includes:
- **19 pre-installed security tools** across 9 categories
- **Isolated execution environment** for security operations
- **Docker-based security** with non-root user execution
- **API integration** for agent-driven tool execution

### Building the Container

1. **Build rtpi-tools image:**

```bash
# From project root
docker-compose build rtpi-tools

# Or build directly
docker build -f Dockerfile.tools -t rtpi-tools .
```

2. **Verify build:**

```bash
docker images | grep rtpi-tools
```

### Starting the Container

The rtpi-tools container starts automatically with docker-compose:

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d

# Verify container is running
docker ps | grep rtpi-tools
```

### Seeding Security Tools Database

After the container is running, populate the tools database:

```bash
# Ensure database is up to date
npm run db:push

# Run the seeder
npx tsx scripts/seed-tools.ts
```

Expected output:
```
🌱 Seeding security tools...
✓ Cleared existing tools
✓ Added: Nmap (reconnaissance)
✓ Added: Metasploit Framework (exploitation)
✓ Added: Hashcat (password_cracking)
...
✅ Successfully seeded 19 security tools!
```

### Container Configuration

The rtpi-tools container is configured in `docker-compose.yml`:

```yaml
rtpi-tools:
  build:
    context: .
    dockerfile: Dockerfile.tools
  container_name: rtpi-tools
  networks:
    - rtpi-network
  volumes:
    - tool-results:/var/log/rtpi
    - tool-configs:/opt/tools/config
    - shared-data:/shared
  stdin_open: true
  tty: true
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "echo", "healthy"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### Volume Mounts

The container uses three volumes for data persistence:

- **tool-results**: Stores tool execution results and logs
- **tool-configs**: Configuration files for tools
- **shared-data**: Shared data between containers

### Testing Tool Execution

Verify tools are working correctly:

```bash
# Test Nmap
docker exec rtpi-tools nmap --version

# Test Python
docker exec rtpi-tools python3 --version

# Test PowerShell
docker exec rtpi-tools pwsh -Command "Write-Host 'Test'"

# List installed tools
docker exec rtpi-tools ls -la /opt/tools/
```

### Container Management

```bash
# View container logs
docker logs rtpi-tools

# Restart container
docker restart rtpi-tools

# Access container shell
docker exec -it rtpi-tools /bin/bash

# Check container status via API
curl http://localhost:3000/api/v1/containers/rtpi-tools/status
```

### Security Considerations

- **Non-root execution**: Tools run as `rtpi-tools` user
- **Network isolation**: Container on isolated bridge network
- **Command validation**: All commands validated before execution
- **Resource limits**: CPU and memory limits enforced
- **Audit logging**: All tool executions logged

### Troubleshooting rtpi-tools

**Container won't start:**
```bash
# Check logs
docker logs rtpi-tools

# Rebuild container
docker-compose build --no-cache rtpi-tools
docker-compose up -d rtpi-tools
```

**Tools not found:**
```bash
# Verify tools are installed
docker exec rtpi-tools which nmap
docker exec rtpi-tools which msfconsole

# Check PATH
docker exec rtpi-tools echo $PATH
```

**Database not seeded:**
```bash
# Check if tools exist in database
curl http://localhost:3000/api/v1/tools

# Re-run seeder
npx tsx scripts/seed-tools.ts
```

For complete rtpi-tools documentation, see [RTPI-Tools Implementation Guide](RTPI-TOOLS-IMPLEMENTATION.md).

---

## Development Deployment

### Local Development Setup

1. **Clone the repository:**

```bash
git clone <repository-url>
cd unified-rtpi
```

2. **Install dependencies:**

```bash
npm install
```

3. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start services with Docker Compose:**

```bash
docker-compose up -d
```

5. **Run database migrations:**

```bash
npm run db:push
```

6. **Start development servers:**

The application requires both backend and frontend servers to be running:

```bash
# Terminal 1: Start backend API server
npm run dev

# Terminal 2: Start frontend development server (in a new terminal)
npm run dev:frontend
```

**Access Points:**
- **Frontend UI**: `http://localhost:5000` (or 5001 if 5000 is busy)
- **Backend API**: `http://localhost:3001`
- **API Documentation**: `http://localhost:3001/api/v1`

**Note**: Always access the application through the frontend URL (port 5000/5001). The backend port (3001) serves API responses only and has no user interface.

### Development with Docker

Use the development Docker Compose configuration:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

---

## Production Deployment

### Method 1: Docker Compose (Recommended)

1. **Prepare production environment:**

```bash
# Clone repository
git clone <repository-url>
cd unified-rtpi

# Create production environment file
cp .env.example .env
# Configure .env with production values
```

2. **Build and start services:**

```bash
docker-compose -f docker-compose.prod.yml up -d
```

3. **Run database migrations:**

```bash
docker-compose -f docker-compose.prod.yml exec app npm run db:push
```

4. **Verify deployment:**

```bash
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs
```

### Method 2: Manual Deployment

1. **Install system dependencies:**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm postgresql redis-server nginx certbot python3-certbot-nginx

# Verify installations
node --version
npm --version
psql --version
redis-cli --version
```

2. **Configure PostgreSQL:**

```bash
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE rtpi_main;
CREATE USER rtpi WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE rtpi_main TO rtpi;
\q
```

3. **Configure Redis:**

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

4. **Deploy application:**

```bash
# Create application directory
sudo mkdir -p /opt/rtpi
sudo chown $USER:$USER /opt/rtpi

# Clone and setup
cd /opt/rtpi
git clone <repository-url> .
npm install --production

# Configure environment
cp .env.example .env
# Edit .env with production values

# Build application
npm run build

# Run migrations
npm run db:push
```

5. **Setup process manager (PM2):**

```bash
npm install -g pm2

# Start application
pm2 start npm --name "rtpi" -- start

# Configure PM2 to start on boot
pm2 startup
pm2 save
```

---

## Docker Deployment

### Production Docker Compose

The `docker-compose.prod.yml` file includes optimized production settings:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    container_name: rtpi-postgres
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: rtpi-redis
    restart: always
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: rtpi-app
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads

volumes:
  postgres_data:
  redis_data:
```

### Docker Management Commands

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f app

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop services
docker-compose -f docker-compose.prod.yml down

# Stop services and remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.prod.yml down -v

# Update application
git pull
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations after update
docker-compose -f docker-compose.prod.yml exec app npm run db:push

# Database backup
docker exec rtpi-postgres-prod pg_dump -U rtpi rtpi_main > backup.sql

# Database restore
docker exec -i rtpi-postgres-prod psql -U rtpi rtpi_main < backup.sql

# Access PostgreSQL shell
docker exec -it rtpi-postgres-prod psql -U rtpi -d rtpi_main

# Access Redis CLI
docker exec -it rtpi-redis-prod redis-cli -a YOUR_REDIS_PASSWORD
```

---

## Database Setup

### Initial Database Setup

1. **Create database:**

```sql
CREATE DATABASE rtpi_main;
CREATE USER rtpi WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE rtpi_main TO rtpi;
```

2. **Run migrations:**

```bash
npm run db:push
```

3. **Verify schema:**

```bash
npm run db:studio
```

### Database Migrations

**Important**: Drizzle Kit commands have been updated for compatibility with version 0.20.0+.

```bash
# Generate new migration
npm run db:generate

# Apply migrations (push schema changes to database)
npm run db:push

# Open database studio (visual database browser)
npm run db:studio
```

**Using Docker**: If your database is running in Docker, run migrations from the host machine:

```bash
# Ensure .env file has correct DATABASE_URL for Docker
# For Docker: postgresql://rtpi:password@localhost:5432/rtpi_main
npm run db:push

# Or run from within the app container
docker-compose exec app npm run db:push
```

### Database Connection Pooling

For production, configure connection pooling in the database URL:

```bash
DATABASE_URL=postgresql://rtpi:password@localhost:5432/rtpi_main?pool_timeout=0&pool_max_conns=10
```

---

## Security Configuration

### SSL/TLS Setup

#### Using Certbot with nginx

1. **Install certbot:**

```bash
sudo apt install certbot python3-certbot-nginx
```

2. **Configure nginx:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

3. **Obtain SSL certificate:**

```bash
sudo certbot --nginx -d yourdomain.com
```

4. **Auto-renewal:**

```bash
sudo certbot renew --dry-run
```

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Deny direct access to database and redis
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp
```

### Environment Security

1. **Protect environment files:**

```bash
chmod 600 .env
chown root:root .env
```

2. **Use secure secrets:**

- Never commit `.env` files to version control
- Rotate secrets regularly
- Use strong, randomly generated passwords
- Store secrets in a secure vault (e.g., HashiCorp Vault)

### OAuth Configuration

1. **Google OAuth Setup:**

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - `https://yourdomain.com/api/v1/auth/google/callback`
   - Copy Client ID and Client Secret to `.env`

### Rate Limiting

The application includes built-in rate limiting. Configure in production:

```javascript
// Authentication: 5 requests per 15 minutes
// Password changes: 3 requests per 15 minutes
// General API: 100 requests per 15 minutes
```

---

## Monitoring and Logging

### Application Logging

Logs are written to stdout/stderr and can be captured:

```bash
# Docker logs
docker-compose -f docker-compose.prod.yml logs -f app

# PM2 logs
pm2 logs rtpi

# System logs
journalctl -u rtpi -f
```

### Health Check Endpoints

Monitor application health:

```bash
# System health
curl http://localhost:3000/api/v1/health-checks

# Database health
curl http://localhost:3000/api/v1/health-checks/database

# Redis health
curl http://localhost:3000/api/v1/health-checks/redis
```

### Monitoring Tools

#### Prometheus + Grafana

1. **Add monitoring to docker-compose:**

```yaml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  volumes:
    - grafana_data:/var/lib/grafana
```

#### Application Performance Monitoring

Consider integrating:
- **Sentry** for error tracking
- **DataDog** for comprehensive monitoring
- **New Relic** for APM

---

## Backup and Recovery

### Database Backups

#### Automated Backup Script

```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/var/backups/rtpi"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/rtpi_backup_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

# Backup database (use correct container name for production)
docker exec rtpi-postgres-prod pg_dump -U rtpi rtpi_main > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

#### Setup Cron Job

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/rtpi/backup-db.sh
```

### Database Restore

```bash
# Decompress backup
gunzip rtpi_backup_20250111_020000.sql.gz

# Restore database
docker exec -i rtpi-postgres psql -U rtpi rtpi_main < rtpi_backup_20250111_020000.sql
```

### File Backups

Backup the uploads directory:

```bash
# Create backup
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz ./uploads

# Restore backup
tar -xzf uploads_backup_20250111.tar.gz
```

### Disaster Recovery Plan

1. **Regular backups**: Daily database, weekly full system
2. **Off-site storage**: Store backups in different location/cloud
3. **Test restores**: Regularly verify backup integrity
4. **Documentation**: Maintain recovery procedures
5. **Monitoring**: Alert on backup failures

---

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check PostgreSQL status (use production container names)
docker-compose -f docker-compose.prod.yml ps postgres
docker-compose -f docker-compose.prod.yml logs postgres

# Verify connection
docker exec -it rtpi-postgres-prod psql -U rtpi -d rtpi_main

# Check network connectivity
docker network inspect rtpi-network

# Test connection from app container
docker-compose -f docker-compose.prod.yml exec app nc -zv postgres 5432
```

#### Redis Connection Errors

```bash
# Check Redis status
docker-compose -f docker-compose.prod.yml ps redis
docker-compose -f docker-compose.prod.yml logs redis

# Test Redis connection with password
docker exec -it rtpi-redis-prod redis-cli -a YOUR_REDIS_PASSWORD ping

# Should return: PONG

# Test from app container
docker-compose -f docker-compose.prod.yml exec app nc -zv redis 6379
```

#### Application Won't Start

```bash
# Check logs
docker-compose logs app

# Verify environment variables
docker-compose config

# Check port availability
sudo netstat -tlnp | grep 3000
```

#### High Memory Usage

```bash
# Check container stats
docker stats

# Increase memory limits in docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
```

#### OAuth Callback Errors

1. Verify OAuth credentials in `.env`
2. Check authorized redirect URIs in Google Console
3. Ensure callback URL matches exactly (including protocol)
4. Check for CORS issues

### Performance Issues

#### Slow Database Queries

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s

-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

#### Redis Performance

```bash
# Check Redis stats
docker exec rtpi-redis redis-cli INFO stats

# Monitor commands
docker exec rtpi-redis redis-cli MONITOR
```

### Debug Mode

Enable debug logging:

```bash
# In .env
NODE_ENV=development
DEBUG=*
```

---

## Scaling

### Horizontal Scaling

#### Load Balancer Configuration

```nginx
upstream rtpi_backend {
    least_conn;
    server app1.local:3000;
    server app2.local:3000;
    server app3.local:3000;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    location / {
        proxy_pass http://rtpi_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Database Scaling

#### Read Replicas

Configure PostgreSQL streaming replication:

```bash
# Primary server
DATABASE_URL=postgresql://rtpi:pass@primary:5432/rtpi_main

# Read replica
DATABASE_REPLICA_URL=postgresql://rtpi:pass@replica:5432/rtpi_main
```

#### Connection Pooling

Use PgBouncer for connection pooling:

```yaml
pgbouncer:
  image: pgbouncer/pgbouncer
  environment:
    DATABASES: rtpi_main=host=postgres dbname=rtpi_main
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 1000
    DEFAULT_POOL_SIZE: 25
```

### Redis Scaling

#### Redis Cluster

For high availability:

```yaml
redis-cluster:
  image: redis:7-alpine
  command: redis-server --cluster-enabled yes
```

### Vertical Scaling

Increase resources in docker-compose:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

---

## Maintenance

### Regular Maintenance Tasks

#### Daily

- Monitor application logs
- Check health endpoints
- Review error rates
- Verify backup completion

#### Weekly

- Database vacuum and analyze
- Review slow queries
- Update dependencies (security patches)
- Review disk usage

#### Monthly

- Full system backup
- Security audit
- Performance review
- Dependency updates

### Update Procedure

```bash
# 1. Backup current state
./backup-db.sh

# 2. Pull latest changes
git pull

# 3. Update dependencies
npm install

# 4. Run migrations
npm run db:push

# 5. Build application
npm run build

# 6. Restart services
docker-compose -f docker-compose.prod.yml restart app

# 7. Verify deployment
curl http://localhost:3000/api/v1/health-checks
```

---

## Support and Resources

### Documentation

- [README](../README.md) - Project overview
- [Development Guide](DEVELOPMENT.md) - Development setup
- [API Documentation](API.md) - API reference

### Getting Help

- Check logs first: `docker-compose logs`
- Review this troubleshooting guide
- Check GitHub issues
- Contact system administrator

### Security Reporting

For security vulnerabilities, please follow responsible disclosure:
1. Do not file public issues
2. Email security concerns directly to administrators
3. Include detailed reproduction steps
4. Allow reasonable time for patching

---

## Checklist for Production Deployment

### Infrastructure
- [ ] System requirements met
- [ ] Docker and Docker Compose installed
- [ ] Firewall rules configured
- [ ] SSL/TLS certificates obtained (if exposing directly to internet)
- [ ] Network isolation configured for containers

### Configuration
- [ ] `.env` file created from `.env.example`
- [ ] All environment variables configured (especially `REDIS_PASSWORD`)
- [ ] Secure secrets generated (`SESSION_SECRET`, `JWT_SECRET`)
- [ ] Database credentials set (`DB_USER`, `DB_PASSWORD`, `DB_NAME`)
- [ ] OAuth providers configured (if used)
- [ ] CORS settings configured for production domain

### Deployment
- [ ] Application built: `docker-compose -f docker-compose.prod.yml build`
- [ ] Services started: `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Database migrations applied: `docker-compose -f docker-compose.prod.yml exec app npm run db:push`
- [ ] Health endpoints accessible and returning healthy status

### RTPI-Tools Container
- [ ] rtpi-tools container built successfully
- [ ] rtpi-tools container running and healthy
- [ ] Security tools database seeded: `npx tsx scripts/seed-tools.ts`
- [ ] Tool execution tested via API
- [ ] Container volumes configured for persistence
- [ ] Tool execution logs accessible

### Security
- [ ] Container running as non-root user verified
- [ ] Command validation enabled
- [ ] Resource limits configured
- [ ] Audit logging functional
- [ ] Security audit completed

### Operations
- [ ] Backup system configured and tested
- [ ] Monitoring and alerting setup
- [ ] Log aggregation configured
- [ ] Performance baseline established
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Rollback procedure tested
- [ ] Disaster recovery plan documented
