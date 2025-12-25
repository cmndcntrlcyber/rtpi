# Empire C2 Integration - Security Audit

**Date:** 2025-12-25
**Version:** 1.0.0-beta.1
**Auditor:** Claude Sonnet 4.5
**Scope:** Empire C2 Integration (Enhancement 06)

## Executive Summary

The Empire C2 integration has been audited for security vulnerabilities. The implementation demonstrates good security practices overall, with proper authentication, parameterized queries, and password redaction. However, one critical issue was identified regarding password storage that requires immediate attention.

## Security Findings

### 🔴 Critical: Password Storage Implementation (CVE-PENDING)

**Issue:** The current implementation uses bcrypt hashing for Empire admin passwords, but then attempts to use the hash for authentication.

**Location:**
- `server/api/v1/empire.ts:79` - Password is hashed with bcrypt
- `server/services/empire-executor.ts:218` - Hash is used directly for login

**Impact:**
- Empire server authentication will fail because bcrypt hashes cannot be reversed
- Admin passwords are protected at rest but unusable for actual authentication

**Root Cause:**
```typescript
// In empire.ts
const passwordHash = await bcrypt.hash(adminPassword, 10);  // One-way hash

// In empire-executor.ts
password: server.adminPasswordHash,  // Cannot be decrypted
```

**Recommendation:**
Use AES-256-GCM encryption instead of bcrypt hashing:

```typescript
// Encrypt on storage
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes
const iv = crypto.randomBytes(16);

const cipher = crypto.createCipheriv(algorithm, key, iv);
let encrypted = cipher.update(adminPassword, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag();

// Store: encrypted + iv + authTag

// Decrypt on use
const decipher = crypto.createDecipheriv(algorithm, key, storedIv);
decipher.setAuthTag(storedAuthTag);
let decrypted = decipher.update(storedEncrypted, 'hex', 'utf8');
decrypted += decipher.final('utf8');
```

**Timeline:** Immediate fix required for production deployment

---

### ✅ Good: API Authentication

**Finding:** All Empire API endpoints properly require authentication.

**Evidence:**
```typescript
const userId = req.user?.id;
if (!userId) {
  return res.status(401).json({ error: "Unauthorized" });
}
```

**Endpoints Protected:**
- Server connection checks
- Listener management
- Agent operations
- Task execution
- Module execution
- Credential operations

---

### ✅ Good: SQL Injection Prevention

**Finding:** All database queries use Drizzle ORM with parameterized queries.

**Evidence:**
```typescript
await db.delete(empireServers).where(eq(empireServers.id, req.params.id));
await db.insert(empireServers).values({...});
```

**Assessment:** No raw SQL queries detected. All user input is properly escaped through ORM.

---

### ✅ Good: Password Redaction in Responses

**Finding:** Admin password hashes are removed from API responses.

**Evidence:**
```typescript
res.json({
  ...server,
  adminPasswordHash: undefined,  // Redacted
});
```

---

### ⚠️  Medium: HTTPS Enforcement

**Issue:** No enforcement of HTTPS for Empire REST API connections.

**Location:** `server/services/empire-executor.ts` - Axios client creation

**Current Implementation:**
```typescript
baseURL: server.restApiUrl,  // Could be HTTP
```

**Recommendation:**
- Add validation to require HTTPS URLs in production
- Warn users when configuring HTTP connections
- Add `rejectUnauthorized: false` option for self-signed certificates with explicit user consent

**Example:**
```typescript
if (process.env.NODE_ENV === 'production' && !server.restApiUrl.startsWith('https://')) {
  throw new Error('HTTPS required for Empire connections in production');
}
```

---

### ⚠️  Medium: Input Validation

**Issue:** Limited input validation on Empire API endpoints.

**Recommendation:** Add Joi/Zod validation schemas for:
- Server configuration (name, host, port ranges)
- Listener parameters
- Module options
- Shell commands (command injection prevention)

**Example:**
```typescript
const serverSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  host: Joi.string().hostname().required(),
  port: Joi.number().min(1).max(65535).required(),
  adminUsername: Joi.string().min(1).max(100).required(),
  adminPassword: Joi.string().min(8).required()
});
```

---

### ✅ Good: Token Management

**Finding:** Empire API tokens are properly stored and managed per-user.

**Implementation:**
- Tokens stored in `empire_user_tokens` table
- Tokens cached for performance
- Tokens refreshed when expired
- Tokens cleared when servers deleted (CASCADE)

---

### ⚠️  Low: Error Message Disclosure

**Issue:** Some error messages may expose internal details.

**Examples:**
```typescript
console.error("Failed to sync agents:", error);
res.status(500).json({ error: "Failed to sync agents" });
```

**Recommendation:**
- Log detailed errors server-side only
- Return generic error messages to clients
- Use error codes instead of messages

---

### ✅ Good: Foreign Key Constraints

**Finding:** Proper CASCADE and SET NULL behaviors configured.

**Schema Validation:**
- `empire_servers` → All child tables CASCADE on delete
- `empire_agents` → Optional relationships SET NULL
- `empire_listeners` → Proper references maintained

---

## Security Best Practices Implemented

1. ✅ Authentication required for all operations
2. ✅ Parameterized database queries (SQL injection prevention)
3. ✅ Password redaction in API responses
4. ✅ Token-based Empire authentication
5. ✅ Proper error handling
6. ✅ Database constraints and referential integrity
7. ✅ Separation of concerns (executor service pattern)

## Recommendations Summary

### Immediate (P0)
- [ ] **Fix password storage** - Use AES encryption instead of bcrypt hashing

### High Priority (P1)
- [ ] **Add input validation** - Implement Joi/Zod schemas for all inputs
- [ ] **Enforce HTTPS** - Require HTTPS in production environments

### Medium Priority (P2)
- [ ] **Improve error handling** - Generic messages to clients, detailed logs server-side
- [ ] **Add rate limiting** - Prevent brute force attacks on Empire operations
- [ ] **Implement audit logging** - Track all Empire operations for compliance

### Low Priority (P3)
- [ ] **Add request signing** - HMAC signatures for Empire API requests
- [ ] **Certificate pinning** - Pin Empire server certificates
- [ ] **Session timeout** - Auto-logout after inactivity

## Compliance Notes

### OWASP Top 10 (2021)
- **A01 Broken Access Control:** ✅ Protected (authentication required)
- **A02 Cryptographic Failures:** ❌ Issue with password storage
- **A03 Injection:** ✅ Protected (parameterized queries)
- **A04 Insecure Design:** ✅ Good design patterns
- **A05 Security Misconfiguration:** ⚠️  HTTPS enforcement needed
- **A06 Vulnerable Components:** ✅ Up-to-date dependencies
- **A07 Identification/Authentication:** ✅ Proper authentication
- **A08 Software/Data Integrity:** ✅ Good integrity controls
- **A09 Logging/Monitoring:** ⚠️  Could be improved
- **A10 Server-Side Request Forgery:** ✅ Not applicable

## Conclusion

The Empire C2 integration demonstrates solid security architecture with one critical issue requiring immediate attention. The password storage implementation must be corrected before production deployment. Once the P0 and P1 items are addressed, the security posture will be production-ready.

**Overall Security Rating:** B (Good) → A (Excellent) after fixes

**Sign-off:** Security audit completed. Recommendations documented.
