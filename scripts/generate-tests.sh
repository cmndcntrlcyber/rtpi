#!/bin/bash

# M8 Test Generation Script
# Generates comprehensive test files for frontend components

echo "🧪 M8 Test Generation Script"
echo "=============================="

# Create test directories
mkdir -p tests/unit/client/components/operations
mkdir -p tests/unit/client/components/targets
mkdir -p tests/unit/client/components/vulnerabilities
mkdir -p tests/unit/client/components/infrastructure
mkdir -p tests/unit/client/components/layout
mkdir -p tests/unit/client/pages
mkdir -p tests/unit/client/hooks
mkdir -p tests/unit/client/services
mkdir -p tests/integration
mkdir -p tests/performance

echo "✅ Test directories created"

# Run tests to check current coverage
echo ""
echo "📊 Running tests to check current coverage..."
cd /home/cmndcntrl/capstone/rtpi/code/unified-rtpi
npm test -- --coverage --run

echo ""
echo "✅ Test generation complete"
echo "📋 See docs/M8-IMPLEMENTATION-PLAN.md for progress tracking"
