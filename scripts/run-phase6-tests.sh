#!/bin/bash
# Phase 6 Testing Automation Script
# 
# Executes all Phase 6 tests in proper order and generates a test report
# Usage: ./scripts/run-phase6-tests.sh [unit|integration|e2e|all]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_TYPE="${1:-all}"
TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
REPORT_DIR="./test-reports"
REPORT_FILE="$REPORT_DIR/phase6-$TIMESTAMP.md"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Phase 6 Testing Suite${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Create report directory
mkdir -p "$REPORT_DIR"

# Initialize report
cat > "$REPORT_FILE" <<EOF
# Phase 6 Testing Report
**Date:** $(date)
**Test Type:** $TEST_TYPE
**Environment:** $(uname -a)

---

## Pre-Test Checks

EOF

# Function to log to report
log_report() {
  echo "$1" >> "$REPORT_FILE"
}

# Function to run a command and capture result
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  echo -e "${YELLOW}Running: $test_name${NC}"
  log_report "### $test_name"
  log_report ""
  
  if eval "$test_command" >> "$REPORT_FILE" 2>&1; then
    echo -e "${GREEN}✅ PASSED: $test_name${NC}"
    log_report "**Status:** ✅ PASSED"
  else
    echo -e "${RED}❌ FAILED: $test_name${NC}"
    log_report "**Status:** ❌ FAILED"
    log_report ""
    log_report "\`\`\`"
    eval "$test_command" 2>&1 | tail -20 >> "$REPORT_FILE"
    log_report "\`\`\`"
  fi
  
  log_report ""
  echo ""
}

# Pre-Test Checks
echo -e "${BLUE}Running Pre-Test Checks...${NC}"
echo ""

# Check Docker containers
run_test "Docker Containers Running" "docker compose ps | grep -E '(rtpi-burp-agent|rtpi-tools|postgres|server)'"

# Check database connectivity
run_test "Database Connectivity" "docker compose exec -T postgres pg_isready -U rtpi"

# Check burpSetup table exists
run_test "BurpSetup Table Exists" "docker compose exec -T postgres psql -U rtpi -d rtpi_main -c \"SELECT table_name FROM information_schema.tables WHERE table_name = 'burp_setup';\""

# Check investigation columns
run_test "Investigation Columns Exist" "docker compose exec -T postgres psql -U rtpi -d rtpi_main -c \"SELECT column_name FROM information_schema.columns WHERE table_name = 'vulnerabilities' AND column_name LIKE 'investigation%';\""

# Check environment variables
run_test "Environment Variables" "docker compose exec -T server env | grep -E '(TAVILY_API_KEY|OLLAMA_HOST|BURP_MCP_URL)'"

log_report "---"
log_report ""
log_report "## Test Execution Results"
log_report ""

# Run tests based on type
if [ "$TEST_TYPE" = "unit" ] || [ "$TEST_TYPE" = "all" ]; then
  echo -e "${BLUE}Running Unit Tests...${NC}"
  echo ""
  
  run_test "R&D Team Agent Unit Tests" "npm run test -- tests/unit/services/rd-team-agent.test.ts"
fi

if [ "$TEST_TYPE" = "integration" ] || [ "$TEST_TYPE" = "all" ]; then
  echo -e "${BLUE}Running Integration Tests...${NC}"
  echo ""
  
  run_test "BurpSuite Activation Integration Tests" "npm run test -- tests/integration/burp-activation.test.ts"
  run_test "Vulnerability Investigation Integration Tests" "npm run test -- tests/integration/vulnerability-investigation.test.ts"
fi

if [ "$TEST_TYPE" = "e2e" ] || [ "$TEST_TYPE" = "all" ]; then
  echo -e "${BLUE}Running E2E Tests...${NC}"
  echo ""
  
  # Check if browser is installed for Playwright
  if ! npx playwright --version > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Playwright not installed, installing browsers...${NC}"
    npx playwright install
  fi
  
  run_test "Phase 6 Complete Flow E2E Test" "npm run test:e2e -- tests/e2e/phase6-complete-flow.spec.ts"
fi

# Summary
log_report "---"
log_report ""
log_report "## Summary"
log_report ""

PASSED_COUNT=$(grep -c "✅ PASSED" "$REPORT_FILE" || echo "0")
FAILED_COUNT=$(grep -c "❌ FAILED" "$REPORT_FILE" || echo "0")

log_report "- **Total Passed:** $PASSED_COUNT"
log_report "- **Total Failed:** $FAILED_COUNT"
log_report ""

if [ "$FAILED_COUNT" -eq 0 ]; then
  log_report "**Overall Status:** ✅ ALL TESTS PASSED"
  echo -e "${GREEN}================================================${NC}"
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo -e "${GREEN}================================================${NC}"
else
  log_report "**Overall Status:** ❌ SOME TESTS FAILED"
  echo -e "${RED}================================================${NC}"
  echo -e "${RED}❌ $FAILED_COUNT TEST(S) FAILED${NC}"
  echo -e "${RED}================================================${NC}"
fi

echo ""
echo -e "${BLUE}Report saved to: $REPORT_FILE${NC}"
echo ""

# Open report if VS Code is available
if command -v code > /dev/null 2>&1; then
  code "$REPORT_FILE"
fi

exit $([ "$FAILED_COUNT" -eq 0 ] && echo 0 || echo 1)
