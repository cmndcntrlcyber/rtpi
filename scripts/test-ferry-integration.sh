#!/usr/bin/env bash
# Ferry Integration Test — v3.10.3a Sprint 5.2
#
# Verifies the complete ferry round-trip:
#   RTPI Express → ferry-client.ts → rust-nexus REST gateway → gRPC → result
#
# Prerequisites:
#   - rust-nexus running on port 9100 (docker compose up in rust-nexus/)
#   - RTPI backend running with FF_FERRY_BRIDGE=true
#
# Usage:
#   FF_FERRY_BRIDGE=true npm run dev &
#   bash scripts/test-ferry-integration.sh

set -euo pipefail

RTPI_URL="${RTPI_URL:-http://localhost:3001}"
FERRY_URL="${NEXUS_FERRY_URL:-http://127.0.0.1:9100}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "0" ]; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Ferry Integration Test ==="
echo ""

# 1. Check ferry gateway is reachable directly
echo "1. Direct ferry gateway checks:"
curl -sf "$FERRY_URL/ferry/health" > /dev/null 2>&1
check "GET /ferry/health (direct)" "$?"

curl -sf "$FERRY_URL/ferry/agents" > /dev/null 2>&1
check "GET /ferry/agents (direct)" "$?"

curl -sf "$FERRY_URL/ferry/anomaly" > /dev/null 2>&1
check "GET /ferry/anomaly (direct)" "$?"

echo ""

# 2. Check RTPI ferry proxy routes
echo "2. RTPI ferry proxy routes:"
HEALTH=$(curl -sf "$RTPI_URL/api/v1/ferry/health" 2>/dev/null)
echo "$HEALTH" | grep -q '"status"' > /dev/null 2>&1
check "GET /api/v1/ferry/health" "$?"

curl -sf "$RTPI_URL/api/v1/ferry/agents" > /dev/null 2>&1
check "GET /api/v1/ferry/agents" "$?"

curl -sf "$RTPI_URL/api/v1/ferry/anomaly" > /dev/null 2>&1
check "GET /api/v1/ferry/anomaly" "$?"

echo ""

# 3. Check feature flag is exposed
echo "3. Feature flag check:"
FLAGS=$(curl -sf "$RTPI_URL/api/v1/settings/features" 2>/dev/null)
echo "$FLAGS" | grep -q '"ferryBridge"' > /dev/null 2>&1
check "FF_FERRY_BRIDGE in settings/features" "$?"

echo ""

# 4. Check harness evaluations route is mounted
echo "4. Harness evaluations route:"
curl -sf "$RTPI_URL/api/v1/harness-evaluations" > /dev/null 2>&1
check "GET /api/v1/harness-evaluations (mounted)" "$?"

echo ""

# 5. Check orchestrator health via ferry
echo "5. Orchestrator ferry path:"
ORCH_HEALTH=$(curl -sf "$RTPI_URL/api/v1/orchestrator/health" 2>/dev/null)
echo "$ORCH_HEALTH" | grep -q '"status"' > /dev/null 2>&1
check "GET /api/v1/orchestrator/health (via ferry)" "$?"

echo ""

# 6. Check skill search includes ferry skills
echo "6. Skill catalog integration:"
SKILLS=$(curl -sf -X POST "$RTPI_URL/api/v1/skills/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "nmap"}' 2>/dev/null)
echo "$SKILLS" | grep -q 'offense/recon/nmap-scan' > /dev/null 2>&1
check "POST /skills/search includes ferry skills" "$?"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
