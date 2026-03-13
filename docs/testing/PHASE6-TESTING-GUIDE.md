# Phase 6 Testing Guide
**Vulnerability Investigation Workflow & BurpSuite Integration**

This guide covers all testing activities for Phase 6 (v2.3.6).

---

## Quick Start

### Run All Automated Tests
```bash
# Make script executable (first time only)
chmod +x ./scripts/run-phase6-tests.sh

# Run all tests (unit + integration + e2e)
./scripts/run-phase6-tests.sh all

# Run specific test types
./scripts/run-phase6-tests.sh unit
./scripts/run-phase6-tests.sh integration
./scripts/run-phase6-tests.sh e2e
```

### Run Individual Test Files
```bash
# Unit tests
npm run test tests/unit/services/rd-team-agent.test.ts

# Integration tests
npm run test tests/integration/burp-activation.test.ts
npm run test tests/integration/vulnerability-investigation.test.ts

# E2E tests (requires Playwright)
npm run test:e2e tests/e2e/phase6-complete-flow.spec.ts
```

---

## Testing Documentation

### Available Documents

1. **v2.3.6-testing-plan.md** - Comprehensive testing plan with all test suites
2. **phase6-manual-testing-checklist.md** - Step-by-step manual testing checklist (100 items)
3. **phase6-test-report-template.md** - Template for documenting test results

### Test Automation Scripts

1. **tests/integration/burp-activation.test.ts** - BurpSuite activation system tests
2. **tests/integration/vulnerability-investigation.test.ts** - Investigation workflow tests
3. **tests/unit/services/rd-team-agent.test.ts** - R&D Team Agent unit tests
4. **tests/e2e/phase6-complete-flow.spec.ts** - End-to-end Playwright tests

### Helper Scripts

1. **scripts/run-phase6-tests.sh** - Automated test runner with reporting

---

## Test Coverage

### API Endpoints Tested
- ✅ GET /api/v1/burp-activation/status
- ✅ POST /api/v1/burp-activation/upload-jar
- ✅ POST /api/v1/burp-activation/upload-license
- ✅ POST /api/v1/burp-activation/activate
- ✅ POST /api/v1/burp-activation/deactivate
- ✅ DELETE /api/v1/burp-activation/jar
- ✅ DELETE /api/v1/burp-activation/license
- ✅ GET /api/v1/burp-activation/health
- ✅ POST /api/v1/vulnerability-investigation/:id/investigate
- ✅ GET /api/v1/vulnerability-investigation/:id/status

### Agent Functionality Tested
- ✅ R&D Team Agent - CVE research
- ✅ R&D Team Agent - Nuclei template generation
- ✅ R&D Team Agent - Template deployment
- ✅ R&D Team Agent - Template validation
- ✅ BurpSuite Orchestrator - Finding investigation
- ✅ BurpSuite Orchestrator - Active scanning
- ✅ BurpSuite Orchestrator - Evidence collection

### Workflow Components Tested
- ✅ Automatic investigation triggering
- ✅ Severity gating (medium+ only)
- ✅ Template existence checking
- ✅ Agent delegation logic
- ✅ Status transitions
- ✅ Duplicate prevention
- ✅ Error handling
- ✅ Blocker reporting

### UI Components Tested
- ✅ BurpSuite Activation Panel
- ✅ File upload controls
- ✅ Status badges and polling
- ✅ Investigation status display
- ✅ Evidence panels
- ✅ Manual investigation triggers

---

## Test Prerequisites

### Required for All Tests
- Docker and Docker Compose installed
- PostgreSQL database running (rtpi-postgres container)
- All application containers running
- Database migrations applied

### Required for Integration Tests
- Valid authentication session/cookie
- Test operation and target created in database
- Server running on localhost:3001

### Required for E2E Tests
- Playwright browsers installed: `npx playwright install`
- Frontend running on localhost:5000
- Valid admin credentials
- Test data seeded

### Optional but Recommended
- **TAVILY_API_KEY** - For R&D Team Agent CVE research
- **Ollama/RKLLama** - For AI template generation
- **BurpSuite Pro JAR + License** - For full BurpSuite testing
- Internet connectivity - For Tavily API calls

---

## Test Execution Workflow

### 1. Pre-Flight Checks
```bash
# Verify Docker containers
docker compose ps

# Check database
docker compose exec postgres pg_isready -U rtpi

# Verify schema
docker compose exec postgres psql -U rtpi -d rtpi_main -c \
  "SELECT table_name FROM information_schema.tables WHERE table_name IN ('burp_setup', 'nuclei_templates', 'vulnerabilities');"

# Check environment
docker compose exec server env | grep -E "(TAVILY|OLLAMA|BURP)"
```

### 2. Run Automated Tests
```bash
# Run test suite
./scripts/run-phase6-tests.sh all

# Check test report
cat test-reports/phase6-*.md
```

### 3. Perform Manual Testing
- Use `docs/testing/phase6-manual-testing-checklist.md`
- Work through each session systematically
- Document findings in real-time
- Take screenshots of issues

### 4. Document Results
- Fill out `docs/testing/phase6-test-report-template.md`
- Include all test metrics
- Document all issues found
- Provide recommendations

### 5. Update Verification Report
- Update `docs/enhancements/2.3/v2.3-Completion-Verification.md`
- Mark Phase 6 as tested
- Link to test reports
- Note any blockers or issues

---

## Troubleshooting Test Failures

### Test Timeout Issues
**Problem:** Tests timeout waiting for investigation to complete

**Solutions:**
1. Increase timeout in test files (default: 30-60s)
2. Check if agents are initialized properly
3. Verify TAVILY_API_KEY and OLLAMA_HOST are accessible
4. Check Docker logs for agent errors

### Authentication Failures
**Problem:** API calls return 401 Unauthorized

**Solutions:**
1. Ensure test user exists in database
2. Create valid session cookie for tests
3. Use proper authentication middleware in tests
4. Check session store (Redis) is running

### Database Connection Issues
**Problem:** Tests fail with database connection errors

**Solutions:**
1. Verify PostgreSQL container is running
2. Check database credentials match .env configuration
3. Ensure migrations have been applied
4. Check database_url in test configuration

### Container Network Issues
**Problem:** Server cannot reach rtpi-burp-agent or rtpi-tools

**Solutions:**
1. Verify all containers are on rtpi-network
2. Check container names match expectations
3. Test inter-container connectivity: `docker compose exec server ping rtpi-burp-agent`
4. Restart Docker network: `docker compose down && docker compose up -d`

### Template Deployment Failures
**Problem:** Generated templates not appearing in container

**Solutions:**
1. Check volume mounts are correct
2. Verify container user has write permissions
3. Check Docker executor service is working
4. Manually verify: `docker exec rtpi-tools ls -lah /home/rtpi-tools/nuclei-templates/custom/`

---

## Test Data Management

### Creating Test Data
```bash
# Create test operation
curl -X POST http://localhost:3001/api/v1/operations \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{
    "name": "Test Operation - Phase 6",
    "status": "active",
    "description": "Testing Phase 6 functionality"
  }'

# Create test target
curl -X POST http://localhost:3001/api/v1/targets \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{
    "name": "testphp.vulnweb.com",
    "type": "domain",
    "value": "http://testphp.vulnweb.com",
    "operationId": "YOUR_OPERATION_ID"
  }'
```

### Cleaning Up Test Data
```bash
# Clean up test vulnerabilities
docker compose exec postgres psql -U rtpi -d rtpi_main -c \
  "DELETE FROM vulnerabilities WHERE title LIKE '%Test%' OR title LIKE '%E2E%';"

# Clean up test templates
docker compose exec postgres psql -U rtpi -d rtpi_main -c \
  "DELETE FROM nuclei_templates WHERE template_id LIKE 'custom-test-%';"

# Clean up burp setup
docker compose exec postgres psql -U rtpi -d rtpi_main -c \
  "DELETE FROM burp_setup;"
```

---

## Continuous Testing

### Pre-Commit Testing
```bash
# Run unit tests before committing
npm run test tests/unit/services/rd-team-agent.test.ts
```

### Pre-Deploy Testing
```bash
# Run full suite before deploying
./scripts/run-phase6-tests.sh all

# Verify critical paths
npm run test tests/integration/
```

### Post-Deploy Smoke Tests
```bash
# Quick health check after deployment
curl http://localhost:3001/api/v1/burp-activation/status
curl http://localhost:3001/api/health
```

---

## Test Reporting

### Automated Reports
- Location: `test-reports/phase6-[timestamp].md`
- Generated by: `scripts/run-phase6-tests.sh`
- Contains: Pre-test checks, test results, summary

### Manual Test Reports
- Template: `docs/testing/phase6-test-report-template.md`
- Checklist: `docs/testing/phase6-manual-testing-checklist.md`
- Store completed reports in: `test-reports/manual/`

### Test Metrics to Track
- Total test execution time
- Pass/fail rates per suite
- Average investigation completion time
- System resource usage during tests
- Number of issues found per severity

---

## Integration with CI/CD

### GitHub Actions Workflow (Future)
```yaml
# .github/workflows/phase6-tests.yml
name: Phase 6 Tests

on:
  pull_request:
    paths:
      - 'server/api/v1/burp-activation.ts'
      - 'server/api/v1/vulnerability-investigation.ts'
      - 'server/services/agents/rd-team-agent.ts'
      - 'server/services/agents/burpsuite-orchestrator-agent.ts'
      - 'server/services/vulnerability-investigation-workflow.ts'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: docker compose up -d
      - run: npm run test:phase6
```

---

## Additional Resources

### Related Documentation
- `v2.3.6-testing-plan.md` - Detailed test plan
- `v2.3-Completion-Verification.md` - Implementation verification
- `server/services/agents/rd-team-agent.ts` - R&D Team Agent source
- `server/services/agents/burpsuite-orchestrator-agent.ts` - BurpSuite Agent source
- `server/services/vulnerability-investigation-workflow.ts` - Workflow service

### External Resources
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Nuclei Template Guide](https://docs.projectdiscovery.io/nuclei/)
- [BurpSuite API Documentation](https://portswigger.net/burp/documentation)

---

**Last Updated:** 2026-03-11
**Maintained By:** Development Team
