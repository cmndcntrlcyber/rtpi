# Critical Bugs & Blockers - Tier 1 Priority

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)  
**Priority:** 🔴 Tier 1 - Critical for Beta  
**Timeline:** Week 1-2 (Days 1-14)  
**Total Items:** 15  
**Last Updated:** December 4, 2025

---

## Overview

This document details all critical bugs and blockers that must be resolved before beta testing can begin. These issues directly impact core functionality and user experience.

### Success Criteria
- ✅ All bugs fixed and verified
- ✅ No 500 errors in core workflows
- ✅ All target types working correctly
- ✅ Scan operations completing successfully
- ✅ Data persistence working as expected

---

## Table of Contents

1. [Bug #1: Operations Date Handling](#bug-1-operations-date-handling)
2. [Bug #2: Operations Status Management](#bug-2-operations-status-management)
3. [Bug #3: Nmap Target Type Sanitization](#bug-3-nmap-target-type-sanitization)
4. [Bug #4: CIDR Scanning Timeouts](#bug-4-cidr-scanning-timeouts)
5. [Bug #5: CVSS Calculator Issues](#bug-5-cvss-calculator-issues)
6. [Enhancement: Scan History System](#enhancement-scan-history-system)
7. [Enhancement: Target Type Testing Framework](#enhancement-target-type-testing-framework)
8. [Testing Requirements](#testing-requirements)
9. [Migration Guide](#migration-guide)

---

## Bug #1: Operations Date Handling

### Status: 🔴 Critical

### Description
Operations CREATE and UPDATE endpoints throw 500 Internal Server Error when date fields are submitted. The error indicates timestamp conversion issues between frontend form submission and database storage.

### Symptoms
- Cannot create new operations
- Cannot edit existing operations
- Error message: "value.toISOString is not a function"
- 500 error in browser console and server logs

### Root Cause
**[TO BE FILLED]**
- Date input fields sending strings instead of Date objects
- Backend expecting Date objects for timestamp conversion
- Database schema using timestamp without proper parsing

### Affected Files
- `client/src/pages/Operations.tsx` - Form submission
- `server/api/v1/[operations-endpoint].ts` - API handler
- `shared/schema.ts` - Database schema

### Proposed Fix
**[TO BE FILLED]**
```typescript
// Example fix approach:
// 1. Frontend: Convert date strings to ISO format before submission
// 2. Backend: Parse and validate date strings before database insert
// 3. Add proper error handling for invalid dates
```

### Testing Checklist
- [ ] Create operation with start date
- [ ] Create operation with end date
- [ ] Create operation with both dates
- [ ] Update operation changing dates
- [ ] Test with invalid date formats
- [ ] Test with null/undefined dates
- [ ] Verify database storage format
- [ ] Test date display on reload

### Dependencies
None

### Estimated Effort
1-2 days

---

## Bug #2: Operations Status Management

### Status: 🔴 Critical

### Description
Operation cards display inconsistent status indicators (showing both "planning" badge and "in progress" icon simultaneously). Additionally, there's no way to quickly change status without opening the full edit dialog.

### Symptoms
- Duplicate/conflicting status indicators on operation cards
- "Invalid Date" display on cards
- No inline status change functionality
- Status changes require full edit dialog

### Root Cause
**[TO BE FILLED]**
- Multiple status fields not synchronized
- UI components reading different data sources
- Missing inline edit functionality

### Affected Files
- `client/src/components/operations/OperationCard.tsx` - Card display
- `client/src/pages/Operations.tsx` - Operations page
- Server API endpoints for status updates

### Proposed Fix
**[TO BE FILLED]**

#### Part A: Fix Status Display Consistency
```typescript
// Ensure single source of truth for status
// Update UI to show only one status indicator
// Sync badge and icon states
```

#### Part B: Add Inline Status Change
```typescript
// Add dropdown on card for quick status change
// Implement optimistic UI updates
// Add confirmation for critical status changes (e.g., cancel)
```

### UI Mockup
```
┌─────────────────────────────────────────────┐
│ Operation Card                              │
│ ┌─────────────┐                 [Status ▼] │
│ │   Avatar    │  Operation Name             │
│ │      B      │  Description...             │
│ └─────────────┘                             │
│ Status dropdown shows:                      │
│   ○ Planning                                │
│   ● Active      ← Selected                  │
│   ○ Paused                                  │
│   ○ Completed                               │
│   ○ Cancelled                               │
└─────────────────────────────────────────────┘
```

### Testing Checklist
- [ ] Status displays consistently across all views
- [ ] Inline status change works on card
- [ ] Status updates persist to database
- [ ] Status change triggers appropriate workflows
- [ ] Confirmation dialogs appear for destructive actions
- [ ] Status history is logged (audit trail)
- [ ] Permissions respected for status changes

### Dependencies
- Bug #1 (Date handling) should be fixed first

### Estimated Effort
2-3 days

---

## Bug #3: Nmap Target Type Sanitization

### Status: 🔴 Critical

### Description
Nmap scans fail when target type is "URL" because the full URL (including protocol) is passed to nmap, which cannot parse URLs. This affects all URL-type targets and causes 0 results.

### Symptoms
- URL target scans show 0 hosts found
- Scan completes but finds no open ports
- Works for IP and Domain types
- Fails for URL, potentially Network (CIDR), and Range types

### Example
```
Input: https://c3s.consulting
Nmap receives: sudo nmap -Pn https://c3s.consulting
Error: 0 IP addresses (0 hosts up) scanned

Should be: sudo nmap -Pn c3s.consulting
```

### Root Cause
**[TO BE FILLED]**
- No URL parsing/sanitization before passing to nmap
- Target type validation missing
- No hostname extraction from URLs

### Affected Files
- `server/services/docker-executor.ts` - Command execution
- `server/api/v1/targets.ts` - Target scanning endpoint
- Target type handlers

### Proposed Fix
**[TO BE FILLED]**

#### Target Sanitization Matrix
```typescript
// Sanitization function for each target type:

interface TargetSanitizer {
  targetType: 'ip' | 'domain' | 'url' | 'network' | 'range';
  sanitize: (value: string) => string;
  validate: (value: string) => boolean;
  nmapCompatible: (value: string) => string;
}

// Implementation details to be added...
```

### Testing Checklist
- [ ] IP address targets scan correctly
- [ ] Domain targets scan correctly  
- [ ] URL targets extract hostname and scan
- [ ] Network (CIDR) targets scan correctly
- [ ] Range targets scan correctly
- [ ] Invalid targets show appropriate errors
- [ ] Scan results populate correctly
- [ ] Services detected and stored

### Dependencies
None

### Estimated Effort
2-3 days

---

## Bug #4: CIDR Scanning Timeouts

### Status: 🔴 Critical

### Description
CIDR network scans (e.g., 192.168.1.0/24) timeout because the default timeout is too short for scanning 256 hosts. The scan fails with "Command execution timeout" error.

### Symptoms
- Network scans timeout before completion
- Error: "Execution failed: Command execution timeout"
- No partial results captured
- Affects /24, /16, and larger networks

### Root Cause
**[TO BE FILLED]**
- Fixed 10-minute timeout for all scans
- No dynamic timeout based on network size
- No progress streaming during long scans
- No partial result capture

### Affected Files
- `server/services/docker-executor.ts` - Timeout configuration
- Scan execution logic

### Proposed Fix
**[TO BE FILLED]**

#### Dynamic Timeout Calculation
```typescript
// Calculate timeout based on network size
function getTimeoutForTarget(target: Target): number {
  if (target.type === 'network') {
    const cidr = parseInt(target.value.split('/')[1]);
    const hostCount = Math.pow(2, 32 - cidr);
    // Estimate: ~1 minute per host for full scan
    return Math.min(hostCount * 60 * 1000, 3600000); // Max 1 hour
  }
  return 600000; // 10 min default
}
```

#### Progress Streaming
```typescript
// Stream progress updates as scan runs
async *scanWithProgress(target: Target): AsyncGenerator<ScanProgress> {
  // Yield progress updates
  // Allow cancellation
  // Capture partial results
}
```

### Testing Checklist
- [ ] /24 network scans complete successfully
- [ ] /16 network scans complete (or timeout appropriately)
- [ ] Progress updates stream to UI
- [ ] Partial results captured on timeout
- [ ] Scan can be cancelled mid-execution
- [ ] Multiple concurrent scans handled

### Dependencies
None

### Estimated Effort
2-3 days

---

## Bug #5: CVSS Calculator Issues

### Status: 🔴 Critical

### Description
CVSS calculator does not parse pasted CVSS vectors. When a user pastes a CVSS vector string (e.g., `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H`), the calculator shows 0.0 score instead of auto-calculating.

### Symptoms
- Paste CVSS vector → no auto-calculation
- Score remains 0.0 despite high-severity vector
- Manual dropdown selection works
- No two-way sync between vector and dropdowns

### Root Cause
**[TO BE FILLED]**
- No vector parsing implementation
- Text field and calculator not synchronized
- Score calculation only triggered by dropdown changes

### Affected Files
- `client/src/components/cvss/CVSSCalculator.tsx` - Calculator component
- CVSS calculation logic

### Proposed Fix
**[TO BE FILLED]**

#### Vector Parser
```typescript
// Parse CVSS vector string into metrics
function parseCVSSVector(vector: string): CVSSMetrics | null {
  const regex = /^CVSS:3\.[01]\/AV:([NALP])\/AC:([LH])\/PR:([NLH])\/UI:([NR])\/S:([UC])\/C:([NLH])\/I:([NLH])\/A:([NLH])$/;
  // Parse and return metrics object
}
```

#### Two-Way Sync
```typescript
// Update vector when dropdowns change
// Update dropdowns when vector pasted
// Calculate score on any change
```

### Testing Checklist
- [ ] Paste vector → auto-calculate score
- [ ] Change dropdown → update vector string
- [ ] Score matches official CVSS calculator
- [ ] Invalid vectors show error
- [ ] Score persists with vulnerability
- [ ] Associated with target correctly

### Dependencies
None

### Estimated Effort
1-2 days

---

## Enhancement: Scan History System

### Status: 🟡 High Priority

### Description
Implement a comprehensive scan history tracking system that stores all scan attempts, results, and metadata in a dedicated database table with UI for viewing and managing history.

### Current State
- Scans stored in target metadata JSON field
- Only latest scan visible
- No history timeline
- No comparison capabilities
- No way to delete old scans

### Proposed Solution
**[TO BE FILLED]**

### Database Schema
```sql
-- New table for scan history
CREATE TABLE target_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID REFERENCES targets(id) ON DELETE CASCADE,
  scan_type VARCHAR(50) NOT NULL,
  command TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration INTEGER,
  status VARCHAR(20) NOT NULL,
  open_ports JSONB DEFAULT '[]',
  discovered_services JSONB DEFAULT '{}',
  raw_output TEXT,
  parsed_output JSONB,
  error_message TEXT,
  scanned_by UUID REFERENCES users(id),
  tool_id UUID REFERENCES security_tools(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_target_scans_target_id ON target_scans(target_id);
CREATE INDEX idx_target_scans_started_at ON target_scans(started_at DESC);
```

### UI Design
```
┌─────────────────────────────────────────────────────────┐
│ Target Details                    │ Scan History        │
│                                   │                     │
│ [Target Info]                     │ ┌─────────────────┐ │
│                                   │ │ Latest Scan     │ │
│                                   │ │ Dec 4, 9:00am   │ │
│                                   │ │ Full Scan       │ │
│                                   │ │ ✓ Complete      │ │
│                                   │ │ [View] [Delete] │ │
│                                   │ └─────────────────┘ │
│                                   │                     │
│                                   │ ┌─────────────────┐ │
│                                   │ │ Dec 3, 5:00pm   │ │
│                                   │ │ Quick Scan      │ │
│                                   │ │ ✓ Complete      │ │
│                                   │ │ [View] [Delete] │ │
│                                   │ └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Implementation Checklist
- [ ] Create database migration for target_scans table
- [ ] Update scan execution to write to new table
- [ ] Create API endpoints for scan history CRUD
- [ ] Build scan history UI component (right column)
- [ ] Implement delete scan functionality
- [ ] Add scan comparison view
- [ ] Migrate existing scan data
- [ ] Add retention policy configuration

### Testing Checklist
- [ ] Scans recorded in history
- [ ] History displays correctly
- [ ] Delete scan works
- [ ] Compare scans works
- [ ] Retention policy applies
- [ ] Performance acceptable with 100+ scans

### Dependencies
- Bug #3 (Nmap sanitization) should be fixed first
- Bug #4 (CIDR timeouts) should be fixed first

### Estimated Effort
3-4 days

---

## Enhancement: Target Type Testing Framework

### Status: 🟡 High Priority

### Description
Implement comprehensive testing for all 5 target types to ensure nmap and other tools work correctly with each type.

### Target Types to Test
1. **IP Address** - `192.168.1.100`
2. **Domain** - `example.com`
3. **URL** - `https://example.com/path`
4. **Network (CIDR)** - `192.168.1.0/24`
5. **IP Range** - `192.168.1.1-254`

### Implementation Plan
**[TO BE FILLED]**

### Test Suite Structure
```typescript
// tests/integration/target-types.spec.ts

describe('Target Type Scanning', () => {
  describe('IP Address Targets', () => {
    it('should scan single IP address');
    it('should handle localhost');
    it('should reject invalid IP');
  });
  
  describe('Domain Targets', () => {
    it('should scan domain name');
    it('should strip protocol from domain');
    it('should handle subdomains');
  });
  
  describe('URL Targets', () => {
    it('should extract hostname from URL');
    it('should handle HTTPS URLs');
    it('should handle URLs with paths');
  });
  
  describe('Network (CIDR) Targets', () => {
    it('should scan /24 network');
    it('should scan /16 network');
    it('should reject invalid CIDR');
  });
  
  describe('IP Range Targets', () => {
    it('should scan short-form range');
    it('should scan full-form range');
    it('should reject invalid range');
  });
});
```

### Manual Testing Checklist
**[TO BE FILLED]**

#### IP Address Testing
- [ ] Single IP: `192.168.1.100`
- [ ] Localhost: `127.0.0.1`
- [ ] Public IP: `8.8.8.8`
- [ ] Invalid IP: Should show error

#### Domain Testing
- [ ] Simple domain: `example.com`
- [ ] Subdomain: `www.example.com`
- [ ] With protocol: `https://example.com` (should strip)
- [ ] With path: `example.com/path` (should strip)

#### URL Testing
- [ ] HTTP URL: `http://example.com`
- [ ] HTTPS URL: `https://example.com`
- [ ] URL with port: `https://example.com:8443`
- [ ] URL with path: `https://example.com/app/page.html`

#### Network (CIDR) Testing
- [ ] /24 network: `192.168.1.0/24`
- [ ] /16 network: `10.0.0.0/16`
- [ ] Invalid CIDR: Should show error

#### IP Range Testing
- [ ] Short form: `192.168.1.1-254`
- [ ] Full form: `192.168.1.1-192.168.1.254`
- [ ] Invalid range: Should show error

### Documentation Required
**[TO BE FILLED]**
- Create `docs/NMAP-TARGET-TESTING.md`
- Include test cases
- Include expected results
- Include troubleshooting guide

### Implementation Checklist
- [ ] Write integration tests
- [ ] Write unit tests for sanitization
- [ ] Create manual testing checklist
- [ ] Document test procedures
- [ ] Run tests against each target type
- [ ] Fix any issues found
- [ ] Add tests to CI/CD pipeline

### Dependencies
- Bug #3 (Nmap sanitization) must be complete

### Estimated Effort
2-3 days

---

## Testing Requirements

### Unit Tests
- [ ] Operations date parsing functions
- [ ] Status management logic
- [ ] Target sanitization for each type
- [ ] CVSS vector parsing
- [ ] Scan history CRUD operations

**Target Coverage:** 100% for Tier 1 items

### Integration Tests
- [ ] Operations CREATE/UPDATE/DELETE workflows
- [ ] Status change workflows
- [ ] Nmap execution for all target types
- [ ] Scan history recording
- [ ] CVSS calculation and persistence

**Target Coverage:** 90% for critical paths

### E2E Tests
- [ ] Complete operation lifecycle
- [ ] Complete scan lifecycle
- [ ] CVSS calculator user flow
- [ ] Scan history browsing and deletion

**Target Coverage:** 80% of user journeys

### Performance Tests
- [ ] Large CIDR network scans
- [ ] Concurrent scan execution
- [ ] Scan history with 1000+ entries

---

## Migration Guide

### Database Migrations Required

#### Migration 1: Fix Operations Date Handling
```sql
-- No schema changes required
-- Fix is in application code
```

#### Migration 2: Add target_scans Table
```sql
-- File: migrations/0005_add_target_scans.sql
-- See Scan History System section for full schema
```

### Data Migration Steps
1. **Backup existing scan data** from targets.metadata
2. **Run migration** to create target_scans table
3. **Migrate scan data** from JSON to new table
4. **Verify data integrity**
5. **Update application** to use new table
6. **Deprecate old JSON field** (keep for rollback)

### Rollback Plan
- Keep old scan data in metadata for 30 days
- Rollback script available to revert changes
- Application code supports both old and new formats

---

## Success Metrics

### Before Beta Launch
- [ ] Zero 500 errors in operations module
- [ ] 100% of target types scanning successfully
- [ ] All critical bugs resolved
- [ ] Test coverage >90%
- [ ] Documentation complete
- [ ] Migration tested in staging

### Post-Fix Validation
- [ ] Run full regression test suite
- [ ] Manual testing of all affected features
- [ ] Performance testing
- [ ] Security review
- [ ] Beta tester feedback positive

---

## Related Documentation
- [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md) - Parent document
- [API.md](../API.md) - API documentation
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Development guide

---

**Status Legend:**
- 🔴 Critical - Blocking beta launch
- 🟡 High Priority - Important for beta
- 🟢 Medium Priority - Nice to have
- ✅ Complete
- 🚧 In Progress
- ⏸️ Blocked

---

**Last Updated:** December 4, 2025  
**Maintained By:** RTPI Development Team
