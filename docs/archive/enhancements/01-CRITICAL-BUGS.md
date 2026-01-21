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
The issue occurs due to type mismatch in the date handling pipeline:

1. **Frontend (OperationForm.tsx)**: The HTML5 `<input type="date">` element returns a string in format `YYYY-MM-DD`
2. **Form Processing**: The code attempts to create Date objects by concatenating timezone strings:
   ```typescript
   submitData.startDate = new Date(formData.startDate + 'T00:00:00.000Z');
   submitData.endDate = new Date(formData.endDate + 'T23:59:59.999Z');
   ```
3. **Backend (operations.ts)**: The API endpoint uses spread operator `...req.body` which passes the Date objects directly to Drizzle ORM
4. **Database Layer**: When Drizzle attempts to insert, it calls `.toISOString()` on the Date objects, but if the conversion failed in step 2, the values may be strings or invalid Date objects
5. **Error Point**: The error "value.toISOString is not a function" indicates that the backend received a string instead of a Date object, likely due to JSON serialization in the HTTP request body (JSON doesn't support Date objects - they get stringified)

### Affected Files
- `client/src/pages/Operations.tsx` - Form submission
- `server/api/v1/[operations-endpoint].ts` - API handler
- `shared/schema.ts` - Database schema

### Proposed Fix

#### Solution A: Frontend - Send ISO Strings (RECOMMENDED)
```typescript
// client/src/components/operations/OperationForm.tsx

const handleSubmit = async (e: React.FormEvent, forcedStatus?: string) => {
  e.preventDefault();
  setSubmitting(true);
  setError("");

  try {
    const cleanGoals = goals.filter((g) => g.trim() !== "");
    const metadata = {
      goals: cleanGoals,
      applicationOverview: formData.applicationOverview,
      businessImpact: formData.businessImpact,
      scopeData: formData.scopeData,
      authentication: formData.authentication,
      additionalInfo: formData.additionalInfo,
    };

    const submitData: any = {
      name: formData.name,
      status: forcedStatus || formData.status,
    };

    if (formData.description) submitData.description = formData.description;
    if (formData.objectives) submitData.objectives = formData.objectives;
    if (formData.scope) submitData.scope = formData.scope;
    
    // FIX: Send ISO strings instead of Date objects
    // JSON.stringify will properly serialize these
    if (formData.startDate) {
      submitData.startDate = `${formData.startDate}T00:00:00.000Z`;
    }
    if (formData.endDate) {
      submitData.endDate = `${formData.endDate}T23:59:59.999Z`;
    }
    
    submitData.metadata = metadata;

    console.log("Submitting operation data:", submitData);
    
    await onSubmit(submitData);
    
    resetForm();
    onOpenChange(false);
  } catch (err: any) {
    setError(err.message || "Failed to save operation");
  } finally {
    setSubmitting(false);
  }
};
```

#### Solution B: Backend - Parse and Validate Dates
```typescript
// server/api/v1/operations.ts

import { z } from "zod";

// Add validation schema
const operationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["planning", "active", "paused", "completed", "cancelled"]),
  startDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  objectives: z.string().optional(),
  scope: z.string().optional(),
  metadata: z.any().optional(),
});

// POST /api/v1/operations - Create new operation
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    // Validate and parse input
    const validated = operationSchema.parse(req.body);

    const operation = await db
      .insert(operations)
      .values({
        ...validated,
        ownerId: user.id,
      })
      .returning();

    await logAudit(user.id, "create_operation", "/operations", operation[0].id, true, req);

    res.status(201).json({ operation: operation[0] });
  } catch (error) {
    console.error("Create operation error:", error);
    
    // Better error messages for validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    
    await logAudit(user.id, "create_operation", "/operations", null, false, req);
    res.status(500).json({ error: "Failed to create operation" });
  }
});

// PUT /api/v1/operations/:id - Update operation
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    // Validate and parse input
    const validated = operationSchema.partial().parse(req.body);

    const result = await db
      .update(operations)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(operations.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    await logAudit(user.id, "update_operation", "/operations", id, true, req);

    res.json({ operation: result[0] });
  } catch (error) {
    console.error("Update operation error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    
    await logAudit(user.id, "update_operation", "/operations", id, false, req);
    res.status(500).json({ error: "Failed to update operation" });
  }
});
```

#### Solution C: Add Utility Function (Optional Enhancement)
```typescript
// shared/utils/date-helpers.ts

export function parseOperationDate(dateInput: string | Date | undefined): Date | undefined {
  if (!dateInput) return undefined;
  
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? undefined : dateInput;
  }
  
  try {
    const parsed = new Date(dateInput);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  } catch {
    return undefined;
  }
}

export function formatDateForInput(date: Date | string | undefined): string {
  if (!date) return "";
  
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  
  return d.toISOString().split('T')[0]; // Returns YYYY-MM-DD
}
```

### Testing Checklist
- [ ] Create operation with start date only
- [ ] Create operation with end date only
- [ ] Create operation with both start and end dates
- [ ] Create operation with no dates (both optional)
- [ ] Update operation changing start date
- [ ] Update operation changing end date
- [ ] Update operation removing dates (set to empty)
- [ ] Test with invalid date formats (should show validation error)
- [ ] Test with dates in the past
- [ ] Test with start date after end date (should this be allowed?)
- [ ] Test with null/undefined dates
- [ ] Verify database storage format (timestamps in UTC)
- [ ] Test date display on reload (correct timezone conversion)
- [ ] Test date display in different timezones
- [ ] Verify audit logs capture date changes
- [ ] Test concurrent updates to same operation dates

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
After analyzing the OperationCard.tsx component, the root causes are:

1. **Status Display Logic**: The card shows a status badge (`<Badge>`) but the "Invalid Date" and inconsistent indicators suggest date-related display issues rather than multiple status fields
2. **Date Formatting Issues**: The `formatDate` function is called on `operation.startedAt` and `operation.completedAt`, but if these fields contain invalid date strings or null values, it displays "Invalid Date"
3. **No Inline Edit**: The current implementation only provides Edit/Delete buttons in action area - no quick status dropdown on the card itself
4. **Workflow Status Confusion**: The card displays both operation status (`operation.status`) and latest workflow status (`operation.latestWorkflowStatus`), which can appear to conflict if not clearly distinguished
5. **Missing Validation**: No validation that `startedAt`/`completedAt` are valid Date objects before calling formatting functions

The primary issue is that the operations database schema may have `startedAt`/`completedAt` fields that aren't properly populated, or the date handling from Bug #1 affects these display fields.

### Affected Files
- `client/src/components/operations/OperationCard.tsx` - Card display
- `client/src/pages/Operations.tsx` - Operations page
- Server API endpoints for status updates

### Proposed Fix

#### Part A: Fix Status Display Consistency
```typescript
// client/src/components/operations/OperationCard.tsx

// 1. Add safe date formatting with fallback
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "Not set";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  } catch {
    return "Invalid date";
  }
};

// 2. Clearly separate operation status from workflow status
// Operation status badge at top (existing)
<Badge 
  variant="secondary" 
  className={`${statusColors[operation.status as keyof typeof statusColors]} px-2 py-1 text-xs font-medium`}
>
  {operation.status.toUpperCase()}
</Badge>

// Workflow status in separate section (existing, but make clearer)
{operation.latestWorkflowStatus === "completed" && (
  <Badge variant="secondary" className="bg-green-500/10 text-green-600 flex items-center gap-1">
    <CheckCircle className="h-3 w-3" />
    WORKFLOW: {operation.latestWorkflowStatus.toUpperCase()}
  </Badge>
)}
```

#### Part B: Add Inline Status Change
```typescript
// client/src/components/operations/OperationCard.tsx

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface OperationCardProps {
  operation: Operation;
  onSelect?: (operation: Operation) => void;
  onEdit?: (operation: Operation) => void;
  onDelete?: (operation: Operation) => void;
  onWorkflowsChange?: () => void;
  onStatusChange?: (operationId: string, newStatus: string) => Promise<void>; // NEW
}

export default function OperationCard({ 
  operation, 
  onSelect, 
  onEdit, 
  onDelete, 
  onWorkflowsChange,
  onStatusChange // NEW
}: OperationCardProps) {
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleStatusChange = async (newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Confirmation for destructive actions
    if (newStatus === "cancelled" || newStatus === "completed") {
      const action = newStatus === "cancelled" ? "cancel" : "complete";
      if (!confirm(`Are you sure you want to ${action} this operation?`)) {
        return;
      }
    }

    if (!onStatusChange) return;

    setUpdatingStatus(true);
    try {
      await onStatusChange(operation.id, newStatus);
      
      // Trigger refresh
      if (onWorkflowsChange) {
        onWorkflowsChange();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update operation status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Replace static badge with dropdown in header
  return (
    <Card 
      className="bg-white border-gray-200 hover:shadow-md cursor-pointer transition-all"
      onClick={handleClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3 ${getColorFromName(operation.name)}`}>
              {getInitials(operation.name)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{operation.name}</h3>
              <p className="text-sm text-gray-500 flex items-center mt-0.5">
                <Users className="h-3 w-3 mr-1" />
                Created by {operation.createdBy}
              </p>
            </div>
          </div>
          
          {/* Inline Status Dropdown */}
          {onStatusChange ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                  disabled={updatingStatus}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    operation.status === 'active' ? 'bg-green-500' :
                    operation.status === 'planning' ? 'bg-blue-500' :
                    operation.status === 'paused' ? 'bg-yellow-500' :
                    operation.status === 'completed' ? 'bg-gray-500' :
                    'bg-red-500'
                  }`} />
                  {operation.status}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={(e) => handleStatusChange('planning', e)}>
                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                  Planning
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleStatusChange('active', e)}>
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                  Active
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleStatusChange('paused', e)}>
                  <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />
                  Paused
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleStatusChange('completed', e)}>
                  <span className="w-2 h-2 rounded-full bg-gray-500 mr-2" />
                  Completed
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => handleStatusChange('cancelled', e)}
                  className="text-red-600"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                  Cancelled
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Fallback to static badge if no onStatusChange provided
            <Badge 
              variant="secondary" 
              className={`${statusColors[operation.status as keyof typeof statusColors]} px-2 py-1 text-xs font-medium`}
            >
              {operation.status}
            </Badge>
          )}
        </div>
        
        {/* Rest of card content... */}
      </CardContent>
    </Card>
  );
}
```

#### Part C: Update Operations Page to Handle Status Changes
```typescript
// client/src/pages/Operations.tsx

const handleStatusChange = async (operationId: string, newStatus: string) => {
  try {
    await update(operationId, { status: newStatus });
    await refetch();
  } catch (err) {
    console.error("Failed to update operation status:", err);
    throw err; // Re-throw for component error handling
  }
};

// Pass to OperationList
<OperationList
  operations={operationsWithWorkflows.length > 0 ? operationsWithWorkflows : operations}
  loading={loading}
  onSelect={handleSelectOperation}
  onEdit={handleEditOperation}
  onDelete={handleDeleteClick}
  onStatusChange={handleStatusChange} // NEW
/>
```

#### Part D: Update OperationList Component
```typescript
// client/src/components/operations/OperationList.tsx

interface OperationListProps {
  operations: Operation[];
  loading: boolean;
  onSelect?: (operation: Operation) => void;
  onEdit?: (operation: Operation) => void;
  onDelete?: (operation: Operation) => void;
  onStatusChange?: (operationId: string, newStatus: string) => Promise<void>; // NEW
}

export default function OperationList({ 
  operations, 
  loading, 
  onSelect, 
  onEdit, 
  onDelete,
  onStatusChange // NEW
}: OperationListProps) {
  // ... existing code ...
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {operations.map((operation) => (
        <OperationCard
          key={operation.id}
          operation={operation}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange} // NEW
        />
      ))}
    </div>
  );
}
```

#### Part E: Backend - Add PATCH Endpoint for Status-Only Updates
```typescript
// server/api/v1/operations.ts

// PATCH /api/v1/operations/:id/status - Quick status update
router.patch("/:id/status", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const user = req.user as any;

  // Validate status
  const validStatuses = ["planning", "active", "paused", "completed", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ 
      error: "Invalid status", 
      validStatuses 
    });
  }

  try {
    const updates: any = {
      status,
      updatedAt: new Date(),
    };

    // Auto-set dates based on status
    if (status === "active" && !req.body.skipDateUpdate) {
      const existing = await db.select().from(operations).where(eq(operations.id, id)).limit(1);
      if (existing[0] && !existing[0].startDate) {
        updates.startDate = new Date();
      }
    } else if (status === "completed" || status === "cancelled") {
      updates.endDate = new Date();
    }

    const result = await db
      .update(operations)
      .set(updates)
      .where(eq(operations.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    await logAudit(user.id, "update_operation_status", "/operations", id, true, req, {
      oldStatus: result[0].status,
      newStatus: status
    });

    res.json({ operation: result[0] });
  } catch (error) {
    console.error("Update operation status error:", error);
    await logAudit(user.id, "update_operation_status", "/operations", id, false, req);
    res.status(500).json({ error: "Failed to update operation status" });
  }
});
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
The issue occurs because target values are passed directly to nmap without sanitization based on target type:

1. **URL Targets**: When a user enters `https://c3s.consulting`, the entire string including `https://` is passed to nmap
2. **Nmap Requirements**: Nmap expects hostnames or IP addresses, not full URLs with protocols
3. **No Sanitization Layer**: The scan execution flow goes: Frontend → API → Docker Executor → Nmap, with no intermediate sanitization
4. **Type-Specific Handling Missing**: Each target type (IP, Domain, URL, Network, Range) has different requirements for nmap compatibility, but current code treats all the same
5. **Command Construction**: The nmap command is built by directly interpolating target value: `sudo nmap -Pn ${target.value}` without any parsing

### Affected Files
- `server/services/docker-executor.ts` - Command execution
- `server/api/v1/targets.ts` - Target scanning endpoint
- Target type handlers
- `shared/utils/target-sanitizer.ts` - NEW FILE NEEDED

### Proposed Fix

#### Create Target Sanitization Utility
```typescript
// shared/utils/target-sanitizer.ts

export type TargetType = 'ip' | 'domain' | 'url' | 'network' | 'range';

export interface SanitizationResult {
  nmapTarget: string;
  originalValue: string;
  sanitized: string;
  isValid: boolean;
  errorMessage?: string;
  warnings?: string[];
}

export class TargetSanitizer {
  /**
   * Main sanitization function - routes to specific handler based on type
   */
  static sanitizeForNmap(targetType: TargetType, value: string): SanitizationResult {
    const trimmed = value.trim();
    
    switch (targetType) {
      case 'ip':
        return this.sanitizeIP(trimmed);
      case 'domain':
        return this.sanitizeDomain(trimmed);
      case 'url':
        return this.sanitizeURL(trimmed);
      case 'network':
        return this.sanitizeNetwork(trimmed);
      case 'range':
        return this.sanitizeRange(trimmed);
      default:
        return {
          nmapTarget: trimmed,
          originalValue: value,
          sanitized: trimmed,
          isValid: false,
          errorMessage: `Unknown target type: ${targetType}`
        };
    }
  }

  /**
   * Sanitize IP address
   */
  private static sanitizeIP(value: string): SanitizationResult {
    // IPv4 regex
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    // IPv6 regex (simplified)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    const match = value.match(ipv4Regex);
    
    if (match) {
      // Validate octets
      const octets = match.slice(1, 5).map(Number);
      if (octets.every(o => o >= 0 && o <= 255)) {
        return {
          nmapTarget: value,
          originalValue: value,
          sanitized: value,
          isValid: true
        };
      }
      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: false,
        errorMessage: 'Invalid IP address: octets must be 0-255'
      };
    }

    if (ipv6Regex.test(value)) {
      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: true
      };
    }

    return {
      nmapTarget: value,
      originalValue: value,
      sanitized: value,
      isValid: false,
      errorMessage: 'Invalid IP address format'
    };
  }

  /**
   * Sanitize domain name
   */
  private static sanitizeDomain(value: string): SanitizationResult {
    // Remove protocol if present
    let domain = value.replace(/^https?:\/\//, '');
    
    // Remove path if present
    domain = domain.split('/')[0];
    
    // Remove port if present (but keep it noted for user)
    const portMatch = domain.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : null;
    domain = domain.replace(/:\d+$/, '');

    // Validate domain format
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    
    if (!domainRegex.test(domain) && domain !== 'localhost') {
      return {
        nmapTarget: domain,
        originalValue: value,
        sanitized: domain,
        isValid: false,
        errorMessage: 'Invalid domain format'
      };
    }

    const warnings = [];
    if (value !== domain) {
      warnings.push(`Stripped protocol and/or path from domain. Using: ${domain}`);
    }
    if (port) {
      warnings.push(`Port ${port} detected but will use default nmap port scan`);
    }

    return {
      nmapTarget: domain,
      originalValue: value,
      sanitized: domain,
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Sanitize URL - extract hostname
   */
  private static sanitizeURL(value: string): SanitizationResult {
    try {
      // Ensure URL has protocol
      let urlString = value;
      if (!urlString.match(/^https?:\/\//)) {
        urlString = `https://${urlString}`;
      }

      const url = new URL(urlString);
      const hostname = url.hostname;
      const port = url.port;

      // Validate extracted hostname
      const hostnameCheck = hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
        ? this.sanitizeIP(hostname)
        : this.sanitizeDomain(hostname);

      if (!hostnameCheck.isValid) {
        return {
          nmapTarget: hostname,
          originalValue: value,
          sanitized: hostname,
          isValid: false,
          errorMessage: `Invalid hostname extracted from URL: ${hostnameCheck.errorMessage}`
        };
      }

      const warnings = [`Extracted hostname '${hostname}' from URL '${value}'`];
      if (port) {
        warnings.push(`URL specifies port ${port}, but nmap will scan default ports`);
      }
      if (url.pathname !== '/') {
        warnings.push(`URL path '${url.pathname}' ignored (nmap scans hosts, not paths)`);
      }

      return {
        nmapTarget: hostname,
        originalValue: value,
        sanitized: hostname,
        isValid: true,
        warnings
      };
    } catch (error) {
      return {
        nmapTarget: value,
        originalValue: value,
        sanitized: value,
        isValid: false,
        errorMessage: `Failed to parse URL: ${error instanceof Error ? error.message : 'Invalid URL'}`
      };
    }
  }

  /**
   * Sanitize network CIDR notation
   */
  private static sanitizeNetwork(value: string): SanitizationResult {
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      theme: { background: '#1e1e1e' }
    });
    
    // Connect to WebSocket for container I/O
    ws.current = new WebSocket(`ws://localhost:3001/api/v1/metasploit/ws/${operationId}`);
    
    ws.current.onmessage = (event) => {
      terminal.write(event.data);
    };
    
    terminal.onData((data) => {
      ws.current.send(data);
    });
    
    terminal.open(terminalRef.current);
    
    return () => {
      ws.current.close();
      terminal.dispose();
    };
  }, [operationId]);
  
  return <div ref={terminalRef} className="terminal-container" />;
};
```

#### Part B: API Bindings for Agents (HIGH PRIORITY)
```typescript
// server/services/metasploit-api-wrapper.ts

class MetasploitAPIWrapper {
  // RPC/REST API for agent programmatic access
  
  async executeCommand(workspaceId: string, command: string): Promise<CommandResult> {
    // Execute command in workspace-scoped msfconsole
    // Return structured results
  }
  
  async runModule(workspaceId: string, module: ModuleConfig): Promise<ModuleResult> {
    // use [module_path]
    // set RHOSTS, LHOST, etc.
    // run/exploit
    // Parse and return results
  }
  
  async getHosts(workspaceId: string): Promise<Host[]> {
    // Query workspace database: hosts
  }
  
  async getServices(workspaceId: string, hostId?: string): Promise<Service[]> {
    // Query workspace database: services
  }
  
  async getVulns(workspaceId: string): Promise<Vulnerability[]> {
    // Query workspace database: vulns
  }
  
  async getCreds(workspaceId: string): Promise<Credential[]> {
    // Query workspace database: creds
  }
  
  async getLoot(workspaceId: string): Promise<Loot[]> {
    // Query workspace database: loot
  }
}
```

#### Part C: Workspace Management (CRITICAL)
```typescript
// server/services/metasploit-workspace-manager.ts

class MetasploitWorkspaceManager {
  // Map RTPI operations to Metasploit workspaces
  // Ensures customer data isolation
  
  async createWorkspaceForOperation(operationId: string): Promise<string> {
    const workspaceName = `rtpi_op_${operationId}`;
    
    // Execute in msfconsole:
    // workspace -a ${workspaceName}
    
    return workspaceName;
  }
  
  async switchWorkspace(workspaceName: string): Promise<void> {
    // workspace ${workspaceName}
  }
  
  async deleteWorkspace(workspaceName: string, exportFirst: boolean = true): Promise<void> {
    if (exportFirst) {
      // db_export -f xml /backups/${workspaceName}.xml
    }
    // workspace -d ${workspaceName}
  }
  
  async exportWorkspace(workspaceName: string): Promise<string> {
    // db_export -f xml /path/to/export.xml
    // Returns file path
  }
  
  async isolateCustomerData(customerId: string): Promise<Workspace[]> {
    // List all workspaces for a customer
    // Enforce access control
  }
}
```

### Customer Data Segmentation Architecture
```
┌────────────────────────────────────────────────────────────┐
│                    RTPI Application Layer                   │
│  ┌──────────────┐                  ┌──────────────┐        │
│  │ Operation A  │                  │ Operation B  │        │
│  │ Customer 1   │                  │ Customer 2   │        │
│  └──────┬───────┘                  └──────┬───────┘        │
└─────────┼──────────────────────────────────┼───────────────┘
          │                                  │
┌─────────▼──────────────────────────────────▼───────────────┐
│         Metasploit Workspace Manager                        │
│  ┌────────────────────┐      ┌────────────────────┐        │
│  │ workspace rtpi_op_1│      │ workspace rtpi_op_2│        │
│  │ (Customer 1 only)  │      │ (Customer 2 only)  │        │
│  └────────────────────┘      └────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
          │                                  │
┌─────────▼──────────────────────────────────▼───────────────┐
│              PostgreSQL Database                            │
│  - Hosts scoped to workspace                                │
│  - Services scoped to workspace                             │
│  - Vulns scoped to workspace                                │
│  - Creds scoped to workspace                                │
│  - Loot scoped to workspace                                 │
│  - Complete isolation between customers                     │
└─────────────────────────────────────────────────────────────┘
```

### Workspace Lifecycle
```typescript
// When operation created:
1. Create Metasploit workspace: workspace -a rtpi_op_{operation_id}
2. Switch to workspace: workspace rtpi_op_{operation_id}
3. All scans auto-saved to workspace

// During operation:
4. UI terminal connects to workspace
5. Agents use API scoped to workspace
6. Complete data isolation

// When operation completed:
7. Export workspace: db_export -f xml /backups/rtpi_op_{operation_id}.xml
8. Archive in RTPI database
9. Delete workspace: workspace -d rtpi_op_{operation_id}
```

### Testing Checklist
- [ ] Embedded terminal displays msfconsole
- [ ] WebSocket connection established
- [ ] Terminal I/O working (commands → output)
- [ ] Workspace created per operation
- [ ] Data isolated between operations
- [ ] API bindings work for agents
- [ ] Agents can query hosts, services, vulns
- [ ] Workspace export/import functional
- [ ] Multi-user concurrent access
- [ ] Session management working

### Dependencies
- xterm.js library for terminal
- WebSocket support in Express
- Docker container with Metasploit
- PostgreSQL database for workspaces

### Estimated Effort
5-7 days

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

Implement a dedicated scan history system with the following components:

#### 1. Database Migration
Create a new `target_scans` table to replace JSON storage in `targets.metadata`. This provides:
- Better query performance
- Easier filtering and sorting
- Proper indexing for large datasets
- Atomic operations for scan data

#### 2. API Layer Enhancement
```typescript
// server/api/v1/target-scans.ts (NEW FILE)

import { Router } from "express";
import { db } from "../../db";
import { targetScans } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";

const router = Router();
router.use(ensureAuthenticated);

// GET /api/v1/target-scans?targetId=<uuid> - List scans for target
router.get("/", async (req, res) => {
  const { targetId } = req.query;
  
  if (!targetId) {
    return res.status(400).json({ error: "targetId required" });
  }

  try {
    const scans = await db
      .select()
      .from(targetScans)
      .where(eq(targetScans.targetId, targetId as string))
      .orderBy(desc(targetScans.startedAt))
      .limit(100);

    res.json({ scans });
  } catch (error) {
    console.error("List scans error:", error);
    res.status(500).json({ error: "Failed to list scans" });
  }
});

// GET /api/v1/target-scans/:id - Get single scan details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const scan = await db
      .select()
      .from(targetScans)
      .where(eq(targetScans.id, id))
      .limit(1);

    if (!scan || scan.length === 0) {
      return res.status(404).json({ error: "Scan not found" });
    }

    res.json({ scan: scan[0] });
  } catch (error) {
    console.error("Get scan error:", error);
    res.status(500).json({ error: "Failed to get scan" });
  }
});

// DELETE /api/v1/target-scans/:id - Delete scan
router.delete("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;

  try {
    await db.delete(targetScans).where(eq(targetScans.id, id));
    res.json({ message: "Scan deleted successfully" });
  } catch (error) {
    console.error("Delete scan error:", error);
    res.status(500).json({ error: "Failed to delete scan" });
  }
});

export default router;
```

#### 3. Scan Execution Integration
```typescript
// server/services/nmap-scanner.ts (modification)

import { db } from "../db";
import { targetScans } from "@shared/schema";

export async function executeScan(target: Target, user: User): Promise<ScanResult> {
  const startedAt = new Date();
  
  // Create scan record
  const [scanRecord] = await db
    .insert(targetScans)
    .values({
      targetId: target.id,
      scanType: 'nmap',
      command: buildNmapCommand(target),
      startedAt,
      status: 'running',
      scannedBy: user.id,
    })
    .returning();

  try {
    // Execute scan
    const result = await dockerExecutor.exec('nmap-container', [...]);
    
    // Update scan record with results
    await db
      .update(targetScans)
      .set({
        completedAt: new Date(),
        duration: Date.now() - startedAt.getTime(),
        status: 'completed',
        openPorts: result.ports,
        discoveredServices: result.services,
        rawOutput: result.stdout,
        parsedOutput: result.parsed,
      })
      .where(eq(targetScans.id, scanRecord.id));

    return result;
  } catch (error) {
    // Update scan record with error
    await db
      .update(targetScans)
      .set({
        completedAt: new Date(),
        status: 'failed',
        errorMessage: error.message,
      })
      .where(eq(targetScans.id, scanRecord.id));

    throw error;
  }
}
```

#### 4. Frontend Components
```typescript
// client/src/components/targets/ScanHistoryPanel.tsx (NEW FILE)

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface ScanHistoryPanelProps {
  targetId: string;
}

export default function ScanHistoryPanel({ targetId }: ScanHistoryPanelProps) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScans();
  }, [targetId]);

  const loadScans = async () => {
    try {
      const response = await api.get(`/target-scans?targetId=${targetId}`);
      setScans(response.scans || []);
    } catch (error) {
      console.error("Failed to load scans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (scanId: string) => {
    if (!confirm("Delete this scan?")) return;
    
    try {
      await api.delete(`/target-scans/${scanId}`);
      await loadScans();
    } catch (error) {
      console.error("Failed to delete scan:", error);
    }
  };

  return (
    <div className="scan-history-panel">
      <h3 className="text-lg font-semibold mb-4">Scan History</h3>
      
      {loading ? (
        <p>Loading scans...</p>
      ) : scans.length === 0 ? (
        <p className="text-gray-500">No scan history</p>
      ) : (
        <div className="space-y-2">
          {scans.map((scan) => (
            <div key={scan.id} className="p-3 border rounded">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{scan.scanType} Scan</p>
                  <p className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(scan.startedAt), { addSuffix: true })}
                  </p>
                  <p className="text-sm">
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
