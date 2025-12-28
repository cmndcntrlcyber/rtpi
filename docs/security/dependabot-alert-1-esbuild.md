# Dependabot Alert #1: esbuild CORS Vulnerability

**Date Detected:** December 27, 2025
**Alert Number:** 1
**Status:** Open
**Severity:** 🟠 Medium

---

## Summary

esbuild versions <= 0.24.2 allow any website to send requests to the development server and read responses due to permissive CORS settings (`Access-Control-Allow-Origin: *`).

**CVE/Advisory:** GHSA-67mh-4wv8-2f99

---

## Vulnerability Details

### Description
esbuild sets `Access-Control-Allow-Origin: *` header on all requests, including SSE connections, which allows malicious websites to:
1. Send arbitrary requests to the local development server (e.g., `http://127.0.0.1:8000`)
2. Read the responses (bypassing same-origin policy)
3. Extract source code, compiled bundles, and source maps

### Attack Scenario

```
1. Attacker hosts malicious page: http://malicious.example.com
2. User visits malicious page while development server is running
3. Malicious JS executes: fetch('http://127.0.0.1:8000/main.js')
4. Attacker receives the bundle content (normally blocked by CORS)
```

The attacker can discover file paths via:
- Fetching `/index.html` (contains script tags)
- Fetching `/assets` (directory listing enabled)
- Connecting to `/esbuild` SSE endpoint (sends changed file paths)
- Following import statements in discovered files

### Impact
- **Development Environment:** High risk if developers visit untrusted websites while dev server is running
- **Production Environment:** No impact (esbuild dev server not used in production)
- **Source Code Exposure:** Attacker can steal uncompiled source code if source maps are enabled

---

## Affected Versions

### Package: esbuild
- **Vulnerable:** <= 0.24.2
- **Fixed:** >= 0.25.0

### Our Installation

```
Current versions in project:
├─┬ drizzle-kit@0.20.18
│ └── esbuild@0.18.20 ❌ (vulnerable)
│ └── esbuild@0.19.12 ❌ (vulnerable)
├─┬ tsx@4.20.6
│ └── esbuild@0.25.12 ✅ (safe)
└─┬ vite@5.4.21
  └── esbuild@0.21.5 ❌ (vulnerable - PRIMARY CONCERN)
```

**Primary Risk:** Vite's esbuild@0.21.5 is used by the frontend development server

---

## Fix Applied

**Commit:** de85afd65edec9ebc44a11e245fd9e9a2e99760d

The fix modifies esbuild's serve mode to:
- Restrict CORS to specific origins instead of wildcard `*`
- Add proper origin validation for development server requests

---

## Remediation Options

### Option 1: Update Vite (Recommended)
Update to Vite 6.x which uses esbuild >= 0.25.0:

```bash
npm install vite@latest
```

**Pros:**
- Fixes the vulnerability directly
- Gets latest Vite features and performance improvements
- May include other security fixes

**Cons:**
- Requires testing for breaking changes
- May need configuration updates

---

### Option 2: Force esbuild Resolution
Add to package.json:

```json
{
  "overrides": {
    "esbuild": "^0.25.0"
  }
}
```

**Pros:**
- Quick fix without major dependency updates
- Works with current Vite version

**Cons:**
- May cause incompatibilities with Vite
- Not officially supported

---

### Option 3: Mitigate in Development Workflow (Temporary)
Until dependencies are updated:

1. **Don't visit untrusted websites** while dev server is running
2. **Run dev server on non-default ports** (harder for attackers to guess)
3. **Use browser profiles** (separate dev profile from general browsing)
4. **Stop dev server** when not actively developing

**Pros:**
- No code changes required
- Works immediately

**Cons:**
- Relies on developer discipline
- Doesn't fix the root cause

---

## Recommended Action Plan

### Immediate (Now)
✅ Document the vulnerability (this file)
✅ Communicate to development team about mitigation practices

### Short-term (Next Sprint)
⬜ Update Vite to v6.x
⬜ Test application with new Vite version
⬜ Verify esbuild is >= 0.25.0 after update
⬜ Close Dependabot alert

### Long-term (Ongoing)
⬜ Enable Dependabot auto-updates for patch versions
⬜ Set up CI/CD checks for known vulnerabilities
⬜ Regular dependency audits (monthly)

---

## Risk Assessment

### Current Risk Level: 🟡 LOW-MEDIUM

**Justification:**
- ✅ Only affects development environment
- ✅ Requires active development server + visiting malicious site
- ✅ No production impact
- ⚠️ Could expose proprietary source code to attackers
- ⚠️ Social engineering could trick developers

### Production Impact: ✅ NONE
The esbuild development server is never used in production builds. Our production deployment uses:
- Pre-compiled static assets
- No esbuild dev server running
- Proper CORS configuration on production web server

---

## Testing After Fix

Once esbuild is updated to >= 0.25.0, verify the fix:

```bash
# 1. Start development server
npm run dev:frontend

# 2. In a different browser tab, open dev tools and run:
fetch('http://127.0.0.1:5000/src/main.tsx')
  .then(r => r.text())
  .then(console.log)
  .catch(e => console.error('CORS blocked:', e))

# Expected result: CORS error (request blocked) ✅
# Vulnerable result: File content displayed ❌
```

---

## References

- **GitHub Advisory:** https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99
- **Fix Commit:** https://github.com/evanw/esbuild/commit/de85afd65edec9ebc44a11e245fd9e9a2e99760d
- **GHSA Database:** https://github.com/advisories/GHSA-67mh-4wv8-2f99
- **Dependabot Alert:** https://github.com/cmndcntrlcyber/rtpi/security/dependabot/1

---

## Decision Log

**Date:** December 27, 2025
**Decision:** Defer immediate fix, implement developer mitigations

**Rationale:**
1. Just completed critical UI/UX fixes and test improvements
2. Medium severity + development-only impact = lower priority
3. Can safely mitigate with developer best practices
4. Plan to update Vite in next development cycle
5. No production risk

**Approved By:** [To be filled]
**Review Date:** [Next sprint planning]

---

**Document Owner:** Security Team
**Last Updated:** December 27, 2025
**Next Review:** Next Sprint / Before Production Deployment
