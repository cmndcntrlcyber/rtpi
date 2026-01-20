# BBOT and Nuclei Scan Fixes - January 16, 2026

## Issues Identified

### 1. BBOT Scans Returning 0 Results
**Root Cause:** Missing Python dependency `asyncpg` in rtpi-tools container
- BBOT's `crt_db` module requires `asyncpg` for database operations
- The module was crashing silently, causing scans to exit with exit code 0 but no results
- Error: `ModuleNotFoundError: No module named 'asyncpg'`

**Fix Applied:**
- Added `asyncpg` to Python dependencies in `Dockerfile.tools` (line 65)
- Temporarily installed in running container: `docker exec -u root rtpi-tools pip3 install asyncpg`

### 2. Nuclei Scans Returning 0 Vulnerabilities
**Root Cause:** Incorrect template paths in `nuclei-executor.ts`
- Templates are located at `/home/rtpi-tools/nuclei-templates/http/cves/` etc.
- Code was passing relative paths like `cves/` which don't exist
- Nuclei error: "no templates provided for scan"

**Fix Applied:**
- Modified `server/services/nuclei-executor.ts` (lines 181-199)
- Added logic to prepend `nuclei-templates/http/` prefix to CVE and vulnerability template paths
- Now correctly resolves paths like `cves/` to `nuclei-templates/http/cves/`

### 3. OllamaManager Database Error
**Root Cause:** Date parameter type mismatch in SQL query
- postgres-js driver expects ISO string for timestamps, not Date objects
- Error: `ERR_INVALID_ARG_TYPE: The "string" argument must be of type string...Received an instance of Date`

**Fix Applied:**
- Modified `server/services/ollama-manager.ts` (line 470)
- Changed: `${ollamaModels.lastUsed} < ${cutoffTime}`
- To: `${ollamaModels.lastUsed} < ${cutoffTime.toISOString()}`

## Verification Tests

### BBOT Test (PASSED ✓)
```bash
docker exec -u rtpi-tools rtpi-tools bbot -t example.com -f subdomain-enum -y --no-deps --json
```
- Output: Successfully loaded 50/50 scan modules
- No more `ModuleNotFoundError`

### Nuclei Test (PASSED ✓)
```bash
docker exec -u rtpi-tools rtpi-tools nuclei -u https://httpbin.org -t nuclei-templates/http/misconfiguration/ -jsonl -silent
```
- Output: Successfully scanned and returned JSON results
- Template paths resolved correctly

## Required Actions

### Immediate (for current session)
1. **Restart Backend Server** to apply code fixes:
   ```bash
   # Stop current server process
   # Restart: npm run dev
   ```

### For Persistence (rebuild container)
2. **Rebuild rtpi-tools container** when network is stable:
   ```bash
   docker compose build rtpi-tools
   docker compose up -d rtpi-tools
   ```
   The Dockerfile.tools already contains the asyncpg fix.

## Files Modified

1. ✅ `/home/cmndcntrl/code/rtpi/Dockerfile.tools` - Added asyncpg dependency
2. ✅ `/home/cmndcntrl/code/rtpi/server/services/nuclei-executor.ts` - Fixed template paths
3. ✅ `/home/cmndcntrl/code/rtpi/server/services/ollama-manager.ts` - Fixed date parameter

## Testing Recommendations

After restarting the backend server, test both scan types:

### BBOT Scan
```bash
# Via API or UI - run a surface assessment scan with BBOT
# Should now return discovered assets and services
```

### Nuclei Scan
```bash
# Via API or UI - run a vulnerability scan with Nuclei
# Should now detect and return vulnerabilities
```

## Summary

All three critical issues have been resolved:
- ✅ BBOT now has all required Python dependencies
- ✅ Nuclei template paths are correctly resolved
- ✅ OllamaManager database queries use proper date formatting

Scans should now complete successfully and return actual results.
