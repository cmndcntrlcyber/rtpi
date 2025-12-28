# Distributed Workflow Safety Limits Error

**Date Discovered**: 2025-12-27
**Severity**: High
**Category**: Runtime | Configuration

## Summary

An unhandled error is occurring in the Distributed Workflow Orchestrator service at line 754, where the safety limits validation is throwing an error with the message "Required capabilities not allowed by safety limits". This error appears to be occurring during test execution and indicates that a task requires capabilities that are not permitted by the current autonomy level's safety configuration.

## Error Details

### Command Executed
```bash
npm run dev
# OR
npm test
```

### Error Output
```
Error: Required capabilities not allowed by safety limits
    at distributedWorkflowOrchestrator.validateSafetyLimits
    (server/services/distributed-workflow-orchestrator.ts:754)
```

### Code Location
**File**: `/home/cmndcntrl/rtpi/server/services/distributed-workflow-orchestrator.ts`
**Line**: 754

```typescript
if (task.requiredCapabilities?.length > 0 && !hasAllowedCapability) {
  await this.auditLog(
    workflowId,
    AuditEventType.SAFETY_CHECK,
    {
      check: "capability_restriction",
      violated: true,
      requiredCapabilities: task.requiredCapabilities,
      allowedCapabilities: limits.allowedCapabilities,
    }
  );
  throw new Error(`Required capabilities not allowed by safety limits`);  // LINE 754
}
```

### Environment
- OS: Linux 6.8.0-90-generic
- Runtime Version: Node.js v20.19.6
- Service: Distributed Workflow Orchestrator

## Root Cause Analysis

The error is triggered when a workflow task requests capabilities that are not included in the allowed capabilities list for the current autonomy level. The validation logic works as follows:

1. **Capability Check Logic** (lines 736-754):
   ```typescript
   // For each task, verify all required capabilities are allowed
   for (const task of tasks) {
     const hasAllowedCapability = task.requiredCapabilities?.every((cap) =>
       limits.allowedCapabilities.some((allowed) => cap.includes(allowed))
     );

     if (task.requiredCapabilities?.length > 0 && !hasAllowedCapability) {
       throw new Error(`Required capabilities not allowed by safety limits`);
     }
   }
   ```

2. **Autonomy Level Configuration**: The system has different safety limits based on autonomy level (0-10):
   - **Level 0-2**: Very restricted (read-only, information gathering)
   - **Level 3-5**: Moderate (network scanning, vulnerability testing)
   - **Level 6-8**: High autonomy (exploitation, lateral movement)
   - **Level 9-10**: Full autonomy (all capabilities)

3. **Likely Scenarios**:

   **Scenario A: Test with Wrong Autonomy Level**
   ```typescript
   // Test creates task requiring 'command_execution'
   const tasks = [{
     taskId: "task-1",
     requiredCapabilities: ["command_execution"],
   }];

   // But autonomy level is set to 2 (information gathering only)
   const limits = getSafetyLimits(2);
   // limits.allowedCapabilities = ["read_file", "list_directory", ...]
   // Does NOT include "command_execution"

   await validateSafetyLimits(workflowId, tasks, limits);
   // ERROR: command_execution not in allowed list
   ```

   **Scenario B: Missing Capability in Configuration**
   ```typescript
   // Task requires a new capability
   requiredCapabilities: ["api_interaction"]

   // But this capability was never added to any autonomy level's allowedCapabilities
   ```

   **Scenario C: Incorrect Capability Name**
   ```typescript
   // Task uses incorrect capability string
   requiredCapabilities: ["exec_command"]  // Wrong!

   // Should be:
   requiredCapabilities: ["command_execution"]  // Correct
   ```

## Investigation Steps

To identify the exact cause, we need to:

1. **Check the failing test or workflow**:
   ```bash
   # Find which test is triggering this
   grep -r "requiredCapabilities" tests/ --include="*.test.ts"

   # Find workflow definitions using this
   grep -r "requiredCapabilities" server/services/ --include="*.ts"
   ```

2. **Examine autonomy level configuration**:
   ```typescript
   // In distributed-workflow-orchestrator.ts
   private getSafetyLimits(autonomyLevel: number): SafetyLimits {
     // Log the actual limits being used
     console.log('Autonomy level:', autonomyLevel);
     console.log('Allowed capabilities:', limits.allowedCapabilities);
   }
   ```

3. **Add debugging to the validation point**:
   ```typescript
   if (task.requiredCapabilities?.length > 0 && !hasAllowedCapability) {
     console.error('Task requires:', task.requiredCapabilities);
     console.error('Allowed:', limits.allowedCapabilities);
     console.error('Autonomy level:', autonomyLevel);
     throw new Error(`Required capabilities not allowed by safety limits`);
   }
   ```

4. **Check the test that's failing**:
   ```bash
   # From deployment status report, there was an unhandled error
   # Check rust-nexus integration tests
   npm test -- rust-nexus-integration.test.ts --reporter=verbose
   ```

## Suggested Fixes

### Option 1: Add Missing Capability to Safety Limits (Most Likely)

If a valid capability is missing from the allowed list:

```typescript
private getSafetyLimits(autonomyLevel: number): SafetyLimits {
  // Base limits for all levels
  const baseLimits: SafetyLimits = {
    // ... other limits
  };

  // Level-specific allowed capabilities
  if (autonomyLevel >= 0) {
    baseLimits.allowedCapabilities = [
      "read_file",
      "list_directory",
      "scan_network",
    ];
  }

  if (autonomyLevel >= 3) {
    baseLimits.allowedCapabilities.push(
      "vulnerability_scan",
      "port_scan",
      "service_enumeration",
    );
  }

  if (autonomyLevel >= 5) {
    baseLimits.allowedCapabilities.push(
      "command_execution",  // Add if missing
      "exploit_execution",
    );
  }

  // ... more levels

  return baseLimits;
}
```

### Option 2: Fix Test Configuration

If the test is using an incorrect autonomy level:

```typescript
// In rust-nexus-integration.test.ts or wherever the test is

it("should validate safety limits", async () => {
  const workflowId = "test-workflow-123";
  const tasks = [{
    taskId: "task-1",
    taskName: "Test Task",
    command: "echo 'test'",
    requiredCapabilities: ["command_execution"],
  }];

  // BEFORE (wrong - level too low)
  // const limits = getSafetyLimits(2);

  // AFTER (correct - level high enough for command execution)
  const limits = getSafetyLimits(5);

  await validateSafetyLimits(workflowId, tasks, limits);
});
```

### Option 3: Make Capability Validation More Flexible

Add a "bypass" mode for tests or special cases:

```typescript
async validateSafetyLimits(
  workflowId: string,
  tasks: any[],
  limits: SafetyLimits,
  options: { bypassCapabilityCheck?: boolean } = {}
): Promise<void> {
  // ... other validations

  // Capability validation
  if (!options.bypassCapabilityCheck) {
    for (const task of tasks) {
      const hasAllowedCapability = task.requiredCapabilities?.every((cap) =>
        limits.allowedCapabilities.some((allowed) => cap.includes(allowed))
      );

      if (task.requiredCapabilities?.length > 0 && !hasAllowedCapability) {
        await this.auditLog(/* ... */);
        throw new Error(`Required capabilities not allowed by safety limits`);
      }
    }
  }

  // ... rest of validation
}
```

### Option 4: Better Error Message with Suggestions

Improve the error to be more actionable:

```typescript
if (task.requiredCapabilities?.length > 0 && !hasAllowedCapability) {
  const missingCapabilities = task.requiredCapabilities.filter(
    (cap) => !limits.allowedCapabilities.some((allowed) => cap.includes(allowed))
  );

  await this.auditLog(/* ... */);

  const error = new Error(
    `Required capabilities not allowed by safety limits.\n` +
    `Task "${task.taskName || task.taskId}" requires: ${missingCapabilities.join(', ')}\n` +
    `Current autonomy level allows: ${limits.allowedCapabilities.join(', ')}\n` +
    `Suggestion: Increase autonomy level or adjust task capabilities.`
  );

  (error as any).code = 'CAPABILITY_NOT_ALLOWED';
  (error as any).details = {
    taskId: task.taskId,
    required: task.requiredCapabilities,
    allowed: limits.allowedCapabilities,
    missing: missingCapabilities,
  };

  throw error;
}
```

## Recommended Solution

**Implement a combination of Option 1 and Option 4**:

1. **First, identify the missing capability** by adding better error messages (Option 4)
2. **Then, add the capability to the appropriate autonomy level** (Option 1)
3. **Update any tests** to use the correct autonomy level (Option 2)

**Implementation Steps**:

```typescript
// Step 1: Better error message
if (task.requiredCapabilities?.length > 0 && !hasAllowedCapability) {
  const missingCapabilities = task.requiredCapabilities.filter(
    (cap) => !limits.allowedCapabilities.some((allowed) => cap.includes(allowed))
  );

  await this.auditLog(
    workflowId,
    AuditEventType.SAFETY_CHECK,
    {
      check: "capability_restriction",
      violated: true,
      requiredCapabilities: task.requiredCapabilities,
      allowedCapabilities: limits.allowedCapabilities,
      missingCapabilities,
      taskId: task.taskId,
      taskName: task.taskName,
    }
  );

  throw new Error(
    `Safety limit violation: Task "${task.taskName || task.taskId}" requires capabilities ` +
    `[${missingCapabilities.join(', ')}] which are not allowed at current autonomy level. ` +
    `Allowed capabilities: [${limits.allowedCapabilities.join(', ')}]`
  );
}

// Step 2: Review and update getSafetyLimits() to include all necessary capabilities
// Step 3: Update tests to use appropriate autonomy levels
```

## Prevention

To prevent similar configuration issues:

1. **Centralize Capability Definitions**
   ```typescript
   // shared/types/capabilities.ts
   export enum WorkflowCapability {
     READ_FILE = "read_file",
     WRITE_FILE = "write_file",
     LIST_DIRECTORY = "list_directory",
     COMMAND_EXECUTION = "command_execution",
     NETWORK_SCAN = "network_scan",
     VULNERABILITY_SCAN = "vulnerability_scan",
     EXPLOIT_EXECUTION = "exploit_execution",
     API_INTERACTION = "api_interaction",
     // ... etc
   }

   export const CAPABILITY_LEVELS: Record<number, WorkflowCapability[]> = {
     1: [WorkflowCapability.READ_FILE, WorkflowCapability.LIST_DIRECTORY],
     3: [WorkflowCapability.NETWORK_SCAN, WorkflowCapability.VULNERABILITY_SCAN],
     5: [WorkflowCapability.COMMAND_EXECUTION, WorkflowCapability.API_INTERACTION],
     // ... etc
   };
   ```

2. **Validation at Task Creation**
   ```typescript
   function createTask(config: TaskConfig): Task {
     // Validate capabilities are recognized
     const unknownCapabilities = config.requiredCapabilities?.filter(
       (cap) => !Object.values(WorkflowCapability).includes(cap as any)
     );

     if (unknownCapabilities?.length > 0) {
       throw new Error(
         `Unknown capabilities: ${unknownCapabilities.join(', ')}. ` +
         `Valid capabilities: ${Object.values(WorkflowCapability).join(', ')}`
       );
     }

     return { ...config };
   }
   ```

3. **Documentation**
   ```markdown
   # Workflow Capabilities and Autonomy Levels

   | Autonomy Level | Allowed Capabilities |
   |----------------|---------------------|
   | 0-2 | read_file, list_directory, scan_network |
   | 3-5 | + vulnerability_scan, command_execution, api_interaction |
   | 6-8 | + exploit_execution, lateral_movement, credential_dumping |
   | 9-10 | All capabilities (full autonomy) |

   ## Adding New Capabilities

   1. Add to `WorkflowCapability` enum
   2. Add to appropriate autonomy level in `CAPABILITY_LEVELS`
   3. Update documentation
   4. Write tests for the new capability
   ```

4. **Unit Tests for Capability Configuration**
   ```typescript
   describe('Safety Limits Configuration', () => {
     it('should have cumulative capabilities (higher levels include lower)', () => {
       const level2 = getSafetyLimits(2);
       const level5 = getSafetyLimits(5);

       // Level 5 should include all level 2 capabilities
       level2.allowedCapabilities.forEach((cap) => {
         expect(level5.allowedCapabilities).toContain(cap);
       });
     });

     it('should not have gaps in capability levels', () => {
       for (let level = 0; level <= 10; level++) {
         const limits = getSafetyLimits(level);
         expect(limits.allowedCapabilities.length).toBeGreaterThan(0);
       }
     });
   });
   ```

## Related Issues

- Workflow autonomy level configuration
- Task capability requirements
- Safety limit validation in distributed workflows
- AI agent safety constraints

## Impact Assessment

**Current Impact**:
- **Severity**: High (blocks workflow execution)
- Workflows fail when tasks require disallowed capabilities
- May occur in production if autonomy levels are misconfigured
- Could prevent legitimate red team operations

**Post-Fix Impact**:
- Clear error messages guide users to fix configuration
- All valid capabilities are properly mapped to autonomy levels
- Tests validate capability configurations
- Reduced operational friction

**Production Risk**:
- **High**: If this occurs in production, automated workflows will fail
- **Mitigation**: Ensure all production workflows are tested with realistic autonomy levels
- **Monitoring**: Add alerts for repeated safety limit violations

## Next Steps

1. Run tests with verbose logging to identify the exact missing capability
2. Check recent commits for new capabilities that weren't added to safety limits
3. Review rust-nexus integration tests for capability requirements
4. Implement better error messages
5. Add missing capabilities to appropriate autonomy levels
6. Create documentation for capability-autonomy mapping
7. Add unit tests for capability configuration

## Testing Checklist

After fix implementation:

- [ ] All existing tests pass
- [ ] New test for the previously failing scenario
- [ ] Verify error messages are clear and actionable
- [ ] Test with multiple autonomy levels (0, 2, 5, 8, 10)
- [ ] Verify capability validation doesn't break legitimate workflows
- [ ] Check audit logs contain helpful debugging information
- [ ] Update documentation with capability-level mapping
