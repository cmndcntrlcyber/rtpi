# Docker Socket Permission Issues

**Date Created**: 2026-02-27  
**Status**: Common Issue - Fixed  
**Severity**: 🔴 Critical - Blocks all container-based tool execution

---

## 📋 Problem Description

### Error Message
```
Error: Execution failed: Failed to get container: connect EACCES /var/run/docker.sock
```

### Symptoms
- Nuclei scans fail with "connect EACCES"
- BBOT scans fail with "connect EACCES"
- Tool Connector Agent reports "Container not running"
- Application cannot execute commands in Docker containers
- All container-based security tools are unavailable

### Root Cause
The application user (`cmndcntrl`) is not in the `docker` group, which is required to access the Docker socket at `/var/run/docker.sock`.

---

## 🔍 Diagnosis Steps

### Step 1: Check Docker Socket Permissions
```bash
ls -la /var/run/docker.sock
```

**Expected Output**:
```
srw-rw---- 1 root docker 0 Feb 22 20:56 /var/run/docker.sock
```

The socket is owned by `root:docker` with `660` permissions (read/write for owner and group only).

### Step 2: Check User Group Membership
```bash
groups <username>
# Or
id <username>
```

**Problem**: User is NOT in the `docker` group  
**Example Output** (before fix):
```
cmndcntrl : cmndcntrl sudo video libvirt
```

**Solution**: User SHOULD be in `docker` group  
**Expected Output** (after fix):
```
cmndcntrl : cmndcntrl sudo video libvirt docker
```

### Step 3: Check Application Logs
```bash
# Check for EACCES errors
docker logs <app-container> 2>&1 | grep EACCES

# Or if running directly
# Check application logs for Docker socket errors
```

---

## ✅ Solution

### Fix: Add User to Docker Group

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Verify the change
groups $USER

# Should now show "docker" in the list
```

### Important: Changes Require Restart

**Option 1: Log Out and Log Back In** (Recommended)
```bash
# Log out of your session completely
exit

# Then log back in
# New group membership will be active
```

**Option 2: Use newgrp** (Temporary for current shell)
```bash
newgrp docker

# This only affects the current shell session
# Applications started from other shells won't be affected
```

**Option 3: Restart Application** (If running as service)
```bash
# If using PM2
pm2 restart rtpi

# If using systemd
sudo systemctl restart rtpi

# If using Docker Compose
docker compose restart app
```

**Option 4: Restart System** (Most reliable)
```bash
sudo reboot
```

---

## 🧪 Verification

### Test 1: Docker Commands Work Without Sudo
```bash
# This should work without sudo after fix
docker ps

# If you still need sudo, the group membership hasn't taken effect
# Try logging out/in or restarting
```

### Test 2: Application Can Access Docker
```bash
# Check application logs for successful Docker operations
# No more EACCES errors should appear

# Tool Connector Agent should now discover tools
# Look for logs like:
# "Tool Connector Agent: Discovered X tools across Y containers"
```

### Test 3: Run a Test Scan
```bash
# Try running a simple scan through the application
# Nuclei, BBOT, or other container-based tools should work
```

---

## 🐛 Common Issues After Fix

### Issue 1: Still Getting EACCES After Adding to Group

**Cause**: Group membership hasn't taken effect  
**Solution**:
1. Log out and log back in completely (most reliable)
2. Or restart the application if running as a service
3. Verify with `groups` command that docker is listed

### Issue 2: Works with `newgrp docker` But Not Otherwise

**Cause**: `newgrp` only affects current shell  
**Solution**: Must log out/in for system-wide effect

### Issue 3: Docker Commands Work But Application Still Fails

**Cause**: Application process was started before group membership took effect  
**Solution**: Restart the application process

---

## 🔒 Security Considerations

### Docker Group = Root Access

⚠️ **Important**: Members of the `docker` group have **root-equivalent access** to the host system because:
- Can mount host filesystem in containers
- Can run containers as root
- Can access sensitive host resources

### Best Practices

1. **Only add trusted users** to docker group
2. **Use rootless Docker** in high-security environments
3. **Audit docker group membership** regularly
4. **Consider alternatives** for production:
   - Docker socket proxy with limited permissions
   - Rootless Docker mode
   - Kubernetes with proper RBAC

### Production Deployment

For production, consider:

```yaml
# Docker Compose: Use socket proxy
services:
  docker-proxy:
    image: tecnativa/docker-socket-proxy
    environment:
      CONTAINERS: 1
      IMAGES: 1
      INFO: 1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    
  app:
    environment:
      DOCKER_HOST: tcp://docker-proxy:2375
```

---

## 📚 Related Documentation

- [Docker Post-Installation Steps](https://docs.docker.com/engine/install/linux-postinstall/)
- [Docker Socket Security](https://docs.docker.com/engine/security/)
- [Rootless Docker](https://docs.docker.com/engine/security/rootless/)

---

## 🔧 Alternative Solutions

### Solution 1: Change Socket Permissions (NOT RECOMMENDED)

```bash
# Makes socket world-writable (INSECURE)
sudo chmod 666 /var/run/docker.sock

# This works but is a security risk
# Anyone can access Docker
```

⚠️ **Do not use in production!**

### Solution 2: Run Application as Root (NOT RECOMMENDED)

```bash
# Run app with sudo (INSECURE)
sudo npm run dev

# This works but violates principle of least privilege
```

⚠️ **Do not use in production!**

### Solution 3: Use Docker Socket Proxy (RECOMMENDED for Production)

Provides fine-grained access control to Docker API:
- Limits which Docker operations are allowed
- No need for docker group membership
- Better audit trail

---

## 📊 Quick Reference

| Scenario | Solution | Time Required |
|----------|----------|---------------|
| Development (local) | Add to docker group | 5 minutes + logout/login |
| Development (Docker Compose) | Add to docker group | 5 minutes + container restart |
| Production | Docker socket proxy | 30 minutes |
| High security | Rootless Docker | 1-2 hours (setup) |

---

## ✅ Checklist

After applying fix:
- [ ] User added to docker group: `sudo usermod -aG docker $USER`
- [ ] Verified group membership: `groups $USER`
- [ ] Logged out and logged back in (or restarted application)
- [ ] Docker commands work without sudo: `docker ps`
- [ ] Application logs show no EACCES errors
- [ ] Tool Connector Agent discovers tools
- [ ] Test scan completes successfully
- [ ] Documented in deployment notes

---

**Last Updated**: 2026-02-27  
**Applies To**: RTPI v2.2+ with Docker-based tool execution  
**Fix Applied**: ✅ User added to docker group
