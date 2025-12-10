# Phase 1: Empire C2 Integration - Testing Requirements

**Parent Document:** [08-EXTERNAL-SERVICES-INTEGRATION-PHASE1.md](08-EXTERNAL-SERVICES-INTEGRATION-PHASE1.md)  
**Priority:** 🟡 Tier 2 - Beta Enhancement  
**Phase:** 1 of 3 (Empire C2)  
**Last Updated:** December 9, 2025

---

## Overview

This document outlines testing requirements for Empire C2 integration with RTPI. Tests ensure Empire operates correctly within the RTPI ecosystem and all integrations function as expected.

---

## Test Coverage Goals

| Test Type | Target Coverage | Priority | Estimated Tests |
|-----------|----------------|----------|-----------------|
| Unit Tests | 80%+ | 🔴 High | 30-40 tests |
| Integration Tests | 70%+ | 🟡 Medium | 15-20 tests |
| E2E Tests | 60%+ | 🟡 Medium | 8-12 tests |

---

## Unit Tests

### Empire Executor Service
**File:** `tests/unit/empire-executor.test.ts`

**Test Coverage:**
- User token creation and management
- Listener CRUD operations
- Agent management
- Stager generation
- Module execution
- Credential harvesting
- Session synchronization
- Health checks

**Key Test Scenarios:**
- Create/revoke user tokens
- Create HTTP/HTTPS/Meterpreter listeners
- Fetch and sync agents
- Generate all stager types
- Execute commands on agents
- Handle API errors gracefully

---

### Kasm Nginx Manager
**File:** `tests/unit/kasm-nginx-manager.test.ts`

**Test Coverage:**
- Proxy route registration
- Nginx config generation
- Config file write/delete operations
- Cloudflare DNS operations
- Route listing

---

### Database Operations
**File:** `tests/unit/empire-database.test.ts`

**Test Coverage:**
- Empire schema creation
- RTPI tracking tables (empire_sessions, empire_user_tokens, empire_listeners)
- Foreign key relationships
- Triggers and functions
- Data migrations

---

## Integration Tests

### Empire API Integration
**File:** `tests/integration/empire-api.test.ts`

**Test Scenarios:**
1. Full listener lifecycle (create → use → delete)
2. Agent check-in and synchronization
3. Proxy route auto-registration
4. Database persistence verification
5. Error handling and recovery

---

### Workflow Integration
**File:** `tests/integration/empire-workflow.test.ts`

**Test Scenarios:**
1. Post-exploitation workflow execution
2. Empire C2 Agent task execution
3. Multi-agent coordination
4. Operation linking

---

## End-to-End Tests

### UI Workflows
**File:** `tests/e2e/empire-ui.spec.ts`

**Test Scenarios:**
1. Login → Navigate to Empire page → Create listener → Verify active
2. Generate stager → Copy to clipboard → Verify content
3. View agents → Execute command → Verify result
4. Delete listener → Verify cleanup

---

### Full C2 Operation
**File:** `tests/e2e/empire-c2-operation.spec.ts`

**Test Scenarios:**
1. Create operation → Create listener → Generate stager
2. (Simulated) Agent check-in → Verify in database
3. Execute reconnaissance module → Verify results
4. Harvest credentials → Verify storage
5. Complete operation → Verify cleanup

---

## Performance Tests

### Load Testing
**Scenarios:**
- 50+ simultaneous agents checking in
- Multiple concurrent listener operations
- Rapid stager generation requests
- Database query performance with 1000+ sessions

**Tools:** Artillery, k6, or custom scripts

---

## Security Tests

### Security Validation
**Checks:**
- API authentication enforcement
- User token isolation (users can't access each other's tokens)
- SQL injection prevention
- XSS prevention in UI
- Listener port validation
- Secure credential storage

---

## Test Execution

### Run All Tests
```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test
```

### CI/CD Integration
Tests run automatically on:
- Pull requests
- Merges to main branch
- Nightly builds

---

## Success Criteria

- [ ] 80%+ unit test coverage
- [ ] All integration tests passing
- [ ] E2E tests cover critical user journeys
- [ ] No security vulnerabilities
- [ ] Performance meets benchmarks (<500ms API response)
- [ ] All tests documented
- [ ] CI/CD pipeline configured

---

**Last Updated:** December 9, 2025  
**Maintained By:** RTPI Development Team
