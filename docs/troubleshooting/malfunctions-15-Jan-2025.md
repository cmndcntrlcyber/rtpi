Comprehensive RTPI Malfunction Investigation & Repair Plan
Issue #1: Ollama AI Page - Complete Rendering Failure ❌ CRITICAL
Investigation Findings
Root Cause Analysis:

Error: TypeError: models.map is not a function at ModelManager.tsx:449
API Response: {"models": []}
Problem: The component expects models to be an array but the API returns an object with a models property

Technical Details:

File: src/components/ollama/ModelManager.tsx (line 449)
The component is likely doing: models.map(...)
But it should be doing: models.models.map(...) OR the API response should be destructured properly
This is a data structure mismatch between API contract and component expectations

Repair Plan
Option A: Fix the Component (RECOMMENDED)
typescript// In src/components/ollama/ModelManager.tsx around line 449

// CURRENT (BROKEN):
const { data: models } = useQuery(['ollama-models'], fetchModels);
return models.map(...) // ❌ models is {models: []}

// FIX:
const { data: response } = useQuery(['ollama-models'], fetchModels);
const models = response?.models || [];
return models.map(...) // ✅ models is now []
Option B: Fix the API Response
typescript// In the API endpoint that returns /api/v1/ollama/models
// Change from:
return { models: [] }

// To:
return []  // Return array directly
Implementation Steps:

Locate src/components/ollama/ModelManager.tsx
Find the useQuery hook that fetches Ollama models (around line 449)
Add proper data destructuring: const models = data?.models || []
Ensure all .map() calls have a fallback for empty data
Add TypeScript interfaces to prevent this type mismatch in the future
Test with empty array and populated array responses

Validation:

Page should load without errors
Empty state should display when no models exist
Models should display correctly when API returns data


Issue #2: User Management Page - 404 Not Found ❌ CRITICAL
Investigation Findings
Root Cause Analysis:

URL: /user-management returns 404
Problem: Route exists in sidebar navigation but not in routing configuration
Observation: File src/pages/Users.tsx exists in the codebase but route is not registered

Technical Details:

The sidebar links to /user-management
The router configuration doesn't have this route defined
The component file exists as src/pages/Users.tsx

Repair Plan
Step 1: Locate Router Configuration

File is likely src/App.tsx or a dedicated router file

Step 2: Add Missing Route
typescript// In src/App.tsx or router configuration file

import Users from './pages/Users';

// Add to router:
<Route path="/user-management" component={Users} />
// OR
<Route path="/users" component={Users} />
Step 3: Update Sidebar Navigation (if needed)
typescript// Ensure sidebar link matches the route
// If route is /users, update sidebar from:
href="/user-management"
// To:
href="/users"
Implementation Steps:

Open src/App.tsx and locate the <Switch> or routing configuration
Add the missing route for User Management
Import the Users component if not already imported
Verify the sidebar link matches the route path
Test navigation from sidebar to user management page

Validation:

Clicking "User Management" in sidebar should load the page
URL should be accessible directly
No 404 error should appear


Issue #3: Surface Assessment - Intermittent Loading Issues ⚠️ MODERATE
Investigation Findings
Root Cause Analysis:

Status: Page loads successfully on second attempt
Problem: Intermittent infinite loading state, possibly race condition or session timeout
API Calls: All API calls succeed when working
Observation: First navigation attempt sometimes triggers session logout

Technical Details:

URL: /surface-assessment
API endpoint called: /api/v1/surface-assessment/{operationId}/overview
Initial load sometimes gets stuck in loading state
Successful loads show operation ID: baadcd58-576e-4b9c-95e5-301f55fc8a25

Repair Plan
Hypothesis: Missing Operation Selection
The page requires an operation to be selected but there's no default handling when no operation is selected.
Step 1: Add Operation Selection Handling
typescript// In src/pages/SurfaceAssessment.tsx

const SurfaceAssessment = () => {
  const { data: operations, isLoading: opsLoading } = useQuery(['operations'], fetchOperations);
  const [selectedOp, setSelectedOp] = useState(null);
  
  // ADD THIS:
  useEffect(() => {
    if (operations && operations.length > 0 && !selectedOp) {
      // Auto-select first operation if none selected
      setSelectedOp(operations[0]);
    }
  }, [operations, selectedOp]);
  
  // Add loading state check
  if (opsLoading) {
    return <LoadingSpinner />;
  }
  
  if (!selectedOp) {
    return <NoOperationSelected />;
  }
  
  // Rest of component...
};
Step 2: Add Error Boundary
typescript// Wrap Surface Assessment with error boundary
<ErrorBoundary fallback={<ErrorPage />}>
  <SurfaceAssessment />
</ErrorBoundary>
Step 3: Add Timeout Handling
typescript// In API query configuration
useQuery(['surface-assessment', operationId], fetchAssessment, {
  retry: 3,
  retryDelay: 1000,
  timeout: 10000, // 10 second timeout
  onError: (error) => {
    // Handle timeout gracefully
  }
});
Implementation Steps:

Locate src/pages/SurfaceAssessment.tsx
Add operation selection logic with auto-select for first operation
Add proper loading states for initial data fetch
Implement timeout handling for API calls
Add error boundary to catch and display errors
Add fallback UI for missing data scenarios

Validation:

Page should load consistently on first attempt
Loading spinner should appear briefly then content loads
No session timeouts should occur
Error states should be handled gracefully


Issue #4: ATT&CK Workbench Connection Failure ⚠️ SERVICE DEPENDENCY
Investigation Findings
Root Cause Analysis:

API Endpoint: /api/v1/workbench/health returns 503
Response: {"status": "disconnected", "message": "Unable to reach Workbench API", "apiUrl": "http://localhost:3010"}
Problem: External Workbench service is not running or not accessible
Expected URL: http://localhost:3010

Technical Details:

This is an external service dependency (ATT&CK Workbench)
The RTPI backend tries to proxy/connect to Workbench at localhost:3010
Service is configured but not running

Repair Plan
This is NOT a code bug - it's a service configuration issue
Option A: Start the Workbench Service
Step 1: Check if Workbench is installed
bash# Look for ATT&CK Workbench installation
ps aux | grep workbench
# Or check Docker containers
docker ps | grep workbench
Step 2: Start Workbench Service
bash# If using Docker:
docker-compose up -d workbench

# If using standalone:
cd /path/to/attack-workbench
npm start -- --port 3010
Option B: Update Configuration
If Workbench is running on a different port/host:
typescript// In backend configuration (likely env file or config)
WORKBENCH_API_URL=http://localhost:3010  // Update to correct URL
Option C: Make Feature Optional
Add graceful degradation:
typescript// In the Workbench component
if (workbenchStatus === 'disconnected') {
  return (
    <Alert variant="warning">
      ATT&CK Workbench is not available. 
      You can still use RTPI features without Workbench integration.
      <Button onClick={retryConnection}>Retry Connection</Button>
    </Alert>
  );
}
Implementation Steps:

Verify if ATT&CK Workbench should be running
Check service status and logs
Start Workbench service if needed
Verify port 3010 is accessible and not blocked by firewall
Update configuration if Workbench is on different URL
Consider adding reconnection logic in frontend
Add better error messaging for users

Validation:

Workbench health check should return status 200
"Disconnected" message should disappear
Sync buttons should become functional
Collections should be accessible


Additional Recommendations
1. Add Error Boundaries (from console warnings)
typescript// Create src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Caught error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

// Wrap components:
<ErrorBoundary>
  <OllamaPage />
</ErrorBoundary>
2. Fix Accessibility Warnings
Multiple warnings about missing aria-describedby for DialogContent:
typescript// Add to all Dialog components:
<DialogContent aria-describedby="dialog-description">
  <DialogDescription id="dialog-description">
    {/* Description text */}
  </DialogDescription>
  {/* Rest of content */}
</DialogContent>
3. Add API Response Type Validation
typescript// Use Zod or similar for runtime validation
import { z } from 'zod';

const OllamaModelsSchema = z.object({
  models: z.array(z.object({
    name: z.string(),
    // other fields...
  }))
});

// In API calls:
const response = await fetch('/api/v1/ollama/models');
const data = OllamaModelsSchema.parse(await response.json());
// Will throw if structure doesn't match

Priority Order for Fixes

CRITICAL - Issue #1 (Ollama): 30 minutes - Complete page failure
CRITICAL - Issue #2 (User Management): 15 minutes - Missing route
MODERATE - Issue #3 (Surface Assessment): 1-2 hours - Intermittent loading
LOW - Issue #4 (Workbench): 30 minutes - External service dependency

Total Estimated Time: 3-4 hours for all critical and moderate fixes

Testing Checklist
After implementing fixes:

 Ollama page loads without errors
 Ollama shows empty state when no models exist
 User Management page accessible from sidebar
 User Management page loads correctly
 Surface Assessment loads consistently on first try
 Surface Assessment handles missing operations gracefully
 Workbench connection status displays correctly
 All error boundaries catch component errors
 No console errors on any page
 Accessibility warnings resolved
