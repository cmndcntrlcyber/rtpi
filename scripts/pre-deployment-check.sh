#!/bin/bash
# RTPI Pre-Deployment Check Script
# Validates prerequisites before attempting deployment
# Version: 1.0.0
# Date: 2026-02-27

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Functions
print_header() {
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_command() {
    if command -v $1 &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_fail "$1 is not installed"
        return 1
    fi
}

# Start checks
print_header "RTPI Pre-Deployment Checks"
echo ""

# Check 1: Docker daemon
print_header "Checking Docker"
if systemctl is-active --quiet docker 2>/dev/null || pgrep -x dockerd > /dev/null; then
    print_success "Docker daemon is running"
    
    # Check Docker version
    DOCKER_VERSION=$(docker --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)
    if [ ! -z "$DOCKER_VERSION" ]; then
        MAJOR=$(echo $DOCKER_VERSION | cut -d. -f1)
        if [ "$MAJOR" -ge 24 ]; then
            print_success "Docker version $DOCKER_VERSION (>= 24.0 required)"
        else
            print_warning "Docker version $DOCKER_VERSION (24.0+ recommended)"
        fi
    fi
else
    print_fail "Docker daemon is not running"
    print_info "Start Docker with: sudo systemctl start docker"
fi

# Check 2: Docker Compose
print_header "Checking Docker Compose"
if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)
    print_success "Docker Compose $COMPOSE_VERSION is installed"
else
    print_fail "Docker Compose is not installed"
    print_info "Install with: sudo apt install docker-compose-plugin"
fi

# Check 3: Docker permissions
print_header "Checking Docker Permissions"
if docker ps &> /dev/null; then
    print_success "Docker commands can run without sudo"
elif sudo docker ps &> /dev/null; then
    print_warning "Docker requires sudo (user not in docker group)"
    print_info "Add user to docker group: sudo usermod -aG docker \$USER"
    print_info "Then log out and log back in"
else
    print_fail "Cannot access Docker (daemon not running or no permissions)"
fi

# Check 4: Disk space
print_header "Checking Disk Space"
DOCKER_ROOT=$(docker info 2>/dev/null | grep "Docker Root Dir" | awk '{print $4}')
if [ -z "$DOCKER_ROOT" ]; then
    DOCKER_ROOT="/var/lib/docker"
fi

AVAILABLE_GB=$(df -BG "$DOCKER_ROOT" | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$AVAILABLE_GB" -ge 50 ]; then
    print_success "Disk space: ${AVAILABLE_GB}GB available (50GB+ required for full deployment)"
elif [ "$AVAILABLE_GB" -ge 20 ]; then
    print_warning "Disk space: ${AVAILABLE_GB}GB available (sufficient for core only, 50GB+ needed for OffSec agents)"
elif [ "$AVAILABLE_GB" -ge 10 ]; then
    print_warning "Disk space: ${AVAILABLE_GB}GB available (limited - only core services recommended)"
else
    print_fail "Disk space: ${AVAILABLE_GB}GB available (insufficient - 20GB+ required)"
    print_info "Free up space or move Docker to larger disk"
fi

# Check 5: Memory
print_header "Checking System Memory"
TOTAL_MEM_GB=$(free -g | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM_GB" -ge 8 ]; then
    print_success "System memory: ${TOTAL_MEM_GB}GB (8GB+ recommended)"
elif [ "$TOTAL_MEM_GB" -ge 4 ]; then
    print_warning "System memory: ${TOTAL_MEM_GB}GB (4GB minimum, 8GB+ recommended)"
else
    print_fail "System memory: ${TOTAL_MEM_GB}GB (insufficient - 4GB+ required)"
fi

# Check 6: Port availability
print_header "Checking Port Availability"
check_port() {
    PORT=$1
    NAME=$2
    if ! sudo netstat -tlnp 2>/dev/null | grep -q ":$PORT "; then
        print_success "Port $PORT is available ($NAME)"
    else
        print_warning "Port $PORT is in use ($NAME)"
        PROCESS=$(sudo netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}')
        print_info "Used by: $PROCESS"
    fi
}

check_port 5434 "PostgreSQL"
check_port 6381 "Redis"
check_port 1337 "Empire API"
check_port 3010 "Workbench API"
check_port 27017 "MongoDB"

# Check 7: .env file
print_header "Checking Environment Configuration"
if [ -f ".env" ]; then
    print_success ".env file exists"
    
    # Check for critical variables
    if grep -q "DATABASE_URL=" .env && [ -n "$(grep DATABASE_URL= .env | cut -d= -f2)" ]; then
        print_success "DATABASE_URL is configured"
    else
        print_warning "DATABASE_URL is not configured"
    fi
    
    if grep -q "REDIS_PASSWORD=" .env && [ -n "$(grep REDIS_PASSWORD= .env | cut -d= -f2)" ]; then
        print_success "REDIS_PASSWORD is configured"
    else
        print_warning "REDIS_PASSWORD is not configured (recommended for production)"
    fi
    
    if grep -q "SESSION_SECRET=" .env && [ -n "$(grep SESSION_SECRET= .env | cut -d= -f2)" ]; then
        print_success "SESSION_SECRET is configured"
    else
        print_fail "SESSION_SECRET is not configured (required)"
        print_info "Generate with: openssl rand -base64 32"
    fi
    
    if grep -q "JWT_SECRET=" .env && [ -n "$(grep JWT_SECRET= .env | cut -d= -f2)" ]; then
        print_success "JWT_SECRET is configured"
    else
        print_fail "JWT_SECRET is not configured (required)"
        print_info "Generate with: openssl rand -base64 64"
    fi
else
    print_fail ".env file not found"
    print_info "Create from template: cp .env.example .env"
fi

# Check 8: Node.js (optional)
print_header "Checking Optional Tools"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | grep -oP '\d+' | head -1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        print_success "Node.js v${NODE_VERSION} (20+ required for development)"
    else
        print_warning "Node.js v${NODE_VERSION} (20+ recommended)"
    fi
else
    print_info "Node.js not installed (optional - only needed for local development)"
fi

# Check 9: Git
if command -v git &> /dev/null; then
    print_success "Git is installed"
else
    print_warning "Git is not installed (recommended)"
fi

# Check 10: OffSec base image (if building agents)
print_header "Checking OffSec Base Image"
if docker images | grep -q "rtpi/offsec-base"; then
    IMAGE_SIZE=$(docker images rtpi/offsec-base:latest --format "{{.Size}}")
    print_success "OffSec base image exists ($IMAGE_SIZE)"
    print_info "You can build agent containers directly"
else
    print_info "OffSec base image not built (required for agent containers)"
    print_info "Build with: docker compose --profile build-only build offsec-base"
fi

# Summary
echo ""
print_header "Summary"
echo -e "Passed:   ${GREEN}$PASSED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "Failed:   ${RED}$FAILED${NC}"
echo ""

# Recommendations
if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        print_success "All checks passed! System is ready for deployment"
        echo ""
        echo -e "${GREEN}Recommended deployment:${NC}"
        echo -e "  ${BLUE}Core services:${NC}"
        echo -e "    docker compose up -d postgres redis rtpi-tools empire-server empire-proxy workbench-db workbench-api workbench-frontend"
    else
        print_warning "System is ready for deployment with some warnings"
        echo ""
        echo -e "${YELLOW}Review warnings above and address if needed${NC}"
        echo ""
        echo -e "${GREEN}Recommended deployment:${NC}"
        echo -e "  ${BLUE}Core services:${NC}"
        echo -e "    docker compose up -d postgres redis rtpi-tools empire-server empire-proxy workbench-db workbench-api workbench-frontend"
    fi
else
    print_fail "Some critical checks failed - resolve issues before deployment"
    echo ""
    echo -e "${RED}Fix the failed checks above before deploying${NC}"
fi

echo ""
print_info "For detailed deployment instructions, see: docs/DEPLOYMENT.md"
print_info "For troubleshooting, see: docs/troubleshooting/"
echo ""

exit 0
