# Optimized Kasm Workspace Docker Images

This directory contains optimized Docker images for Kasm Workspaces used in RTPI. These images are designed to minimize size and startup time while maintaining essential functionality for red team operations.

## Available Images

### Kali Linux (`Dockerfile.kali-optimized`)
- **Base**: `kasmweb/kali-rolling-desktop:1.17.0`
- **Purpose**: Penetration testing workspace
- **Optimizations**:
  - Removed: LibreOffice, Thunderbird, Transmission, GIMP, Inkscape, VLC
  - Added: Essential pentesting tools only (nmap, metasploit-framework, sqlmap, burp,nikto, john, hydra, wireshark)
  - Includes: Python security libraries (impacket, pwntools, requests, scapy)
- **Expected Size Reduction**: 30-40%
- **Expected Startup Improvement**: 40-50%

### VS Code (`Dockerfile.vscode-optimized`)
- **Base**: `kasmweb/vscode:1.17.0`
- **Purpose**: Development workspace for red team tooling
- **Optimizations**:
  - Minimal extension set
  - Pre-installed: Python, Node.js, essential dev tools
  - Pre-configured: TypeScript, ESLint, Prettier
- **Expected Size Reduction**: 15-25%
- **Expected Startup Improvement**: 20-30%

### Firefox (`Dockerfile.firefox-optimized`)
- **Base**: `kasmweb/firefox:1.17.0`
- **Purpose**: Web application testing
- **Optimizations**:
  - Minimal footprint
  - Pre-configured for security testing (disabled cert warnings, tracking protection)
  - Includes: Python web security tools
- **Expected Size Reduction**: 20-30%
- **Expected Startup Improvement**: 25-35%

## Building Images

### Build All Images

```bash
./scripts/build-optimized-images.sh --all --analyze
```

### Build Specific Image

```bash
./scripts/build-optimized-images.sh --type kali --analyze
```

### Build Without Cache

```bash
./scripts/build-optimized-images.sh --all --no-cache
```

### Build and Push to Registry

```bash
./scripts/build-optimized-images.sh --all --push --registry localhost:5000
```

## Using Optimized Images

### Update Workspace Manager

Edit `server/services/kasm-workspace-manager.ts`:

```typescript
// Change imageMapping to use optimized images
private imageMapping: Record<WorkspaceType, string> = {
  vscode: 'rtpi/kasm-vscode:optimized',
  burp: 'kasmweb/burp-suite:1.17.0', // Not yet optimized
  kali: 'rtpi/kasm-kali:optimized',
  firefox: 'rtpi/kasm-firefox:optimized',
  empire: 'kasmweb/empire-client:1.17.0', // Not yet optimized
};
```

### Pre-pull Images on Kasm Workers

```bash
# On each Kasm worker node
docker pull rtpi/kasm-kali:optimized
docker pull rtpi/kasm-vscode:optimized
docker pull rtpi/kasm-firefox:optimized
```

## Image Analysis

Run size comparison analysis:

```bash
./scripts/build-optimized-images.sh --all --analyze
```

Example output:
```
╔═══════════════════════════════════════════════════════════════╗
║         Kasm Workspace Image Size Analysis                   ║
╚═══════════════════════════════════════════════════════════════╝

Type            Original        Optimized       Reduction
───────────────────────────────────────────────────────────────
kali            3.2GB           2.1GB           34%
vscode          1.8GB           1.5GB           17%
firefox         1.2GB           900MB           25%
───────────────────────────────────────────────────────────────
Total size reduction: 28%
```

## Customization

### Adding Tools to Kali Image

Edit `Dockerfile.kali-optimized`:

```dockerfile
ENV KALI_TOOLS="nmap metasploit-framework sqlmap your-tool-here"
```

### Adding VS Code Extensions

Edit `Dockerfile.vscode-optimized`:

```dockerfile
RUN code --install-extension ms-python.python \
         --install-extension ms-azuretools.vscode-docker
```

### Firefox Preferences

Edit `firefox-prefs.js` to customize browser behavior.

## Maintenance

### Updating Base Images

When Kasm releases new versions:

1. Update base image versions in Dockerfiles
2. Rebuild all images:
   ```bash
   ./scripts/build-optimized-images.sh --all --no-cache --analyze
   ```
3. Test workspace provisioning
4. Push to registry if tests pass

### Monitoring Image Sizes

Set up automated builds and size tracking:

```bash
# Add to CI/CD pipeline
./scripts/build-optimized-images.sh --all --analyze --export image-sizes.json
```

## Troubleshooting

### Build Failures

**Issue**: "Failed to pull base image"
**Solution**: Verify internet connectivity and Docker Hub access

**Issue**: "No space left on device"
**Solution**: Clean up old images:
```bash
docker system prune -a --volumes
```

### Runtime Issues

**Issue**: "Missing tool in optimized image"
**Solution**: Add tool to Dockerfile and rebuild:
```dockerfile
RUN apt-get install -y your-missing-tool
```

**Issue**: "Workspace starts but crashes"
**Solution**: Check logs:
```bash
docker logs <container-id>
```

## Performance Benchmarks

Expected startup time improvements:

| Workspace | Original | Optimized | Improvement |
|-----------|----------|-----------|-------------|
| Kali      | 55-65s   | 35-45s    | ~35%        |
| VS Code   | 40-50s   | 30-40s    | ~25%        |
| Firefox   | 30-40s   | 20-30s    | ~30%        |

## Best Practices

1. **Regular Updates**: Rebuild images monthly to include security patches
2. **Size Monitoring**: Track image sizes to prevent bloat
3. **Layer Optimization**: Group related RUN commands to reduce layers
4. **Cache Utilization**: Don't use --no-cache unless necessary
5. **Testing**: Always test workspaces after rebuilding images

## Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Kasm Workspaces Documentation](https://www.kasmweb.com/docs)
- [Image Optimization Guide](../docs/admin-guides/kasm-performance-optimization.md)

---

**Last Updated**: 2025-01-15
**Maintained By**: Platform Engineering Team
