# Empire Executor Listener Validation Test Failure

**Date Discovered**: 2025-12-27
**Severity**: High
**Category**: Testing

## Summary

The Empire Executor security test `should create listener with validated parameters` is failing with an assertion error where `result.success` is returning `false` instead of the expected `true`. This indicates that the listener creation flow is not completing successfully even when provided with valid mock data.

## Error Details

### Command Executed
```bash
npm test
```

### Error Output
```
× tests/unit/services/empire-executor.test.ts > Empire Executor Security Tests > Listener Management Security > should create listener with validated parameters
   → expected false to be true // Object.is equality
```

### Test Code Location
**File**: `/home/cmndcntrl/rtpi/tests/unit/services/empire-executor.test.ts`
**Lines**: 678-716

### Test Implementation
```typescript
it('should create listener with validated parameters', async () => {
  const mockServer = {
    id: 'server-1',
    name: 'Test Empire Server',
    restApiUrl: 'https://empire.local:1337',
    isActive: true,
  };

  const mockToken = {
    id: 'token-1',
    permanentToken: 'valid-token',
  };

  mockDbQuery.empireServers.findFirst.mockResolvedValue(mockServer);
  mockDbQuery.empireUserTokens.findFirst.mockResolvedValue(mockToken);
  mockAxiosInstance.post.mockResolvedValue({
    data: {
      ID: 1,
      name: 'http-listener',
      listener_type: 'http',
      listener_category: 'http',
      enabled: true,
      options: {},
      created_at: new Date().toISOString(),
    },
  });

  const empireExecutor = await getEmpireExecutor();
  const result = await empireExecutor.createListener('server-1', 'user-1', {
    name: 'http-listener',
    listenerType: 'http',
    host: '0.0.0.0',
    port: 80,
    defaultDelay: 5,
    defaultJitter: 0.0,
  });

  expect(result.success).toBe(true); // FAILS HERE
});
```

### Environment
- OS: Linux 6.8.0-90-generic
- Runtime Version: Node.js v20.19.6
- Test Framework: Vitest 1.6.1

## Root Cause Analysis

The test is failing because the `createListener` method in the Empire Executor service is returning a result object with `success: false`. Based on the test structure, the likely causes are:

1. **Mock Response Mismatch**: The Empire API response structure may have changed or the mock doesn't match what the service expects. The service might be checking for specific fields that aren't in the mock response.

2. **Validation Logic Issue**: The listener creation method may have validation logic that's rejecting the parameters despite them being valid. The parameters include:
   - `name: 'http-listener'`
   - `listenerType: 'http'`
   - `host: '0.0.0.0'`
   - `port: 80`
   - `defaultDelay: 5`
   - `defaultJitter: 0.0`

3. **Error Handling Path**: The service may be catching an error during processing and returning `success: false` rather than throwing an exception.

4. **Missing Mock Configuration**: There may be additional axios method calls (like `get` or `put`) that aren't being mocked, causing the service to fail silently.

## Investigation Steps

To identify the exact cause, the following investigation is needed:

1. **Add Debug Logging**: Temporarily add console.log statements in the `createListener` method to see where it's failing:
   ```typescript
   console.log('Server lookup result:', server);
   console.log('Token lookup result:', token);
   console.log('API response:', response);
   console.log('Validation result:', validationResult);
   ```

2. **Check Service Implementation**: Review the actual `createListener` implementation in the Empire Executor service to understand:
   - What fields it expects in the API response
   - What validation it performs
   - What conditions cause it to return `success: false`

3. **Verify Mock Coverage**: Ensure all HTTP requests made by `createListener` are properly mocked

4. **Check Error Messages**: Modify the test to log the error message from the result:
   ```typescript
   if (!result.success) {
     console.log('Error message:', result.error);
   }
   expect(result.success).toBe(true);
   ```

## Suggested Fixes

### Option 1: Fix Mock Response Structure (Most Likely)

Review the Empire Executor service implementation and update the mock to match the expected response structure:

```typescript
mockAxiosInstance.post.mockResolvedValue({
  data: {
    success: true,  // Add if service checks for this
    listener: {     // Wrap in 'listener' object if service expects it
      ID: 1,
      name: 'http-listener',
      listener_type: 'http',
      listener_category: 'http',
      enabled: true,
      options: {},
      created_at: new Date().toISOString(),
    },
  },
});
```

### Option 2: Fix Axios Mock Configuration

Ensure all HTTP methods called by the service are mocked:

```typescript
// Mock token validation call if it exists
mockAxiosInstance.get.mockResolvedValue({
  data: { valid: true }
});

// Mock listener creation
mockAxiosInstance.post.mockResolvedValue({
  data: { /* ... */ }
});
```

### Option 3: Fix Service Validation Logic

If the service has overly strict validation, adjust it to properly handle valid inputs:

```typescript
// In empire-executor.ts (hypothetical fix)
async createListener(serverId, userId, options) {
  // Validate required fields
  if (!options.name || !options.listenerType) {
    return { success: false, error: 'Missing required fields' };
  }

  // Don't fail on default values
  const listenerConfig = {
    name: options.name,
    type: options.listenerType,
    Host: options.host || '0.0.0.0',  // Use defaults
    Port: options.port || 80,
    DefaultDelay: options.defaultDelay || 5,
    DefaultJitter: options.defaultJitter || 0.0,
  };

  // ... rest of implementation
}
```

### Option 4: Add Better Test Diagnostics

Improve the test to provide more information about failures:

```typescript
const result = await empireExecutor.createListener('server-1', 'user-1', {
  name: 'http-listener',
  listenerType: 'http',
  host: '0.0.0.0',
  port: 80,
  defaultDelay: 5,
  defaultJitter: 0.0,
});

// Better assertion with error details
expect(result).toMatchObject({
  success: true,
  error: expect.any(Object),  // Optional
});

if (!result.success) {
  console.error('Listener creation failed:', result.error);
}
```

## Prevention

To prevent similar issues in the future:

1. **Response Type Contracts**: Define TypeScript interfaces for Empire API responses and ensure mocks conform to them:
   ```typescript
   interface EmpireListenerResponse {
     ID: number;
     name: string;
     listener_type: string;
     enabled: boolean;
     // ... other fields
   }
   ```

2. **Mock Factories**: Create helper functions to generate consistent mocks:
   ```typescript
   function createMockListenerResponse(overrides = {}): EmpireListenerResponse {
     return {
       ID: 1,
       name: 'test-listener',
       listener_type: 'http',
       enabled: true,
       ...overrides,
     };
   }
   ```

3. **Integration Tests**: Add integration tests that use a real Empire server (in CI/CD) to catch API contract changes

4. **Better Error Messages**: Ensure all service methods return descriptive error messages:
   ```typescript
   return {
     success: false,
     error: 'Failed to create listener: Invalid response from Empire API',
     details: { expectedFields: [...], receivedFields: [...] }
   };
   ```

## Related Issues

- Similar test failures may exist for other Empire Executor methods (stager generation, agent management)
- Empire API documentation: https://bc-security.gitbook.io/empire-wiki/quickstart/rest-api
- PowerShell Empire REST API changes should be tracked in project dependencies

## Next Steps

1. Add debug logging to identify exact failure point
2. Review Empire Executor service implementation
3. Update mock response structure to match service expectations
4. Verify all axios calls are properly mocked
5. Re-run tests to confirm fix
6. Add regression test to prevent future failures

## Impact

**Current Impact**:
- CI/CD pipeline shows test failures (4% of tests failing)
- Reduces confidence in Empire integration functionality
- May hide actual bugs in listener creation logic

**Potential Production Impact**:
- If test is correct and service is broken, listener creation would fail in production
- Red team operators would be unable to set up C2 listeners via RTPI
- Manual Empire server configuration would be required as workaround
